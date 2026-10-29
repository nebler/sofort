TS_TOOLS := delegate.ts count-loc.ts test_delegate.ts test_links.ts test_receipts.ts
include ../tools/scriptc.mk
.PHONY: test links
test: tools
	.work/bin/test_links
	$(MAKE) -C ../protocol tools
	$(MAKE) -C ../kernel .work/bin/artifact
	.work/bin/test_delegate
	.work/bin/test_receipts
# The link check alone (relative links and anchors in arch/jitk/**/*.md).
links: .work/bin/test_links
	.work/bin/test_links
