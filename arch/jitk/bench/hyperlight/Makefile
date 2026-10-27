include ../../tools/deps.mk
.PHONY: build test
build:
	sh build.sh
# adapter-test.ts resolves the source, worker and snapshot itself (explicit
# variables, else the `make -C arch/jitk deps` cache) and fails when missing.
test:
	"$(call jitk_artifact,JITK_NODE)" --experimental-transform-types adapter-test.ts
