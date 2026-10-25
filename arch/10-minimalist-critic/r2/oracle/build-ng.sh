#!/bin/sh
set -eu
# All sources/build products stay in the allowed private scratch directory.
curl -fLsS https://github.com/quickjs-ng/quickjs/archive/refs/tags/v0.17.0.tar.gz -o /tmp/jitk-08/ng.tar.gz
tar -xzf /tmp/jitk-08/ng.tar.gz -C /tmp/jitk-08
docker run --rm --platform linux/arm64 --network none --entrypoint sh \
  --cpus 2 --memory 1g -v /tmp/jitk-08:/work:rw jitk-oracle:08 -c '
cmake -S /work/quickjs-0.17.0 -B /work/ng-build \
  -DQJS_BUILD_CLI_STATIC=ON -DQJS_BUILD_CLI_WITH_MIMALLOC=OFF \
  -DQJS_BUILD_CLI_WITH_STATIC_MIMALLOC=OFF -DQJS_BUILD_EXAMPLES=OFF
cmake --build /work/ng-build --target qjs_exe -j2
cp /work/ng-build/qjs /work/qjs-ng-musl'
