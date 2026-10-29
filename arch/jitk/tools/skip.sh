#!/bin/sh
# skip.sh NAME REASON: a check that cannot run here. Prints the reason and
# exits 0 when NAME is listed in JITK_ALLOW_SKIP (comma- or space-separated
# names), else exits 1: an unexpected skip fails the suite. The TS twin is
# ../tslib/skip.ts; README.md "CI" lists the names.
name=$1
reason=$2
for allowed in $(printf '%s' "${JITK_ALLOW_SKIP:-}" | tr ',' ' '); do
  if [ "$allowed" = "$name" ]; then
    echo "SKIP $name: $reason (allowed by JITK_ALLOW_SKIP)"
    exit 0
  fi
done
echo "FAIL $name skipped: $reason; set JITK_ALLOW_SKIP=$name to allow it" >&2
exit 1
