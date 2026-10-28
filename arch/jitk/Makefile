SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DOCS_BIN := $(ROOT)/docs/.work/bin
DELEGATE = "$(DOCS_BIN)/delegate"
DEPS = "$(ROOT)/tools/.work/bin/deps"

.PHONY: help doctor build test test-linux bench demo linux-nested loc tools deps deps-status ci
# The delegate guard, LOC counter and deps tool are scriptc binaries.
tools:
	+@$(MAKE) -s -C "$(ROOT)/docs" tools
	+@$(MAKE) -s -C "$(ROOT)/tools" tools
# Pinned external artifacts built once into the shared jitk cache; see
# README.md. Both: Node/npm, zig, the VMM. macOS: Hyperlight source, worker and
# snapshot. Both: the shard binary (Linux `real`, macOS the HVF engine `hvf`;
# `make -C shard snapshot` adds the prepared snapshots).
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
# CI on a Linux arm64 host (tools/ci.sh; .github/workflows/jitk-ci.yml): doctor,
# deps, the Linux-capable suites and builds, the KVM suites when /dev/kvm is
# usable; each skip says why.
ci:
	@sh "$(ROOT)/tools/ci.sh"
help:
	@printf '%s\n' 'doctor: check this host (run first)' 'ci: every Linux arm64 check (CI entrypoint)' 'deps: pinned Node/npm, zig, VMM, Hyperlight into the jitk cache' 'build: kernel, VMM, executor, MCP server' 'test: every subtree suite (macOS: with the shard HVF suite, make -C shard test-hvf)' 'test-linux: the backend-parity corpus on a Linux KVM host (shard + libkrun)' 'bench: canonical area-06 harness' 'demo: executor, syscall regrowth, Lua (H2)' 'linux-nested: area-05 nested KVM suite' 'loc: owned-source inventory'
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
ifeq ($(shell uname -s),Darwin)
	@# The HVF engine's prepared snapshots, for the executor suite and the
	@# parity corpus's hvf backend (executor/parity/README.md).
	+@$(MAKE) -s -C "$(ROOT)/shard" snapshot
endif
	+@$(DELEGATE) executor test
	+@$(DELEGATE) executor parity
	+@$(DELEGATE) executor/policy test
	+@$(DELEGATE) mcp test
	+@$(DELEGATE) grow test
	+@$(DELEGATE) bench test
	+@$(DELEGATE) bench/hyperlight test
	+@$(DELEGATE) linux test
ifeq ($(shell uname -s),Darwin)
	+@$(DELEGATE) shard test-hvf
endif
# Linux arm64 KVM host, from a clean clone: the backend-parity corpus
# (executor/parity/README.md) on the shard and on libkrun, then the shard's
# library tests, the shard-only executor suite (executor/shard-check.ts) and
# the KVM tests. Writes executor/.work/parity/linux-arm64.json for the
# cross-host compare. On a shared host set JITK_BENCH_LOCK (kvm-dev:
# /home/dev/bench.lock) so the KVM timing tests do not overlap a benchmark.
test-linux: deps
	@[ "$$(uname -s)" = Linux ] || { echo 'test-linux needs a Linux arm64 KVM host (from the Mac: make -C executor parity-ssh)' >&2; exit 2; }
	+@$(MAKE) -s -C "$(ROOT)/shard" snapshot
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	@# libkrun runs kernel/dist/kernel.bin, which must match kernel/.READY's hash:
	@# Linux builds the Mac's bytes (kernel/ARCH.md "Image identity").
	+@$(DELEGATE) executor parity
	+@$(MAKE) -s -C "$(ROOT)/shard" test
	+@$(MAKE) -s -C "$(ROOT)/executor" .work/bin/fixtures/shard-peer
	+@$(LOCKED) $(MAKE) -s -C "$(ROOT)/executor" test-shard
	+@$(LOCKED) $(MAKE) -s -C "$(ROOT)/shard" test-kvm
# Timing-sensitive KVM suites wait for the shared bench lock when one is named.
LOCKED = $(if $(JITK_BENCH_LOCK),flock -w $${JITK_SHARD_LOCK_WAIT:-600} "$(JITK_BENCH_LOCK)")
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
