.PHONY: build test grow demo experiments clean oracle
SCRIPTC := node_modules/.bin/scriptc
SOURCES := $(wildcard *.ts)
ZIG ?= /Users/noah/.local/share/zig-0.16.0/zig

$(SCRIPTC): package.json package-lock.json
	npm ci --no-audit --no-fund

build: kernel-tools build/grow build/oracle-profile build/experiments build/parity build/sqlite-checks

.PHONY: kernel-tools
kernel-tools: build/kernel-tools/prepare build/kernel-tools/build-args build/kernel-tools/artifact

build/kernel-tools/native.o: ../kernel/native.c
	mkdir -p build/kernel-tools
	clang -c $< -o $@

build/kernel-tools/ffi.json: ../kernel/native-ffi.json build/kernel-tools/native.o
	node -e 'const fs=require("fs"),p=require("path"),v=JSON.parse(fs.readFileSync("../kernel/native-ffi.json"));v.libraries=[p.resolve("build/kernel-tools/native.o")];fs.writeFileSync("$@",JSON.stringify(v))'

build/kernel-tools/%: ../kernel/%.ts $(wildcard ../kernel/*.ts) build/kernel-tools/ffi.json $(SCRIPTC)
	$(SCRIPTC) build $< --ffi build/kernel-tools/ffi.json -o $@

build/grow: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build main.ts -o $@

build/test: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build test.ts -o $@

test: build/test
	build/test

build/oracle-profile: oracle-profile.ts lib.ts $(SCRIPTC) package-lock.json
	mkdir -p build
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build oracle-profile.ts -o $@

oracle: build/oracle-profile

build/experiments: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build experiments-main.ts -o $@

build/parity: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build parity-main.ts -o $@

build/sqlite-checks: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build sqlite-checks.ts -o $@

build/e2: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build e2.ts -o $@

grow: build
	build/grow --run-id run-$$(date +%Y%m%dT%H%M%S) --validate-only $(ARGS)

demo: grow

experiments: build
	build/experiments $(ARGS)

clean:
	-rm -r build .scriptc
