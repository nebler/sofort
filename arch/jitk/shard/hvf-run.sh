#!/bin/sh
# Cargo runner for macOS (make test-hvf): Hypervisor.framework needs the
# com.apple.security.hypervisor entitlement, so ad-hoc sign the test or tool
# binary with it, then run it.
set -eu
codesign --force --sign - --entitlements "$(dirname -- "$0")/../vmm/hypervisor.entitlements" "$1" 2>/dev/null
exec "$@"
