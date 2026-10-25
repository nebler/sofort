#!/bin/sh
# Re-clone the upstream repos studied in cloudflare-deep.md at the exact commits we read.
set -e
cd "$(dirname "$0")" && mkdir -p repos && cd repos
while read name url sha; do
  [ -d "$name" ] || git clone --filter=blob:none "$url" "$name"
  git -C "$name" checkout -q "$sha"
done <<'LIST'
agents https://github.com/cloudflare/agents 321814b6c13f72cff82161e7eb20312574ac9b7a
capnweb https://github.com/cloudflare/capnweb 766655329fe4fe2dada67c8b4e82e3a81e38b194
cloudflare-os https://github.com/cloudflare/cloudflare-os 835de9e8776429fc16781edbe66367d879a64b87
computer https://github.com/cloudflare/computer 2b23503eac1f4efa8403908e472c472f747b61f7
workerd https://github.com/cloudflare/workerd 2c37de0d944552d8e5404924290dafb43a0e7d53
LIST
