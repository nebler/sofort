SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DOCS_BIN := $(ROOT)/docs/.work/bin
DELEGATE = "$(DOCS_BIN)/delegate"
DEPS = "$(ROOT)/tools/.work/bin/deps"

.PHONY: help doctor build test bench demo linux-nested loc tools deps deps-status
# The delegate guard, LOC counter and deps tool are scriptc binaries.
tools:
	+@$(MAKE) -s -C "$(ROOT)/docs" tools
	+@$(MAKE) -s -C "$(ROOT)/tools" tools
# Pinned external artifacts built once into the shared jitk cache; see
# README.md. Both: Node/npm, zig. macOS: VMM, Hyperlight source, worker and snapshot.
# Linux: the shard binary (`make -C shard snapshot` adds the
# prepared snapshots).
deps: tools
ifeq ($(shell uname -s),Darwin)
	+@$(MAKE) -s -C "$(ROOT)/vmm" .work/bin/build
	+@$(MAKE) -s -C "$(ROOT)/bench" build/hyperlight-build
endif
	@$(DEPS) build
deps-status: tools
	@$(DEPS) status
# Host check: toolchains, native tools, deps cache, Docker, the Linux dev VM;
# one line per item with its fix (tools/doctor.ts). Fails only on hard
# requirements.
doctor:
	+@$(MAKE) -s -C "$(ROOT)/tools" tools
	@"$(ROOT)/tools/.work/bin/doctor"
help:
	@printf '%s\n' 'doctor: check this host (run first)' 'deps: pinned Node/npm, zig, VMM, Hyperlight into the jitk cache' 'build: kernel, VMM, executor, MCP server' 'test: every subtree suite' 'bench: canonical area-06 harness' 'demo: executor, syscall regrowth, Lua (H2)' 'linux-nested: area-05 nested KVM suite' 'loc: owned-source inventory'
build: deps
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) vmm build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	+@$(DELEGATE) executor build
	+@$(DELEGATE) mcp build
	+@$(DELEGATE) grow build
test: deps
	+@$(DELEGATE) kernel test
	+@$(DELEGATE) vmm test
	+@$(DELEGATE) vmm/sandbox test
	+@$(DELEGATE) protocol test
	+@$(DELEGATE) executor test
	+@$(DELEGATE) executor/policy test
	+@$(DELEGATE) mcp test
	+@$(DELEGATE) grow test
	+@$(DELEGATE) bench test
	+@$(DELEGATE) bench/hyperlight test
	+@$(DELEGATE) linux test
bench: deps
	+@$(DELEGATE) bench bench
demo: deps
	+@$(DELEGATE) executor demo
	+@$(DELEGATE) grow grow
	+@$(DELEGATE) grow demo
linux-nested: tools
	+@$(DELEGATE) linux nested
loc: tools
	@"$(DOCS_BIN)/count-loc"
