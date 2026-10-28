#!/bin/sh
# npm for the one-time scriptc install (pin.mk). A PATH npm wins (the Mac
# setup); otherwise the pinned Node from the jitk cache, so a clean Linux host
# (kvm-dev) needs no Node of its own. When that entry is missing it is
# bootstrapped: the deps.json tarball is fetched and sha256-checked here, then
# `deps.ts node` (run by the Node inside it) writes the same cache entry that
# `make -C arch/jitk deps` builds. Cache root as in ../tslib/deps.ts.
set -eu
TOOLS=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if command -v npm >/dev/null 2>&1; then
  exec npm "$@"
fi
if [ -n "${JITK_NODE:-}" ] && [ -n "${JITK_NPM_CLI:-}" ]; then
  exec "$JITK_NODE" "$JITK_NPM_CLI" "$@"
fi
pin() {
  sed -n "s/^ *\"$1\": *\"\([^\"]*\)\".*/\1/p" "$TOOLS/deps.json" | head -n 1
}
case $(uname -s) in Darwin) os=darwin ;; *) os=linux ;; esac
case $(uname -m) in aarch64 | arm64) arch=arm64 ;; x86_64) arch=x64 ;; *) arch=$(uname -m) ;; esac
platform=$os-$arch
version=$(pin version)
cache=${JITK_CACHE:-${XDG_CACHE_HOME:-$HOME/.cache}/jitk}
dir=$cache/node/v$version-$platform
if [ ! -f "$dir/jitk-manifest.json" ]; then
  sha=$(pin "$platform")
  if [ -z "$sha" ]; then
    echo "jitk npm: tools/deps.json pins no Node tarball for $platform; put npm on PATH" >&2
    exit 1
  fi
  mkdir -p "$cache"
  boot=$(mktemp -d "$cache/node-bootstrap.XXXXXX")
  trap 'rm -rf "$boot"' EXIT
  url=https://nodejs.org/dist/v$version/node-v$version-$platform.tar.gz
  echo "jitk npm: no npm on PATH; bootstrapping pinned Node $version from $url" >&2
  curl -fsSL --retry 3 -o "$boot/node.tar.gz" "$url"
  got=$( (sha256sum "$boot/node.tar.gz" 2>/dev/null || shasum -a 256 "$boot/node.tar.gz") | cut -d ' ' -f 1)
  if [ "$got" != "$sha" ]; then
    echo "jitk npm: $url sha256 $got != pinned $sha" >&2
    exit 1
  fi
  mkdir "$boot/node"
  tar -xzf "$boot/node.tar.gz" -C "$boot/node" --strip-components 1
  JITK_NODE_TARBALL=$boot/node.tar.gz "$boot/node/bin/node" "$TOOLS/deps.ts" node >&2
  rm -rf "$boot"
  trap - EXIT
fi
node=$dir/bin/node
if [ "$os" = darwin ]; then
  node=$dir/bin/node-real
fi
# Package install scripts (scriptc's native installer) run a bare `node`.
PATH=$dir/bin:$PATH
export PATH
exec "$node" "$dir/lib/node_modules/npm/bin/npm-cli.js" "$@"
