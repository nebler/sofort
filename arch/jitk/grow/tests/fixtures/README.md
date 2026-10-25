# Bounded differential fixtures

These small raw stdout/native strace pairs were recorded by the accepted R3
canonical run. One fresh-VM sample per handler is retained here to test the
strict verifier. They are parser regression inputs, not new 30-run evidence.
Signal traces use explicit native Linux strace ENOSYS injection. Lua stdout is
compared with normal native Linux stdout. No repository or build output is
needed to run these tests; patch tests construct their own temporary trees.
Historical full R3 receipts are archived in the owner's area, outside this
portable package; no executable here reads that archive.
