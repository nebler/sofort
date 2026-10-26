TS_TOOLS := delegate.ts count-loc.ts test_delegate.ts test_receipts.ts
include scriptc.mk
.PHONY: test
test: tools
	$(MAKE) -C ../protocol tools
	$(MAKE) -C ../kernel .work/bin/artifact
	.work/bin/test_delegate
	.work/bin/test_receipts
