# Agentic internet, build versus buy, and VSCO's business agent

Research date: 2026-10-28. Assigned talks: 01, 02, 08.

**I — Finding:** the broad agentic-web opportunity is occupied. The useful residue is testing a customer's business promises across product surfaces, plans, and representations. Three narrowly scoped candidates survive provisionally; none has strong evidence of a standalone market yet.

## Evidence conventions and scope

- **Q**: quoted from the supplied captions; a speaker's assertion, not independent verification.
- **F**: supported by the linked external source. A published implementation or package establishes availability, not adoption or reliability.
- **I**: interpretation, proposed project, or bounded negative search result.
- **E**: estimated effort, demo timing, or subjective score.

**F — Reading coverage:** every line of all three assigned transcripts was read, including the audience questions: [01](/Users/noah/code/sofort/arch/research/connect26/transcripts/01-building-an-open-agentic-internet-discoverable-callable-and-.txt), [02](/Users/noah/code/sofort/arch/research/connect26/transcripts/02-it-s-time-to-build-not-buy.txt), [08](/Users/noah/code/sofort/arch/research/connect26/transcripts/08-an-agent-that-onboards-a-photography-studio-on-workers-ai.txt). Timestamps locate the captions' minute buckets; they are not second-accurate quote locations. Brackets mark obvious caption corrections. Uncertain model names and benchmark numbers are not silently repaired.

**F — Background consulted:** [research summary §0, §11, §12](/Users/noah/code/sofort/arch/research/RESEARCH-SUMMARY.md) and [stack summary §1](/Users/noah/code/sofort/arch/research/stack/SUMMARY.md). **I:** generic agent hosting, identity, payments, MCP discovery, app generation, replay gates, and workflow runtimes are excluded as new pitches.

