# 02 - "Everything is a file" and MCP as resources

Facts are cited. Inference is marked **(inf)**. Podcast timestamps follow the brief (transcript uses ~minute buckets). Searches were shallow: I did not read client source, so client-support claims are low confidence.

## State of the world (late 2026)

- **Resources, templates, subscriptions are in the base spec.** Spec 2026-07-28 has `resources/list`, `resources/read`, `resources/templates/list` (RFC 6570 URI templates, with completion), and `listChanged`. Subscriptions moved to a `subscriptions/listen` stream with `notifications/resources/updated`. Results now carry `ttlMs` and `cacheScope`, so reads are cacheable. `file://` "need not map to a real filesystem", with `inode/directory`. https://modelcontextprotocol.io/specification/latest/server/resources
- **Skills over MCP is SEP-2640, status Final** (created 2026-04-23). Each file in a skill dir is a resource, conventionally `skill://<path>/<file>`, including `scripts/*`. It adds `skills/list`, `skills/get` (with digests) and an optional `resources/directory/read` for scoped navigation. Skills must follow the Agent Skills format (`SKILL.md` with `name`/`description` frontmatter, https://agentskills.io/specification). Any scheme is allowed (`github://...`). Nested skills need fresh user consent. https://modelcontextprotocol.io/seps/2640-skills-extension
  - SEP-2640 explicitly covers shipping scripts next to skills (podcast 56:30-60:00). It does not execute them; execution stays in the host's tools.
- **No SEP for "everything is a resource" or tools-as-resources.** I found none. The podcast's sitemap-of-APIs idea (transcript ~0:59) is only partly covered: `skills/list`, `directory/read` and nested skill paths give a hierarchy for instructions, not for executions. **(inf)** It is a convention you could write on top, not a spec gap you must wait on.
- **Client support is the weak link.**
  - Claude Code has `ListMcpResourcesTool` and `ReadMcpResourceTool`. There were HTTP-server bugs (closed Jan 2026) and an open July 2026 report that the read tool becomes "not enabled in this context" after reconnect. https://claudeissues.com/issue/80300-mcp-resources-readmcpresourcetool-intermittently-not-enabled-in-this-context-aft
  - Codex is listed as supporting resources, per a third-party directory. https://glama.ai/mcp/clients/codex
  - Pi has no built-in MCP (extensions only). OpenCode: MCP yes, resources unknown.
  - I could not confirm any client that implements `skill://` or `skills/list` natively. Podcast 53:15 (ChatGPT) is not corroborated by what I found.
  - Cross-client picture: tools work everywhere, resources are patchy and mostly user-attached rather than model-browsed. **(inf)** Don't make resources the only path.
- **Filesystems for agents (prior art):**
  - Turso AgentFS: SQLite-backed FS, FUSE on Linux and NFS on macOS, copy-on-write overlay, beta, no MCP surface found. https://github.com/tursodatabase/agentfs, https://turso.tech/blog/agentfs-fuse
  - Cloudflare Artifacts: git-compatible storage for agents. Freestyle argues "git is the agent filesystem". Beam Airstore (FUSE), Archil, agentignore (FUSE overlay), Mirage. https://blog.freestyle.sh/blog/engineering/agent-filesystems-git
  - Repo-as-resource MCP servers (gitingest, filesystem-python, git resources) are small, tool-flavoured, and snapshot-based. https://glama.ai/mcp/servers/@punkpeye/mcp-filesystem-python
  - I found **no** project serving *btrfs-style per-turn snapshots* as an MCP resource tree.

## Fern facts that matter

- Snapshots are `btrfs subvolume snapshot -r` under `envs/<id>/snaps/<snapshot>/`, read-only, with ms cost (arch §9). The snapshot ID is the T3 checkpoint ref (§5).
- The `store` component owns the pool. The `api` socket has list-snapshots but no file-read endpoint (§5). `internal/mcp` is not built yet (`ls internal`: actor api boxexec csi driver store).
- Agent MCP tokens are scoped to the agent's own environment (§13). The setup contract lives in `.agents/*` or `.fern/*` (§8).
- Reads from a snapshot or `live/` are host-side filesystem reads, so no box wake is needed. Only `exec` wakes (§5). The wake layer is a separate component (§3 "wake").

---

## Idea 1: Env/snapshot tree as MCP resources (`fern://<env>/snap/<id>/path`) - 21:30, 56:30-60:00

1. **Idea:** the model is RL-trained on Linux filesystems, so expose environments as a browsable tree instead of more `env_*` tools. Reading is a URI, not a tool call.
2. **Exists:** the resource, template and subscription primitives are standard (above). `file://`-like virtual trees are explicitly allowed. Nobody serves CoW snapshots this way.
3. **Fern fit:**
   - New `internal/mcp` (§3 "mcp", §18) registers templates `fern://{env}/live/{+path}`, `fern://{env}/snap/{id}/{+path}`, and `fern://{env}/` (listing).
   - A new read-only `store` method `Open(env, snap, path)` that walks the host path with `openat2(RESOLVE_BENEATH)` (no symlink escapes, which satisfies the spec's traversal MUST). Add `GET /envs/{id}/snapshots/{s}/fs/{path}` to `api` (§5). MCP calls it.
   - `resources/list` returns the env and snapshot roots only (`inode/directory`). Files come via `resources/directory/read` (SEP-2640 shape, but we apply it to non-skill trees) and `resources/read`.
   - Snapshots are immutable, so `cacheScope: private` with a long `ttlMs` is exactly right. `live/` gets a short `ttlMs`.
   - Subscriptions: `notifications/resources/updated` on `fern://<env>/snaps` when the actor takes a snapshot (§7.2), and `list_changed` on env create/delete. The actor already serialises these, and `GET /events` is planned (§5), so the source exists.
   - Must hide secrets: filter `.env`, `.git` hooks and anything listed in `.agents/linked` (§8). Snapshots shouldn't hold credentials (§13), but a repo `.env` can.
4. **Verdict: BUILD**, ~1 week for the read path (store walk, api endpoint, MCP templates, tests). +2-3 days for subscriptions. No existing option does CoW-snapshot trees. Use the official Go MCP SDK for the transport (inf: check it supports `subscriptions/listen` of the 2026-07-28 spec before committing).
5. **Model trend:** grows. More agent volume means more cross-thread and cross-turn reads (a reviewer reading a worker's turn N). Cheap, cacheable reads beat waking a box. The "browse the tree" habit itself is neutral-to-grows.
6. **Signal:** Twitter 4 (demo: agent diffs turn 3 against turn 7 of another thread with zero boxes running), CV 4 (Go, btrfs, MCP spec depth).

## Idea 2: Serve reads without waking a box - supports Idea 1

1. **Idea:** `ls`/`cat` on a sleeping env costs no pod. Podcast spirit: files are the cheap interface, execution the expensive one (56:30).
2. **Exists:** E2B/Daytona-style sandboxes must run to read. Amp Orbs pauses to a bucket (design.md §109), so reads need a wake. **(inf)** Nobody serves cold reads from the snapshot store.
3. **Fern fit:** the read path never touches `actor` or `driver`. It goes `mcp -> api -> store`. Caveat: for the *running* box's `live/`, a host read can see half-written files. That is fine for browsing and the hint should say so (`lastModified` annotation, "may be mid-write"). Reads of snapshots are consistent (atomic snapshot, §9).
   - Needs a check that the store lock/retention can't delete a snapshot mid-read (prune is `DELETE .../snapshots/{s}`). An open fd on btrfs subvolume deletion is the risk.
4. **Verdict: BUILD**, included in Idea 1 (+1-2 days for the prune race and fd handling).
5. **Model trend:** grows. Cheaper inference makes read volume the dominant load, and it must not cost a pod start (~1-2 s, unmeasured per design.md §267).
6. **Signal:** Twitter 3, CV 4.

## Idea 3: Ship the setup contract and per-repo skills as resources - 56:30-60:00, 53:15

1. **Idea:** `.agents/skills/<name>/SKILL.md` plus `scripts/` in the repo become `skill://` resources served by Fern, next to the code they describe.
2. **Exists:** SEP-2640 (Final), Agent Skills format. Native clients mostly load skills from disk, so MCP delivery adds little where the box already has the repo. The real gain is *cross-environment*: a skill that lives in the golden/main repo reaches any thread, including ones cut from older snapshots.
3. **Fern fit:**
   - `internal/mcp` declares the `io.modelcontextprotocol/skills` extension. `skills/list` scans `golden/<repo>@<key>/.agents/skills/` (read-only, §9). `skills/get` returns digests, so a client can cache.
   - Also expose `fern://<repo>/contract/setup|resume|services.yaml|linked` as read-only resources so an agent can read how its env is built without exec (§8).
   - Sensible default: **do not** auto-run scripts. Keep execution in `env_exec` (token-scoped, §13). Nested-skill consent rules in the SEP match Fern's untrusted-box stance.
   - Danger: skills in a repo are attacker-controlled input if the repo is. Serve only from the golden at a pinned key, never from `live/`.
4. **Verdict: ADOPT** the spec, BUILD the ~2 days of server side on top of Idea 1. Low value *today* because few clients consume `skill://` **(inf)**; do it after Idea 1.
5. **Model trend:** neutral. Better models need less hand-holding, but organisation-specific procedures stay valuable. Closer to neutral than a crutch.
6. **Signal:** Twitter 2, CV 2.

## Idea 4: Tools as executions at URIs / hierarchical tool tree - 56:30-60:00

1. **Idea:** `fern://<env>/exec/<script>` read-or-invoke, "the sitemap includes APIs".
2. **Exists:** only the podcast's sketch. No SEP. SEP-2640's `directory/read` is the nearest hierarchy primitive.
3. **Fern fit:** would map to `env_exec` plus Code Mode (§5). Side-effecting reads violate the resource contract (reads are cacheable, repeatable). **(inf)** Conflicts with idempotency and `ttlMs` caching.
4. **Verdict: SKIP** for now. Keep `env_*` as tools and Code Mode as the call surface. Revisit if a SEP appears.
5. **Model trend:** neutral. 6. **Signal:** Twitter 2, CV 1.

## Idea 5: FUSE/AgentFS-style mount of snapshots into other boxes

1. **Idea:** instead of MCP, mount `snaps/<id>` read-only into another thread's pod.
2. **Exists:** AgentFS, Airstore (FUSE, beta/alpha). Fern already has a CSI driver (§3 "csi") that can bind a snapshot subvolume.
3. **Fern fit:** the CSI authorisation rule ("only for the pod named after the env", §13) would need a sibling "read-only snapshot of env X for pod Y" grant, which is a cross-thread data-leak surface (known gap: shared git folder, §13). Native tools (`grep`, `rg`) then work on it, which beats resource reads for big trees.
4. **Verdict: BUILD later** (1-2 weeks, mostly the authorisation model). Not before Idea 1. No FUSE needed: btrfs already gives a read-only subvolume, a bind mount does the job.
5. **Model trend:** grows. 6. **Signal:** Twitter 3, CV 4.

---

## Top 3 (ranked)

1. **Idea 1+2: snapshot/env resource tree, served cold from the store.** About 1.5 weeks. Unique, demoable, no new infrastructure beyond `internal/mcp` and one `store` method.
2. **Subscriptions on snapshot/env events** (part of Idea 1, +2-3 days), fed from the actor and `GET /events`. This is the "MCP = auth + one primitive + notifications" story from 56:30 made concrete.
3. **Per-repo skills via SEP-2640** (Idea 3), after 1 and 2. Cheap, spec-aligned, but low pull until clients catch up.

## Open risks

- Client reality: resources are patchy, and the reliability bug (July 2026) suggests the model may not be able to *browse* them in Claude Code. Mitigate by also adding a single `env_read(env, snap, path)` tool with identical semantics. If the resource tree is rarely used by real clients, the demo still works via the T3 UI or a Code Mode call. I did not verify Codex or OpenCode behaviour directly.
- Spec churn: the 2026-07-28 protocol changed subscriptions (`subscriptions/listen`) and added caching. The Go SDK may lag; confirm before planning dates.
- Security: serving file contents out of snapshots makes secrets in the repo (not in Fern's own credential paths) readable by any token that can name the env. Scope by token (§13) and filter by `.agents/linked`.
- Ping-pong with jitk: none needed here. One line: jitk would plug in as the executor behind `env_exec`, not the read path.
