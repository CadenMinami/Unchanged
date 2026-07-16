# Product Spec

## 1. One-Sentence Pitch

**History Unbroken: The Road That Should Have Closed** is a teacher-aligned historical mystery in which students interrogate source-bound AI characters, compare conflicting evidence, construct a multicausal explanation of the Flight to Varennes, and repair one altered link without reducing the French Revolution to a single cause.

## 2. Product Positioning

History Unbroken is not:

- a generic AI tutor
- a trivia game
- a choose-your-own-adventure retelling
- a freeform alternate-history simulator
- a chatbot that impersonates historical figures without game mechanics
- a system where the model invents historical truth

It is a playable historical reasoning system. The central value is that students must build a defensible argument from evidence, not merely recall a fact.

The approved primary presentation is a compact third-person temporal reconstruction with a complete non-spatial alternative. The student moves through four authored zones, opens evidence and source-bounded conversations through readable focus overlays, and completes one guided pursuit. Travel supports presence; evidence comparison, causal construction, and repair remain the core experience.

## 3. Target Student

Primary target:

> Grade 10 World History student completing a French Revolution unit after learning basic events of 1789-1791.

The case should also work for students who have not yet studied Varennes, because the game includes a novice-safe context primer and every required conclusion is discoverable in the case.

## 4. Educational Problem

Students often learn historical outcomes as a sequence of events without practicing the disciplinary moves historians use to explain those outcomes. They may:

- accept sources as neutral containers of facts
- miss the difference between testimony, interpretation, and evidence
- confuse chronology with causation
- write single-cause explanations for multicausal events
- fail to evaluate perspective, bias, and knowledge limits

Teachers also lack visibility into how students reasoned before their final answer.

## 5. Learning Objectives

By the end of the case, students should be able to:

1. Source a document or testimony by identifying author, position, timing, and limitation.
2. Corroborate evidence by comparing at least three sources.
3. Distinguish condition, trigger, mechanism, and consequence.
4. Construct an evidence-based causal argument.
5. Reject at least one plausible but unsupported hypothesis.
6. Express appropriate historical uncertainty.
7. Avoid single-cause explanations of major historical change.

## 6. Core Mystery

The game centers on the Flight to Varennes, June 1791.

The case targets the historical sequence in which Louis XVI and the royal family secretly left Paris and were stopped at Varennes after a chain of recognition, information, pursuit, and local action. Exact operational claims remain unavailable to implementation until they pass the Phase 0 source ledger.

The player knows only that the timeline fractured somewhere inside the recognition-to-detention chain. A diagnostic layer surfaces three equally labeled fictional temporal anomalies: one involving recognition, one involving route information, and one involving local authorization. Fixed fictional observations show what occurred in the altered branch, while reviewed historical evidence shows what must be restored. The player must compare those two layers to eliminate two candidates and identify the active fracture.

The intended repair, pending historical verification of the surrounding chain, is the route-information handoff:

> accurate route information -> redirected pursuit -> warning at Varennes -> local mobilization -> (blocked onward passage and passport inspection as parallel local actions) -> guarded collective detention

The game repairs only this bounded link. It does not claim to know what France would have become had Louis reached Montmedy.

## 7. Historical Scope

Playable window:

- night of 20-21 June 1791: royal departure from Paris
- recognition near Sainte-Menehould
- pursuit toward Varennes
- local warning and obstruction
- detention and return
- immediate political reaction

Contextual band:

- constitutional conflict
- Louis's constrained position in Paris
- royal dissatisfaction with revolutionary settlement
- fear of counterrevolution
- growth of political press and public opinion
- local civic institutions and National Guard action

Consequence boundary:

- The deterministic gate records competing official, diplomatic, and radical framings after the flight.
- The deterministic gate records that the September Constitution retained monarchical government.
- The deterministic gate requires the claim limit that this case record does not establish the flight as the sole or inevitable cause of later outcomes.
- Arguments that the episode damaged trust, intensified debate, strengthened some republican positions, or contributed to polarization remain bounded historical interpretations for formative feedback; they are not canonical fact gates.

## 8. Provenance Labels

Every item must be visibly labeled:

| Label | Meaning |
|---|---|
| Verified historical record | Supported by a reviewed primary source or reliable scholarship |
| Contested interpretation | Historically debatable meaning or motive |
| Historical reconstruction | Authored map, timeline, dossier, or diagram assembled from reviewed sources |
| Dramatized dialogue | AI-generated or authored dialogue constrained by a knowledge dossier |
| Fictional temporal corruption | Invented only for gameplay |
| Class material | Uploaded or selected by the teacher for alignment, not ground truth |

