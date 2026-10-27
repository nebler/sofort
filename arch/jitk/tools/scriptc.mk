# Generic rule for components whose tools are top-level <name>.ts files built
# to .work/bin/<name> (set TS_TOOLS, SCRIPTC_FLAGS and TS_EXTRA_DEPS first).
include $(dir $(lastword $(MAKEFILE_LIST)))pin.mk
# Kept for the Makefiles' Linux rules, which name the runtime pack through it.
TOOLS_PACKAGE := $(JITK_TOOLS)
TS_SOURCES := $(shell find . -name '*.ts' -not -path './node_modules/*' -not -path './.work/*' -not -path './build/*') $(TSLIB_SOURCES)
TS_TOOLS ?= $(filter-out lib.ts,$(wildcard *.ts))
.PHONY: tools
tools: $(patsubst %.ts,.work/bin/%,$(TS_TOOLS))
.work/bin/%: %.ts $(TS_SOURCES) $(SCRIPTC) $(TS_EXTRA_DEPS)
	mkdir -p $(@D)
	$(SCRIPTC) build $< $(SCRIPTC_FLAGS) -o $@
