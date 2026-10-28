# A07 — Everyone: a software team you can stop tending

Research cut: **2026-10-29**. **Q** = quotation or attributed practitioner report; **F** = sourced fact; **I** = inference, proposal or bounded search conclusion; **E** = estimate or experimental target. A quotation establishes what someone said. Product documentation establishes a claimed capability, without establishing its reliability in practice.

**I — ONE pick: software mutuals.** Make bespoke software an ordinary household possession that a community can keep useful, repair and hand over after its original maker leaves. The ambitious object is a federation of accountable caretakers and accumulated repair knowledge serving billions of people. The six-week experiment is eight households, three small kinds of software, two non-programmer successor caretakers, and an actual week without the author. Its valuable output is evidence about whether personal software can survive the person who made it without making another family member its unpaid engineer.

**I — The surprising inversion:** abundant engineering does not imply that everybody should become an app owner. It could let ordinary people obtain the benefits of custom software while spending *less* time thinking about software. Ben's completed family display is a useful destination. A society of permanent amateur infrastructure administrators is a failure mode.

## Reading and evidential boundaries

**F — Local research:** read the two governing ambition briefs; examined the named surviving signals in S01, S02, S05 and S07; screened E01–E19, all five Connect ledgers and S01–S07 for this lens, including the 1,917-row S05 board. Revisited the relevant caption blocks in videos 11–12, 49, 80, p3-02, p3-08, p3-19, p3-48, p3-65 and the Eric Simons section of p3-64. Read the earlier kill list and the stack/Connect summaries. This was a thematic screen of the large corpus, not an end-to-end rereading of every recording. No interviews, pilots or software benchmarks were conducted.

**I — Constraints inherited from the corpus:** S07 §5's 13-practitioner attention bottleneck argues against giving each household a new queue of agent decisions. S01's disappearing tool visibility and S02's incompatible approved designs argue against treating a convincing demonstration as evidence of continued human control. S05's tailoring-versus-malleability disagreement argues for measuring quiet continued usefulness. The evidence-commons signals in E12–E19 suggest accumulating actual failures, accepted repairs and participating people, rather than accumulating generated applications.

**F/I — Prior-art method:** checked primary product documentation, repositories, project accounts and institutional sources. Searched both named builders and functional equivalents: personal software, support/maintenance, cooperative hosting, application-independent data, economic commitments, multilingual/offline field systems, communal computing and custom assistive devices. Searches found much closer attempts than a generic app-builder comparison would reveal. “Unestablished” below means the inspected evidence does not establish an outcome; it does not establish absence. Active projects are competition or potential homes for contributions, including small projects and funded 2026 companies.

## The 1,000× question

**I — Working assumption:** code, adapters, firmware and interface variants become cheap enough that every family, school, clinic and village could have a tireless implementation team. What remains scarce is the right to act, knowledge of this particular life, willingness to take responsibility, and a way to resolve disagreement. The three proposals target different units of that scarcity:

| Proposal | Unit that persists when code is regenerated | Ambition rung |
|---|---|---|
| **1. Software mutuals** | A supported household capability, its custody and its repair history | Infrastructure for universal access to bespoke software |
| **2. Institutions without compulsory apps** | A commitment accepted by the actual parties, independent of their interfaces | Changes who can participate in digital institutions |
| **3. A public works network for personal computing** | A physically fitted, maintained way for a person to use computation | Changes where and for whom software can be useful |

**I — These are alternative bets.** Combining them into a universal runtime would obscure three different adoption problems. The prototypes should borrow existing storage, agent and interoperability systems.

## Prior art that removes the obvious ideas

All capability/status cells are **F** unless qualified. The consequence column is **I**. The table distinguishes an actual limit or closure from an untested extension; thriving projects have not “stalled” merely because they do not implement these proposals.

