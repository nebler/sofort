# The single scriptc 0.4.5 pin for arch/jitk: package.json and package-lock.json
# in this directory, installed once into ./node_modules. Include it before the
# rules that use $(SCRIPTC); it keeps the including Makefile's default goal.
JITK_TOOLS := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SCRIPTC := $(JITK_TOOLS)/node_modules/.bin/scriptc
# Static aarch64 Linux builds: SCRIPTC_TARGET=aarch64-linux-musl, zig cc as
# the linker, and this runtime pack (SCRIPTC_RUNTIME_PACK).
SCRIPTC_RUNTIME_LINUX := $(JITK_TOOLS)/node_modules/@scriptc/runtime-linux-arm64-musl
ZIG ?= $(or $(shell command -v zig),$(HOME)/.local/share/zig-0.16.0/zig)
# The pinned Rust toolchain (deps.json rust_toolchain): every Makefile cargo
# call is $(CARGO_PIN). rustup's bin directory is appended to PATH for hosts
# whose non-login shells lack it (kvm-dev over ssh).
RUST_TOOLCHAIN := $(shell sh $(JITK_TOOLS)/rust-toolchain.sh)
CARGO_PIN = cargo +$(RUST_TOOLCHAIN)
export PATH := $(PATH):$(or $(CARGO_HOME),$(HOME)/.cargo)/bin
# Every tool imports ../tslib; rebuild when it changes.
TSLIB_SOURCES := $(wildcard $(JITK_TOOLS)/../tslib/*.ts)
jitk_goal := $(.DEFAULT_GOAL)
$(SCRIPTC): $(JITK_TOOLS)/package.json $(JITK_TOOLS)/package-lock.json
	sh $(JITK_TOOLS)/npm.sh ci --prefix $(JITK_TOOLS) --no-audit --no-fund
.DEFAULT_GOAL := $(jitk_goal)
