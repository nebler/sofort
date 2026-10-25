.PHONY: build test bench smoke
build:
	python3 -c 'import ast,pathlib; [ast.parse(p.read_text()) for p in pathlib.Path(".").glob("*.py")]'
test:
	python3 run.py --test
bench:
	python3 -u run.py $(BENCH_ARGS)
smoke:
	python3 -u run.py --smoke --gate-budget 0
