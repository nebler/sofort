# Owner entrypoints for docs/delegate.py. build installs the locked SDK locally
# (scripts disabled) and syntax-checks; test/bench need built executor, VMM, kernel.
NODE_BIN = $(or $(JITK_NODE),$(error set JITK_NODE to an absolute Node >=24 executable; see README.md))
NPM_CLI = $(or $(JITK_NPM_CLI),$(error set JITK_NPM_CLI to npm-cli.js; see README.md))
NPM_CACHE = $(or $(JITK_NPM_CACHE),$(or $(TMPDIR),/tmp)/jitk-npm-cache)

.PHONY: build test bench
build:
	"$(NODE_BIN)" "$(NPM_CLI)" ci --ignore-scripts --no-audit --no-fund --prefer-offline --cache "$(NPM_CACHE)"
	for f in jitk.mjs server.mjs test.mjs bench.mjs providers/*.mjs; do "$(NODE_BIN)" --check $$f || exit 1; done
test:
	"$(NODE_BIN)" test.mjs
bench:
	"$(NODE_BIN)" bench.mjs
