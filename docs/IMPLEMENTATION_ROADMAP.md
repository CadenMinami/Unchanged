# Implementation Roadmap

## Current Rule

Phases 0-4 are complete for the current vertical slice. The Phase 3 GPT-5.6 source-bounded layer and Task 12 staged voice runtime are implemented and locally tested; live API-key smoke tests remain before provider-level verification can be claimed. Phase 4 teacher alignment/accessibility is implemented with bounded authority and deterministic reporting. Phase 5's grounded visual pass is implemented with scene manifest `1.2.0`, asset ledger `1.0.0`, exact runtime hashes, project-authored license records, optional-asset fallbacks, articulated figures, late-evening environment treatment, and muted-by-default procedural ambience. Automated cross-route accessibility equivalence and axe-core checks are present. Remaining Phase 5 work is release closure: formal screen-reader and physical Chromebook verification, live-provider smoke, deployment regression, unfamiliar-user playtesting, screenshots, and demo production.

## Phase 0: Historical Verification And Wireframes

Status: complete and approved for the current case package. Barnave remains excluded from the runtime model policy.

Goal: lock the case canon before implementation.

Tasks:

- read all planning documents
- identify contradictions and ambiguous requirements
- verify historical claims marked `REQUIRES VERIFICATION`
- resolve Sauce role
- resolve Barnave role
- verify route chronology
- verify bridge geography
- verify travel timing
- verify escort details
- choose source excerpts
- update source ledger
- produce text wireframes
- define deterministic state transitions
- review AI contracts
- update build log

Exit condition:

- no unresolved ambiguity about solution, provenance, model authority, or answerability
- user approves implementation

## Phase 1: Deterministic Vertical Slice

Status: complete in the local application and full browser path.

Goal: working crude end-to-end case without model calls.

Build:

- app shell
- case data format
- case-state reducer
- context primer
- fracture opening
- one static character/testimony station
- two evidence items
- comparison action
- simple caseboard
- basic hypothesis hard gate
- repair animation placeholder
- debrief
- fallback mode

Exit condition achieved locally: the case completes from primer through debrief without model calls. Public deployment remains Phase 5 work.

## Phase 2: Full Deterministic Case

Status: complete for the submission path. Packet-aware reporting was added in Phase 4.

Goal: entire mystery works without AI.

Build:

- all evidence items
- evidence inspector
- comparison lab
- route map
- caseboard
- character locations with static fallback
- notebook
- glossary
- hard-gate hypothesis logic
- full repair sequence
- reconstructed timeline
- student debrief
- teacher report shell
- local persistence
- provenance/source drawer

Exit condition:

- full case is completable without model calls

## Phase 3: GPT-5.6 Integration

Status: implemented, historical-integrity reviewed, and covered by unit, integration, policy-eval, and no-key browser paths. Live-key provider verification remains open.

Goal: make AI meaningfully necessary but bounded.

Implemented:

- strict character-turn endpoint for Drouet and Louis only
- static Varennes civic and Assembly reaction dossiers
- station allowlists, explicit unknowns, and E1-only Louis boundary
- ID-only plans with server-rendered authored character prose
- evidence-aware reactions with presented-evidence prerequisites
- Socratic follow-up and refusal unit selection
- formative Case Brief feedback using exact student spans and authored templates
- provenance, dependency-lineage, and independent-lineage feedback context
- coherence checks for corroboration, evidence fit, and formative status
- tests proving model output cannot change repair eligibility
- `omni-moderation-latest` input checks and authored safety refusals
- schema bounds, rate limiting, abort propagation, one transient retry, and typed failure handling
- validation/no-key/provider fallback and source-bounded model eval corpus

Exit condition:

- GPT-5.6 improves investigation and assessment but cannot alter canon or state directly
- a configured-key smoke test confirms the Responses API and moderation paths

## Phase 4: Teacher Alignment And Accessibility

Status: feature implementation and integrated local no-key verification complete. Focused contract/component verification, a 3-test teacher/classroom Playwright file, targeted desktop/mobile browser QA, warning-free lint, typecheck, 75 Vitest files with 509 tests, the production build, and all 19 Playwright tests passed.

Goal: demonstrate classroom fit.

Implemented:

- `/teacher` setup screen with two-or-three objective selection and reading/motion/guidance preferences
- reviewed sample packet, pasted text up to 40,000 characters, and UTF-8 TXT/Markdown files up to 64 KB
- explicit rejection of PDF/DOCX until a hardened binary extraction/OCR boundary exists
- course-alignment `1.1.0` and prompt `1.0.0` contracts over a closed objective/concept/boundary catalog
- model plans limited to reviewed IDs, server-created segment IDs, exact packet terms, and bounded enums
- exact-segment server authorization, conflict/injection flags, short excerpts, limitations, and raw-packet non-retention
- deterministic sample and no-key/provider-failure alignment paths
- pending teacher review and explicit approval before an alignment profile is persisted or used
- learning-session `1.0.0` persistence separate from deterministic case state
- four-tier authored hint ladder with standard, reduced-reading, and approved class-term variants
- approved class-material references in non-spatial and spatial evidence surfaces
- reduced-reading variants across primer, dialogue, feedback, hints, and evidence details
- reduced-motion CSS, zero ambient residents, direct camera following, and static repair context without a repair shortcut
- deterministic printable `/teacher/report` from validated case state, approved alignment, preferences, and bounded observable events
- additional semantic labels and live progress status on the investigation path

Exit condition:

- sample packet visibly changes vocabulary, hints, and reporting without changing solution

