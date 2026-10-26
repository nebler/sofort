.DEFAULT_GOAL := build
.PHONY: build test bench smoke clean
SCRIPTC := node_modules/.bin/scriptc
SOURCES := $(wildcard *.ts ledger/*.ts hyperlight/*.ts)
PROGRAMS := analysis-test gate run watchdog test-child load-monitor recertify ledger ledger-report ledger-verify ledger-waves hvf-control hyperlight-analyze hyperlight-bench parity

$(SCRIPTC): package.json package-lock.json
	npm ci --no-audit --no-fund

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

build/recertify: recertify.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
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

build/parity: parity.ts $(SOURCES) ffi.json build/native.o $(SCRIPTC)
	$(SCRIPTC) build $< --ffi ffi.json -o $@

test: build
	build/run --test
	build/parity --test
	build/analysis-test

bench: build
	/usr/bin/lockf -k /tmp/sofort-bench.lock build/run $(BENCH_ARGS)

smoke: build
	/usr/bin/lockf -k /tmp/sofort-bench.lock build/run --smoke $(BENCH_ARGS)

clean:
	rm -rf build .scriptc
