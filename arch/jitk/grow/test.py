#!/usr/bin/env python3
"""Portable verifier: shipped small traces, fresh temporary repositories, no VM."""
import copy, json, pathlib, shutil, stat, subprocess, sys, unittest
from unittest.mock import patch
from runtime import *
from adapters import guest, linux, compare
from loop import validate_source, installation_patch
from agent import proposal, validate_proposal
from observations import observe, require_result
from profiles import PROFILES, mutations

FIXTURES=ROOT/'tests/fixtures'

class Verify(unittest.TestCase):
    def test_registered_enosys_and_argument_errors_are_retained(self):
        value=observe((FIXTURES/'rt_sigaction/guest.stdout').read_bytes())
        self.assertTrue(value['trace_complete'])
        self.assertFalse(value['missing'])
        self.assertEqual(value['registered_enosys'][0]['nr'],134)
        self.assertEqual(value['registered_enosys'][0]['ret'],-38)
        self.assertEqual(len(value['registered_enosys'][0]['args']),6)
        self.assertEqual(value['argument_errors'],value['registered_enosys'])
    def test_fatal_and_truncated_output_fail_closed(self):
        for raw in (b'\x1efatal control byte\n',b'\x1e{"v":2,"kind":"fatal"}\n',
                    (FIXTURES/'ppoll/guest.stdout').read_bytes()[:-20]):
            value=observe(raw)
            self.assertFalse(value['trace_complete'])
            with self.assertRaises(AssertionError):
                require_result(value,{'stdout_hex':'','stderr_hex':'','exit':0})
    def test_fd2_is_compared_as_bytes_and_guest_exit_is_independent(self):
        raw=(FIXTURES/'rt_sigaction/guest.stdout').read_bytes()
        raw=b'\x1e{"v":2,"kind":"log","hex":"00ff0a"}\n'+raw
        value=observe(raw)
        self.assertEqual(value['stderr_hex'],'00ff0a')
        with self.assertRaises(AssertionError):
            require_result(value,dict(value,exit=1))
        with self.assertRaises(AssertionError):
            require_result(value,dict(value,stderr_hex=''))
    def test_every_target_requires_independent_cases_and_mutants(self):
        for name,profile in PROFILES.items():
            self.assertTrue(all(profile['cases'].get(k) for k in ('semantic','error','state')))
            variants=mutations(name,(CANONICAL/f'src/syscalls/{name}.rs').read_text())
            self.assertGreaterEqual(len(variants),2)
            self.assertEqual(len(variants),len(set(variants.values())))
    def test_loader_failure_receipt(self):
        with scratch() as d:
            work=pathlib.Path(d)/'kernel';work.mkdir();(work/'build.sh').touch()
            out=pathlib.Path(d)/'out'
            with patch('runtime.run',side_effect=RuntimeError('ELF rejected: PT_INTERP')):
                with self.assertRaises(RuntimeError): build(work,out,pathlib.Path('/payload'),['probe'])
            self.assertEqual(json.loads((out/'failure.json').read_text())['class'],'loader-or-build-failure')
    def test_complete_differentials(self):
        for name in ('ppoll','rt_sigaction','rt_sigprocmask'):
            d=FIXTURES/name
            reference=json.loads((d/'linux.json').read_text())
            compare(reference,guest((d/'guest.stdout').read_bytes()))
            compare(reference,linux((d/'linux.strace').read_text(),bytes.fromhex(reference['stdout_hex']),b'',0))
    def test_missing_rejected(self):
        raw=(FIXTURES/'ppoll/guest.stdout').read_bytes().replace(b'"kind":"sys.enter"',b'"kind":"missing"',1)
        with self.assertRaisesRegex(AssertionError,'unregistered syscall'): guest(raw)
    def test_truncation_rejected(self):
        raw=(FIXTURES/'ppoll/guest.stdout').read_bytes()
        with self.assertRaises((AssertionError,ValueError)): guest(raw[:raw.index(b'"kind":"done"')-20])
    def test_buffer_difference_rejected(self):
        a=json.loads((FIXTURES/'ppoll/linux.json').read_text());b=copy.deepcopy(a)
        b['events'][0]['output'][0][2]=0
        with self.assertRaises(AssertionError): compare(a,b)
    def test_unknown_syscall_rejected(self):
        raw=(FIXTURES/'ppoll/guest.stdout').read_bytes().replace(b'"nr":73',b'"nr":999',1)
        with self.assertRaises(AssertionError): guest(raw)
    def test_enosys_profile_is_explicit(self):
        for name in ('rt_sigaction','rt_sigprocmask'):
            a=json.loads((FIXTURES/name/'linux.json').read_text());b=copy.deepcopy(a)
            self.assertEqual(a['events'][0]['ret'],-38)
            b['events'][0]['ret']=0
            with self.assertRaises(AssertionError): compare(a,b)
    def test_build_rejects_canonical_mutation(self):
        with scratch() as d:
            with self.assertRaises(AssertionError): build(CANONICAL,pathlib.Path(d)/'build',ROOT/'payload/lua-static',['lua'])
    def test_candidate_escape_rejected(self):
        for escape in ('unsafe {}','include!("x");','extern "C" {}','asm!("hvc 0");'):
            with self.assertRaises(AssertionError): validate_source('rt_sigaction','pub fn call(_: &[usize])->isize { '+escape+' -38 }')
    def test_group_kill_denied_still_reaps_owned_child(self):
        p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(30)'],start_new_session=True,env=SAFE_ENV)
        try:
            with patch('runtime.os.killpg',side_effect=PermissionError(1,'forced group denial')): kill_reap(p)
            self.assertEqual(p.returncode,-signal.SIGKILL)
        finally:
            if p.poll() is None: p.kill();p.wait()
    def test_already_applied_patch_is_noop(self):
        # This repository is constructed here. No saved receipt paths are read.
        with scratch() as d:
            base=pathlib.Path(d)/'base';base.mkdir()
            (base/'handler.rs').write_text('fixture original\n')
            run(['git','init','-q'],cwd=base)
            updated=pathlib.Path(d)/'updated';shutil.copytree(base,updated)
            (updated/'handler.rs').write_text('fixture changed\n')
            (updated/'new.rs').write_text('fixture added\n')
            names=['handler.rs','new.rs']
            change=installation_patch(base,updated,names)
            self.assertTrue(change)
            run(['git','apply','--check','-'],cwd=base,input_data=change.encode())
            run(['git','apply','-'],cwd=base,input_data=change.encode())
            self.assertEqual(installation_patch(base,updated,names),'')
    def test_output_matches_linux(self):
        rec,output=records((FIXTURES/'lua.stdout').read_bytes())
        self.assertEqual(output,(FIXTURES/'lua-linux.stdout').read_bytes())
        self.assertFalse(any(r['kind']=='missing' for r in rec))
    def test_canonical_copy_delete_replay(self):
        with scratch() as d:
            work=pathlib.Path(d)/'kernel';out=pathlib.Path(d)/'receipt';out.mkdir()
            src,before=copy_kernel(work)
            target=work/'src/syscalls/ppoll.rs';expected=target.read_text();target.unlink()
            value=proposal('ppoll',work,out,{},live=False)
            target.write_text(validate_proposal('ppoll',value))
            self.assertEqual(target.read_text(),expected)
            self.assertEqual(tree_hashes(src),before)
    def test_one_file_schema_enforced(self):
        for value in ({'path':'../escape','source':'x'}, {'path':'src/syscalls/ppoll.rs','source':'x','extra':[]},
                      [{'path':'src/syscalls/ppoll.rs','source':'x'}]):
            with self.assertRaises(AssertionError): validate_proposal('ppoll',value)
    def live_fixture(self,d):
        root=pathlib.Path(d);work=root/'work';work.mkdir();(work/'src').mkdir()
        (work/'src/syscalls.rs').write_text('// test helper API\n')
        out=root/'out';out.mkdir();(out/'oracle').mkdir();(out/'oracle/linux-00.strace').write_text('fixture\n')
        auth=root/'original-auth';auth.mkdir();(auth/'auth.json').write_text('{"fixture":"private-test-value"}')
        return work,out,auth
    def test_live_rails_and_private_auth_cleanup(self):
        with scratch() as d:
            work,out,auth=self.live_fixture(d);private_paths=[]
            def cli(cmd,**kw):
                private=pathlib.Path(kw['env']['CODEX_HOME']);private_paths.append(private)
                self.assertEqual(stat.S_IMODE(private.stat().st_mode),0o700)
                self.assertEqual(stat.S_IMODE((private/'auth.json').stat().st_mode),0o600)
                self.assertNotIn(private,work.parents)
                self.assertIn('--ephemeral',cmd);self.assertIn('--ignore-user-config',cmd)
                self.assertEqual(cmd[cmd.index('--sandbox')+1],'read-only')
                self.assertNotIn('OPENAI_API_KEY',kw['env'])
                schema=json.loads((out/'agent.schema.json').read_text())
                self.assertFalse(schema['additionalProperties'])
                self.assertEqual(schema['properties']['path']['enum'],['src/syscalls/rt_sigaction.rs'])
                dump(out/'agent.json',{'path':'src/syscalls/rt_sigaction.rs','source':'pub fn call(_: &[usize]) -> isize { -38 }'})
                return subprocess.CompletedProcess(cmd,0,b'',b'')
            with patch.dict(os.environ,{'CODEX_HOME':str(auth)}),patch('agent.shutil.which',return_value='/fixture/codex'),patch('agent.run',side_effect=cli):
                validate_proposal('rt_sigaction',proposal('rt_sigaction',work,out,{},live=True))
            self.assertTrue((auth/'auth.json').is_file())
            self.assertTrue(private_paths and all(not p.exists() for p in private_paths))
    def test_live_failure_cleans_auth_without_replay(self):
        with scratch() as d:
            work,out,auth=self.live_fixture(d);private_paths=[]
            def fail(cmd,**kw):
                private_paths.append(pathlib.Path(kw['env']['CODEX_HOME']));raise RuntimeError('CLI failed')
            with patch.dict(os.environ,{'CODEX_HOME':str(auth)}),patch('agent.shutil.which',return_value='/fixture/codex'),patch('agent.run',side_effect=fail):
                with self.assertRaisesRegex(RuntimeError,'CLI failed'): proposal('rt_sigaction',work,out,{},live=True)
            self.assertTrue(all(not p.exists() for p in private_paths))
            self.assertFalse((out/'agent.json').exists())

if __name__=='__main__': unittest.main()
