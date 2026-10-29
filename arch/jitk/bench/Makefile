.DEFAULT_GOAL := build
.PHONY: build test bench smoke clean
include ../tools/pin.mk
SOURCES := $(wildcard *.ts ledger/*.ts hyperlight/*.ts) $(TSLIB_SOURCES)
PROGRAMS := analysis-test gate run watchdog test-child load-monitor ledger ledger-report ledger-verify ledger-waves hvf-control hyperlight-analyze hyperlight-bench hyperlight-build parity

build/native.o: native.c
	mkdir -p build
	$(CC) -O2 -c $< -o $@

build: $(addprefix build/,$(PROGRAMS))

build/run: run.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/watchdog: watchdog.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/test-child: test-child.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/ledger: ledger/ledger.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/hyperlight-analyze: hyperlight/analyze.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/analysis-test: analysis-test.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/gate: gate.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/load-monitor: load-monitor.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/ledger-report: ledger/report.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/ledger-verify: ledger/verify.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/ledger-waves: ledger/waves.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/hvf-control: ledger/hvf_control.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/hyperlight-bench: hyperlight/bench.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

build/hyperlight-build: hyperlight/build.ts $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build $< -o $@

build/parity: parity.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

test: build
	build/run --test
	build/parity --test
	build/analysis-test

# The recorded ledger memory replay; its inputs are not in the repository:
# JITK_LEDGER_INPUTS=/absolute/ledger-collection make test-memory.
.PHONY: test-memory
test-memory: build/analysis-test
	build/analysis-test --memory

bench: build
	/usr/bin/lockf -k /tmp/sofort-bench.lock build/run $(BENCH_ARGS)

smoke: build
	/usr/bin/lockf -k /tmp/sofort-bench.lock build/run --smoke $(BENCH_ARGS)

clean:
	rm -rf build .scriptc
