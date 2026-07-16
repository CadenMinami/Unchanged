# History Unbroken Codex Master Brief

## Intent

Build a historically responsible, educationally meaningful, technically feasible, and highly competitive OpenAI Build Week 2026 Education submission called **History Unbroken: The Road That Should Have Closed**.

The project is an AI-powered historical mystery game. The player investigates a bounded temporal fracture around the Flight to Varennes, interrogates historically grounded AI characters, evaluates conflicting evidence, constructs a causal explanation, repairs one altered link, and receives a student debrief plus a teacher-facing learning report.

## Current Authorization

Phase 0 was completed and explicitly approved on 14 July 2026. The deterministic case, source-bounded GPT-5.6 layer, staged voice path, archive graybox, bounded teacher alignment, accessibility preferences, authored hints, and deterministic teacher report are implemented in the working tree. On 15 July 2026, the user approved the diegetic 3D investigation specification and gated implementation plan; on 16 July 2026, the approved teacher-alignment phase was implemented and browser-tested. The current authorization is integrated hardening and Phase 5 polish. Do not restart completed phases or treat unchecked scratch-plan boxes as stronger authority than `AGENTS.md`, the versioned contracts, and the implemented tests.

The existing non-spatial route remains complete and directly selectable. It is also the accessible DOM interaction layer for the spatial route. The historical case engine remains the only educational authority; the 3D runtime is presentation and navigation, not a second game-state system. Teacher alignment is separately persisted support metadata and may never mutate case state, evidence, character knowledge, scoring, repair, or the solution.

The "do not write application code" language below records the completed Phase 0 gate and is no longer the current stop condition. `AGENTS.md`, the approved 3D specification, the versioned case package, and `docs/REPAIR_GATE_TRACEABILITY.md` define current authority.

## Controlling Product Principle

History Unbroken must not become a chatbot wrapped in UI. The game must make historical reasoning visible through actions:

- Present evidence to a character
- Challenge a claim with a source
- Compare documents
- Record testimony
- Mark claims as corroborated, contradicted, qualified, or unresolved
- Connect evidence to a causal board
- Submit a free-form historical argument
- Repair a specific altered causal link

GPT-5.6 should be meaningfully necessary but never historically authoritative. Authored deterministic logic controls facts, evidence, character knowledge, causal graph, repair eligibility, and win conditions.

The spatial experience must make the student feel physically present without becoming an open-world simulation. The fixed investigator travels through four compact reconstructed zones, opens readable DOM evidence and dialogue overlays from world objects, and completes one guided pursuit. Combat, unrestricted riding, stealth, alternate-France simulation, and photorealism are excluded.

For interface work, `docs/DESIGN_SYSTEM.md` and `docs/WIREFRAMES.md` control visual hierarchy, responsive behavior, provenance treatment, and critical interactions.

## Required Build Phases

### Phase 0: Historical Verification and Wireframe Approval

Completed and approved on 14 July 2026. The following list records the gate that preceded application work.

1. Read every planning document.
2. Identify contradictions, ambiguous requirements, and historical claims marked `REQUIRES VERIFICATION`.
3. Research and propose resolutions for:
   - Sauce character
   - route chronology
   - bridge geography
   - travel timing
   - escort details
   - source excerpts
4. Do not silently modify the canon.
5. Produce text wireframes for the five critical screens:
   - context primer and fracture opening
   - investigation hub
   - character interview with evidence presentation
   - evidence comparison and causal board
   - hypothesis submission and repair sequence
6. Define deterministic state transitions.
7. Verify that every required conclusion remains discoverable through the answerability matrix.
8. Review the AI contracts and identify missing fields or authority leaks.
9. Update:
   - `docs/HISTORICAL_SOURCES.md`
   - `docs/PRODUCT_SPEC.md`
   - `docs/ARCHITECTURE.md`
   - `docs/BUILD_LOG.md`
10. Present the completed Phase 0 package for approval.
11. Stop before application implementation.

### Phase 1: Deterministic Vertical Slice

After explicit approval, build a crude but complete deterministic case before integrating model calls.

Minimum vertical slice:

- fracture opening
- evidence archive
- one character or static testimony station
- source comparison
- causal board
- hypothesis hard gates
- repair sequence
- debrief
- fallback mode

### Phase 2: Full Deterministic Case

Add all evidence, character locations, route map, caseboard states, hypothesis checks, local persistence, provenance labels, source drawer, student debrief, and teacher report shell.

### Phase 3: GPT-5.6 Integration

Add:

- structured character turns
- evidence-aware dialogue
- Socratic follow-up
- hypothesis parsing for formative feedback
- non-authoritative rubric evaluation
- repair-authority isolation tests
- model failure handling
- model eval tests

### Phase 4: Teacher Alignment and Accessibility

