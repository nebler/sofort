.PHONY: all build test ring
all: build
build:
	sh build.sh
ring:
	sh build-ring.sh
test: build
	python3 tests/test_packer.py
	python3 tests/test_handlers.py
	python3 tests/test_fs.py
	python3 tests/regression.py
	python3 tests/fs_diff.py
