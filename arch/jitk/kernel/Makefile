.PHONY: all build test ring
all: build
build:
	sh build.sh
ring:
	sh build-ring.sh
test: build
	python3 build-checks.py
	python3 ../docs/test_delegate.py
	python3 ../docs/test_receipts.py
	python3 tests/test_packer.py
	python3 tests/test_handlers.py
	python3 tests/test_fs.py
	python3 tests/regression.py
	python3 tests/fs_diff.py
	"$${NODE:-node}" tests/ring-bootstrap-check.mjs

.PHONY: fmt check
fmt:
	cargo +1.95.0 fmt
	python3 format.py
check:
	sh check.sh