Role keys used in every signal table: **CF** = Cloudflare employee; **VSCO** = customer speaker, Andreas Salme, senior director of software engineering at VSCO, as introduced in talk 08; **AUD** = audience member, employer unspecified; **MCE** = audience member from Maricopa County Elections. **F:** the [official talk-01 session page](https://www.cloudflare.com/connect/2026/session/building-an-open-agentic-internet-discoverable-callable-and-payable/) identifies Matthew Conroy, senior director of product management, Cloudflare. **Q:** Ryan Skidmore introduces himself as working on developer productivity and AI at Cloudflare in 02 00:00. **F:** [VSCO's help center](https://help.workspace.vsco.co/en/articles/15556802-getting-started-as-a-vsco-member-with-vsco-workspace) confirms the company/product spelling behind the captions' “Disco” and “Visio.”

## 1. Per-talk signals

### Talk 01 — Building an open agentic Internet: Discoverable, callable, and payable

[Video](https://www.youtube.com/watch?v=_LYr4dSmdsk). Each quote is **Q**; each meaning is **I**. Types: prediction, wish/gap, pain, hand-rolled, limit, roadmap. A roadmap row stays occupied even when a speaker also describes an unresolved problem.

| ID | Time | Role | Type | Q — short caption quote | I — meaning |
|---|---|---|---|---|---|
| A01 | 00:00 | CF | Pain | “patching PHP applications at 6:00 a.m. this morning” | Operational ownership remains a real cost; this anecdote does not establish an agent-specific product gap. |
| A02 | 01:00 | CF | Prediction | “that number is going to go way higher, and it's all going to be automated” | Small sites should expect substantially more machine requests. |
| A03 | 02:00 | CF | Hand-rolled / platform capability | “submit a cryptographically verified HTTP header” | Cloudflare already identifies participating bots cryptographically; identity is occupied. |
| A04 | 03:00 | CF | Pain | “human traffic is dropping a lot, considerably” | His hometown news site loses the human audience behind its revenue. |
| A05 | 03:00 | CF | Pain | “His revenue from ads is just going down. His revenue from subscriptions is going down.” | Machine traffic is not replacing the publisher's existing income. |
| A06 | 04:00 | CF | Pain | “97% less human traffic hitting the site” | He cites a severe Digital Trends example; the percentage is a talk claim, not a general industry rate. |
| A07 | 05:00 | CF | Pain | “for every 3,400 visits their agent accesses any given site, they're sending one human visit back” | Crawl volume and referral value can diverge sharply. This is his Perplexity snapshot. |
| A08 | 05:00 | CF | Pain | “more resources, more load, more servers” | Publishers pay for requests even when the requests produce little direct revenue. |
| A09 | 06:00 | CF | Prediction | “eventually it will probably hit everyone including e-commerce installations, small blog providers” | He expects the publisher problem to spread beyond news. |
| A10 | 07:00 | CF | Limit / pain | “it's harder for you know bot detection providers such as Cloudflare to actually detect them and stop them” | AI-browser traffic can resemble ordinary users; identification is incomplete. |
| A11 | 08:00–09:00 | CF | Hand-rolled commercial arrangement | “signing direct deals with the big frontier model providers” | Large publishers have bespoke licensing; that does not make the long tail self-serve. |
| A12 | 09:00 | CF | Pain / requirement | “freshness of content is extremely important” | A licensed stale answer is still a poor answer. |
| A13 | 09:00–10:00 | CF | Pain | “out-of-date or no access to the latest best content” | Missing fresh source information is a separate problem from reasoning quality. |
| A14 | 10:00 | CF | Wish / roadmap | “we need to make it easy for both sides to to achieve their end goal” | Cloudflare's scope includes discovery and efficient access, beyond collecting payment. |
| A15 | 11:00 | CF | Pain / workaround | “I've actually had a couple of sites go down” / “I had to block them” | He blocked Meta crawlers despite wanting to distribute product catalogs. Availability and discovery conflicted. |
| A16 | 11:00 | CF | Roadmap / deployed capability | “The proxy will automatically issue a new endpoint” / “without hitting your backend server” | A signed-bot endpoint serves extracted Markdown away from the origin. Do not build generic crawl offload. |
| A17 | 12:00 | CF | Roadmap | “still very much under development” / “building an open index” | Cloudflare explicitly owns the network-wide discovery/index project. |
| A18 | 12:00–13:00 | CF | Requirement | “It's your content, it's your application, under your control.” | Participation and access choices must remain with the publisher. The captions' opt-in wording immediately before this is contradictory. |
| A19 | 13:00 | CF | Pain / hand-rolled | “discovering new domains and sites ... was one of our biggest challenges” | His former employer Netcraft needed domain discovery and partnered with others for domain lists. |
| A20 | 13:00–14:00 | CF | Hand-rolled / roadmap | “We give them signals of new domains” | Cloudflare and OpenAI have already piloted discovery assistance. |
| A21 | 15:00 | CF | Roadmap / limit | “it's the trust-based system” / “still some work to be done there” | Purpose and reuse preferences are being standardized, with compliance dependent on participants. |
| A22 | 16:00 | CF | Gap / roadmap | “a frontier model provider only needs to crawl you once, and they may reuse that content 100,000 times” | Request billing does not account for subsequent use. Cloudflare explicitly takes this on. |
| A23 | 16:00–17:00 | CF | Roadmap / limit | “still under development” / “pay per use is based on a trust system for now” | Reuse compensation depends on identified buyers and reported use, not independently observable downstream execution. |
| A24 | 17:00 | CF | Roadmap / availability | “This is in private beta.” | Monetization Gateway is an access-controlled product, not an empty opening. |
| A25 | 18:00 | CF | Roadmap / deployed capability | “re-access the content with proof that they have paid” | The gateway implements a 402 payment-and-retry flow for content and APIs. |
| A26 | 19:00 | CF | Roadmap / deployed capability | “only make portions of your API ... requiring payment” | Endpoint and regional pricing rules already belong to the proxy. |
| A27 | 19:00–20:00 | CF | Roadmap / ecosystem | “implement it actually on your own servers without a proxy” | The payment protocol is open and has other implementers. A Cloudflare-independent wrapper is not intrinsically new. |
| A28 | 20:00 | CF | Limit / roadmap | “how do we scale up this concept of micro payments?” | Payment scale and Cloudflare's Net Dollar stablecoin initiative are on Cloudflare's agenda. |
| A29 | 20:00 | CF | Prediction | “by the time we meet again next year ... the new business model of internet taking shape” | He expects adoption to clarify the economics within a year; it is not established revenue evidence. |
| A30 | 21:00 | AUD | Wish / pain | “most people have no idea how to how to price” | Publishers need price discovery, not just a field in a dashboard. |
| A31 | 21:00 | CF | Limit / current behavior | “You just define the price for the endpoints.” | Gateway prices are seller decisions; the bot chooses whether to buy. |
| A32 | 21:00–22:00 | CF | Roadmap | “that is more of a bidding system” / “well under development” | Buyer offers, acceptance ranges, and optimization for reused content are explicitly taken. |
| A33 | 22:00–23:00 | CF | Hand-rolled | “I've actually done something similar on one of my sites.” | He built an article-summary API, referral path, and monetization layer himself. This is a concrete publisher integration signal. |
| A34 | 23:00 | CF | Pain / limit | “agents even sign up to subscriptions, crawl all of the content, and then redistribute it” | Authentication and payment do not prove that downstream use follows the publisher's terms. |
| A35 | 24:00 | CF | Pain | “the web archive ... now they're getting abused” | Copies held elsewhere complicate control; checking one's own endpoints cannot solve redistribution. |
| A36 | 24:00 | AUD | Wish / gap | “how do you balance the monetization versus discoverability?” | Adding a pay gate can reduce reach, and the business tradeoff is unclear. |
| A37 | 24:00–25:00 | CF | Limit / policy choice | “a smaller news agent may want to give access ... for free” | Cloudflare supplies controls but does not choose the publisher's business strategy. |
| A38 | 25:00–26:00 | CF | Limit / hand-rolled | “for very large publication like BBC, we're going to be building something custom” | Content preparation is not uniformly solved by a switch; large publishers require integration work. |
| A39 | 26:00 | CF | Roadmap | “our new model, [Clairic], that we just launched” | Unstructured-to-structured extraction already has a Cloudflare owner. |
| A40 | 26:00 | CF | Hand-rolled | “they all have alternatives to their standard human readable sites, which are optimized for agents” | Publishers maintain multiple representations that must preserve intentional access and content choices. |
| A41 | 27:00 | AUD | Pain / gap | “not creating different ... functions?” | The audience is uncertain about overlap among AI Search, MCP, and crawl features. |
| A42 | 27:00–28:00 | CF | Limit / roadmap explanation | “If I don't know about you ... I don't know where to go.” | Discovery and efficient retrieval solve separate parts of the flow; Cloudflare is building both. |
| A43 | 29:00–30:00 | CF | Pain / roadmap | “people are trying to bypass protections” / “way more complicated ... cases” | Residential proxies are one example, not a complete explanation or a new mitigation opportunity. |
| A44 | 30:00 | MCE | Wish / pain | “we want the right information out” / “we're updating throughout the day” | A public-information publisher wants freshness and reach, not payment or blocking. |
| A45 | 30:00–31:00 | CF | Roadmap / limit | “you need a way to ... notify that your content has changed” / “actively working on” | Push updates, subscription, and provider notification are explicitly Cloudflare work. |
| A46 | 32:00 | CF | Prediction / roadmap | “Content definitely value over time goes down.” | Cloudflare is designing buyer offers around changing content value; do not pitch a generic decay-price engine. |
| A47 | 32:00–33:00 | CF | Limit / uncertainty | “the internet is blowing up with content and replicas” / “I don't know how that's going to play out” | Duplicated supply and long-term pricing remain unresolved; the speaker does not claim a solution. |

### Talk 02 — It's time to build, not buy

[Video](https://www.youtube.com/watch?v=-_qUn_LfJ6M). Quotes are **Q**, meanings **I**.

| ID | Time | Role | Type | Q — short caption quote | I — meaning |
|---|---|---|---|---|---|
| B01 | 01:00 | CF / audience response | Pain / prediction | “software ... that your team actively works around” / “rebuilding ... in a weekend ... pretty feasible” | Existing SaaS often fits poorly, while implementation has become cheaper. The show of hands is not a demand survey. |
| B02 | 02:00–03:00 | CF | Pain | “months of ... engineering work” / “you're on call for it as well” | Building includes ongoing ownership, not only writing code. |
| B03 | 03:00 | CF | Pain | “SaaS prices have increased 16.4%” | He cites SaaS inflation as motivation; do not treat an unattributed slide statistic as a verified market estimate. |
| B04 | 03:00 | CF | Pain | “65% of people have a license for something and they just never use it” | License waste and management friction are part of the buy-side cost. |
| B05 | 03:00 | CF | Pain | “79% of IT leads have been hit with IT price rises at renewal” | Renewal uncertainty contributes to the wish for control. |
| B06 | 04:00 | CF | Prediction / economic change | “the same outcome, but 75 times cheaper” | His benchmark-based token-price comparison supports the thesis direction, not a precise build-cost forecast. |
| B07 | 04:00–05:00 | CF | Prediction / limit claim | “agents are now finishing longer tasks” / “the benchmark actually hit its limit” | Longer autonomous coding tasks make replacement plausible. Specific model/horizon claims remain unverified captions. |
| B08 | 05:00–06:00 | CF | Pain | “running it, fixing it, and replacing it” | Cheap generation leaves a lifecycle burden. |
| B09 | 06:00 | CF | Prediction / pain | “a thousand versions of slightly different but kind of the same software” | Personal software creates fragmentation inside organizations. |
| B10 | 07:00 | CF | Pain | “waiting 8, 12 hours for it to get a review” | Human review queueing is a measured internal bottleneck in his account. |
| B11 | 07:00 | CF | Hand-rolled / outcome claim | “now ... measured ... in ... minutes” | Their internal reviewer already addresses this bottleneck. |
| B12 | 08:00 | CF | Pain / gap | “none of them were flexible enough for what we wanted” | Off-the-shelf reviewer customization failed Cloudflare's requirements. It does not imply that AI review is unoccupied. |
| B13 | 08:00 | CF | Hand-rolled / failed approach | “a Git diff” / “quite dumb prompt” / “it wasn't that effective” | A thin prompt wrapper was insufficient. |
| B14 | 08:00–09:00 | CF | Hand-rolled | “based on ... [OpenCode]” / “our own version on GitLab” | Cloudflare assembled existing components and a custom review harness. |
| B15 | 09:00 | CF | Hand-rolled | “500 merge requests to our internal AI reviewer” | Hundreds of internal changes show continuing adaptation and maintenance, not a one-off afternoon build. |
| B16 | 10:00 | CF | Pain / control | “how angry engineers get when they have to fight with an LLM” | An approval gate has real false-positive and usability costs. |
| B17 | 10:00 | CF | Outcome claim | “block about 16,000 merges ... over the past 4 months” | A substantial volume of enforced decisions makes reviewer quality consequential; blocks are not a proven bug count. |
| B18 | 10:00–11:00 | CF | Pain / hand-rolled | “fail over quickly” / “break glass mechanisms” | They built provider-outage recovery and an escape path so shipping can continue. |
| B19 | 11:00 | CF | Hand-rolled scale claim | “just over a million reviews” / “350,000 merge requests” / “7,000 repositories” | This is a large, already operating internal system. |
| B20 | 11:00–12:00 | CF | Pain / hand-rolled | “$0.67 per review” / “reduce our AI inference bill by 68%” | Optimization matters even after deployment; the linked written report has a different unit-cost figure, noted below. |
| B21 | 12:00 | CF | Pain / mistake | “raising a lot of issues which were kind of like non-issues” | Exhaustive nitpicking reduced usefulness; they narrowed findings to actionable issues. |
| B22 | 13:00 | CF | Limit / gap | “we can only really look at the [Git] diff” | Repo size limits the context this implementation can afford. |
| B23 | 13:00 | CF | Limit / gap | “a whole design doc ... we just can't ... pull that in at run time” | The reviewer can miss design intent outside the diff. |
| B24 | 13:00 | CF | Limit / gap | “difficult to check cross-process system impact” / “up to like a hundred services” | Checking a change's distributed effects is much more expensive than reviewing a local patch. |
| B25 | 13:00 | CF | Limit / pain | “probably take about three hours” | Exhaustive service-impact review would create unacceptable merge latency in his estimate. |
| B26 | 13:00 | CF | Limit | “time dependent races” / “hard to spot those in a static diff” | Some checks require execution and specialized tools. |
| B27 | 13:00–14:00 | CF | Limit | “millions of lines” / “a million token context” | Very large changes exceed a straightforward context-based review strategy. |
| B28 | 14:00 | CF | Limit | “it doesn't replace human review” | The deployed reviewer is not their complete acceptance process. |
| B29 | 15:00 | CF | Prediction | “build the replacement in 6 months with better models” | He expects tool replacement to become routine; persistent data and integrations still have to cross that boundary. |
| B30 | 16:00 | CF | Wish / requirement | “make sure that there is an exit from the vendor” | Replaceability needs a credible exit path, whether the current tool is bought or built. |
| B31 | 17:00 | CF | Pain / requirement | “maintenance, the on-call burden” | Prototype economics alone are insufficient for the build decision. |
| B32 | 17:00 | CF | Hand-rolled / composition | “reuse ... [OpenCode], workers KV, ... AI gateway” | The opportunity is in customer-specific composition; the underlying components already exist. |
| B33 | 17:00–18:00 | CF | Wish / requirement | “make sure you measure it” / “keep a way out” | Lifecycle costs, impact, and recovery need evidence. |
| B34 | 18:00 | CF | Prediction / pain | “building got cheap, but owning it is still kind of a problem for now” | Ongoing ownership is the unresolved part of the thesis. |
| B35 | 19:00 | AUD | Wish / gap | “shouldn't all of that same skills, prompts, and context just be part of the developer's” | The audience wants review requirements available before submitting a change. |
| B36 | 19:00–20:00 | CF | Limit / hand-rolled | “AI is ... never deterministic” / “review it from like five different angles” | They compensate with multiple review perspectives and custom tooling. |
| B37 | 20:00 | CF | Hand-rolled / limit | “a local version of ... that same AI review” | Local review parity is already implemented; nondeterministic findings still differ. |
| B38 | 20:00–21:00 | CF | Roadmap | “internal standards ... one of our big focuses at the moment” | Cloudflare is already pushing standards into generation-time workflows. |
| B39 | 21:00 | CF | Limit / pain | “They don't necessarily always get invoked when they should” | Agent skills are not guaranteed enforcement of engineering requirements. |
| B40 | 21:00 | CF | Prediction / observed behavior | “wait for the CI ... fix them ... loop until everything's ... good to go” | He sees agents consuming CI feedback autonomously; another generic repair loop is not an opening. |

### Talk 08 — An agent that onboards a photography studio — on Workers AI

[Video](https://www.youtube.com/watch?v=I4AMpO2KCTA). Quotes are **Q**, meanings **I**. Application limits below are not claims that Workers AI lacks the capability.

| ID | Time | Role | Type | Q — short caption quote | I — meaning |
|---|---|---|---|---|---|
| C01 | 00:00 / 04:00 | VSCO | Hand-rolled / evolution | “the agent has evolved quite a bit since” / “all of your day-to-day business needs” | Scout expanded from guided onboarding into business operations. |
| C02 | 01:00 | VSCO | Pain / customer preference | “far more ... acceptive ... on ... the business side ... not so much on the creative side” | Photographers accept AI for administration more readily than for creative work. |
| C03 | 01:00–02:00 | VSCO | Pain | “quite a steep learning curve” | A feature-rich CRM is difficult for occasional/new users. |
| C04 | 02:00 | VSCO | Pain | “studio work is scattered all across the CRM, deep hidden in UI and screens” | Users know the outcome but cannot find the workflow. |
| C05 | 02:00 | VSCO | Pain / limit | “you can't send an invoice unless you connect it to a job” | Business actions have prerequisite entities and ordering. |
| C06 | 02:00–03:00 | VSCO | Hand-rolled | “the team built Scout” | VSCO has already shipped an embedded assistant; do not pitch a photography CRM agent. |
| C07 | 03:00 | VSCO | Hand-rolled | “provides kind of proof that ... a job has been done” | The UI needs evidence of the result, beyond a conversational assurance. |
| C08 | 03:00 | VSCO | Implementation constraint | “We built parts of it using Cloudflare's technologies” | Inference and the incumbent application can live in different environments. |
| C09 | 04:00 | VSCO | Requirement / hand-rolled | “Reading and writing real studio data.” | The assistant executes mutations rather than only retrieving answers. |
| C10 | 04:00 | VSCO | Requirement / hand-rolled | “never claim success without checking or verifying that the mutation had taken place” | Completion must be checked against application state. |
| C11 | 04:00 | VSCO | Requirement / hand-rolled | “hand off ... with a deep link in the UI” | Unsupported actions must produce a usable self-service path. |
| C12 | 04:00–05:00 | VSCO | Requirement / hand-rolled | “respect plan tiers” / “up upgrade to a different tier” | Tool admission and the response must reflect the user's purchased capabilities. |
| C13 | 05:00 | VSCO | Requirement / hand-rolled | “remember conversations across sessions” / “a different device” | Product identity and durable conversation continuity are required. |
| C14 | 05:00 | VSCO | Requirement | “ask the user clarifying questions” | Missing business information should not be guessed merely to finish a task. |
| C15 | 05:00 | VSCO | Requirement / hand-rolled | “multiple product surfaces” / “streaming replies” | One agent must fit several interfaces while remaining responsive. |
| C16 | 06:00 | VSCO | Hand-rolled | “the same agent using two different harnesses” | The classic CRM and Atlas have separate adapters and feature sets. |
| C17 | 06:00 | VSCO | Hand-rolled | “knows what the current page in the app” / “studio settings” | Invocation context includes product location and studio configuration. |
| C18 | 07:00 | VSCO | Hand-rolled | “check all the preconditions” | Tier checks and prerequisite creation remain application logic. |
| C19 | 07:00 | VSCO | Hand-rolled | “reread the ... record” | Their concrete completion check is a read after mutation. |
| C20 | 07:00 | VSCO | Hand-rolled | “a nice looking card ... see ... the invoice that was created” | An actionable result card ties the assistant's claim to the actual record. |
| C21 | 08:00 | VSCO | Hand-rolled | “a declarative capability with a tier” | VSCO built a product-specific action catalog. |
| C22 | 08:00 | VSCO | Hand-rolled | “completed ... guiding the user ... or ... an upgrade” | Three semantic outcomes must stay consistent with policy and actual application behavior. |
| C23 | 08:00 | VSCO | Hand-rolled / maintenance | “adding an action is a data change plus plus an adapter change” | Capability expansion avoids retraining but still requires business integration. |
| C24 | 08:00–09:00 | VSCO | Pain / change pressure | “tuning different prompts” / “evaluating different models” / “adding new actions” | Model, prompt, action, and packaging changes create a shifting test surface. |
| C25 | 09:00 | VSCO | Pain / hand-rolled | “the vocabulary between the two CRMs were ... different” | A response and link appropriate for one product can be wrong in the other. |
| C26 | 09:00 | VSCO | Hand-rolled | “a rich feature flagging system” | Availability also varies by flags, beyond nominal plan tier. |
| C27 | 09:00 | VSCO | Hand-rolled stable substrate | “how we verify that mutation had taken place” / “conversation memory ... staying put” | Business checks and state plumbing change less often than models and prompts. |
| C28 | 10:00 | VSCO | Hand-rolled composition | “LangChain ... LangGraph ... deep agents ... AGUI bridge” | The harness is assembled from existing Python/streaming components. |
| C29 | 11:00 | VSCO | Platform capability | “single gateway for multiple harnesses” / “OpenAI compatible in the API layer” | Workers AI reduced provider-wrapper work; this abstraction already ships. |
| C30 | 12:00 | VSCO | Limit / customer roadmap | “all of the things you see in the workspace UI today is not declared as APIs” | Scout's capability ceiling is VSCO's API coverage, not a stated Workers AI limitation. |
| C31 | 12:00 | VSCO | Customer roadmap | “keep evaluating new models” / “exploring durable objects” | VSCO is considering platform primitives that already exist. No new state-hosting product is implied. |
| C32 | 12:00 | VSCO | Customer roadmap | “[Clef] ... decision model ... manage token spend” | Cheaper decision routing is an intended integration with Cloudflare's model family. |
| C33 | 13:00 | VSCO | Organizational constraint / uncertainty | “they work in Python” / “I wish I had ... an exact answer” | Team tooling influenced framework choice; the speaker does not explain every runtime block in detail. |
| C34 | 13:00–14:00 | VSCO | Mistake / pain | “not have done so many guardrails in the initial versions” | Narrow onboarding behavior prevented useful operations users already wanted. This is not a claim that business authorization should be removed. |
| C35 | 14:00 | VSCO | Hand-rolled data boundary | “that context never got to the model” / “control that through the harness” | He says sensitive context stays within their infrastructure while the model selects a next step; the talk is not an independent data-flow audit. |
| C36 | 15:00 | VSCO | Hand-rolled effort claim | “started somewhere this summer” / “two people working on it” | A small team built the product-specific UI and harness; exact duration is not given. |
| C37 | 15:00 | VSCO | Hand-rolled / potential migration | “how we maintain the conversation state today” / “durable objects ... conversation state” | They already store conversation state; a migration to DOs is exploratory. The captions name the existing store “valid key,” probably Valkey; that identification is unconfirmed. |
| C38 | 16:00–17:00 | VSCO | Pain / customer preference | “a polarizing concept” / “how we ... position AI ... in the creative part” | AI features in the editor draw different reactions than business assistance. |
| C39 | 17:00 | VSCO | Limit / cost uncertainty | “I don't have exact numbers.” | The talk does not establish Scout's dollar cost or financial return. |
| C40 | 18:00 | VSCO | Hand-rolled workaround | “if ... context gets too large, we summarize” | They already compact conversation context before inference. |

**I — Limit audit:** these talks do not establish a missing Workers runtime capability, a DO scaling ceiling, or a Workers AI concurrency limit. The concrete limits are information visibility, affordable review scope, application API coverage, policy combinations, and incomplete control over downstream content use.

## 2. Checked signals and classification

**I — Classification rule:** **Open** means the narrowly defined deliverable was not found in this bounded search. It is not a claim of global novelty. **Being built** means an identified implementation or proposal is underway. **Shipped** includes published open-source tools and restricted betas, with availability stated. **Cloudflare roadmap** means Cloudflare explicitly claims the unresolved work; that alone disqualifies the broad outsider pitch.

### 2.1 Agentic-web signals

| Signals | Classification | F / Q — check and source | I — consequence |
|---|---|---|---|
| A02–A10, A15: traffic, revenue, detection and origin pressure | **Shipped** controls; economic pain remains | **F:** [AI Crawl Control](https://developers.cloudflare.com/ai-crawl-control/) and [Cloudflare's agentic-web account](https://blog.cloudflare.com/agentic-web/) describe traffic visibility, bot distinctions, controls and monetization. **Q:** the local-site outage and lost revenue are the speaker's experience. | Do not pitch origin scheduling, bot analytics, or a generic AI-traffic control panel. A claimed decline in a slide is not verified revenue demand for a new tool. |
| A03, A10, A21, A43: identifying compliant bots | **Shipped**; ongoing **Cloudflare roadmap** for accountability | **F:** Cloudflare describes Web Bot Auth and its participating operators in [The Internet has a second audience](https://blog.cloudflare.com/agentic-web/). | Identity proves an operator signed a request; it does not prove every later use of the content. Generic agent identity is on the kill list. |
| A12–A14, A16, A38–A42: readable and callable content | **Shipped** components; custom integrations remain | **F:** [Markdown for Agents header-preservation changelog, 2026-07-13](https://developers.cloudflare.com/changelog/post/2026-07-13-markdown-for-agents-header-preservation/) documents actual transformation behavior. [AI Index's announcement](https://blog.cloudflare.com/an-ai-index-for-all-our-customers/) includes standard APIs and MCP access. | A Markdown converter, MCP facade, or agent-readiness generator is occupied. The residual is checking the publisher's expected content and access behavior. |
| A17, A19–A20, A42: domain discovery and open index | **Cloudflare roadmap** with pilot and private beta | **F:** [OpenAI discovery pilot](https://blog.cloudflare.com/cloudflare-openai-discovery-agentic-web/) reports hundreds of millions of pages from a cohort around 1% of Cloudflare's network. [AI Index](https://www.cloudflare.com/aiindex-signup/) advertises private-beta participation. | The talk's “several million” domains and the blog's pages are different units; do not substitute one for the other. New discovery infrastructure is taken. |
| A18, A21, A37: purpose controls | **Shipped**; standards continue evolving | **F:** [2026-08-31 crawl changelog](https://developers.cloudflare.com/changelog/post/2026-08-31-crawl-content-use/) adds declared reuse levels. [Browser Run docs](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/) describe trust-based purpose declarations. | Declared purpose is not measured downstream compliance. Also, Browser Run's account API named `/crawl` is distinct from the publisher-facing endpoint described in the talk. |
| A11, A22–A23, A30–A32, A46–A47: licensing, reuse and price discovery | **Cloudflare roadmap**; Pay Per Use beta already **Shipped** | **F:** [Pay Per Use, 2026-09-30](https://blog.cloudflare.com/pay-per-use/) describes buyer-defined offers, buyer-reported use, enrollment and payouts; counteroffers and differentiated pricing are future work. | Do not build a generic reuse-metering network, publisher bidding exchange, or price optimizer. Self-reporting is a limitation, not an outsider-solvable observability primitive. |
| A24–A28, A31: charging agents and API callers | **Shipped**, closed beta | **F:** [Monetization Gateway docs](https://developers.cloudflare.com/monetization-gateway/) specify matching rules and x402 verification/settlement. [Eligibility](https://developers.cloudflare.com/monetization-gateway/eligibility/) currently restricts buyers and sellers to the US and imposes account/zone requirements. | A Berlin-based builder should not assume immediate access to the Cloudflare beta. Open x402 implementations can support a prototype without that access. |
| A28–A29: micropayment infrastructure | **Cloudflare roadmap** | **Q:** Net Dollar and scale are explicitly Cloudflare initiatives at 20:00. **F:** the [gateway beta post](https://blog.cloudflare.com/monetization-gateway-beta/) describes the payment infrastructure and production use cases. | Another wallet, facilitator, or micropayment gateway is not a candidate. Future economic adoption is still uncertain. |
| A33–A35, A38, A40: bespoke summaries, paywalls, multiple representations | **Shipped** tooling; narrowly **Open** integration tests | **F:** [BrowserBash](https://www.browserbash.com/blog/test-paywall-metering-flows-ai) already tests and monitors browser paywall flows. [AgentMarkup audit](https://github.com/agentmarkup/agentmarkup/tree/main/packages/audit) compares browser/crawler views and checks machine-readable surfaces. | Broad paywall testing and crawler-view diffing are occupied. Only publisher-authored expectations over protected versus excerpt content, across CMS/API/Markdown/cache states, remain a conditional integration-pack opening (P3). |
| A21, A36–A37, A41: contradictory configuration and visibility | **Shipped** | **F:** [ai-signals-audit](https://github.com/fernforge/ai-signals-audit) supplies an npm CLI and CI action for contradictory AI-control carriers. [@nuxtjs/robots](https://www.npmjs.com/package/@nuxtjs/robots) already emits AI-crawler signals. | A robots/content-policy linter is also dead as a new pitch. P3 must test returned content against an owner's rule, beyond linting declarations. |
| A34–A35, A43: subscriber redistribution and external copies | **Being built** by platform/content-control vendors; no complete solution established | **Q:** Cloudflare says this is its bot-detection challenge. **F:** [Cloudflare's current framing](https://blog.cloudflare.com/agentic-web/) combines identity, controls and commercial agreements. | Do not claim to prevent copying after authorized disclosure. P3 measures only a publisher's own configured delivery paths. |
| A39: structured extraction | **Shipped** preview / **Cloudflare roadmap** open weights | **F:** [Clairic announcement, 2026-10-19](https://blog.cloudflare.com/clairic-extraction-model/) identifies the hosted Workers AI preview and intended open-weight release. | Generic extraction is occupied. Typed model output also does not establish that an external business effect occurred. |
| A44–A45, A12: freshness and push notification | **Cloudflare roadmap** / private beta | **F:** [AI Index signup](https://www.cloudflare.com/aiindex-signup/) explicitly describes pushing updates and a permissioned pub/sub feed. **Q:** the elections attendee supplies unusually concrete freshness demand. | Strong customer signal, but a change-notification feed would collide directly with Cloudflare's stated direction. |

### 2.2 Build-versus-buy and reviewer signals

| Signals | Classification | F / Q — check and source | I — consequence |
|---|---|---|---|
| B01–B09, B29–B34: cheaper builds, fragmented tools, ownership and exit | **Shipped** construction/export primitives; narrowly **Open** executable replacement drill | **F:** [D1 export](https://developers.cloudflare.com/workers/wrangler/commands/d1/) writes SQL. [pgcopydb compare](https://pgcopydb.readthedocs.io/en/v0.18/ref/pgcopydb_compare.html) compares PostgreSQL schema and data. [AirBridge](https://github.com/he8um/AirBridge/blob/main/docs/overview.md) documents Airtable backup, validation, dry-run and restore, including explicit exclusions. | Backup and migration are not new. P2 targets proving that a changed application can still perform a few owner-defined operations after importing its export. |
| B09: proliferating internal tools | **Shipped** adjacent cataloging | **F:** [Backstage's software catalog](https://backstage.io/docs/features/software-catalog/) tracks ownership and metadata for software. | Do not propose another internal-tool inventory or ownership registry. P2 must perform the exit, not merely list tools. |
| B10–B19, B21, B28, B36–B37: reviewer queue, customization, enforcement and local review | **Shipped** internally at Cloudflare | **F:** [Orchestrating AI Code Review at scale, 2026-04-20](https://blog.cloudflare.com/ai-code-review/) describes the OpenCode/GitLab implementation and repo-specific instructions. | Their custom reviewer is strong hand-rolled evidence of a requirement, but Cloudflare already solved its own need. A general AI reviewer is not a new opening. |
| B18, B32: provider failure and routing | **Shipped** platform capability | **F:** [AI Gateway fallback documentation](https://developers.cloudflare.com/ai-gateway/configuration/fallbacks/) documents fallback routing. **Q:** the reviewer's break-glass mechanism is its own internal control. | Do not confuse a general routing feature with an organization's policy for bypassing an unavailable reviewer. Neither is an empty broad project category. |
| B20: review cost optimization | **Shipped** internally | **F:** [2026-10-19 optimization report](https://blog.cloudflare.com/obsessive-inference-optimization/) reports a reduction from $2.43 to **$0.77**, and 68% savings. **Q:** captions say **$0.67**. | Preserve the discrepancy. Neither number establishes Scout's economics or makes a generic cache/routing optimizer novel. |
| B22–B27: missing design, distributed impact, races, huge changes | **Shipped** partial tooling; unsolved completeness is not a defined product | **F:** [CodeRabbit](https://landing.coderabbit.ai/) describes linked-issue/MCP context; [Speedscale's release notes](https://docs.speedscale.com/reference/release-notes/) document capture and replay; [Go's race detector](https://go.dev/doc/articles/race_detector) handles execution-time races in its supported setting. | The talk identifies several different limits. None of these tools proves arbitrary 100-service correctness. Do not re-pitch the already-researched generic replay gate or “review everything” engine. |
| B35, B38–B40: standards before review, skill invocation, CI repair | **Cloudflare roadmap** internally; **Shipped** adjacent testing | **Q:** Cloudflare says generation-time standards are a current focus and already offers local review. **F:** [Promptfoo's Claude Agent SDK integration](https://www.promptfoo.dev/docs/providers/claude-agent-sdk/) supports assertions over tool and skill use. | A skill library or another CI repair loop is occupied. Requirement enforcement should be a deterministic boundary check where possible. |

### 2.3 VSCO action and harness signals

| Signals | Classification | F / Q — check and source | I — consequence |
|---|---|---|---|
| C01–C06, C38: photographer onboarding and administration | **Shipped** by VSCO | **F:** [VSCO Workspace getting started](https://help.workspace.vsco.co/en/articles/15556802-getting-started-as-a-vsco-member-with-vsco-workspace) documents Scout and account tasks. | A business assistant for photographers is not open. The creative/business acceptance distinction is a product lesson, not proof of a general infrastructure gap. |
| C07, C09–C10, C19–C20, C27: verified mutations and result cards | **Shipped** | **F:** [Postcept](https://postcept.com/) verifies business outcomes against systems of record and gates completion claims; its [npm MCP package](https://www.npmjs.com/package/@postcept/mcp) supports refunds, cancellations and tickets. [Postcondition](https://github.com/christian140903-sudo/postcondition-mcp) provides constrained read-only outcome verifiers and receipts. | Generic read-after-write verification, completion receipts, and “never say done without evidence” are directly occupied, including business connectors. P1 must be a product-policy test pack, not a relabeled receipt SDK. |
| C05, C11–C12, C18, C21–C26, C30: prerequisites, tier, flags, adapters, UI fallback | **Shipped** building blocks; **Being built** related surface contracts; narrowly **Open** combined application fixture pack | **F:** [Stigg](https://www.stigg.io/product/entitlements) supplies commercial access decisions. [ACC v1](https://agentcapability.org/docs/spec/) defines capability exposure/risk/approval metadata, explicitly excluding final business authorization and UI requirements. [AgentWorks' surface design](https://github.com/manishiitg/agentworks/wiki/agent_tool_surface_single_source) records implemented surface-registration tests and remaining work. | A capability registry and entitlement engine are taken. The conditional residue is a reusable test matrix for execute/guide/upgrade, correct resource and link, prerequisite state, flag and surface combinations (P1). |
| C08, C13, C15–C17, C28–C29, C31, C33, C36–C37: hybrid hosting, memory, streaming, harness | **Shipped** components | **F:** [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence), [AG-UI](https://docs.ag-ui.com/introduction), and [Workers AI OpenAI compatibility](https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/) cover these primitives. **Q:** VSCO's actual deployment and staffing are its report. | A cross-device memory layer, DO agent host, framework bridge or provider-compatible gateway is not a candidate. Python in the talk is a team choice, not a Workers AI requirement. |
| C24, C27, C32, C39–C40: model churn, decision routing, context cost | **Shipped** / **Cloudflare roadmap** | **F:** [Clef model announcement](https://blog.cloudflare.com/clef-decision-models/) describes the decision-model family; [AI Gateway](https://developers.cloudflare.com/ai-gateway/) provides existing management infrastructure. **Q:** VSCO already summarizes large contexts and gives no exact cost. | A cheap routing model, model switcher, or summarizer is occupied. There is no substantiated cost-saving project thesis from this talk alone. |
| C14, C34–C35: clarification, narrow onboarding, data boundary | **Shipped** product behavior; narrowly **Open** regression scenarios | **Q:** VSCO describes clarification, excessive initial restriction, and sensitive-context handling. **F:** [τ-bench evaluation documentation](https://github.com/sierra-research/tau2-bench/blob/main/docs/evaluation.md) already separates state outcomes, actions and communication. | A new generic agent benchmark is unnecessary. P1 can reuse evaluation machinery while supplying the product-specific oracle and denied/clarification cases. |

### 2.4 Tempting extractions explicitly rejected

| Extraction | Classification and reason |
|---|---|
| “Payment settled, but did the paid API work?” | **Shipped / Being built. F:** [x402-conformance](https://github.com/atsp-protocol/x402-conformance) has CI fault injection; [Soren](https://soren.com/conformance) has client failure cases; [x402 issue 452](https://github.com/x402-foundation/x402/issues/452) contains concrete idempotency work; [Atlas](https://402atlas.com/report.html) already performs paid service checks. **I:** neither another x402 fault lab nor a general delivery-receipt layer is a clean opening. |
| “Publishers need help choosing a price.” | **Cloudflare roadmap. Q:** A30–A32 explicitly cover offers and optimization. **I:** a pricing field is trivial; price discovery needs buyer participation and demand data the builder does not own. |
| “Tell agents when authoritative information changes.” | **Cloudflare roadmap. Q:** A44–A45; **F:** AI Index's pub/sub offer. **I:** the elections use case is strong evidence, but does not make the underlying feed open. |
| “Generate APIs for UI-only workflows.” | **Being built / Shipped** adjacent primitives. **F:** [WebMCP](https://developer.chrome.com/blog/webmcp-epp) exposes website actions to agents. **I:** C30 still requires VSCO to define its own business operations; a general UI-to-tool generator repeats the killed automation/MCP category. |

### Search coverage and uncertainty

**F — Registry checks:** direct npm registry metadata on 2026-10-28 confirmed published packages: [postcondition-mcp 0.1.0](https://registry.npmjs.org/postcondition-mcp/0.1.0), [@postcept/mcp 0.3.3](https://registry.npmjs.org/@postcept%2fmcp/0.3.3), [@stigg/agent-sdk-js 0.5.1](https://registry.npmjs.org/@stigg%2fagent-sdk-js/0.5.1), [x402-conformance-svm 1.6.0](https://registry.npmjs.org/x402-conformance-svm/1.6.0), [@agentmarkup/audit 0.2.5](https://registry.npmjs.org/@agentmarkup%2faudit/0.2.5), and [@fernforge/ai-signals-audit 0.1.2](https://registry.npmjs.org/@fernforge%2fai-signals-audit/0.1.2). Some search snippets showed different versions; the versions here come from registry responses. No packages were installed or executed.

**I — Search record:** searches covered GitHub repositories/issues, npm packages and registry metadata, product documentation, Cloudflare blog/changelog, HN and X. Terms included `agent tool postcondition`, `agent capability conformance entitlement`, `agent product surfaces contract testing`, `internal tools exit migration rehearsal`, `SaaS exit test`, `paywall regression tests`, `crawler policy linter Cloudflare`, `x402 conformance fault`, and `x402 response lost retries`. Follow-up searches named each discovered competitor rather than treating a broad query as sufficient.

**F — Additional practitioner evidence:** [HN's internal-tools discussion](https://news.ycombinator.com/item?id=39376059) contains direct maintainer accounts of integration/ownership costs; [the Notion export complaint](https://news.ycombinator.com/item?id=27612894) documents a user-reported export failure and proposed workarounds; [the Markdown-service launch discussion](https://news.ycombinator.com/item?id=43462894) includes the builder discussing paywall use. **I:** these are anecdotes with dates, not present-day incidence measurements or independent product certifications.

**I — Coverage limit:** site-restricted X searches for VSCO Scout, Cloudflare Pay Per Use, agent postconditions, content-signal audits, entitlements testing and internal-tool export/migration returned no useful indexed posts. That is missing coverage, not evidence that nobody is building these things. Directories and vendor claims were used to locate primary sources, not to establish customer demand. Searches found adjacent implementations for all three candidates; the narrow combinations below remain hypotheses.

## 3. Convergence worth preserving

1. **Q:** A33/A38/A40 describe custom publisher surfaces; C16/C21/C23/C25 describe custom business-action surfaces; B12/B14/B15 describe a heavily customized internal reviewer. **I:** three independent implementations needed domain-specific adapters despite mature platform primitives. The common requirement is customer-owned semantics, not another universal harness.
2. **Q:** B24–B27 say a diff cannot cheaply establish system behavior; C10/C19 insist on rereading the changed record; A25 establishes payment proof, while A34 says payment does not establish acceptable downstream use. **I:** these are different verification boundaries. Their convergence supports precise checks at a boundary, not a claim that one receipt proves all three.
3. **Q:** B29/B30/B34 anticipate disposable implementations but continuing ownership; C24/C27 separate frequently changing models/configuration from stable orchestration/checks. **I:** the valuable artifact may be an independent contract that survives replacing the implementation. P1 and P2 test that proposition concretely.
4. **Q:** A44's public-information user wants unrestricted freshness; C02/C38's photographers prefer assistance in administration over creative production. **I:** “serve agents” is not one market. Pricing, discovery, task completion and creative acceptance need separate customer evidence.

## 4. Three conditional project candidates

**I — Scope:** these are small integration/test products. The broad versions are already shipped. The proposed versions are only Open under the explicit boundaries below; kill them if integration effort outweighs reuse.

### P1 — Business-action conformance fixtures across plans and product surfaces

**Q — Sources:** 08 04:00: “never claim success without checking or verifying that the mutation had taken place”; 08 08:00: “completed ... guiding the user ... or ... an upgrade”; 08 09:00: “the vocabulary between the two CRMs were ... different”; supporting pressure in 02 13:00: “difficult to check cross-process system impact.”

**I — One sentence:** a TypeScript test pack that runs the same declared business action across product surfaces, subscription plans, flags and prerequisite states, then checks the real outcome, permissible result message and destination link against a product-owner-approved expectation.

**E — 30-second demo:** request an invoice in a classic CRM and its reduced-feature sibling. A paid account creates one invoice linked to the intended job; a free account gets a valid upgrade route and no mutation; an unsupported surface gets a working self-service route. Change a flag or downgrade the plan between turns: the report catches a success card pointing at a nonexistent or inaccessible invoice. The test injects the requested tool/action directly so model randomness does not hide an application-contract failure; an optional live-model run tests selection separately.

**F — Closest prior art:** [Stigg](https://www.stigg.io/product/entitlements) answers what access is allowed. [Postcept](https://postcept.com/) already verifies external business completion and gates customer messages. [Postcondition](https://github.com/christian140903-sudo/postcondition-mcp) already packages outcome checks. [ACC](https://agentcapability.org/docs/spec/) declares exposed capabilities but excludes UI requirements and final business authorization. [AgentWorks](https://github.com/manishiitg/agentworks/wiki/agent_tool_surface_single_source) documents cross-surface registration tests. [τ-bench](https://github.com/sierra-research/tau2-bench/blob/main/docs/evaluation.md) evaluates state and communication. **I:** use these patterns or integrate them. The possible gap is reusable fixtures for the combined execute/guide/upgrade business matrix, including record identity and usable UI routes. A new capability schema or completion-receipt service would duplicate existing work.

**I — Beneficiary and outside evidence:** a SaaS team exposing an existing application through both UI and an embedded agent, especially with more than one plan or product surface. **F:** AgentWorks' concrete tests show another implementer wrestling with surface declarations; Stigg documents scattered access decisions; Postcept's published business connectors show that observed completion is already a product category. **I:** these establish implementation work and competition, not willingness to pay for this particular test pack.

**I — Why Cloudflare would not simply own it:** Cloudflare can supply runners, models and DO storage, but cannot determine that a particular studio's invoice belongs to the intended job, that an Atlas route is correct, or which operation each subscription should allow. The reusable part could be adopted as fixtures/examples in an existing SDK or customer implementation. There is little moat in the runner itself, and a platform could still ship a generic adapter.

**E — 2–3-week version:** one Hono/Workers sample with two surfaces, three action types (create/update/cancel), three plan states, two relevant flags, and explicit prerequisite fixtures. Separate owner-maintained expectations from implementation declarations, with deterministic readback and route checks. Emit JSON/JUnit and a small report showing expected outcome, observed record and broken link. Integrate an existing completion verifier rather than building a receipt protocol. Cap state exploration to selected transition scenarios rather than exhaustively multiplying every flag.

**E — 1–2-day kill test:** map ten real actions from one consenting SaaS team and attempt eight deliberate faults: wrong tier, stale tier after downgrade, hidden flag, missing prerequisite, wrong record relation, wrong-surface link, success after a failed write, and duplicated mutation. Compare the pack with ordinary Vitest tests plus Postcept/Stigg/ACC and their existing adapters. Kill or contribute upstream if ordinary tests take similar effort, if expected policy is generated from the same implementation being tested, or if a second team's adapter cannot reuse most of the fixture/reporting structure. Proceed only with an observed reduction in setup work and at least one credible owner willing to maintain the independent expectations.

### P2 — An executable exit drill for a replaceable internal application

**Q — Sources:** 02 05:00–06:00: “running it, fixing it, and replacing it”; 02 15:00: “build the replacement in 6 months with better models”; 02 16:00: “make sure that there is an exit from the vendor”; 02 18:00: “owning it is still kind of a problem.”

**I — One sentence:** a repository-owned drill that exports an internal tool's state, imports it into a replacement, and executes a tiny owner-defined business corpus to demonstrate that the replacement can operate on the restored state.

**E — 30-second demo:** replace a small approval tool built on Workers/D1 with a rewritten implementation. Export ten requests, comments and attachments, import into a clean target, then approve one restored request and inspect its history. A row-count check passes while the drill flags an orphaned attachment and a missing approval permission. Fix the mapper and rerun to a clean report; no production cutover occurs.

**F — Closest prior art:** [D1 SQL export](https://developers.cloudflare.com/workers/wrangler/commands/d1/), [pgcopydb comparisons](https://pgcopydb.readthedocs.io/en/v0.18/ref/pgcopydb_compare.html), and [Datafold data-diff](https://github.com/datafold/data-diff) already cover data movement/comparison; the latter's open-source repository is archived. [AirBridge](https://github.com/he8um/AirBridge/blob/main/docs/overview.md) covers Airtable backup and dry-run restoration. [Software Sausage's exit test](https://softwaresausage.com/exit-test) explicitly asks whether data can be exported, restored, operated on and reconciled. **I:** an exit checklist or migration validator alone is occupied. The narrow deliverable is an executable application-level contract for a cheap internal tool being rewritten, with imported relationships, a few permission checks and operation outcomes.

**I — Beneficiary and outside evidence:** small teams maintaining bespoke tools they expect to rewrite, rather than enterprises seeking a universal SaaS migration platform. **F:** the [Notion export discussion](https://news.ycombinator.com/item?id=27612894) supplies a user-reported failure; AirBridge's documented omissions distinguish records from working application state. **I:** both support the need to rehearse, but demand for a general paid product remains unproven.

**I — Why Cloudflare would not simply own it:** D1 can export the database, but a replacement's data model, external attachments and business behavior belong to the customer and may use another host. A platform could adopt the drill as an example of portable application contracts. The builder's differentiator would be a low-effort workflow and useful examples, not novel database machinery.

**E — 2–3-week version:** support a small SQLite/D1 application plus a directory/object-store attachment manifest. Require explicit export/import commands, canonical business-ID mappings and five imperative operations with expected outcomes. Run old and replacement implementations against sanitized copies and compare normalized observations. Produce a repeatable exit report with exact unsupported state. Avoid a universal schema mapper or a fleet-management service.

**E — 1–2-day kill test:** take one genuinely owned internal tool, a small export and a plausible rewrite. Time a manual rehearsal using existing database diff and test tools, then build only enough glue to repeat it. Kill if the same database backup already supplies all needed continuity, if every mapping becomes bespoke consulting, if the owner cannot name a likely replacement, or if the wrapper saves no material work. A working dry run is the gate, not enthusiasm for “disposable software.”

### P3 — Publisher fixtures for content visibility across HTML, Markdown and feeds

**Q — Sources:** 01 11:00: “I had to block them even if I was trying to give them product catalogs”; 01 23:00: “I've actually done something similar on one of my sites”; 01 26:00: “alternatives to their standard human readable sites”; 01 24:00–25:00: the publisher chooses whether to block, give access, or monetize.

**I — One sentence:** an owner-configured CMS integration pack that checks which excerpt or full content each authenticated audience receives across HTML, Markdown, JSON/RSS and cache states after a publishing or access-policy change.

**E — 30-second demo:** publish a fixture article containing a public excerpt marker and a protected-body marker. The ordinary page shows the intended excerpt, but a Markdown or JSON route returns the body marker to an anonymous request after a configuration change. The report identifies the exact representation, headers and fixture marker. After the fix, the paid account still receives the full article and the intended machine-readable summary still works. This tests the publisher's chosen policy; it does not assume that every bot should be blocked.

**F — Closest prior art:** [ai-signals-audit](https://github.com/fernforge/ai-signals-audit) catches conflicting declarations. [AgentMarkup audit](https://github.com/agentmarkup/agentmarkup/tree/main/packages/audit) compares user-agent views and checks Markdown availability. Its README explicitly says spoofed crawler headers cannot establish what a real verified bot receives. [BrowserBash](https://www.browserbash.com/blog/test-paywall-metering-flows-ai) already tests browser paywall behavior. [Cloudflare's header-preservation changelog](https://developers.cloudflare.com/changelog/post/2026-07-13-markdown-for-agents-header-preservation/) shows that transform/cache/policy interaction is concrete platform behavior. **I:** a generic scanner would duplicate them. The conditional gap is fixture content, real test sessions, intended excerpt/full-body policy and transitions across representations. This is the weakest candidate and probably an upstream integration.

**I — Beneficiary and outside evidence:** a small publisher maintaining a subscriber site and an agent-facing summary/API route. **F:** the existing audit tools and Cloudflare changelog demonstrate multiple maintained policy/content carriers and implementation corrections; [Leaky Paywall's integration docs](https://docs.leakypaywall.com/article/323-wp-rest-api-integration) show a real membership/API surface. **I:** this does not establish how often protected-content regression occurs or whether publishers will pay for fixtures.

**I — Why Cloudflare would not simply own it:** Cloudflare owns its conversion and caching behavior and can test those directly. The publisher owns the CMS extensions, member states, separate feeds and intended excerpt boundary. A shared integration pack could be adopted by an existing audit project or CMS plugin. Its cross-vendor scope is the only reason to exist independently.

**E — 2–3-week version:** one consenting WordPress/Leaky Paywall fixture site, anonymous/member/expired sessions, HTML/JSON/feed routes plus Markdown negotiation where supported, and warm/cold cache scenarios on dedicated test URLs. Reuse policy parsers. Store only synthetic marker matches, relevant headers and bounded response evidence. Real signed-bot tests require an explicitly configured test identity or cooperation from a verified operator; otherwise report that case as unknown. Do not equate a user-agent string with identity.

**E — 1–2-day kill test:** configure the existing audit tools and browser tests against one synthetic member article; implement three intentional representation/access mismatches and compare coverage. Kill if existing tools express the expected policy in a few straightforward assertions, if no publisher supplies the extra delivery paths, or if the useful result depends on pretending to be an approved production bot. Do not expand into redistribution detection, external archive control, pricing optimization or a bot-mitigation platform.

### Scores

**E — Subjective 1–5 scores; higher is better.** Gap scores describe the narrow artifact, not the occupied broad category. “Not GrowOS” measures distance from the existing kernel/runtime project.

| Candidate | Cool | CF / Vercel / TS adjacent | Real gap | Value | Survives better models | Not GrowOS | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| P1 — action conformance fixtures | 3 | 5 | 3 | 4 | 5 | 5 | 25/30 |
| P2 — executable exit drill | 3 | 4 | 2 | 3 | 5 | 5 | 22/30 |
| P3 — publisher visibility fixtures | 2 | 5 | 2 | 3 | 5 | 5 | 22/30 |

**I — Model-resilience rationale:** better reasoning can improve tool selection and author adapters, but it cannot decide a business's purchased rights, supply missing API access, define the owner-approved excerpt, or reconstruct data absent from an export. Conversely, better models make thin adapter/test wrappers cheaper to reproduce; resilience of the problem is not a moat for the implementation.

## 5. ONE pick

**I — Pick P1: business-action conformance fixtures across plans and product surfaces, subject to the two-day kill test.** VSCO supplies the strongest paid-for implementation signal: it built a capability catalog, two harnesses, prerequisite checks, tier handling, readback verification and result cards. Those moving parts have a concrete common check: did the correct permitted operation occur, or did the user receive the correct guide/upgrade path?

**I:** start with a fixture pack that can be contributed to an existing harness or verification project. Do not build another runtime, policy engine, schema standard, completion receipt service or generic eval dashboard. Postcept, Stigg, ACC, AgentWorks and τ-bench make that boundary necessary. If ordinary tests plus those components already solve the integration cheaply, stop. The evidence warrants a practical probe, not a broad startup claim.

## 6. Five-line TL;DR

1. **Q/F:** Cloudflare already owns or is building discovery, crawl offload, update feeds, bot identity, reuse payments and 402 billing.
2. **Q/F:** VSCO shipped the photography business agent; generic verified mutations, receipts and entitlements also have published owners.
3. **I:** The strongest remaining gap is checking one business action across plans, flags, prerequisites, surfaces and real resulting state.
4. **I/E:** Exit drills and publisher content fixtures are weaker integration ideas; kill all three quickly if existing tools cover them cheaply.
5. **I:** ONE pick: P1, a narrow action-conformance fixture pack, gated by a two-day comparison against ordinary tests and existing products.
