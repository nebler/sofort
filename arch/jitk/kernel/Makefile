.PHONY: all build test
all: build
build:
	sh build.sh
test: build
	python3 tests/test_packer.py
	python3 tests/test_handlers.py
	python3 tests/test_fs.py
	python3 tests/regression.py
	python3 tests/fs_diff.py
