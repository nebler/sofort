SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DOCS_BIN := $(ROOT)/docs/.work/bin
DELEGATE = "$(DOCS_BIN)/delegate"

.PHONY: help build test bench demo linux-nested loc tools
# The delegate guard and LOC counter are scriptc binaries built by docs/.
tools:
	+@$(MAKE) -s -C "$(ROOT)/docs" tools
help:
	@printf '%s\n' 'build: kernel, VMM, executor, MCP server' 'test: every subtree suite' 'bench: canonical area-06 harness' 'demo: executor, syscall regrowth, Lua (H2)' 'linux-nested: area-05 nested KVM suite' 'loc: owned-source inventory'
build: tools
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) vmm build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	+@$(DELEGATE) executor build
	+@$(DELEGATE) mcp build
	+@$(DELEGATE) grow build
test: tools
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
bench: tools
	+@$(DELEGATE) bench bench
demo: tools
	+@$(DELEGATE) executor demo
	+@$(DELEGATE) grow grow
	+@$(DELEGATE) grow demo
linux-nested: tools
	+@$(DELEGATE) linux nested
loc: tools
	@"$(DOCS_BIN)/count-loc"
