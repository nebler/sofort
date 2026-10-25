.PHONY: build test demo grow
build:
	python3 -B prepare.py
test:
	python3 -B test.py
	python3 -B -m unittest discover -s oracle -p 'test_*.py'
grow: build
	python3 -B loop.py --run-id run-$$(date +%Y%m%dT%H%M%S) $(ARGS)
demo:
	python3 -B demo.py $(ARGS)