Implemented in the working tree:

- sample course packet
- teacher objective selection
- bounded course-packet ingestion
- packet alignment review
- packet-aware hints and debriefs
- reduced-reading mode
- reduced-motion mode
- keyboard path
- accessible labels

The secure first course-material path supports the reviewed sample, pasted text, TXT, and Markdown. PDF and DOCX remain explicitly unsupported until a bounded binary extraction/OCR design can preserve exact server-authorized segment provenance and cleanup guarantees.

### Phase 5: Polish, Test, Deploy, and Demo

Finish:

- historical review
- prompt-injection tests
- API fallback
- visual polish
- deployed regression test
- README and docs
- under-three-minute YouTube demo
- Build Week submission

## Historical Authority Rules

1. Verified facts must have source IDs.
2. Fictional temporal corruption must be labeled as fictional.
3. Reconstructed artifacts must be labeled as reconstructions.
4. Dramatic dialogue must be labeled as dramatized AI output.
5. Teacher packets align terminology and objectives; they do not rewrite history.
6. The model may not invent canonical facts, evidence, solution requirements, or win conditions.
7. The final reconstruction must avoid "one person caused the Revolution" logic.
8. The alternate branch must collapse into uncertainty after the immediate divergence.

## Student Knowledge Contract

Students do not need prior knowledge of Varennes to solve the case. Everything required must be available in the game through the context primer, glossary, evidence, characters, notebook, and caseboard.

The product may assume students can:

- read or use reduced-reading support
- compare two statements
- identify disagreement
- select evidence for a claim
- revise after feedback

The product must not assume students already know:

- who Drouet or Sauce were
- where Varennes is
- why the royal journey failed
- what the Flight to Varennes meant politically

## Model/Deterministic Split

GPT-5.6 handles flexible language, perspective, adaptation, and reasoning feedback:

- character dialogue within a dossier
- evidence-aware reactions
- Socratic questions
- selection among authored standard and reduced-reading units
- course-packet concept/term mapping through reviewed IDs and exact server-created segment IDs
- hypothesis parsing
- rubric evaluation

The model does not write historical dialogue, hint prose, packet excerpts, or teacher-report narration directly. The server renders authorized authored units, derives short packet references from exact transient segments, and builds the teacher report deterministically from validated state and bounded observable events.

Deterministic logic controls:

- facts
- chronology
- evidence
- provenance
- fictional alteration
- character knowledge boundaries
- evidence unlocks
- causal graph
- hard assessment gates
- repair eligibility
- final state changes

## Documentation Requirements

Maintain these files throughout the build:

- `README.md`
- `docs/PRODUCT_SPEC.md`
- `docs/HISTORICAL_SOURCES.md`
- `docs/BUILD_LOG.md`
- `docs/ARCHITECTURE.md`
- `docs/DEMO_SCRIPT.md`

`BUILD_LOG.md` must distinguish:

- what Codex proposed
- what Codex implemented
- what the user decided
- what the user rejected or changed
- why important decisions were made

## Submission Requirements

Before submission:

- deployed working project
- public or accessible repository
- setup and testing instructions
- documentation of Codex's contribution
- documentation of GPT-5.6's role
- screenshots
- public YouTube demo under three minutes
- `/feedback` Session ID from the primary Codex thread

## Original Phase 0 Prompt

This prompt records the handoff that began Phase 0. The repository's current gate is defined in `AGENTS.md` and `docs/REPAIR_GATE_TRACEABILITY.md`.

Use this prompt to begin Phase 0:

```text
Use CODEX_MASTER_BRIEF.md and every document in the planning bundle as the controlling specification for History Unbroken.

Begin Phase 0 only. Do not write application code yet.

First:

1. Read every planning document.
2. Identify contradictions, ambiguous requirements, and historical claims still marked REQUIRES VERIFICATION.
3. Research and propose resolutions for the Sauce character, route chronology, bridge geography, travel timing, escort details, and source excerpts. Do not silently modify the canon.
4. Produce text wireframes for the five critical screens:
   - context primer and fracture opening
   - investigation hub
   - character interview with evidence presentation
   - evidence comparison and causal board
   - hypothesis submission and repair sequence
5. Define the deterministic state transitions and verify that every required conclusion remains discoverable through the answerability matrix.
6. Review the conceptual AI contracts and identify any missing fields or authority leaks.
7. Update docs/HISTORICAL_SOURCES.md, docs/PRODUCT_SPEC.md, docs/ARCHITECTURE.md, and docs/BUILD_LOG.md.
8. Present the completed Phase 0 package for my approval.
9. Stop before application implementation. Wait until I explicitly say: begin implementation.

Throughout the work, distinguish:
- what Codex proposed
- what Codex implemented
- what I decided
- what I rejected or changed
- why each important decision was made
```
