# Cloudflare codemode helpers

`codemode.mjs` is a checked-in copy of the normalizer, identifier sanitizer and
JSON-schema type generator shipped by `@cloudflare/codemode` **0.5.5**, MIT,
Copyright (c) 2025 Cloudflare, Inc. The complete notice is in
`LICENSE.cloudflare`. The only changes are the attribution header, named exports,
and removal of the now-invalid source-map footer. The implementation is unchanged.

Source: the installed package's `dist/json-schema-types-D_m9tVnI.js`.
Original SHA256: `53cd10cf586be5c7bd3b234021a938284be485d41c9f9359d6008e7e94b4d6c2`.
Vendored SHA256: `79091b106e34cbf8fd972d43b7c46d3a3a0c5b732f1fbfbc6cab5191cdd241db`.

The normalizer uses Acorn through its public package export, pinned to 8.19.0.
No runtime helper resolves a package-private file or hashed export. The optional
Cloudflare wrapper fixture reads the installed **public entrypoint** to capture
its generated module; it is not a runtime dependency of `MicroVMExecutor`.
