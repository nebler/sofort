"""Delegated suites run in place and may only create ignored build/test output."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('delegate', Path(__file__).with_name('delegate.py'))
delegate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delegate)


class DelegateTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / 'jitk'
        self.owner = self.root / 'kernel'
        self.owner.mkdir(parents=True)
        (self.root / '.gitignore').write_text('.work/\n')
        (self.owner / 'README.md').write_text('fixture owner')
        (self.owner / 'receipt.json').write_text('recorded')
        self.recipe('mkdir -p .work; pwd > .work/cwd')
        self.git('init', '-q')
        self.git('add', '.')
        self.git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid',
                 'commit', '-qm', 'fixture')

    def git(self, *args):
        return subprocess.check_output(['git', '-C', str(self.root), *args], text=True)

    def recipe(self, command):
        (self.owner / 'Makefile').write_text('test:\n\t' + command + '\n')

    def run_suite(self):
        with patch.object(delegate, 'ROOT', self.root), \
             patch.object(sys, 'argv', ['delegate', 'kernel', 'test']), \
             patch.dict(os.environ, {'MAKEFLAGS': ''}):
            return delegate.main()

    def test_in_place_output_and_preexisting_dirty_receipt(self):
        (self.owner / 'receipt.json').write_text('local edit')
        before = self.git('status', '--porcelain')
        self.assertEqual(self.run_suite(), 0)
        self.assertEqual((self.owner / '.work/cwd').read_text().strip(), str(self.owner.resolve()))
        self.assertEqual(self.git('status', '--porcelain'), before)
        self.assertEqual((self.owner / 'receipt.json').read_text(), 'local edit')

    def test_tracked_receipt_mutation_fails_without_restoring_it(self):
        self.recipe('printf rewritten > receipt.json')
        self.assertNotEqual(self.run_suite(), 0)
        self.assertEqual((self.owner / 'receipt.json').read_text(), 'rewritten')

    def test_mutating_already_dirty_receipt_fails(self):
        self.recipe('printf rewritten > receipt.json')
        (self.owner / 'receipt.json').write_text('local edit')
        before = self.git('status', '--porcelain')
        self.assertNotEqual(self.run_suite(), 0)
        self.assertEqual(self.git('status', '--porcelain'), before)

    def test_unignored_new_output_fails(self):
        self.recipe('printf unexpected > unexpected.json')
        self.assertNotEqual(self.run_suite(), 0)

    def test_failed_suite_preserves_exit_code(self):
        self.recipe('exit 7')
        self.assertEqual(self.run_suite(), 2)  # make reports a failed recipe as 2

    def test_failed_suite_mutation_is_also_reported(self):
        self.recipe('printf rewritten > receipt.json; exit 7')
        self.assertNotEqual(self.run_suite(), 0)
        self.assertEqual((self.owner / 'receipt.json').read_text(), 'rewritten')


if __name__ == '__main__':
    unittest.main()
