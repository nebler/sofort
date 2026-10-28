SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DOCS_BIN := $(ROOT)/docs/.work/bin
DELEGATE = "$(DOCS_BIN)/delegate"
DEPS = "$(ROOT)/tools/.work/bin/deps"

.PHONY: help doctor build test test-linux bench demo linux-nested loc tools deps deps-status
# The delegate guard, LOC counter and deps tool are scriptc binaries.
tools:
	+@$(MAKE) -s -C "$(ROOT)/docs" tools
	+@$(MAKE) -s -C "$(ROOT)/tools" tools
# Pinned external artifacts built once into the shared jitk cache; see
# README.md. Both: Node/npm, zig, the VMM. macOS: Hyperlight source, worker and
# snapshot. Linux: the shard binary (`make -C shard snapshot` adds the
# prepared snapshots).
deps: tools
	+@$(MAKE) -s -C "$(ROOT)/vmm" .work/bin/build
ifeq ($(shell uname -s),Darwin)
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
	@printf '%s\n' 'doctor: check this host (run first)' 'deps: pinned Node/npm, zig, VMM, Hyperlight into the jitk cache' 'build: kernel, VMM, executor, MCP server' 'test: every subtree suite' 'test-linux: the backend-parity corpus on a Linux KVM host (shard + libkrun)' 'bench: canonical area-06 harness' 'demo: executor, syscall regrowth, Lua (H2)' 'linux-nested: area-05 nested KVM suite' 'loc: owned-source inventory'
build: deps
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) vmm build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	+@$(DELEGATE) executor build
	+@$(DELEGATE) mcp build
	+@$(DELEGATE) grow build
# The layering lint (tools/layering.ts) runs first: abi <- guest <- engine <- host <- research;
# then the ABI crate, whose test fails while a generated copy (abi/README.md) is stale.
test: deps
	@"$(ROOT)/tools/.work/bin/layering" --self-test
	+@$(DELEGATE) abi test
	+@$(DELEGATE) kernel test
	+@$(DELEGATE) vmm test
	+@$(DELEGATE) vmm/sandbox test
	+@$(DELEGATE) protocol test
	+@$(DELEGATE) executor test
	+@$(DELEGATE) executor parity
	+@$(DELEGATE) executor/policy test
	+@$(DELEGATE) mcp test
	+@$(DELEGATE) grow test
	+@$(DELEGATE) bench test
	+@$(DELEGATE) bench/hyperlight test
	+@$(DELEGATE) linux test
# Linux arm64 KVM host, from a clean clone: the backend-parity corpus
# (executor/parity/README.md) on the shard and on libkrun, then the shard's
# library and KVM tests. Writes executor/.work/parity/linux-arm64.json for the
# cross-host compare. On a shared host set JITK_BENCH_LOCK (kvm-dev:
# /home/dev/bench.lock) so the KVM timing tests do not overlap a benchmark.
test-linux: deps
	@[ "$$(uname -s)" = Linux ] || { echo 'test-linux needs a Linux arm64 KVM host (from the Mac: make -C executor parity-ssh)' >&2; exit 2; }
	+@$(MAKE) -s -C "$(ROOT)/shard" snapshot
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	@# The image just built from this tree: kernel/.READY records the Mac build's
	@# hash, and a Linux-hosted build lays out a few functions differently.
	+@JITK_KERNEL_IMAGE="$(ROOT)/kernel/dist/kernel.bin" $(DELEGATE) executor parity
	+@$(MAKE) -s -C "$(ROOT)/shard" test
	+@if [ -n "$$JITK_BENCH_LOCK" ]; then flock -w "$${JITK_SHARD_LOCK_WAIT:-600}" "$$JITK_BENCH_LOCK" $(MAKE) -s -C "$(ROOT)/shard" test-kvm; else $(MAKE) -s -C "$(ROOT)/shard" test-kvm; fi
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