Labels must not rely on color alone.

## 9. Player Journey

1. Teacher optionally selects two or three authored objectives, chooses accessibility/guidance preferences, and prepares a reviewed sample, pasted-text, TXT, or Markdown alignment profile.
2. The teacher reviews exact packet references, conflicts, ignored instruction-like text, and limitations, then explicitly approves or clears the profile. Unapproved drafts do not affect the student experience.
3. Student starts in Guided Investigation or Unit Challenge mode.
4. Context primer gives the minimum background needed.
5. Cold open shows the fractured carriage route and contradictory records.
6. Player directly chooses the spatial reconstruction or complete non-spatial archive route; both preserve the same evidence and repair requirements.
7. Player questions characters, inspects evidence, compares sources, and builds a caseboard through the selected presentation route.
8. The player may switch from the spatial world to the non-spatial workspace without losing deterministic case progress.
9. Player submits a free-form hypothesis with pinned evidence.
10. GPT-5.6 evaluates reasoning while deterministic gates protect historical requirements.
11. Player revises if needed.
12. Repair sequence restores route information and warning chain.
13. Reconstruction explains what was repaired and why it mattered.
14. Student debrief and deterministic teacher report summarize recorded reasoning.

## 10. Core Gameplay Loop

Claim -> evidence confrontation -> changed testimony -> recorded claim -> caseboard update -> stronger hypothesis.

The most important demo sequence:

1. Character makes a plausible but biased or incomplete claim.
2. Player presents contradictory evidence.
3. GPT-5.6 responds dynamically within the character's knowledge boundary.
4. Player records or qualifies the claim.
5. Deterministic system unlocks a caseboard relationship.
6. Assessment later refers to that reasoning move.

## 11. Key Screens

The controlling visual and interaction specifications are `docs/DESIGN_SYSTEM.md` and `docs/WIREFRAMES.md`. The locked direction is an archival control room with the route and evidence as the visual center; conversation remains a subordinate investigation surface.

### Context Primer and Fracture Opening

Visual timeline cards establish France in 1791 and the immediate contradiction. The player is told they are not expected to know Varennes beforehand.

### Investigation Hub

Route map is central. Access points lead to characters, evidence archive, comparison lab, caseboard, notebook, and glossary.

### Character Interview

Character profile and provenance disclosure on left; transcript in center; evidence tray and actions on right.

Required actions:

- ask
- present evidence
- challenge claim
- record claim
- compare
- ask for context

### Evidence Inspector

Shows document or reconstruction, provenance label, source metadata, simplified/original toggle, glossary terms, and source notes.

### Comparison Lab

Allows two or three evidence items side by side. Player marks:

- agreement
- contradiction
- chronology problem
- provenance issue
- uncertainty

### Causal Caseboard

Lanes:

- conditions
- journey conditions
- immediate mechanism
- political consequences
- uncertainty/alternatives

### Hypothesis Composer

Student submits:

- natural-language argument, with 80-220 words offered as non-blocking writing guidance
- selected altered link
- five required historical records representing at least three eligible historical lineages
- two broader conditions
- one limited consequence
- two rejected anomaly candidates and both authored claim limits

The prose length and wording are not repair gates. Deterministic eligibility reads the validated anomaly decisions, evidence pins, condition selections, causal nodes and edges, consequence, claim limits, and submission state. Future model feedback may evaluate the prose formatively but cannot unlock or block repair.

### Repair Sequence

After identifying the active anomaly, the player restores the supported route information, sends the warning to Varennes, and places local mobilization, blocked-onward-passage, passport-inspection, and guarded-detention nodes. Blocked passage and passport inspection branch from collective local action; either may be restored first, and both reducer-owned actions must be present before the authored joint-response step completes. Both links into detention use the cautious `contributed_to` verb and display their authored-reconstruction limitation. This requirement represents the collective response in the reconstruction; the records do not prove either action or their pair as a strict but-for cause. The two rejected anomaly candidates remain visible as unsupported alternatives.

### Reconstructed Timeline

Two tracks rebuild:

- journey track
- political-meaning track

Later outcomes appear as faded downstream nodes with multicausal warnings.

### Teacher Setup

`/teacher` provides:

- selection of two or three repository-authored learning objectives
- standard/reduced reading, standard/reduced motion, and guided/challenge preferences that work with or without a packet
- reviewed sample, pasted-text, and TXT/Markdown input paths
- an explicit pending-review state showing authorized concept links, short exact packet excerpts, reference labels, possible historical conflicts, ignored instruction-like text, and limitations
- a **Confirm alignment** action before the profile can be persisted or used for class-language support