| Closest attempt and how far it got | What it removes; where the boundary remains |
|---|---|
| **Claude artifacts — shipped.** Anthropic documents personal/shared persistent storage, connected tools and apps that call Claude using each user's plan. The documented storage limit is 20 MB of text per artifact. [Artifact documentation](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them). | A persistent, shareable family app with AI inside it already exists as a product capability. A caretaker succession network and responsibility for a family's outcome are separate claims. The page also warns that builders choose which data is shared. |
| **ChatGPT apps/plugins — shipped infrastructure.** Official documentation describes interactive UI, tool calls and widget state. [OpenAI UI documentation](https://developers.openai.com/plugins/build/chatgpt-ui). | Chat-based interfaces and stateful tools are occupied. Neither a custom UI nor a connector is a defensible contribution by itself. This check does not establish that every ChatGPT creation surface has identical persistence or export behavior. |
| **Lovable — shipped generation, hosting and ownership features.** Its 2026 changelog documents SQL database export, separate storage downloads and automatically generated security information for published apps. [Changelog](https://docs.lovable.dev/changelog). | “Add export” and “add a trust page” are already features. Source, data and service credentials still have different transfer conditions. No blanket claim that Lovable prevents ownership is justified. |
| **Bolt — shipped full lifecycle.** Its documentation covers collaboration, backups, hosting, databases, GitHub, payments and mobile projects; its security page describes automatic review and fixes. [Help center](https://support.bolt.new/), [security](https://bolt.new/platform/security). | A secure-looking mobile app builder, a repair agent and integrated deployment are direct competition. Eric Simons's Forge announcement is also occupied ground for cheaper/open-model access; the talk does not establish that its frontier-model ambition has been achieved. |
| **Replit — funded, active 2026 competition.** Replit announced **$400 million at a $9 billion valuation on March 11, 2026**. Its April monitoring launch includes outage notifications and Agent diagnosis using logs and production data. [Funding announcement](https://replit.com/blog/replit-raises-400-million-dollars), [App Monitoring](https://replit.com/blog/app-monitoring). | “An engineering team for everyone” and keeping generated apps running already have a heavily funded owner. A mutual must demonstrate something beyond monitoring plus agent fixes: cross-provider custody, bounded human effort and an accepted successor. |
| **Val Town — shipped.** Public/private programs, scheduled execution, team offerings and Townie are documented; its team publishes experiments in multiplayer self-building software. [Pricing/capabilities](https://www.val.town/pricing), [project blog](https://blog.val.town/). | Small remixable software and multiplayer agents are occupied. A TypeScript hosting service would be a particularly weak imitation for this builder. |
| **Glide and Notion — shipped, with important device boundaries.** Glide documents both offline use cases and real browser/network compatibility failures. Notion provides downloaded offline pages in native apps; its documented database behavior initially downloads 50 rows of a view. [Glide FAQ](https://www.glideapps.com/faqs), [connection troubleshooting](https://help.glideapps.com/en/articles/11647540-debugging-app-connection-issues), [Notion offline documentation](https://www.notion.com/en-gb/help/use-pages-offline). | Non-programmers already make useful software from data. Do not claim these systems categorically require uninterrupted connectivity. Verify the actual device, dataset and operation; “offline” is not one universal guarantee. |
| **Apple Shortcuts and HyperCard — shipped historical precedents.** Apple documents event-triggered personal automations. Its HyperCard manual describes browsing, editing, cards and stacks. [Shortcuts guide](https://support.apple.com/en-ie/guide/shortcuts/apdfbdbd7123/ios), [Apple's 1987 manual](https://vintageapple.org/macmanuals/pdf/HyperCard_Users_Guide_1987.pdf). | Ordinary people composing software is decades old. The new claim must concern affordable lifetime service or reach, rather than rediscovering buttons and scripts. Platform dependence is a continuity concern; this research does not establish one cause for HyperCard's commercial fate. |
| **Ink & Switch — working research prototypes and a broad research agenda.** Potluck enriches ordinary documents into tools. The malleable-software essay explicitly discusses communal creation, composition, privacy and maintenance economics. Its earlier work sets out offline collaboration and data ownership. [Potluck](https://www.inkandswitch.com/project/potluck/), [malleability essay](https://www.inkandswitch.com/essay/malleable-software/), [research index](https://www.inkandswitch.com/essay/). | Neither personal malleability nor a computing commons is new. The essay leaves support economics and trustworthy extension beyond close groups as substantial questions. These are research questions with owners, not an empty market. |
| **Manyshape — public implementation.** It separates vendor authority, signed capability contracts and generated personal surfaces; durable user intent is regenerated against updated contracts. [Repository and architecture](https://github.com/Them-labs/manyshape). | “Keep personal customization through vendor updates” is directly occupied. Published architecture and component repositories do not establish population-scale adoption. Use or extend its approach if appropriate. |
| **Kody — shipped/open source.** The platform captioned “Cody” in the videos is currently spelled **Kody** on its official site. It keeps agents' packages, credentials, memory, jobs and apps across MCP hosts. [About Kody](https://kody.codes/about), [Kent's project listing](https://kentcdodds.com/info). | Cross-agent personal-software portability is the practitioner's own product positioning. Another portable agent cloud is not the opening. |
| **Wabi — personal-software product.** Its official manifesto already promises mini-apps shaped by personal context and persistent memory. [Manifesto](https://wabi.ai/manifesto). | “Software for you and your friends” is direct product territory. The manifesto establishes intent, not independent evidence of retention, maintenance costs or successful migration. |
| **Solid, hREA/Valueflows and Coasys AD4M — real implementations/specifications.** Solid separates personal data stores from apps. Valueflows models agreements, commitments and fulfillment; hREA supplies a composable implementation. AD4M has public releases and agent-facing interoperability. [Solid FAQ](https://solidproject.org/faq), [Valueflows flows](https://www.valueflo.ws/concepts/flows/), [hREA](https://github.com/h-REA/hREA), [AD4M](https://github.com/coasys/ad4m). | User-owned data and cross-application commitments have close prior art. Solid's application-interoperability document is explicitly a community draft, rather than a W3C standard. The residual test is real institutional acceptance across independently chosen software, not a new ontology. [Draft status](https://solidproject.org/TR/sai). |
| **Co-op Cloud, YunoHost and Public Code — operating stewardship precedents.** Co-op Cloud reports production use by tech cooperatives and shared maintenance recipes. YunoHost publishes automated app-test and maintainer-status machinery. Public Code supplies a collaborative stewardship standard. [Co-op Cloud FAQ](https://docs.coopcloud.tech/intro/faq/), [YunoHost catalog repository](https://github.com/YunoHost/apps), [Public Code standard](https://www.publiccode.net/standard). | Cooperative software care is already practiced. Extending common recipes to household-specific programs may still have terrible economics. The network and the operational labor cannot be assumed into existence. |
| **Buildly and ordinary maintenance businesses — commercial service.** Buildly advertises maintenance from **$20/month**, with assessment, explicit allowances and exclusions. [Maintenance scope](https://thebuildly.com/maintenance). | “Someone maintains software you already own” is sold today. A lower headline price proves nothing unless support time, exclusions and custody are comparable. No evidence here establishes Buildly's realized margins or scale. |
| **CosyAI — active cooperative formation.** Its September 2026 account describes preparing a European cooperative and reports more than 800 signups; a managed AI workspace is an initial service direction. [Formation status](https://cosyai.org/2026/09/22/coop-3-0-building-cosyai-as-a-template-for-aligned-ai-companies/), [vision](https://cosyai.org/2026/07/31/the-cosyai-vision-we-the-people-will-own-ai/). | Cooperative ownership of AI is also occupied. Signups and a roadmap are not established delivery of lifetime personal-software care. Partnering is more sensible than pretending this organizational form was just invented. |
| **ODK, CommCare and OpenFn — deployed public-interest infrastructure.** ODK documents multilingual offline forms and exports. CommCare reports over a million frontline workers supported across 130-plus countries. OpenFn supplies open-source public-service integration. [ODK](https://docs.getodk.org/getting-started/), [CommCare](https://commcare.dimagi.com/), [OpenFn](https://www.openfn.org/digital-public-infrastructure). | “An offline multilingual app for every clinic” is an established field. Usage figures are provider reports, not an independent impact estimate. Extend these ecosystems when their capabilities fit. |
| **Dynamicland, Morphic and Makers Making Change — working alternatives to app-centric access.** Dynamicland demonstrates communal physical computing. Morphic carries accessibility settings between computers. Makers Making Change operates a device library and fulfillment network. [Dynamicland introduction](https://dynamicland.org/2024/Intro/), [Morphic overview](https://morphic.org/Product-Overview/), [Makers Making Change](https://www.makersmakingchange.com/). | Screenless computation, portable accessibility and locally made adaptations have all been demonstrated. The remaining ambition concerns their affordable, individually fitted reach and continuing care, with those projects as potential partners. |

**F — A useful failure with a named cause:** Glitch ended project hosting on July 8, 2025. Its own announcement names the cost and time of running millions of apps, increasing platform age and abuse. Downloadable code did not keep hosted apps executing. [Glitch announcement](https://blog.glitch.com/post/changes-are-coming-to-glitch/).

**I — Consequence:** none of the three ideas below can claim novelty for generation, hosting, an interoperable data store, a repair agent, cooperative governance or distributed fabrication. Each survives only as a difficult deployment/participation thesis that must produce new observations.

## 1. Software mutuals

### Seed

**Q — Ryan Skidmore, Cloudflare Connect talk 02, 18:00:** “building got cheap, but owning it is still kind of a problem for now.” [Video](https://www.youtube.com/watch?v=-_qUn_LfJ6M&t=1080s), [caption source](/Users/noah/code/sofort/arch/research/connect26/transcripts/02-it-s-time-to-build-not-buy.txt).

**Q — Ben, State of Agentic Coding #11, 1:33:** after about an hour tailoring a display for his family: “And I'm good.” [Video at the caption bucket](https://www.youtube.com/watch?v=HDdbU10r7Js&t=5580s), [local transcript](/Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt:97).

**Q — Laurie Voss, p3-08, 21:00:** “We need 10,000 of them per year.” The referent is people trained for the emerging product-engineering role, following a comparison with Google's associate-product-manager program. This is a proposed training need, not an existing 10,000-person apprenticeship deployment. [Video](https://www.youtube.com/watch?v=kspZP5BgkEU&t=1260s), [caption source](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-08-ai-engineer-ai-writes-the-code-so-what-s-left-for-engineers-laurie-vos.txt:25).

**Q — Frank Nillard, p3-02, 07:00:** “patterns across all 10.” His example concerns observations earned through serving several actual companies, rather than copying an application's appearance. **I:** the equivalent asset here would be member-authorized experience of support and succession across households; it does not require pooling their private records. [Video](https://www.youtube.com/watch?v=O8IvlUNIQGY&t=420s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-02-frank-nillard-your-software-won-t-matter-in-5-years-here-s-what-to-do-.txt).

### Full-scale vision

**I:** A family asks a trusted local organization to keep three useful capabilities working: its calendar display, a shared-equipment reminder and its particular volunteer rota. It can choose a personal appearance and language once, then stop editing. Its service record identifies the people entitled to decide, which data they control, the supported behavior, a successor caretaker and the cost ceiling. Routine technical repair is delegated to agents. Changes affecting other people go to the people with authority over that relationship.

**I:** A federation of member-controlled mutuals maintains those capabilities across model vendors, hosts, household changes and caretaker turnover. A school, clinic or village can be a member too, with a different risk and responsibility tier. Shared repairs accumulate as public knowledge when participants authorize publication; personal records stay with the relevant household or institution. A replacement app is acceptable when the useful capability and its records survive.

**I — Field-level change:** access to bespoke software stops requiring a household member to become its perpetual operator. Personalization becomes compatible with ordinary public-service procurement and community stewardship. A society could support billions of distinct arrangements without billions of people individually managing cloud accounts, dependency upgrades and forgotten subscriptions.

### Why now; one-shot test

**I:** Supporting a unique application per household used to require enough professional discovery and maintenance time to swamp a small household budget. Cheap synthesis and repair can amortize recurring technical work across related variants, while deterministic programs handle daily use. This is a claim about the economics of massive variation; bespoke maintenance and cooperatives were possible before.

**I — Non-code value:** accepted responsibility, valid custody transfers, relationships with members, paid support capacity, and a longitudinal history of repairs that actually preserved usefulness. A stronger model can build the control plane and perform more repairs. It cannot create consenting members, appoint the legitimate successor, transfer a third party's account by assertion, or retroactively produce a year of successful care. Better models should reduce the service cost. If a provider supplies all these outcomes on acceptable ownership terms, use that provider; an independent implementation is not intrinsically valuable.

### Physics, economics, data and law

**E — Illustrative unit budget, not a provider quote:** assume maintenance consumes 100,000 input and 10,000 output tokens per household-month, priced at $2/M input and $10/M output. That is **$0.30**. Add **$0.20** for pooled runtime, storage and backups; **five human minutes at $30/hour = $2.50**; and **$1** for administration, incidents and reserve. Total: **$4/household-month**, before tax, acquisition, onboarding and margin. At 30 human minutes, the same total becomes **$16.50**. Human effort is the dominant sensitivity. Every figure must be measured separately from donated labor.

**E:** One million input and 100,000 output tokens for initial tailoring would cost $3 under that envelope; two human onboarding hours cost $60. Thus an apparently cheap monthly service can still exclude poor households through its setup cost. A school, library, association or public budget can pool onboarding and sponsor membership. Universal reach cannot be inferred from willingness to pay in a wealthy pilot.

**E — Civilization-scale stress case:** two billion households at that maintenance envelope imply **$600 million/month of inference** and **$8 billion/month for the full illustrative service**. Five minutes each is about **167 million human hours/month**. That is an institutional labor allocation, even if most engineering is automated. At an assumed **10–100 Wh of serving energy per household-month**, inference uses **0.24–2.4 TWh/year**; this deliberately broad range needs actual measurements and excludes model training, devices and telecommunications. For context, the IEA estimated total data-center electricity at 415 TWh in 2024. Physical power is plausible; regional supply, support funding and correlated outages remain serious constraints. [IEA analysis](https://www.iea.org/reports/energy-and-ai/executive-summary).

**F/E — Payments:** Stripe's displayed standard EEA card fee on its French pricing page is 1.5% + €0.25. A €1 collection therefore loses about 26.5% to that fee. Annual €36 dues lose about €0.79, roughly 2.2%, before other costs. Collecting per agent action is a poor default; use pooled or annual budgets and appropriate local payment rails. This is one market's fee example, not a global rate. [Stripe pricing](https://stripe.com/en-fr/pricing).

**I — Data availability:** technical logs exist only after real use; family preferences, authority and social consequences need observation and consent. A public repair entry should contain a minimized failure, relevant environment and member-approved outcome. It need not contain private calendar contents. Group records can have multiple legitimate data subjects; a single “owner” field is insufficient.

**F/I — Law:** GDPR portability has conditions and does not transfer arbitrary credentials or other people's rights. The revised EU product-liability framework includes software and distinguishes noncommercial open-source supply; commercial service operation must not assume the same exclusion. This proposal initially offers a bounded maintenance allowance, rather than making unpriced promises of insurance or perpetual availability. Expanding into regulated uses requires appropriate domain responsibility. [Commission on portability](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en), [Directive 2024/2853](https://eur-lex.europa.eu/legal-content/EN/ALL/?uri=CELEX%3A32024L2853).

### Closest attempts and their limits

**F/I:** Co-op Cloud supplies the cooperative operational lineage; Buildly sells defined maintenance; Replit supplies agent-assisted diagnosis; Kody supplies portable durable agent resources; Manyshape preserves personal surface intent. None should be rebuilt wholesale. The unestablished combination is **supported household-specific variation plus member-directed succession at a cost ordinary institutions can fund**. Glitch demonstrates that a beloved creative platform and source export do not establish continuity. CosyAI is an active organizational neighbor, not proof of an empty cooperative-AI category. Sources and statuses are in the prior-art table.

**I — Strong novelty limit:** a succession manifest and a restore button are one-prompt software. Their usefulness as components does not make this ambition pass. Only observed transfer of actual service, low enough continuing human effort, and a willing next caretaker do.

### Six weeks for one person

**E — Budget:** about 10–12 hours/week, 60–72 hours total, plus consenting participants' separately recorded time. Recruit within an existing parent-run community association, rather than creating a new community. Users sought: **eight households whose participating adults do not write software, and two rotating adult volunteers who also do not write software**. Include at least two households with a relevant language, device or accessibility constraint. No users have yet agreed to participate.

1. **Week 1:** observe the association's adult duty rota, equipment loans and family displays of public dates. Choose three small applications from those classes. Record why an ordinary calendar, spreadsheet or existing builder does not already suffice. Exclude children's personal records and safety-critical coordination. Set an explicit end date and support allowance.
2. **Week 2:** use existing app/agent tools to tailor eight small variants. Give each household control of its data and explicitly appoint a successor. Keep everyday work deterministic, with an offline-readable export and a paper fallback. Record the cost of every setup task.
3. **Week 3:** build the thin open-source custody layer: program/data bundle, deployment recipe, scoped access delegation, approved behavior examples and a plain-language service record. TypeScript and SQLite are enough; Workers can provide a bounded relay/host. Do not invent a kernel, agent harness or general fork manager.
4. **Week 4:** run the real routines. Record useful completions, unwanted notifications, requests for change, agent cost and every human support minute. Ask whether each person wants further tailoring or simply wants the current behavior to continue.
5. **Week 5:** with agreed fallback coverage, remove the author from routine support for seven days. Successor volunteers use agents to handle one genuine change or defect per application class. Perform a separately identified host-withdrawal rehearsal; do not call an injected outage a naturally observed failure. Households decide whether their original useful behavior survived.
6. **Week 6:** publish the reusable software and a consented field report, including failed transfers, excluded tasks, time distribution and the baseline comparison. Demonstrate one live household workflow after author departure and provider replacement. Offer the group a concrete, bounded next maintenance period with its measured price; a real acceptance or rejection is more informative than a hypothetical survey.

**I — New result sought:** a documented transfer of several genuinely different household programs to non-programmer community caretakers, while the households continue their actual routines. An animated migration dashboard would not establish it. A six-week result cannot establish multiyear reliability or global support economics.

### What kills it; builder fit

**I — Strongest objection:** human exception handling is irreducibly bespoke, and the mutual is an agency with hidden unpaid labor. Shared model/provider failures also correlate across members, so a reserve cannot be priced as if each app fails independently. Governance can create obligations participants never wanted.

**E — Cheapest disproof:** before building the custody layer, run a two-day handover of three existing household tools to one willing successor using ordinary exports, documentation and an existing agent. Stop if households prefer the stock tools, decline any successor, or transferring authority requires continuing access through the author. During the six-week pilot, count even quick messages and favors. Consistently exceeding 30 human minutes/household-month makes the $4 thesis fail. A later cohort must approach the five-minute assumption; eight households cannot establish that tail.

**I — Builder fit: strongest of the three, conditional.** State custody, bounded execution, migration and cross-host behavior suit a systems engineer. Recruiting and serving real families is the difficult new work. The bounded deliverable is open source and can become a Co-op Cloud/CosyAI/Public Code contribution. The builder should avoid becoming an indefinite solo support provider. GrowOS is outside this proposal.

## 2. Institutions without compulsory apps

### Seed

**Q — Kent C. Dodds, p3-48, 00:00:** “They just want their problem solved.” His later barber example retains different payment integrations across personal app variants and identifies switching friction around those connections. [Video](https://www.youtube.com/watch?v=P00lzZaxv8U&t=0s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-48-kent-c-dodds-the-future-of-software-is-invisible.txt).

**Q — Cyrus Omar, p3-19, 47:00:** “a big network of live programs”; at 48:00 he explicitly includes non-programmers in monitoring and manipulating the resulting computational commons. [Video](https://www.youtube.com/watch?v=fB_lklm7xgU&t=2820s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt:51).

**Q — Armin Ronacher, video 80, 1:08:** “hide the tool output.” He describes this as a regression in the user's ability to understand generated activity. [Video](https://www.youtube.com/watch?v=HDdbU10r7Js&t=4080s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/80-armin-ronacher-state-of-agentic-coding-11-with-geoff-armin-and-ben.txt:72).

### Full-scale vision

**I:** A school publishes the obligations it can accept: an adult volunteered for a shift, an equipment loan was extended, a form was received. A household can participate through its existing calendar, a personally tailored display, a voice interface or a paper-assisted service. Another household uses different software. The institution accepts the same concrete commitment without requiring every participant to create an account in its preferred app.

**I:** Agents build and revise the adapters and interfaces. A small shared representation records what the parties actually agreed, their authority, relevant version/time, revocation conditions and acknowledgment. An offline request stays visibly pending until the institution accepts it. Two agents cannot create two copies of the same scarce shift by translating it differently. The parties retain an intelligible account of what happened instead of relying on an agent's narration.

**I — Field-level change:** personal software stops imposing a coordination tax on everybody around its owner. Institutions become accessible through many languages and interaction styles while retaining their legitimate rules. At scale, this could make the ability to participate independent of the ability to operate one particular vendor's UI. A household may customize its view; it cannot unilaterally fork a school's policy or another person's commitment.

### Why now; one-shot test

**I:** Email, calendars, standardized transactions and service integration already solve large parts of this. What was uneconomic was continuously tailoring both sides of millions of small, changing workflows across languages, devices and household circumstances. Cheap implementation could make that variation affordable. It does not make semantic disagreement disappear.

**I — Non-code value:** institutions willing to recognize externally produced actions, jointly accepted meanings, permission to access real systems and a history of resolved disputes. The adapter generator is disposable. A better model cannot grant a school administrator's authority, discover an unrecorded exception reliably or compel another organization to accept a proposed interpretation. More capable models make the network more usable while increasing the importance of specifying who can commit whom.

### Physics, economics, data and law

**E:** A stress case of one million institutions × 200 participating households × 20 changes/month yields **four billion changes/month**. At 2 KB per event, that is **8 TB/month** of raw event payload before indexes, retention and replication. Transport and deterministic validation are tractable; confidentiality and governance are harder than storage capacity.

**E:** Reasoning over 40,000 input and 4,000 output tokens for every change would cost **$0.12/change** under proposal 1's illustrative rates, or **$480 million/month**. Generate an approved interface/adapter when a workflow changes, then exchange deterministic messages. If 200 million participant surfaces each need a $0.30 regeneration annually, that is **$60 million/year**, with a highly uncertain long tail. Always-running personal agent teams are unnecessary for this workload.

**E:** At a hypothetical 10–100 Wh per annual surface regeneration, that same 200-million-surface case uses **2–20 GWh/year** of serving energy. Message transport, devices and training are additional. Four billion notifications at $0.001 each would cost $4 million/month; voice calls can be much more expensive and must be budgeted by actual country/provider rates. Physical access is not solved by small JSON messages.

**E:** If 0.1% of changes require three human minutes to resolve a disagreement, that is **200,000 hours/month**, or **$6 million at $30/hour**. A 1% rate multiplies it by ten. The objective is completed, uncontested participation with low human effort, rather than maximizing agent-to-agent traffic.

**I — Data:** begin with an institution that already has an accessible calendar or sheet and an authorized administrator. Do not infer a current allocation from stale cached data or silently expand a translated request into a commitment. Languages need acceptance by speakers; a generic translation quality score does not establish that a date, obligation or cancellation was understood.

**F/I — Law:** data portability and authorization are distinct. Organizational duties and other participants' privacy survive a new interface. The pilot uses adult voluntary commitments, no payments and no clinical decisions; a production school or clinic would need its own authority, data-processing and retention arrangements. This is a deployment requirement, not a proposal for agents to waive institutional rules. [Commission guidance](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/dealing-requests-individuals_en).

### Closest attempts and their limits

**F/I:** Valueflows/hREA already model the central economic objects; Solid already separates data from app choice; AD4M already spans agents and social perspectives. Manyshape can generate different user surfaces over an authorized contract. OpenFn already does public-service integration at institutional scale. Kody already moves personal agent resources across hosts. Thus **a general interoperable personal-software substrate is rejected as the project**.

**I — Residual hypothesis:** can an ordinary institution accept real commitments through independently chosen personal software with *less* administration than its current app? Existing standards should carry the representation wherever possible. The new contribution would be an accepted institutional practice and observed interoperability cases. If hREA/OpenFn plus ordinary email already supplies that result, contribute the cases and stop building infrastructure.

### Six weeks for one person

**E:** Recruit one existing neighborhood tool library and one association that borrows its equipment, with six to ten consenting adults. Scope one workflow: request, accept, reschedule and return an equipment loan. Use two independently stored personal interfaces and the librarian's existing sheet. One interface can be a calendar/display; the other can be a large-text bilingual page with a print path. The people who depend on the workflow are the users; agent developers are not the target cohort.

**E — Weeks 1–2:** observe actual handoffs and exclusions; agree meanings and authority with the librarian; check Valueflows/OpenFn before creating any schema. **Weeks 3–4:** implement one bounded bridge in TypeScript, a local queue and a readable record of acceptance/revocation. Run real loans while retaining the current process as fallback. **Weeks 5–6:** exercise an offline reschedule, a conflicting request, a withdrawn authorization and a participant changing interface; have the librarian and borrowers independently state what they believe is agreed. Publish mismatches, extra work and successful completions.

**I — New result sought:** a real group changes its accepted participation rule from “use our software” to “satisfy these obligations,” while participants retain different tools and agree on contested outcomes. A synthetic three-agent scheduling demo would supply no evidence of that institutional change.

### What kills it; builder fit

**I — Strongest objection:** the institution quite reasonably prefers one standard interface; supporting diversity increases ambiguity, fraud handling and help-desk work. Personal software may mostly reintroduce bespoke integration costs that a common app successfully eliminated.

**E — Cheapest disproof:** use email/calendar invitations and a human-translated bilingual form for ten real transactions before coding. Stop if the institution refuses the arrangement, participants see no benefit, or extra coordination exceeds the burden of its existing app. Continue only when a specific exclusion or repeated mismatch is observed. No standards working group is required to run this test.

**I — Builder fit: good technical fit, harder permission fit.** Typed effects, synchronization, capability boundaries and small interpreters fit the builder. Institutional participation is the scarce asset; a broad protocol rollout does not fit a part-time solo start. Open-source an adapter and its actual field evidence within an existing ecosystem. GrowOS has no role.

## 3. A public works network for personal computing

### Seed

**Q — Sunil Pai, Next Token Ep 05, 51:00:** “How do you actually make lives better?” At 53:00 he asks for software “for your family for your friends”; at 54:00: “I'm tired of seeing new agent frameworks.” [Video](https://www.youtube.com/watch?v=gPBw5Cr9VJo&t=3060s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/12-next-token-ep-05-i-m-the-arbiter-of-tokens-and-gpus.txt:55).

**Q — Tobi Lütke, p3-65, 12:00:** “computers to fulfill our wishes.” His concrete example combines code-driven design, a 3D printer and a child selling physical objects. [Video](https://www.youtube.com/watch?v=p7AhQO3Y-GY&t=720s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-65-vercel-the-third-customer-a-fireside-with-tobi-l-tke-and-guillermo-rau.txt:16).

**Q — Eric Simons, ViteConf p3-64, 3:50:** “anyone has the abundance of intelligence to just go and build.” The same passage names hardware and electricity as conditions for local execution. [Video](https://www.youtube.com/watch?v=PfyIEgLzNYI&t=13800s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-64-viteconf-viteconf-2026-5th-edition-we-are-vite.txt:234).

**Q — Sunil Pai, Latent Space video 49, 14:00:** “infrastructure and LLMs almost fail you.” [Video](https://www.youtube.com/watch?v=287Q-bs_pEU&t=840s), [captions](/Users/noah/code/sofort/arch/research/corpus/transcripts/49-latent-space-why-you-should-build-science-fiction-sunil-pai-cloudflare.txt:18).

### Full-scale vision

**I:** A person enters a library, school workshop or village service point and describes something they cannot do with their existing tools. The local team can change software, produce a tactile control, print a fitted guide, create talking labels or offer a paper/voice interface. The person need not own a powerful phone, read English or describe a software specification. The deliverable is an accepted ability in that person's daily environment, with a repair route.

**I:** A worldwide network accumulates **fit histories**: which physical/software configurations worked, for which task and environment, what failed after use, and what another site reproduced. Participants decide what observations may travel. Agents handle CAD, firmware, localization and program changes; local people provide the observations, consent, fabrication, fitting and care. Schools and clinics can participate as places, with appropriate domain oversight, instead of merely becoming buyers of another dashboard.

**I — Field-level change:** bespoke computing becomes a form of public works, delivered where people live. The network's valuable knowledge is how to make a real person capable of a real task, not how to generate another nominally accessible interface. This is the most crazy-but-not-impossible proposal here because it joins digital abundance to a distributed physical service institution.

### Why now; one-shot test

**I:** Makers, accessibility services and communal computing already exist. The formerly prohibitive part was making and maintaining the software, firmware, physical dimensions and language variants for vast numbers of individual situations. Cheap engineering could remove enough design/iteration labor to make local delivery practical. It cannot remove fabrication, fitting or the need to learn what happened during actual use. If those dominate so completely that cheaper engineering changes no access, the thesis fails.

**I — Non-code value:** physical sites and equipment, trained local partners, consented observations, accepted adaptations, repair relationships and reproducibility across sites. A model two generations better can generate almost all the technical artifacts. It still cannot fabricate a control in a village lacking equipment, know how a particular person experiences it without observation, or create trustworthy local support by emitting a website.

### Physics, economics, data and law

**F — Reach constraint:** ITU estimates six billion people online in 2025 and **2.2 billion offline**. Its affordability analysis also finds much higher income-relative broadband costs in poorer economies. An eight-billion-person thesis must allow shared devices, offline operation and people who never install a personal app. [ITU connectivity](https://www.itu.int/en/mediacentre/Pages/PR-2025-11-17-Facts-and-Figures.aspx), [affordability](https://www.itu.int/itu-d/reports/statistics/2025/10/15/ff25-affordability-of-ict-services/).

**E — Bounded station:** a reused computer, camera, input devices and access to a basic printer/fabrication service could require **$500–1,000** in equipment; **$800** is a planning midpoint, excluding premises, technician training and replacement stock. Begin with low-voltage USB controls and non-load-bearing guides, rather than assuming a workshop can manufacture arbitrary objects. No biological, material or power constraint makes that narrow scope implausible.

**E — Scale case:** one million sites at $800 implies **$800 million** in initial equipment. Fifty adaptations/site/month yields **600 million adaptations/year**. At $10 materials, $1 inference/design and half an hour of local labor at $20/hour, direct variable cost is **$21 each**, or **$12.6 billion/year**, before sites, logistics, failed attempts and administration. Three fitting hours instead of half an hour make it **$71 each**. This is a service/funding challenge; lower token prices do not settle it.

**E — Energy:** a continuously running 20 W local computer consumes about **175 kWh/year**. Add an illustrative **0.1 kWh fabrication energy/adaptation × 600/year = 60 kWh**. One million such stations consume about **0.235 TWh/year**, excluding remote inference, transport and embodied equipment energy. At an additional 10–100 Wh of inference per adaptation, the remote serving allowance adds **6–60 GWh/year**. These are equipment assumptions for simple objects, not measured impacts or a promise that every print uses 0.1 kWh.

**I — Data:** a mesh file is insufficient. The useful record includes hardware/firmware versions, physical measurements, environment, a task the person selected, observed trouble and the person's accepted result after use. Bodies, disabilities and household observations can be sensitive. Keep identifying records local and publish only expressly authorized, minimized cases. Sharing a printable design does not require sharing a person's health history.

**F/I — Law:** the EU's software-device guidance classifies medical software by intended purpose, including software running in the cloud or on phones. Calling a service “personal” or “open source” does not decide its regulatory status. The pilot must select a use with a qualified local partner and document intended use; any clinical or safety-critical expansion needs its own assessment and responsible organization. [MDCG software guidance](https://health.ec.europa.eu/system/files/2025-06/mdcg_2019_11_en.pdf).

### Closest attempts and their limits

**F:** Makers Making Change already reports more than 30,000 devices delivered, more than 200 designs and a substantial volunteer network. Its live request board includes software-sensitive fitting needs: a September 2026 request asks for a keyguard fitting a particular communication device **with its case and handle**, rather than a generic keyguard. The board supplies evidence of specific demand, not evidence that any request is medically appropriate or still unresolved. [Program](https://www.makersmakingchange.com/), [request board](https://www.makersmakingchange.com/maker-wanted/).

**F:** Its LipSync project combines physical components, firmware and user/clinician feedback; the public repository puts a single build's materials around $325, lower in quantity. Dynamicland already demonstrates computation integrated into physical communal work. Morphic already makes accessibility configurations portable; a published study reports cases where applications ignored those configurations. [LipSync](https://github.com/makersmakingchange/LipSync), [Dynamicland](https://dynamicland.org/2024/Intro/), [Morphic](https://morphic.org/Product-Overview/), [adoption study](https://link.springer.com/content/pdf/10.1007/s10209-023-00984-1.pdf).

**I — Residual hypothesis:** use cheaper engineering to increase the share of individual fit problems these existing networks can solve and continue supporting. The network itself is prior art. A contribution that links parameterized physical design, software behavior and independently reproduced fit evidence could be useful. Creating a competing maker directory or claiming an autonomous universal factory would fail this search.

### Six weeks for one person

**E:** Work with one existing maker/accessibility workshop, one qualified local practitioner and **three consenting adult users** who each have a frustrating everyday computer task. These are proposed participants, not people already recruited. Choose one device family, such as a USB input control for operating a personal display or media tool; adapt an existing openly licensed design. The partner must agree that the task and prototype scope are appropriate.

**E — Weeks 1–2:** observe each person using the current arrangement, choose their task and record the actual fit problem. Obtain partner review before fabrication. **Weeks 3–4:** generate the small software/firmware and physical variants; implement an offline local configuration tool in TypeScript/Rust only where existing tools are inadequate. **Week 5:** let people use the adaptations for an ordinary week, recording breakdowns and unwanted effort. **Week 6:** have a second maker reproduce one adaptation from the minimized case without consulting its author; publish time, material cost, failed versions and user acceptance.

**I — New result sought:** an independently reproduced, user-accepted adaptation where the relevant fit spans physical dimensions and software behavior, with evidence from ordinary use. It should become an upstream device or method contribution. A printed object on the builder's desk is insufficient.

### What kills it; builder fit

**I — Strongest objection:** fittings, trust and local logistics dominate, so cheap engineering yields little additional access. A maker platform plus human expertise may already solve every selected case. Fitting observations may be too person-specific to transfer, eliminating the proposed accumulating advantage.

**E — Cheapest disproof:** spend two observation sessions at an existing workshop before writing code. Identify ten requests and ask which are blocked by software/design iteration versus money, equipment, travel or expertise. Stop if none has a tractable engineering bottleneck, no appropriate partner participates, or the existing design already works once somebody simply builds it. Do not count refusing a physically or clinically inappropriate request as a product failure.

**I — Builder fit: moderate and partner-dependent.** Device protocols, firmware, bounded runtimes and cross-device tooling fit the technical background. Physical fabrication and accessibility judgment require partners. It is feasible as one device-family contribution in six weeks; operating a global network is a long institutional program. It does not involve GrowOS.

## Cross-cutting exclusions and failure conditions

| Constraint | I — Required outcome | Cheapest observation that can contradict it |
|---|---|---|
| Trust | People can explain who may act, who is responsible and how to revoke access. | Ask participants independently; inspect their actual access changes. |
| Maintenance | Useful behavior continues through caretaker and provider turnover. | Remove the maker from a bounded routine; record every rescue. |
| Data ownership | People retain usable records and can control legitimate onward sharing. | Export, restore elsewhere and ask every affected party what transferred. |
| Payments | Routine use is affordable without hidden token debt or subsidy assumptions. | Invoice a bounded period at observed cost; count payment and administration fees. |
| Devices/connectivity | The actual old phone, shared machine or offline path works. | Use participants' equipment, including a cold start without the network. |
| Language | The person understands the actual obligation or device behavior. | Have speakers explain it back with a deliberately ambiguous example. |
| Literacy | People can complete their task without learning software administration. | Observe an unaided attempt; include a non-text path where needed. |
| Attention | The system returns time and does not create a new household management job. | Count interruptions, setup, governance and support time against the current routine. |

**I:** A one-off successful demo satisfies none of the continuing claims by itself. Better models may eventually handle almost all technical judgment. Missing authority, observations, physical capacity and conflicting interests still require an explicit resolution. The proposals are attractive as public, open institutions even if their code becomes a commodity.

## Ranking and decision

All ratings are **I**, relative judgments rather than market measurements.

| Rank | Proposal | Durable non-code asset | Why take it seriously | Main reason to decline |
|---|---|---|---|---|
| **1** | **Software mutuals** | Trusted succession, paid care capacity and repair/use history | Closest connection between Ben's finished tailoring, Ryan's ownership pain and the builder's systems skills | Support tail may prevent household economics; willing successors may not exist |
| **2** | **Institutions without compulsory apps** | Counterparty acceptance and jointly governed meanings | Addresses the network tax that appears when everybody has different software | Established common apps may be the better coordination solution |
| **3** | **Public works for personal computing** | Physical reach, fit evidence, fabrication and repair relationships | Reaches people whose limiting interface is their device or physical environment | Partnerships and fitting dominate the solo builder's contribution |

**I — ONE pick:** run the software-mutual handover test. Start with the eight-household association cohort and its rotating volunteers; publish every support minute and failed transfer. Build only the custody components that this test proves necessary. Scale the *institution of continued care* after measuring it, rather than treating app count as progress.

**I — Most crazy-but-not-impossible:** the public works network. Its destination is a million places where a person's wish can become a fitted computational tool, with local accountability and transferable experience. Material, energy and equipment costs are large but finite. Trustworthy local delivery and maintenance are the hard part.

## Five-line TL;DR

1. **I:** The eight-billion-person opportunity is reducing people's software obligations while giving them tailored capabilities.
2. **F/I:** Builders, persistent artifacts, portable agent clouds, cooperative hosting and device-making networks already exist; their mechanisms are not the novelty.
3. **I:** Pick software mutuals: shared responsibility and successful succession can outlast a one-prompt rewrite.
4. **E:** Spend six weeks with eight households, three small application classes and two successor volunteers; measure useful continuity and all human effort.
5. **I:** Keep the physical public-works network as the wild ambition; abandon either thesis when real participation and costs contradict it.
