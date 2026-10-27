# The single scriptc 0.4.5 pin for arch/jitk: package.json and package-lock.json
# in this directory, installed once into ./node_modules. Include it before the
# rules that use $(SCRIPTC); it keeps the including Makefile's default goal.
JITK_TOOLS := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SCRIPTC := $(JITK_TOOLS)/node_modules/.bin/scriptc
# Static aarch64 Linux builds: SCRIPTC_TARGET=aarch64-linux-musl, zig cc as
# the linker, and this runtime pack (SCRIPTC_RUNTIME_PACK).
SCRIPTC_RUNTIME_LINUX := $(JITK_TOOLS)/node_modules/@scriptc/runtime-linux-arm64-musl
ZIG ?= /Users/noah/.local/share/zig-0.16.0/zig
# Every tool imports ../tslib; rebuild when it changes.
TSLIB_SOURCES := $(wildcard $(JITK_TOOLS)/../tslib/*.ts)
jitk_goal := $(.DEFAULT_GOAL)
$(SCRIPTC): $(JITK_TOOLS)/package.json $(JITK_TOOLS)/package-lock.json
	npm ci --prefix $(JITK_TOOLS) --no-audit --no-fund
.DEFAULT_GOAL := $(jitk_goal)
