SHELL := /bin/sh
.DEFAULT_GOAL := help
ROOT := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
DELEGATE = python3 "$(ROOT)/docs/delegate.py"

.PHONY: help build test bench demo linux-nested loc
help:
	@printf '%s\n' 'build: kernel, VMM, executor, MCP server' 'test: every subtree suite' 'bench: canonical area-06 harness' 'demo: executor, syscall regrowth, Lua (H2)' 'linux-nested: area-05 nested KVM suite' 'loc: owned-source inventory'
build:
	+@$(DELEGATE) kernel build
	+@$(DELEGATE) vmm build
	+@$(DELEGATE) protocol build
	+@$(DELEGATE) executor dependencies
	+@$(DELEGATE) executor build
	+@$(DELEGATE) mcp build
test:
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
bench:
	+@$(DELEGATE) bench bench
demo:
	+@$(DELEGATE) executor demo
	+@$(DELEGATE) grow grow
	+@$(DELEGATE) grow demo
linux-nested:
	+@$(DELEGATE) linux nested
loc:
	@python3 "$(ROOT)/docs/count-loc.py"
