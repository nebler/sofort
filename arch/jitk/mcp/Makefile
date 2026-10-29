# Owner entrypoints for docs/delegate.ts. build installs the locked SDK locally
# (scripts disabled) and syntax-checks; test/bench need the SDK, the built
# executor (`make -C ../executor build`, which `make -C .. test` runs first)
# and the ring engine (JITK_SHARD_BINARY, JITK_SHARD_SNAPSHOT; macOS: its
# parking gate).
include ../tools/deps.mk
NODE_BIN = $(call jitk_artifact,JITK_NODE)
NPM_CLI = $(call jitk_artifact,JITK_NPM_CLI)
NPM_CACHE = $(or $(JITK_NPM_CACHE),$(or $(TMPDIR),/tmp)/jitk-npm-cache)
# npm ci writes this file last; it stands for the installed node_modules.
INSTALLED := node_modules/.package-lock.json

.PHONY: build test bench
$(INSTALLED): package.json package-lock.json
	"$(NODE_BIN)" "$(NPM_CLI)" ci --ignore-scripts --no-audit --no-fund --prefer-offline --cache "$(NPM_CACHE)"
build: $(INSTALLED)
	for f in jitk.mjs native.mjs native-test.mjs native-linux-test.mjs server.mjs test.mjs bench.mjs providers/*.mjs; do "$(NODE_BIN)" --check $$f || exit 1; done
test: $(INSTALLED)
	"$(NODE_BIN)" native-test.mjs
	"$(NODE_BIN)" test.mjs
bench: $(INSTALLED)
	"$(NODE_BIN)" bench.mjs
