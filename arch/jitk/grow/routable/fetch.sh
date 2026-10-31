#!/bin/sh
# Fetches the pinned routable-workload binaries (workloads.json "artifacts")
# into DIR, named by sha256. Each archive is checked before it is unpacked, in
# its own empty directory; nothing downloaded is executed here.
#   sh routable/fetch.sh DIR
set -eu
dir=$1
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$dir"
sum() { if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
jq -r '.artifacts | to_entries[] | [.key, .value.url, .value.archive_sha256, .value.member, .value.sha256] | @tsv' "$here/workloads.json" |
while IFS="$(printf '\t')" read -r name url archive member want; do
  if [ -f "$dir/$want" ] && [ "$(sum "$dir/$want")" = "$want" ]; then echo "$name: cached"; continue; fi
  work=$(mktemp -d)
  curl -fsSL --proto '=https' -o "$work/archive" "$url"
  [ "$(sum "$work/archive")" = "$archive" ] || { echo "$name: archive sha256 mismatch" >&2; exit 1; }
  mkdir "$work/x"
  tar -xzf "$work/archive" -C "$work/x" "$member" 2>/dev/null || tar -xzf "$work/archive" -C "$work/x"
  [ "$(sum "$work/x/$member")" = "$want" ] || { echo "$name: binary sha256 mismatch" >&2; exit 1; }
  cp "$work/x/$member" "$dir/$want"
  chmod 0755 "$dir/$want"
  rm -rf "$work"
  echo "$name: $want"
done