Contract/component evidence supports the authority, ingestion, approval, persistence, hint, and report behavior. Focused browser evidence supports sample review/approval, separate learning-session persistence, an unchanged canonical investigation, E3/E4/E5/E7 class-material connections, six distinct historical-record control names, 320 x 700 world-HUD fit, desktop/390 x 844 teacher-layout fit, and clean report rendering. Phase 4 is locally verified against its implemented no-key scope. Formal screen-reader-oriented checks, route-equivalence accessibility checks, live-provider smoke tests, and the physical-device gate remain project-level release work.

## Phase 5: Polish, Testing, Deployment, Demo

Goal: submission-ready package.

Status: grounded visual implementation and local provenance closure are complete; release and submission gates remain open.

Build/test:

- visual polish
- responsive layout
- historical integrity tests
- model eval tests
- e2e tests
- API fallback
- prompt-injection tests
- documentation
- deployment regression
- screenshots
- three-minute video

Exit condition:

- deployed project works
- repo docs are complete
- video under three minutes
- submission is ready before deadline buffer

## Daily Schedule Through July 21

### July 14-15

- materialize planning docs
- complete Phase 0 verification
- approve wireframes
- establish repo/app
- complete the deterministic vertical slice
- implement and review the source-bounded GPT-5.6 layer ahead of the original schedule

### July 16

- complete and locally verify the staged Task 12 voice runtime without a paid provider call
- implement the Phase 4 teacher alignment/accessibility feature scope
- run focused Phase 4 unit, integration, and historical-authority checks
- pass the three focused Phase 4 Playwright tests and targeted desktop/mobile browser QA
- run the full integrated no-key suite: lint, typecheck, 509 Vitest tests, production build, and 19 Playwright tests
- synchronize product, architecture, contract, roadmap, README, and build-log documentation

### July 17

- extend browser coverage from the completed sample/evidence path to pasted TXT/Markdown errors, no-key fallback, refresh/resume, aligned hints, and raw-packet non-retention
- run screen-reader-oriented, reduced-reading, and cross-route accessibility-equivalence checks
- perform live-key GPT-5.6/media smoke tests only when credentials are explicitly available

### July 18

- correct reproducible Phase 4 browser/accessibility defects
- run cross-route information and repair-equivalence checks
- complete teacher-report print review
- retain PDF/DOCX as unsupported unless a separate hardened extraction design is approved

### July 19

- historical review
- prompt injection testing
- polish
- API failure handling
- screenshots

### July 20

- feature freeze
- tests
- documentation
- playtesting
- final demo recording

### July 21

- final regression
- verify deployment
- verify repo setup instructions
- upload YouTube video
- run `/feedback`
- submit by 2:00 PM Pacific if possible

## Testing Checklist

### Unit

- case reducer
- evidence unlocks
- provenance labels
- character knowledge boundaries
- hard gates
- hint ladder - covered for deterministic tier selection and authored alignment wording
- packet boundaries - covered for type/body limits, closed IDs, exact segment/term authorization, and raw-packet exclusion
- learning-session compatibility - covered
- deterministic teacher report - covered

### Historical Integrity

- every fact has source ID
- every evidence item has provenance
- every fictional item labeled
- no reconstruction labeled primary
- no character authorized for forbidden fact
- no inevitable downstream causation
- course-alignment concepts link only to existing atomic facts - covered
- alignment profiles cannot encode evidence, scoring, repair, or win-condition authority - covered
- reviewed sample terms/excerpts copy exact authored segments - covered

### Model Evals

- unauthorized and direct-answer requests
- prompt injection and attempted solution leakage
- evidence reactions without required presented evidence
- Louis private-motive and E1-only boundary
- invented student spans
- strong corroboration from one historical lineage
- contradictory statuses without contradictory evidence
- incoherent `well_supported` feedback
- moderation, retry, cancellation, rate-limit, and no-key fallbacks

### End-To-End

- clean path
- different investigation order
- early wrong answer then revision
- reduced-reading mode - dedicated browser acceptance pending
- teacher sample review/approval into unchanged aligned investigation - covered in focused Playwright
- pasted TXT/Markdown review/error paths - pending in browser
- aligned E3/E4/E5/E7 evidence connections and report rendering - covered in focused browser verification
- aligned hint path - pending in browser
- 320 x 700 world HUD and six distinct record-control names - covered in focused Playwright
- API failure path
- refresh/resume
- keyboard-only path - final Phase 4 route coverage pending

## Definition Of Done

Product:

- complete 10-15 minute case
- all evidence implemented
- character/evidence interactions visible
- causal board works
- formative hypothesis feedback works without controlling repair
- repair sequence works
- debrief works and the deterministic teacher report is present
- sample packet changes approved vocabulary, authored hints, and report alignment without changing the solution
- accessibility modes are implemented without changing evidence or repair authority

Historical:

- source ledger complete
- fictional and reconstructed items labeled
- no unsupported character knowledge
- no Varennes-as-single-cause framing
- alternate branch remains uncertain

Technical:

- deployed app runs
- API keys server-side
- model outputs schema-validated
- visible historical model prose is server-rendered from authored units
- evidence prerequisites and source-lineage coherence are post-validated
- input moderation, request bounds, rate limiting, cancellation, and fallbacks work
- full case completable in fallback mode
- core tests pass
- progress survives refresh
- live GPT-5.6 and moderation paths are smoke-tested with a configured key

The overall definition of done is not yet met. The full final suite, remaining accessibility-equivalence/screen-reader-oriented checks, live-provider smoke testing, physical Chromebook gate, deployment, and submission artifacts remain open.

Submission:

- README complete
- docs complete
- demo under three minutes
- screenshots clear
- repository accessible
- `/feedback` Session ID saved
