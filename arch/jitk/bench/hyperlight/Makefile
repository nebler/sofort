.PHONY: build test
build:
	sh build.sh
test:
	@if [ -z "$$HYPERLIGHT_JS_SRC" ]; then \
	  printf '%s\n' 'SKIP: 13 adapter checks: HYPERLIGHT_JS_SRC is unset; see README.md for source/build setup'; \
	else \
	  case "$(JITK_NODE)" in /*) ;; *) echo 'Set JITK_NODE to a verified absolute Node >=24 executable' >&2; exit 2;; esac; \
	  "$(JITK_NODE)" --experimental-transform-types adapter-test.ts; \
	fi
