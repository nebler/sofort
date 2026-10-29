# A05 — Science and mathematics at full ambition

Research completed 2026-10-29. **Q** = supplied practitioner quotation or attributed claim; **F** = checked external source; **I** = inference, proposal, or judgment; **E** = estimate or experimental target. Caption timestamps identify minute buckets. Proposed outcomes below have not been demonstrated in this research.

**I — ONE pick: make the computational scientific record continuously executable and independently challengeable.** The full ambition is a public dependency graph of computational results across the literature: when an input measurement, geometry, solver, or scientific assumption changes, researchers can discover which published conclusions need reconsideration and execute the relevant checks. The accumulating asset is an independently reviewed body of scientific claims, their measurement dependencies, disagreements, and histories. An execution service alone fails the ambition filter.

**I — Begin with a real dependency correction in kite aerodynamics.** Two open 2026 papers already provide code, measurements, and independent execution certificates; an author-documented geometry offset propagated into earlier simulation studies. Turn that existing scientific work into a maintained, executable history across papers and solver versions. Credit the authors for the correction. The six-week contribution would be the linked evidence and its independently assessed consequences under subsequent changes.

**F — Closest active funded effort:** the NWO-backed CODECHECK study at Amsterdam UMC and TU Delft, September 2026–September 2028, award 110.110.017. It plans about 60 institutional checks and a classification of reproducibility failures. No award amount was verified. This is a prospective collaborator and overlapping effort, rather than an empty market. [CODECHECK project](https://codecheck.org.uk/indicators/).

## Evidence and framing

**F — Reading scope.** Read both ambition briefs and the five assigned transcripts in full: [de Moura, p3-45](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-45-ryan-peterman-creator-of-lean-handwritten-math-will-change-dramaticall.txt), [Tao, p3-46](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-46-big-think-clips-the-paradox-at-the-heart-of-ai-and-science-terence-tao.txt), [Stephenson, p3-01](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-01-core-memory-podcast-neal-stephenson-on-ai-swords-and-blue-origin.txt), [Omar, p3-19](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-19-jane-street-trustworthy-human-ai-collaboration-in-a-live-type-theoreti.txt), and [Campbell, p3-32](/Users/noah/code/sofort/arch/research/corpus/transcripts/p3-32-ndc-conferences-keynote-after-the-ai-hype-what-s-real-and-what-s-next-.txt). Screened the E01–E19 ledgers, S01–S07 syntheses, and Connect 01–05 reports for science, commons, formalization, and attention signals, returning to the relevant E13/E15/E17 sections. Consulted the research-summary kill list and the stack/Connect summaries. This is not an exhaustive rereading of every transcript in the corpus.

**I — Constraints inherited from the surviving signals.** S07's 13-practitioner attention cluster means the scarce resource is often the reviewer, scientist, or mentor. S01's concealed tool output and S02's incompatible-design combination argue for exposing actual statements, dependencies, and execution rather than accepting an agent's report. S05's finished-tailoring counterexample argues against assuming every scientist wants an endlessly changing notebook. Preserve stable publications and make adoption of updated analyses deliberate. Generic agents, schedulers, proof generators, code migrations, sandboxes, and another language are already occupied mechanisms.

The assigned speakers supply five distinct motivations:

- **Q — Tao, 18:00–21:00:** “proof indigestion”; “the pace of understanding them and putting them into the final textbook form is still done by humans.” Generating and checking output can outrun a field's ability to assimilate it. [Video](https://www.youtube.com/watch?v=svl_1upFpQo&t=1080).
- **Q — de Moura, 25:00:** “enabling people to work together in large numbers”; at 37:00, “if there's no connection to our world, this is some alien thing.” Checking enables collaboration; useful abstractions and specifications still connect it to human purposes. [Video](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=1500).
- **Q — Omar, 48:00–49:00:** “imagine something like Wikipedia where the whole system is a live program being edited by thousands of humans and AIs”; “world models that are live programs, not just databases.” He is a Michigan researcher speaking at Jane Street, and is explicitly pursuing climate collaboration. [Video](https://www.youtube.com/watch?v=fB_lklm7xgU&t=2880).
- **Q — Stephenson, 39:00–40:00:** his concerns are carbon and “the fact that people cannot agree on what is real.” At 1:28:00–1:32:00 he stresses teachers' actual needs and warns against extrapolating from exceptional learners. His tall-tower discussion supplies ambition, but its insurance/customer constraint at 1:20:00–1:22:00 also warns that technical feasibility does not create institutional adoption. [Science/public-reality signal](https://www.youtube.com/watch?v=Ii-aeW5pHPQ&t=2340), [education](https://www.youtube.com/watch?v=Ii-aeW5pHPQ&t=5280).
- **Q — Campbell, 48:00:** “computed the 200 million most common protein fold sets possibly needed and published them for free.” Treat this as a public-commons scale signal. **F:** AlphaFold DB does distribute hundreds of millions of predictions, with confidence information and substantial limitations; the talk's universal-accuracy and specific treatment claims are not established by that fact. [Video](https://www.youtube.com/watch?v=uWnUnMphmPM&t=2880), [database](https://alphafold.ebi.ac.uk/), [current limitations](https://www.alphafold.ebi.ac.uk/faq).

**I — Three distinctions govern the proposals.** A Lean proof establishes a particular formal statement under recorded assumptions, not the faithfulness of its translation from a paper. A rerun establishes a computational relationship, not the truth of the scientific interpretation. Predictive performance on observational data does not by itself justify a causal policy counterfactual. More powerful agents make these distinctions more consequential because they can produce far more accepted-looking artifacts.

## Prior art and funding that materially change the choice

### Mathematics: the obvious infrastructure is already being funded

**F — Mathlib Initiative / Formal Frontier / Formal Commons.** The October 2026–March 2027 roadmap reports over two million lines and over 750 contributors. It identifies review capacity as the main constraint, records an unmet review-response target, and targets infrastructure, documentation, and AI integration. XTX-funded **Formal Frontier** covers source alignment, reusable autoformalization, standards, and open tooling; its December 2026 target is 20 autoformalized textbooks, not an achieved result. **Formal Commons** proposes federation, provenance, and trust; its funding contract is still pending according to the roadmap. A general formal-knowledge commons substantially duplicates these plans. [Current roadmap](https://mathlib-initiative.org/roadmap/), [Formal Frontier scope](https://mathlib-initiative.org/formal-frontier/).

**F — Lean FRO.** Its published year-three plan includes performance, automation, benchmarking, and mixed formal/informal scientific authoring through Verso and a proposed scientific DSL. Amazon announced substantial long-term support on July 26, 2026, described as the FRO's largest donation; the inspected announcement does not give an amount. The core language, scalable checking, and literate interface have owners. [FRO roadmap](https://lean-lang.org/fro/roadmap/y3/), [Amazon announcement](https://www.amazon.science/news/amazon-is-investing-in-the-lean-focused-research-organization).

**F — Renaissance / XTX AI for Math Fund.** The March 2026 announcement increases commitments from $18 million to $31.5 million, with grants described as $100,000–$1 million over 12–24 months. It names funded publication formalization and tool integrations. It separately references Gerko's $10 million 2025 support for the Mathlib/literate-interface ecosystem; do not add overlapping announcements into an invented total. The advertised March 30 application deadline has passed. [Funding announcement and projects](https://www.renaissancephilanthropy.org/insights/renaissance-philanthropy-and-xtx-markets-additional-13-million).

**F — DeepMind AlphaProof.** The 2024 result combined AlphaProof and AlphaGeometry 2 for four of six IMO problems, after manual formalization; some solutions took up to three days. This demonstrated powerful formal search rather than whole-field semantic curation. DeepMind's 2025 gold-standard headline used Gemini in natural language, so the two pipelines must not be conflated. [2024 methodology](https://deepmind.google/blog/ai-solves-imo-problems-at-silver-medal-level/), [DeepMind's 2025 methodology](https://deepmind.google/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/).

**F — Harmonic.** It announced a $120 million Series C on November 25, 2025, at a $1.45 billion valuation. Its infrastructure report describes nearly 500,000 CPUs running Lean during its IMO work, at reported 95–100% utilization, with retry and scheduling engineering already implemented. Its October 27, 2026 announcement expands Aristotle into C/Verilog verification. These are company reports, not reproduced measurements. A generic public Lean execution farm competes with serious existing systems. [Financing](https://www.harmonic.fun/news/series-c/), [execution infrastructure](https://www.harmonic.fun/news/lean-at-scale/), [dated announcements](https://www.harmonic.fun/news/).

**F — Tao's Equational Theories Project and Polymath.** The equational project classifies implications among 4,694 laws, covering 22,028,942 non-reflexive ordered pairs, and reports new mathematical constructions. That is an important precedent for a bounded, shared, machine-assisted research atlas; the pair count is not a count of separately invented proofs. Polymath demonstrated large online collaboration and produced substantive mathematics in 2009. Neither establishes that a systems engineer can independently choose a useful field ontology. [ETP authors' paper](https://arxiv.org/abs/2512.07087), [repository](https://github.com/teorth/equational_theories), [Polymath participants' account](https://www.nature.com/articles/461879a), [research paper](https://arxiv.org/abs/0910.3926).

### Executable science: preservation, reruns, and live execution all have precedents

**F — Software Heritage** preserves public source and its history, with institutional and philanthropic support, including Sloan-backed contributor grants. It supplies durable identifiers and archival infrastructure; preserving source does not preserve every dataset, executable environment, instrument calibration, or scientific claim. Reuse it rather than build a parallel archive. [Mission/contributor support](https://www.softwareheritage.org/grants/).

**F — ReScience C / CODECHECK.** ReScience publishes reviewed computational replications, explicitly requires domain editorial expertise, and investigates apparent failures cautiously. Its decade-old-code challenge deliberately tested historical executability. CODECHECK supplies auditable independent executions and a certificate register; its September 2026 news reports 132 certificates represented on Wikidata. Neither project's inspected scope establishes universal ongoing revalidation of the literature. Their limits should not be described as project failure. [ReScience process](https://rescience.github.io/faq/), [historical challenge](https://rescience.github.io/news/2019/10/11/TenYears.html), [CODECHECK process and register news](https://codecheck.org.uk/).

**F — Existing execution platforms.** eLife launched Stencila-based executable research articles in 2020, with browser reruns and eLife-funded compute. Code Ocean announced a $16.5 million Series B in 2022 for its computational-science platform; that is a historical financing event, not a verified current total. Renku already combines reproducible collaborative research and institutional operation. These defeat “put a run button on every paper” as a new idea. [eLife launch](https://elifesciences.org/for-the-press/eb096af1/elife-launches-executable-research-articles-for-publishing-computationally-reproducible-results), [company-issued financing release](https://www.prnewswire.com/news-releases/code-ocean-announces-16-5-million-in-series-b-funding-to-expand-its-digital-lab-platform-for-computational-scientists-301555157.html), [Renku's account of adoption barriers](https://blog.renkulab.io/introducing-renku/), [2025 institutional deployment](https://www.idiap.ch/en/news/idiap-and-the-sdsc-collaborate-on-a-cloud-platform-for-reproducible-research).

**F — Benchopt / SciMLBenchmarks.** Benchopt already handles comparable cross-language experiments, HPC execution, caching, and invalidation. SciMLBenchmarks already publishes scientific solver/method comparisons, versions, hardware, and work-precision protocols. An ODE/PINN leaderboard, cache, or cross-language runner alone would duplicate them. [Benchopt](https://benchopt.github.io/index.html), [SciML scope and rules](https://docs.sciml.ai/SciMLBenchmarksOutput/dev/).

**F — Omar's Fairground is exceptionally close.** The 2025 paper by Omar, Coblenz, and Madhavapeddy proposes interoperable notebooks, a planetary live program, distributed execution, and shared artifacts updated as dependencies change. It is a research design, not evidence that a planetary service is operational. The 2024 Planet Hazel paper similarly presents a vision/mockup. Hazel itself has working language foundations and NSF-backed research. Scientific oracle construction and independent evidence are plausible contributions to that program; a new live-notebook platform has weak differentiation. [Fairground paper](https://hazel.org/papers/fairground-propl25.pdf), [Planet Hazel paper](https://hazel.org/papers/propl24.pdf), [Hazel publications and funding](https://hazel.org/).

### Earth models: orchestration and validation are existing scientific infrastructure

**F — CMIP7 / Climate-REF.** Model intercomparison already coordinates scientific protocols and outputs. Climate-REF evaluates incoming model data against observations, updates derived results, and supports local/cloud/HPC operation. Its CMIP7-ready release launched March 9, 2026, with ESA/US DOE resources. This is direct funded competition to a climate-model validation observatory. REF also cautions against interpreting diagnostics as universal rankings. [CMIP7](https://www.wcrp-cmip.org/cmip-phases/cmip7/), [REF delivery/funding](https://www.wcrp-cmip.org/cmip-phases/cmip7/rapid-evaluation-framework/), [execution docs](https://climate-ref.readthedocs.io/en/latest/), [interpretation guidance](https://www.wcrp-rifs.org/ref-guidance/).

**F — Destination Earth / interTwin / NVIDIA.** EU-funded Destination Earth already has climate and extremes twins and a workflow engine; phase three runs June 2026–June 2028. ECMWF reports collaboration with over 100 organizations. interTwin received approximately €11.73 million EU support and its grant ended August 2025, so it is funded prior work rather than an assumed active 2026 grant. NVIDIA released an open Earth-2 weather-model stack in January 2026 and publishes observation-assimilation tooling. A generic Earth twin or compute orchestrator is occupied. [DestinE delivery](https://www.ecmwf.int/en/about/media-centre/news/2026/third-phase-destination-earth-confirmed), [interTwin grant](https://cordis.europa.eu/project/id/101058386), [Earth-2 release](https://blogs.nvidia.com/blog/nvidia-earth-2-open-models/), [September 2026 assimilation workflow](https://developer.nvidia.com/blog/turn-your-latest-observations-into-timely-weather-decisions-with-nvidia-earth-2).

**F — CSDMS/BMI.** A language-neutral interface for coupling models and datasets already exists, alongside standard names, wrappers, Landlab, and a modeling toolkit. Interfaces alone do not establish that two scientific models may validly be composed. [BMI specification](https://github.com/csdms/bmi), [CSDMS workbench](https://csdms.io/do/).

**I — Prior-art verdict.** The public record does not justify a claim that these attempts stalled. Several are shipping, scaling, or explicitly funded for the next phase. The remaining hypotheses concern reviewable scientific meaning, independently observed failure/correction histories, and cross-institution adoption. They are contribution opportunities whose novelty must be checked with the relevant communities.

## 1. A continuously executable scientific record — recommended

### Seed and full-scale vision

**Q:** Omar wants an executable commons at 48:00–49:00; Tao says automated simulations, theory, and analysis can run at unprecedented breadth at 03:00–05:00, while warning that faster components need not accelerate science at 16:00–17:00. Campbell's public protein resource supplies the release-at-field-scale example. [Omar](https://www.youtube.com/watch?v=fB_lklm7xgU&t=2880), [Tao](https://www.youtube.com/watch?v=svl_1upFpQo&t=180), [Campbell](https://www.youtube.com/watch?v=uWnUnMphmPM&t=2880).

**I — Full ambition:** computational publications become a maintained, executable scientific dependency network. A researcher asks: “Which conclusions about this wing, watershed, material, or algorithm still hold after this calibration correction?” The answer includes affected claims, unaffected claims, conflicting evidence, actual reruns, and unresolved links. Independent teams can attach stronger oracles and replicate with new measurements. The scale target is eventually millions of claims across fields, with publication credit for validation and maintenance.

**I — Necessary boundary:** “every published computational result” cannot literally be executed when data are missing, code is unavailable, or access is prohibited. Represent those holes explicitly. Continuous means continuously maintained eligibility and triggered/scheduled checks, subject to scientific and compute budgets; it does not mean rerunning every climate simulation after every edit. Published results remain immutable reference points alongside separately identified updated analyses.

### Why now; one-shot test

**I:** A small reproducible paper was possible decades ago. Keeping a cross-paper corpus executable across heterogeneous obsolete environments required prohibitive ongoing engineering per result. Better agents can repair environments, port analysis code, map paper quantities to computations, and prepare candidate dependency links at scale. Their outputs still need independent acceptance. The enabling change is the amount of scientific legacy that can be maintained, not invention of workflow execution.

**I — Non-code value:** real measurements and calibrations; adjudicated links from computations to claims; a corpus of observed changes over time; contributor trust, credit, and journal/research-group participation. A model two generations better can generate the entire interface and many adapters. It cannot retroactively collect a missing measurement, infer an undisclosed calibration, manufacture independent replication, or create an already adopted scientific record from a prompt. If direct prompting plus existing platforms supplies all the useful evidence, the standalone project loses its justification.

### Physics, economics, data, and law

**E — Explicit costing assumptions, not vendor quotations:** $0.02 per CPU-hour, $2 per GPU-hour, $15 per TB-month of storage; 10 W allocated per active CPU core and 0.7 kW per GPU, with an illustrative 1.3 facility-overhead factor. Procurement, interconnect, memory, utilization, and egress can change these materially.

**E:** One million lightweight capsules, each using ten CPU-hours per quarterly rerun, require 40 million CPU-hours/year: about $0.8 million and 520 MWh at those assumptions. Keeping 100 TB adds about $18,000/year before replicas/egress. Ingesting them at $5–$50 in model use per capsule adds $5–$50 million once, before human work. Even one reviewer-hour per capsule at $100/hour adds $100 million. Review, rights, and contributor incentives can dominate compute.

**E:** A heavy tail matters: 10,000 results using 1,000 GPU-hours each per quarterly rerun would add 40 million GPU-hours/year, $80 million, and about 36 GWh. This is a national/international infrastructure budget. Reuse unchanged results, execute near datasets, and tier reruns by scientific need. Stronger models do not remove this bill.

**I:** Open access to a PDF does not grant every code, data, or redistribution right. Record licenses per artifact; use existing archives and authorized institutional execution for restricted data. Missing physical observations stay missing. A green rerun must distinguish “matches published computation,” “independently implemented,” and “tested against observations,” with named uncertainty and domain limits.

### Closest attempts and the contribution boundary

**F/I:** CODECHECK and ReScience already supply independent execution/replication; Renku, Code Ocean, and eLife supply reproducible execution; Fairground proposes live cross-artifact composition. Climate-REF supplies a strong domain-specific implementation. The candidate therefore earns its place only through an adopted, independently adjudicated claim corpus with a history of scientific consequences across updates. The execution layer should reuse existing tools. The closest active funded institutional effort is the CODECHECK NWO study above; the closest architectural proposal is Fairground.

### Six weeks for one part-time systems engineer

**F — Concrete starting material:** the [March 2026 load-measurement paper](https://wes.copernicus.org/articles/11/911/2026/) documents a **1.02°** CAD angle offset propagated into earlier CFD studies and publishes corrected geometry, measurements, and analysis code. The [April 2026 PIV paper](https://wes.copernicus.org/articles/11/1461/2026/) publishes processed flow measurements, archived CFD data, and a separate analysis. Both cite independent CODECHECK certificates and share a geometry deposit. This gives actual scientific dependencies to investigate rather than an invented error.

**F:** Both analysis repositories declare MIT licensing. The PIV README warns that full processing takes hours and pins VSM v2.1.0; the load-paper availability statement identifies VSM v2.0.2, while the inspected repository README points at a development branch. These are reasons to capture exact historical artifacts, not evidence of an incorrect result. Data/geometry licenses and historical revisions still need checking individually. [Load repository](https://github.com/jellepoland/WES_load_wind_tunnel_measurements_TUDELFT_V3_LEI_KITE), [PIV repository](https://github.com/jellepoland/kite_piv_analysis).

**E — Budget:** 60–90 builder-hours over six weeks, $100–$500 cash excluding compensated expert time, and a bounded subset of existing calculations. Do not regenerate the original high-cost CFD campaign.

1. **Week 1:** reproduce one selected output from each archived analysis and record artifact rights, versions, run cost, and failure reasons. Seek one aerodynamicist/codechecker's agreement on two meaningful claims and comparison tolerances. No participant is assumed recruited by this report. Stop if neither scientific review nor a tractable dependency path is available.
2. **Week 2:** identify six claim nodes across the two papers and their shared geometry/solver inputs. Keep the earlier CFD output as a published dataset, labeled with its original coordinate convention. Preserve the authors' existing explanation of the offset.
3. **Week 3:** execute the selected comparisons under the published configurations and an explicitly separate updated configuration. Expose exactly which angle transformation is applied, where, and with what sign. Have the domain reviewer check the mapping before interpreting output.
4. **Week 4:** add independent coordinate/unit checks and a small numerical oracle, with tolerances fixed outside the repair agent's control. Check force- and flow-derived comparisons only where the scientist judges them comparable; incompatible regimes remain explicit.
5. **Week 5:** exercise a solver-version or geometry change across the linked calculations. Recompute only affected nodes, preserve prior results, and record whether changed agreement comes from measurement convention, solver behavior, processing, or an unresolved cause. Include the no-change case.
6. **Week 6:** deliver a public, reproducible three-minute demonstration and a citable record: one upstream change, its downstream claim impacts across two publications, independent review, cost, and unresolved assumptions. Let another person execute it from the recorded artifacts.

**E — What should be new at the end:** an independently reviewed, executable cross-publication history showing which measured/model agreements survive a specific subsequent dependency change. The 1.02° correction itself is existing authors' work. The novel contribution sought is the maintained relationship between published and updated evidence; no global priority claim is warranted. If the authors already maintain an equivalent artifact, contribute to it rather than reproduce its infrastructure.

### Strongest objection, cheap falsifier, and builder fit

**I — Strongest objection:** computational reproducibility can faithfully preserve an unimportant or scientifically wrong analysis, and upkeep brings little academic credit. A beautiful dependency network may create another review queue.

**E — Cheap falsifier:** within roughly ten builder-hours, reconstruct one known correction pathway and ask a domain reviewer whether an automatically maintained cross-paper record would change a real modeling or review decision. If the answer is “the paper and current scripts already tell me everything,” stop the new-project pitch. By week six require independent execution and one concrete use decision, rather than a count of green runs. No new bug is required; honest stability can be useful evidence.

**I — Fit:** excellent for environment capture, immutable artifact identity, bounded execution, numerical provenance, and distributed invalidation. TypeScript can organize the claim graph and web report; existing Python/native tools perform the science; Rust can provide execution boundaries if needed. Cloudflare is appropriate for metadata and publication, with actual scientific work on local/HPC infrastructure. An aerodynamicist owns the interpretation. Building an OS, universal sandbox, or scheduler is unnecessary. This is a route from systems engineering into shared scientific evidence.

## 2. Formalize an entire field, then make its knowledge digestible

### Seed and full-scale vision

**Q:** de Moura's 25:00 collaboration observation and 35:00–38:00 discussion of communication/abstractions combine with Tao's 18:00–21:00 proof-indigestion pain. [de Moura](https://www.youtube.com/watch?v=KzdYKeAqWhY&t=2100), [Tao](https://www.youtube.com/watch?v=svl_1upFpQo&t=1080).

**I — Full ambition:** take a bounded field's literature through a declared cutoff and give every mathematical claim an explicit status: formalized and semantically reviewed, refuted, conditional on a recorded assumption, duplicated, or unresolved. Connect all accepted results to shared definitions and checked proofs, alongside explanations of central ideas, counterexamples to omitted assumptions, and evidence that other researchers can reuse the technique. The result is a field that can systematically audit assumptions and transfer methods, rather than a library with a large line count.

**I:** A candidate scope is finite-state Markov chains and mixing-time results, selected only with a subject specialist and after checking existing projects/intentions. This report does not establish that this area is unclaimed. “Entire field” needs a bibliographic boundary and explicit omissions; it cannot mean an undefined moving target.

### Why now; one-shot test

**I:** Before automated proof construction/maintenance, building and updating a literature-scale formal corpus required too many specialist-years. AI changes that engineering labor, while Mathlib supplies reusable foundations. Proof assistants and polished exposition already existed; the new scale is the systematic treatment of a field's corpus with semantic acceptance and demonstrated reuse.

**I — Non-code value:** accepted definitions, rights to source material, expert-reviewed statement alignment, useful abstraction choices, and observed comprehension/transfer. A stronger model may generate excellent explanations too. “Human prose will always be better” is not a defensible moat. The durable value must be independent acceptance and a shared corpus whose users have actually learned or reused something.

### Physics and economics

**E:** A deliberately illustrative field corpus of 10,000 papers × 50 material statements gives 500,000 claims. At $10–$1,000 in search/inference per accepted claim, formalization alone costs $5–$500 million. At one to four expert-hours per claim, review adds 500,000–2 million hours: 250–1,000 person-years at 2,000 hours/year. Reuse and claim selection may reduce this; difficult missing theory can increase it drastically. These are scale scenarios, not estimates of that particular field's actual bibliography.

**E:** Rechecking 500,000 artifacts at an average of one CPU-minute is about 8,333 CPU-hours, $167 and 108 kWh under §1 assumptions; elaboration, proof search, dependency rebuilding, large proof terms, and repeated failures can be orders of magnitude more expensive. Checking and discovery must have separate budgets. A finite formal atlas is physically plausible; unconditional automated formalization of arbitrary mathematics is not guaranteed.

**I:** Need open or licensed texts and an expert-chosen coverage policy. Separate the published statement, translated Lean type, allowed axioms, and explanation. Reject unresolved `sorry`/unauthorized axioms; expose dependencies and use independent checking where appropriate. These controls still cannot prove the translation expresses what the author intended. Empirical assumptions in mathematical biology or physics remain empirical.

### Closest attempts; why the obvious version loses

**F/I:** Formal Frontier already pursues reusable text autoformalization and alignment standards; Formal Commons overlaps with federation/trust. Lean Blueprint already connects exposition and formal developments. The Lean project list includes major theorem projects, physics/scientific computing, and intentions specifically intended to reduce duplication. This is a strong case for joining the funded ecosystem. [Blueprint](https://github.com/PatrickMassot/leanblueprint), [projects and intentions](https://leanprover-community.github.io/lean_projects.html).

**I:** Mathlib has not “stalled”; its reported growing review queue is direct evidence of the remaining constraint. A systems engineer should contribute coverage/provenance infrastructure, reproducible checking, and source-to-statement inspection within an agreed project. Another proof farm is a poor bet given Harmonic's scale; an automatic proof-to-textbook site is vulnerable to better models and existing literate-authoring work.

### Six-week slice; objection and fit

**E:** With one mathematical co-owner, choose two permissively available papers or one chapter. Agree 15–25 statements, a shared vocabulary, and three nontrivial proof ideas. Reuse Mathlib/Blueprint/Verso and Formal Frontier metadata. Publish a buildable dependency/assumption atlas, including a deliberate false-assumption variant and its checked counterexample. Have four to eight researchers/advanced students compare it with the original plus direct model explanation, followed by a delayed unaided explanation and nearby transfer task.

**E — New artifact sought:** an accepted miniature literature where every included statement has an inspectable semantic mapping, and where users demonstrably transfer a technique from an initially opaque proof. Budget 60–90 systems hours, 15–30 expert-hours, and $200–$1,000 in compute; reduce theorem count if that budget is exceeded. A tiny cohort supplies feasibility evidence, not a statistically reliable educational effect.

**I — Strongest objection:** proof checking can conceal bad definitions and wrong translations, while the builder lacks the expertise to adjudicate them. The closest funded effort is **Formal Frontier**, within the Mathlib/Renaissance/XTX ecosystem. **E — Cheap kill:** ask a maintainer to nominate a genuinely useful missing slice and review five mappings. No mathematical co-owner, no reuse beyond the direct-model baseline, or direct duplication of a funded deliverable ends the standalone proposal.

**I — Fit:** strong for library infrastructure and inspectable evidence; weak as an independent author of frontier mathematics. Join a community with mathematical authority. Ranking is discounted heavily for close funded overlap.

## 3. A world model assembled from public scientific models

### Seed and full-scale vision

**Q:** Omar explicitly connects fish, ocean-temperature, and ice-sheet modelers at 49:00 and asks for an up-to-date planetary view at 1:04:00. Stephenson's carbon/reality concerns provide an independent purpose. [Omar](https://www.youtube.com/watch?v=fB_lklm7xgU&t=2940), [Stephenson](https://www.youtube.com/watch?v=Ii-aeW5pHPQ&t=2340).

**I — Full ambition:** a federation of public scientific models, observations, mathematical constraints, and their disagreements. One can trace a climate/land-use scenario through hydrology, ecosystems, infrastructure, and exposure, with alternatives and uncertainty retained. Contributors continuously test components and couplings against held-out observations. A user can discover which new measurement would discriminate among consequential disagreements.

**I:** “All public models” should mean a discoverable, versioned federation with explicit compatibility boundaries. Some models cannot be coupled because they answer different questions, share hidden calibration data, operate at incompatible scales, or double-count a process. The scientifically honest world model includes those incompatibilities. A universally correct single model inferred by connecting every available program is rejected.

### Why now; one-shot test

**I:** Large coupled models existed long before current AI. What was prohibitive was maintaining interfaces, scientific metadata, tests, and alternate couplings across the much larger long tail of public models. Agents can supply much of that integration labor. Their ease of creating plausible adapters also raises the need for independent semantic checks.

**I — Non-code value:** observations, calibration histories, scientifically approved couplings, independent hindcasts, distributed institutional access, and a maintained uncertainty/disagreement record. A future model can generate the adapters and much of the composition strategy, but it cannot infer unobserved boundary conditions with certainty or turn observational fit into a valid intervention model. Better simulation code is not the scarce asset.

### Physics, economics, and scientific limits

**E — Storage lower bound:** Earth's surface is approximately 510 million km². A 1 km horizontal grid with only 100 float64 state components needs about 408 GB per state slice. Hourly storage is approximately 3.6 PB/year; 100 ensemble members approach 360 PB/year, before vertical/detail expansion, diagnostics, replicas, and restart states. At §1's storage assumption that is about $0.65 million/year for one retained year/member, or $65 million/year for 100. Compression, selective output, and recomputation are essential. This is bookkeeping, not a credible full climate-model configuration.

**E:** A program buying one billion CPU-hours/year would spend roughly $20 million and 13 GWh under §1 assumptions, before specialist hardware, storage, and staffing. Real costs depend strongly on model resolution, timestep, ensembles, and coupling. No global runtime estimate can be inferred from notebook execution latency. Surrogates can save work but need independent validation in their intended regimes.

**I:** Compute should follow the data and existing HPC allocations. Sparse/non-independent observations, chaotic trajectories, and unknown structural error limit validation. Conservation checks, dimensions, and interface types are necessary but insufficient. A proof of numerical conservation is not a proof of forecasting skill. Preserve independent observations for testing, propagate uncertainty without assuming model errors are independent, and label counterfactuals conditional on causal assumptions.

**I — Rights:** public discovery does not imply permission to copy every dataset or run every model commercially. A federation must carry artifact-specific permissions and allow authorized remote execution. Private industrial and human data cannot be conjured into the public world model.

### Closest funded work; six weeks

**F/I:** Destination Earth is the closest operational funded Earth-scale effort; Climate-REF is the closest recurring evaluation infrastructure. CSDMS already supplies model coupling, and Fairground/Planet Hazel closely match the live-computational vision. interTwin is additional funded infrastructure precedent. Building a replacement for these from scratch has little justification. The remaining contribution hypothesis is an independently reviewed corpus of coupling assumptions and cross-model failure evidence that more than one institution actually reuses.

**E:** Spend six weeks on one watershed and a rainfall–runoff → channel-flow → water-temperature chain using existing models/interfaces and public historical observations. Have a domain scientist approve units, calendars, boundary conditions, and the causal scope. Run two alternative couplings over a held-out period; preserve an existing historical configuration and an updated one. Deliver an executable map of where each composition is empirically useful, where uncertainty expands, and where agreement fails. Do not promise accurate global prediction or policy advice from this pilot.

**E — Target and budget:** 60–90 engineering hours, 10–20 domain-review hours, 100–1,000 CPU-hours, and $100–$500 cash excluding labor. The novel evidence sought is a consequential, independently reproduced composition difference or incompatibility; a diagram with three connected existing models is insufficient.

**I — Objection and kill:** the hard work may be new domain science, with integration already served by CSDMS/REF/DestinE. **E:** before building a UI, ask whether an existing coupler plus its current diagnostics settles the chosen question. If so, contribute the case upstream. If meaningful validation needs new field instruments or unavailable observations, do not pretend a six-week software project can provide it.

**I — Fit:** very strong systems fit, very high dependence on scientific collaborators and institutions. A federation of evidence is plausible; independently becoming a planetary science authority is not. This is the **most crazy-but-not-impossible** direction, with the weakest solo ownership story among the three technical candidates.

## 4. A live observatory of actual AI-assisted research

**Q — Seed:** Tao, 22:00–24:00, asks how much compute successful work consumed and how many failed problems were attempted. [Video](https://www.youtube.com/watch?v=svl_1upFpQo&t=1320).

**I — Full vision:** a consented international panel records prospectively sampled real research tasks, abandoned attempts, human interventions, costs, validation, and eventual use. It establishes how changing models affect scientific work across fields, including exploration and understanding rather than only solved-question totals. An experiment logger is merely a component. The valuable asset is a credible denominator and a longitudinal research population.

**F — Close funded effort:** **1stProof** already publishes expert judgments, costs, logs, exposition, and attribution. Its October 14, 2026 release reports a ten-problem batch with 30 expert reviewers and support including DARPA, the AI for Math Fund, and Google.org. An observatory cannot claim that nobody reports research costs. [Dated results/funding](https://1stproof.org/third-batch-press-release.html).

**F:** Epoch's **FrontierMath** core was commissioned by OpenAI, with ownership/access arrangements and holdouts explicitly disclosed. Its 2026 Open Problems work includes computational verifiers and explicitly acknowledges the resulting constructive-problem selection bias. These are serious benchmark programs rather than complete samples of everyday research. [Core funding/access disclosure](https://epoch.ai/latest/openai-and-frontiermath), [current core/Tier 4 versioning](https://epoch.ai/frontiermath/tiers-1-4/about), [Open Problems scope and bias](https://epoch.ai/frontiermath/open-problems/about/faq).

**I — Why now / ambition verdict:** breadth of machine-assisted research creates an increasingly important measurement problem. However, prospective observational science was possible before AI. The mechanism does not pass the historical-impossibility test; it survives only as an ambitious, sustained institution with unusually broad researcher access. Recommend it as a partner study within existing evaluation organizations, rather than the builder's independent technical moonshot.

**I — One-shot / law:** the non-code value is trusted access to sensitive live work, preregistered sampling, honest failure disclosure, independent adjudication, and follow-up over time. A model cannot manufacture a historical cohort. Participants must control disclosure of unpublished ideas and research data, with de-identification and delayed release where necessary. Consent, missingness, and selective withdrawal affect interpretation.

**E — Economics:** 1,000 researchers × 200 tasks/year = 200,000 task records. At two expert-hours and $20 inference per task, the study requires 400,000 expert-hours and $4 million in inference annually; at $100/hour, expert time is another $40 million. Storage is secondary. Institutional participation is more limiting than server throughput.

**E — Six weeks:** recruit five researchers, prospectively record their next 20 eligible tasks in total, preserve all attempts, and obtain independent assessment of usefulness and intervention burden. Use existing logs, not a new agent harness. Budget 50–70 builder-hours, 20–40 participant/reviewer-hours, and $300–$1,500 in compute. Publish a consented full-denominator pilot including abandoned work and a later-use follow-up plan; six weeks cannot establish long-term scientific impact.

**I — Objection / cheap kill / fit:** sampling bias can make this another collection of selected successes. Within one week, test whether researchers will disclose failures and enough context for independent review. If not, stop. Systems engineering can lower collection burden; research design, access, and adjudication require an institutional co-owner. **Closest funded effort: 1stProof; rank below the technical commons.**

## 5. Research apprenticeships that grow understanding alongside machine output

**Q — Seed:** Tao, 27:00–28:00, warns that substituting AI for graduate-student work may remove the process that develops future scientists. Stephenson, 1:28:00–1:32:00, warns that education technology often misses teachers' needs and that an exceptional learner is a poor universal test case. [Tao](https://www.youtube.com/watch?v=svl_1upFpQo&t=1620), [Stephenson](https://www.youtube.com/watch?v=Ii-aeW5pHPQ&t=5280).

**I — Full vision:** a research institution spanning many disciplines makes real contributions while treating independent understanding, diagnosis, and problem selection as explicit outputs. Apprentices use agents to participate in work otherwise out of reach, but must explain assumptions and transfer ideas unaided. Mentors receive time and credit; failed learning trajectories are recorded. The ambition is replenishing scientific judgment while production automates, rather than delivering a tutoring app.

**F — Closest attempts:** LeanTutor is an actual proof-tutoring prototype, evaluated with 371 Peano-arithmetic proofs, not a demonstration of durable research apprenticeship. NSF REU already funds mentored research cohorts; UConn's mathematics program identifies a current 2024–2027 award, DMS-2349433. Hazel also has NSF-backed classroom-proof-assistant research. Existing institutions and teaching expertise should be collaborators. [LeanTutor paper](https://ojs.aaai.org/index.php/AAAI/article/view/41514), [NSF program](https://www.nsf.gov/funding/opportunities/reu-research-experiences-undergraduates), [UConn award record](https://mathreu.uconn.edu/overview/), [Hazel research](https://hazel.org/).

**I — Why now / ambition verdict:** accessible machine proof/explanation changes what a novice can contribute. Apprenticeship itself was never impossible. A global institution could change the field's capabilities, but the proposed intervention has not established a new systems bottleneck or why an existing REU/research-school program could not adopt it. Reject as the independent platform-engineering pick; retain its learning measures inside ideas 1 and 2.

**I — One-shot / law:** mentorship, trusted research access, observed development, and academic recognition survive model improvement. Tutoring code does not. Participant consent, attribution, and separation from academic grading are necessary for meaningful evidence; avoid recruiting only already exceptional students.

**E — Economics:** at 10,000 apprentices, four mentor-hours each week for 30 weeks requires 1.2 million mentor-hours/year. At an illustrative $100/hour this is $120 million, before stipends, coordination, and experiments. $100/month of model use for each participant adds $12 million/year. Mentor time and funding incentives dominate compute.

**E — Six weeks:** with an existing mentor, run four to six adults through one real proof-digestion or computational-reproduction project. Record baseline understanding, permitted AI help, contribution quality, a delayed unaided explanation, and a new problem requiring transfer. Budget 40–60 organizer-hours, 20–40 mentor-hours, and $200–$600 compute, with participant support accounted for separately. Deliver an open curriculum plus consented outcome/failure cases; the sample supports feasibility only.

**I — Objection / cheap kill / fit:** productive output can mask declining understanding, and mentors may have no incentive to carry the additional burden. Test recruitment and one delayed transfer exercise before writing dedicated software. If direct model tutoring works equally well or no mentor will participate, do not build a platform. **Closest funded institution: NSF REU; closest technical prototype: LeanTutor.** Poor solo systems fit despite the importance of the goal.

## Ranking and decision

**I — Ranking weighs scientific consequence, survivability under stronger models, actual opening after funded prior art, and the ability of a part-time systems builder to make an accepted contribution. These are judgments, not measured scores.**

1. **Continuously executable scientific record.** Best bridge from a concrete physical-data dependency to infrastructure that changes what a field can audit and reuse. Build a scientific evidence contribution with CODECHECK/ReScience/Fairground compatibility. Require independent use and interpretation.
2. **Whole-field formalization plus proof digestion.** Enormous consequence and a strong checking substrate. Funded overlap is unusually close, and mathematical co-ownership is mandatory. Contribute within Formal Frontier/Mathlib rather than pitching a replacement commons.
3. **Federated world model with validated couplings.** Largest vision and strong systems fit. Planetary integration and recurring model evaluation already have institutional owners; contribute a meaningful cross-model evidence corpus. Most crazy-but-not-impossible.
4. **Prospective live research observatory.** Valuable institutional science; weak historical-impossibility case and extensive existing benchmark work. Partner with a funded evaluator if access is available.
5. **Research apprenticeships.** Addresses a real scientific-renewal problem, but current evidence supports a mentored educational experiment rather than a distinctive engineering infrastructure project.

**I — ONE pick and six-week commitment:** an executable cross-paper scientific record, starting with the TU Delft kite geometry, load, and flow evidence. Preserve the authors' published configurations and known 1.02° correction, reproduce selected comparisons under recorded solver versions, and publish independently assessed downstream effects of a subsequent change. The scale ambition remains the computational literature; the scarce asset is accepted scientific evidence accumulating over time. **Closest active funded effort: CODECHECK's NWO-supported 2026–2028 reproducibility-indicator study.**

**I — Five-line TL;DR**

1. Make published computational claims a maintained executable network with independent scientific checks and explicit holes.
2. A real pilot exists in open kite-aerodynamics papers, archived measurements, shared geometry, and an author-documented correction.
3. Whole-field Lean and proof digestion have powerful funded neighbors: Mathlib, Formal Frontier, Lean FRO, and the $31.5 million AI for Math Fund.
4. A planetary model federation is physically plausible at institutional budgets; CMIP/REF, DestinE, CSDMS, NVIDIA, and Fairground already cover much of it.
5. The engineer's field-changing contribution is accumulated, adopted evidence about meaning and model behavior; a new runner, proof bot, or tutor is insufficient.
