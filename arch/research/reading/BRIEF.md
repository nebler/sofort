# Brief: curated videos + blog posts for Sofort (2026-10-25)

Goal: a reading/watching list (YouTube talks + blog posts/articles ONLY; papers only if there is no good post/talk, and then link the paper PDF as a fallback) covering every concept the author must be able to defend for Sofort (jitk tiny Rust kernel on KVM/HVF, ~0.5 MiB microVMs, snapshots/CoW restore, growth loop verified against Linux, single tool I/O channel, MCP/code-mode executor, Wasm tier with pause/fork/move, Capsule = portable continuations with an effects journal on Cloudflare Workers/DO/R2, Goose language). Read `demo.md` §0–1 and `arch/research/cloudflare-goose/SYNTHESIS.md` for context. The author is a strong platform engineer (Java/Kotlin/Go/TS, GCP/K8s) but newer to kernels/virtualization; he wants the MOST IMPORTANT material, not exhaustive lists.

Rules:
- Research only. Don't log in, post, comment or subscribe. Don't modify any repo file except your output file.
- **Every link must be verified**: fetch it (curl -sIL or a web fetch) and confirm it resolves and is the right item. For YouTube, confirm title + channel via `https://www.youtube.com/oembed?url=<video-url>&format=json`. Record duration if you can find it. Drop anything you can't verify. No invented URLs.
- Prefer primary sources (the engineer who built it), honest/critical takes, and classic talks over listicles. Include contrarian/critical pieces where they exist.

Output format (markdown), per item:
`- [P1|P2|P3] **Title** — Author/Speaker (Org), Type (YouTube|Blog), Year, Length — <URL>`
`  Why for Sofort: one line. Concepts: tags.`
P1 = must watch/read (aim ~6–8 per lane), P2 = should, P3 = deep dive. 15–30 items total per lane. End with a 5-line "if you only have 3 hours" path for your lane.
