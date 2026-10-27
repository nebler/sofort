# Makefile defaults for the artifacts `make -C arch/jitk deps` builds: an
# explicitly set variable wins, then the cache path (tools/.work/bin/deps), and
# a missing artifact stops make naming the target. Usage: $(call jitk_artifact,JITK_NODE)
JITK_DEPS := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))/.work/bin/deps
jitk_artifact = $(or $($(1)),$(shell "$(JITK_DEPS)" path $(1)),$(error $(1) is unset and not built; run `make -C arch/jitk deps` or set $(1)))
