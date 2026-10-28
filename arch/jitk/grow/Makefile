.PHONY: build test grow demo experiments clean oracle
include ../tools/pin.mk
SOURCES := $(wildcard *.ts) $(TSLIB_SOURCES)

build: kernel-tools build/grow build/oracle-profile build/oracle-root build/experiments build/parity build/sqlite-checks

.PHONY: kernel-tools
kernel-tools: build/kernel-tools/prepare build/kernel-tools/build-args build/kernel-tools/artifact

build/kernel-tools/native.o: ../kernel/native.c
	mkdir -p build/kernel-tools
	clang -c $< -o $@

build/kernel-tools/ffi.json: ../kernel/native-ffi.json build/kernel-tools/native.o
	node -e 'const fs=require("fs"),p=require("path"),v=JSON.parse(fs.readFileSync("../kernel/native-ffi.json"));v.libraries=[p.resolve("build/kernel-tools/native.o")];fs.writeFileSync("$@",JSON.stringify(v))'

build/kernel-tools/%: ../kernel/%.ts $(wildcard ../kernel/*.ts) $(TSLIB_SOURCES) build/kernel-tools/ffi.json $(SCRIPTC)
	$(SCRIPTC) build $< --ffi build/kernel-tools/ffi.json -o $@

build/grow: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build main.ts -o $@

build/test: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build test.ts -o $@

test: build/test
	build/test

build/oracle-profile: oracle-profile.ts oracle-trace.ts lib.ts $(TSLIB_SOURCES) $(SCRIPTC)
	mkdir -p build
	PATH="$(dir $(ZIG)):$$PATH" SCRIPTC_TARGET=aarch64-linux-musl $(SCRIPTC) build oracle-profile.ts -o $@

# Shared-tree launcher (static aarch64 musl), mounted into the unchanged oracle
# image. The pinned toolchain's aarch64-unknown-linux-musl target links it with
# its own musl (libc.a, crt objects) through rust-lld: no C toolchain. Needs
# `rustup target add --toolchain $(RUST_TOOLCHAIN) aarch64-unknown-linux-musl`.
build/oracle-root: oracle-root.rs
	mkdir -p build
	rustc +$(RUST_TOOLCHAIN) --edition=2024 --target aarch64-unknown-linux-musl -D warnings -C panic=abort -C opt-level=s -C strip=symbols -C target-feature=+crt-static -C link-self-contained=yes -C linker=rust-lld -C linker-flavor=ld.lld --remap-path-prefix=$(CURDIR)=arch/jitk/grow $< -o $@

oracle: build/oracle-profile build/oracle-root

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

build/e3: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build e3.ts -o $@

build/auto-grow: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build auto-grow.ts -o $@

grow: build
	build/grow --run-id run-$$(date +%Y%m%dT%H%M%S) --validate-only $(ARGS)

demo: grow

experiments: build
	build/experiments $(ARGS)

clean:
	-rm -r build .scriptc

build/phase2: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build phase2-main.ts -o $@
