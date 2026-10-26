SCRIPTC := $(abspath $(dir $(lastword $(MAKEFILE_LIST)))/node_modules/.bin/scriptc)
TOOLS_PACKAGE := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
TS_SOURCES := $(shell find . -name '*.ts' -not -path './node_modules/*' -not -path './.work/*' -not -path './build/*')
TS_TOOLS ?= $(filter-out lib.ts,$(wildcard *.ts))
.PHONY: tools
tools: $(patsubst %.ts,.work/bin/%,$(TS_TOOLS))
$(SCRIPTC): $(TOOLS_PACKAGE)/package.json $(TOOLS_PACKAGE)/package-lock.json
	npm ci --prefix $(TOOLS_PACKAGE) --no-audit --no-fund
.work/bin/%: %.ts $(TS_SOURCES) $(SCRIPTC) $(TS_EXTRA_DEPS)
	mkdir -p $(@D)
	$(SCRIPTC) build $< $(SCRIPTC_FLAGS) -o $@
