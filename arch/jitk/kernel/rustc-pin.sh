#!/bin/sh
# rustc wrapper (.cargo/config.toml build.rustc-wrapper): pins the kernel
# crate's -C metadata so the image is byte-identical on every build host.
#
# Cargo derives -C metadata from a hash that includes the build-script unit,
# and build scripts are host units whose hash contains `rustc -vV`'s host:
# line. So aarch64-apple-darwin and aarch64-unknown-linux-gnu hand jitk_02
# different metadata, rustc derives a different StableCrateId, every legacy
# symbol hash changes, and codegen orders a few monomorphized functions by
# those hashes (kernel/.READY's image vs a kvm-dev build: 23 bytes, two
# <&T as Display>::fmt bodies swapped). The value below is what cargo 1.95
# computed on the Mac for the default feature set, so the promoted Mac image
# keeps its bytes; it is only a disambiguator (no two jitk_02 builds are ever
# linked together), so one value serves every feature set and host.
# JITK_CRATE_METADATA overrides it; JITK_CRATE_METADATA=cargo keeps cargo's.
set -eu
pin=${JITK_CRATE_METADATA:-be12e36f7cc66641}
rustc=$1
shift
case " $* " in
  *' --crate-name jitk_02 '*) ;;
  *) exec "$rustc" "$@" ;;
esac
[ "$pin" = cargo ] && exec "$rustc" "$@"
for arg; do
  shift
  case $arg in
    metadata=*) arg=metadata=$pin ;;
    -Cmetadata=*) arg=-Cmetadata=$pin ;;
  esac
  set -- "$@" "$arg"
done
exec "$rustc" "$@"