The ordinary student case remains available without teacher setup. Within the setup workflow, the student-launch action appears only after approval.

### Teacher Report

`/teacher/report` is a printable formative report. It shows completion status, counts from validated case state, bounded support-use events, the recorded student argument, support settings, and teacher-approved objective/packet connections. It does not generate a narrative with GPT-5.6, recalculate an AI rubric, infer unobserved revision history, or serve as a tamper-resistant grade record.

## 12. Character And Source Stations

Current stations:

- generated Jean-Baptiste Drouet station, combining the fixed FO1 fictional branch with authored reactions to presented E3, E4, or E5
- Varennes civic-response station centered on Sauce's documented office and collective local action; open Sauce roleplay deferred
- generated Louis XVI station limited to the E1 declaration and S1
- static Assembly reaction dossier using E7

Barnave is excluded from the current runtime model policy. Adding him requires a later explicit product decision and coordinated canon, policy, test, and version changes. Assessed Varennes civic evidence remains static even if a later dramatized Sauce guide is added.

## 13. Evidence Set

Planned evidence:

1. Louis XVI's written declaration
2. Royal travel dossier
3. Drouet's account
4. Route-and-timing board
5. Varennes civic-response, passage, and detention dossier
6. Fictional temporal-anomaly set plus equally labeled fixed branch observations: recognition, route, and local-authorization candidates
7. Immediate press and political-reaction packet

## 14. Hypothesis Assessment

Assessment uses a free-form student argument plus deterministic repair requirements and AI-assisted formative feedback.

### Repair Authority

Repair eligibility is deterministic. It is computed only from validated student actions and structured case state, never from model prose, a model rubric score, or semantic extraction from the essay.

Deterministic hard gates read explicit state from the anomaly comparison, evidence pins, causal board, and Case Brief controls:

- route-information candidate identified from fixed fictional branch observations compared with reviewed history, rather than assumed from its label
- recognition and local-authorization candidates rejected through the same comparison
- mechanism includes misdirected or delayed pursuit
- Varennes warning, collective action, blocked onward passage, passport inspection, and guarded detention included
- Louis's intentional participation supported by his declaration plus independent travel-preparation evidence, without treating the declaration as proof of every private motive
- all five required historical records cited, spanning at least three eligible historical lineages
- at least two broader conditions included
- bounded reaction-and-continuity observation selected
- no single-cause or inevitability claim

Fictional branch observations can establish what happened inside the authored alternate branch. They never count as historical evidence, independent corroboration, or proof of a verified historical claim.

GPT-5.6 evaluates:

- reasoning coherence
- evidence-to-claim fit
- sourcing and perspective
- corroboration
- treatment of uncertainty
- quality of revision feedback

GPT-5.6's evaluation is formative. It may recommend revision in the student feedback surface, but the current deterministic teacher report does not import or recalculate the model rubric. Model feedback cannot unlock, block, revoke, or delay repair, and the complete case remains playable when evaluation is unavailable.

## 15. Student Assessment Rubric

Each criterion is scored 0-4:

- sourcing and perspective
- corroboration
- causal reasoning
- claim and evidence fit
- alternatives and uncertainty

Repair unlock requires every deterministic hard gate to pass. The rubric has no minimum score for progression, no category threshold, and no second-pass adjudication.

The rubric score is displayed as AI-assisted formative feedback. A teacher must review it before using it for grading. Unsupported or overconfident prose may lower the formative rubric and generate a revision prompt, but it cannot override the student's validated evidence and causal-board work.

## 16. Teacher Report

The implemented report is deterministic. Its inputs are the final validated `CaseState`, the separately persisted approved alignment and support preferences, and bounded observable event codes such as `hint_viewed`, `evidence_inspected`, and `evidence_pinned`.

Sections:

- session overview
- recorded reasoning state
- course alignment
- student work
- support settings
- teacher-review and AI-authority boundaries

The report must not infer intelligence, personality, disability, political belief, motivation, emotional state, or future achievement.

It describes observable final state and recorded events, for example:

> 3 source comparisons recorded; 5 reviewed records pinned to the final brief.

It does not claim unobserved chronology such as what a student "initially" believed. It is printable from the browser and explicitly requires teacher review.

## 17. Accessibility Scope

Implemented Phase 4 behavior:

- reduced-reading preference persists independently of case state and selects authored shorter primer, character-response, feedback, and hint variants
- reduced-reading evidence surfaces retain the authoritative excerpt while moving longer source limitations behind an accessible disclosure
- reduced-motion preference persists independently of case state, honors the operating-system preference on first compatible load, suppresses CSS animation/transition timing, removes ambient 3D residents, and uses a direct follow camera
- reduced-motion repair shows the complete static reconstruction sequence while preserving every ordered reducer-owned repair action; it does not provide a progression shortcut
- keyboard-operable teacher controls, semantic review/report sections, live progress status, and explicit labels for investigation actions
- glossary support, color-independent state, no timed decision gate, visible dialogue captions, optional audio, and responsive text sizing remain available

Reading and motion preferences do not change evidence, scoring, solution requirements, or repair eligibility. Focused Phase 4 Playwright coverage passes the teacher approval/aligned-investigation path, 320 x 700 world-HUD fit, and distinct accessible names for all six historical-record controls. Manual browser QA also passed `/teacher` at desktop and 390 x 844, `/teacher/report`, and the 320 x 700 world top controls without overflow or overlap. The fresh integrated no-key gate passes warning-free lint, typecheck, 75 Vitest files with 509 tests, the production build, and all 19 Playwright tests. Do not claim formal accessibility compliance or final project readiness: screen-reader-oriented/cross-route equivalence, live-provider, physical Chromebook, deployment, and submission checks remain separate gates.

## 18. Teacher Packet Alignment

Status: implemented for the secure text-first phase.

Supported sources:

- built-in reviewed sample packet
- pasted text, bounded to 40,000 characters
- UTF-8 `.txt` / `text/plain` files, bounded to 64 KB
- UTF-8 `.md` / `text/markdown` files, bounded to 64 KB

PDF and DOCX are not supported in this phase. The application has no hardened binary extraction or OCR boundary for page limits, embedded objects, decompression, malformed containers, external references, and temporary-artifact cleanup. Restricting ingestion to directly inspectable bounded UTF-8 text makes the accepted bytes, segmentation, and retained excerpts auditable.

The alignment contract is closed and versioned. A model may return only:

- repository-authored objective, concept, historical-boundary, injection-kind, and limitation IDs
- a server-created packet segment ID
- an exact case-sensitive packet term from that segment
- bounded confidence and reading-support enums

Exact server-authorized segments are required so the model cannot invent a packet quotation, cite text outside the bounded request, or smuggle a new historical claim into the approved profile. The server resolves every proposed segment ID against its own ephemeral segment map, verifies that the term is an exact substring, derives the short excerpt/reference itself, and drops unresolved mappings. The profile is always `alignment_only`, `mutatesCaseState: false`, and `pending_teacher_review` until the teacher confirms it.

Raw packet text is not retained. The separately persisted learning-session envelope stores the approved profile, preferences, and bounded event codes. The approved profile contains a SHA-256 digest, reviewed IDs, exact short excerpts/terms, references, limitations, and approval metadata; it does not contain the original pasted text, uploaded file, or a case-state snapshot.

Teacher materials may influence:

- vocabulary
- reading level
- hints
- course-objective links
- report emphasis
- packet references

Teacher materials may not change:

- verified facts
- fictional alteration
- chronology
- evidence
- character knowledge
- causal graph
- minimum solution requirements
- correctness

Deterministic correctness is read only from the versioned case package's `solution` object. Source-linked `repairGates` are explanatory traceability metadata, not a second scoring or unlock system.

With no API key or after invalid/provider output, deterministic exact-term matching returns a reviewable profile. The reviewed sample never requires a model. Instruction-like packet text is surfaced as ignored class data, and possible conflicts with authored historical boundaries require teacher attention rather than changing canon.

## 19. API Failure Fallback

The full case must remain completable without model calls.

Fallbacks:

- pre-authored character responses
- deterministic hypothesis feedback
- reviewed sample course-alignment profile
- deterministic exact-term alignment for pasted TXT/Markdown content
- authored hint ladder with no packet term when no alignment is approved
- deterministic teacher report
- no blank or blocked states

## 20. Definition of Product Done

Done means:

- complete 10-15 minute case
- all evidence included
- investigation can proceed in more than one order
- evidence presentation changes responses
- causal board works
- hypothesis submission works
- repair sequence works
- student debrief and teacher report work
- sample teacher packet visibly changes alignment
- reduced-reading and reduced-motion modes work
- historical claims sourced
- fictional and reconstructed elements labeled

The Phase 4 feature scope above is implemented with focused unit, integration, historical-authority, Playwright, manual browser-layout, and full integrated no-key suite evidence. The overall product is not finally done: screen-reader-oriented/cross-route accessibility checks, live-provider smoke testing, physical Chromebook verification, deployment, and submission checks remain separate gates.
