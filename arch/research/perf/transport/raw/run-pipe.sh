#!/bin/sh
/usr/bin/uptime > /tmp/sofort-a4/raw/pipe-load-before.txt
/tmp/sofort-a4/bin/bench-pipe > /tmp/sofort-a4/raw/pipe.json
/usr/bin/uptime > /tmp/sofort-a4/raw/pipe-load-after.txt
