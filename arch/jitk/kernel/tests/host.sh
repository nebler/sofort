#!/bin/sh
# Integrated test CLI adapter; JITK_TEST_HOST can select a legacy positional host.
set -eu
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
VMM=${JITK_VMM_BINARY:-$HERE/../../vmm/dist/jitk-vmm}
if [ ! -x "$VMM" ]; then
 echo 'Build ../vmm first, or set JITK_VMM_BINARY to the integrated launcher.' >&2
 exit 70
fi
exec "$VMM" --image "$@"
