.PHONY: build test spike grow clean
SCRIPTC := node_modules/.bin/scriptc
SOURCES := $(wildcard *.ts)

node_modules/.bin/scriptc: package.json package-lock.json
	npm ci --no-audit --no-fund

build: build/grow

build/grow: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build main.ts -o $@

build/test: $(SOURCES) $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build test.ts -o $@

test: build/test
	build/test

spike: $(SCRIPTC)
	mkdir -p build
	$(SCRIPTC) build spike/main.ts -o build/spike
	build/spike --probe yes

grow: build
	build/grow --run-id run-$$(date +%Y%m%dT%H%M%S) --validate-only $(ARGS)

clean:
	rm -rf build .scriptc
