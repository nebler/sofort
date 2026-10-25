#!/bin/sh
# Pack /tmp/jitk-07/kvm/{bin,run.sh,init} as an overlay cpio appended to base.
set -e; cd /tmp/jitk-07/kvm; rm -rf stage; mkdir -p stage/work; cp -R bin/. stage/work/; cp run.sh stage/work/; cp init stage/init
chmod +x stage/work/* stage/init
(cd stage && find . | cpio -o -H newc 2>/dev/null | gzip -1) > work.cpio.gz; cat base.cpio.gz work.cpio.gz > test.cpio.gz
