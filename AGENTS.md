# History Unbroken Agent Guide

## Intent

Build a polished, historically responsible educational mystery in which evidence-based reasoning changes visible game state, while authored data and deterministic logic retain authority over history, assessment, and progression.

## Read Before Working

Read the files relevant to your work before editing. The controlling order is:

1. `AGENTS.md`
2. `CODEX_MASTER_BRIEF.md`
3. `docs/superpowers/specs/2026-07-15-diegetic-3d-investigation-design.md`
4. `docs/CASE_CANON.md`
5. `docs/HISTORICAL_SOURCES.md`
6. `docs/ANSWERABILITY_MATRIX.md`
7. `docs/REPAIR_GATE_TRACEABILITY.md`
8. `docs/CONTEXT_AND_CURRICULUM_CANON.md`
9. `docs/PRODUCT_SPEC.md`
10. `docs/DESIGN_SYSTEM.md` and `docs/WIREFRAMES.md` for interface work
11. `docs/ARCHITECTURE.md` and `docs/AI_CONTRACTS.md`
12. `.Codex/plans/diegetic-3d-investigation-implementation.md` for the active task order

When documents disagree, stop at the conflict and report it. Do not silently choose the convenient version.

## Current Gate

Phase 0, the deterministic primer-to-debrief vertical slice, the source-bounded GPT-5.6 layer, the four-zone 3D investigation through the Louis station, push-to-talk transcription, authorized speech playback, bounded teacher alignment, and the reducer-owned guided pursuit repair are implemented in the working tree. AI contract `1.1.0`, media contract `1.0.0`, course-alignment contract `1.1.0`, and scene manifest `1.1.0` are active. The current gate is Phase 5 visual and operational polish: replace approved graybox surfaces with provenance-labeled grounded stylized assets without changing spatial authority, then complete cross-route accessibility, performance, live-provider smoke, deployment, playtesting, screenshots, and demo-production gates.

The current 2D route is frozen as the complete, directly selectable non-spatial experience and as the DOM focus-overlay system used by the 3D route. Do not delete or weaken it while adding spatial presentation or media. Teacher alignment now uses a separately persisted, teacher-approved profile composed only of repository-owned concept IDs, exact server-authorized packet segments, and authored definitions. It may affect vocabulary, hints, reading support, selected objectives, and report emphasis; it may never alter case state, evidence, character knowledge, scoring, repair, or the solution. The secure first ingestion path supports the reviewed sample, pasted text, TXT, and Markdown; PDF and DOCX remain unsupported until their extraction can preserve the same exact-segment authorization boundary.

Integrated provider verification remains unfinished: live-key smoke tests for historical dialogue, transcription, and speech must run separately when a key is available. Regular unit, integration, and Playwright runs must remain no-key and deterministic. Do not claim physical Chromebook performance, classroom efficacy, production privacy compliance, public deployment, or final submission readiness until those checks have actually been completed.

Treat the case package, command schema, reducer, persistence contract, causal graph, reconstruction companion, repair authority, and model-policy boundaries as shared critical contracts. Change them only through a coordinated, versioned main-integrator task with historical-integrity review. Do not hard-code unresolved optional claims into fixtures, prompts, assessments, world manifests, or UI copy.

Only Drouet and Louis are authorized for generated dialogue. Drouet may combine the fixed FO1 fictional-branch perspective with authored reactions to presented E3/E4/E5 evidence. Louis is limited to the E1 declaration and its S1 facts; E2 and its S8/S9 preparation records remain deterministic archive evidence. Varennes civic content and the Assembly reaction packet are static dossiers. Barnave is excluded from the current model policy; adding him requires an explicit product decision plus coordinated canon, policy, test, and version updates.

## Historical Integrity

- Use the global `historical-integrity` skill for historical research, authoring, review, case data, evidence, character knowledge, causal claims, and tests.
- A historical claim cannot control scoring, progression, repair, or character knowledge until it has an atomic fact ID and an auditable source entry.
- Keep `VERIFIED_RECORD`, `CONTESTED_INTERPRETATION`, `RECONSTRUCTION`, `DRAMATIZATION`, `FICTIONAL_COUNTERFACTUAL`, and `CLASS_MATERIAL` distinct in data and UI.
- Multiple artifacts derived from one account are not independent corroboration.
- Counterfactual consequences are simulation rules, not verified historical necessities.
- Spatial placement is a reconstruction claim. Exact coexistence, distances, routes, bridge geometry, and object positions require explicit source support or a visible schematic-reconstruction limitation.
- Generated dialogue is never historical evidence and cannot contain the only path to an assessed conclusion.
- Every hard gate must trace through `docs/ANSWERABILITY_MATRIX.md` to learner-accessible, deterministic content.
- If source status changes, update the source ledger, case canon, evidence data, prompts, tests, and student-facing label together.

## Product Rules

- Preserve layered mystery Option C: the player knows the fracture lies within the recognition-to-detention chain but must identify the actual altered link among several labeled temporal anomalies.
- The true alteration is not announced by an evidence title, provenance badge, tutorial, or automatic unlock.
- Make investigation actions, evidence comparison, causal construction, and repair visually primary. Chat supports those mechanics; it is not the product shell.
- Keep the novice promise: no required answer may depend on outside knowledge.
- Avoid single-cause and inevitability framing. Drouet is one actor in a network that includes information, geography, local action, institutions, and political context.
- Do not depict a definitive alternate future after the carriage passes the historical interception point.
- The 3D world may report proximity to an authored canonical ID; it may never create evidence, facts, claims, repair eligibility, or a fallback ID.
- The two local repair actions represent an authored reconstruction of the collective response. Their required conjunction is a game reconstruction, not proof that either action or the pair was historically necessary or sufficient.

## AI And State Authority

- The repository-owned case package defines canonical facts, allowed IDs, evidence relationships, and repair rules. A shared pure reducer defines all permitted state transitions.
- Within the case package, `solution` is the sole machine authority for repair eligibility. `repairGates` is validated traceability metadata only and must never be read as a second win-condition definition.
- `schemaVersion` versions package shape; `caseVersion` versions immutable content and invalidates stale local state when facts, IDs, evidence, or solution rules change.
- Evidence records list every dependency lineage separately from the independent historical lineages eligible for corroboration counts. Fiction, dramatization, class material, unresolved sources, and unresolved facts can never enter the historical-evidence registry.
- For the anonymous formative MVP, the browser owns its local session state and invokes only typed reducer commands. This state is intentionally not tamper-resistant and must not be represented as a secure grade record.
- The server owns model calls, uploaded-file handling, and validation of model output. It does not need to round-trip deterministic game commands or persist student sessions in the MVP.
- Model output is an untrusted proposal. Validate schema, IDs, case version, prompt version, request ID, and state revision before use.
- Character and Case Brief model calls return ID-only plans and exact student spans, not visible historical prose. The server renders all displayed historical dialogue and feedback explanations from authored policy units.
- Character claims and evidence reactions must satisfy their `requiresPresentedEvidenceIds` prerequisites. No-evidence and mismatched-evidence plans fail closed to an eligible authored fallback.
- Case Brief feedback must use pinned evidence, distinguish dependency from independently countable source lineages, and pass cross-field coherence checks. Strong corroboration requires at least two independent lineages among evidence actually linked to the student's claims; unrelated pinned records do not count.
- A model may interpret student language, select authored dialogue units, and recommend formative rubric results. It may not invent facts, add requirements, mutate state, or affect repair eligibility. Repair authority is deterministic and model-independent.
- Teacher uploads are untrusted class material. They may align terminology and objectives but never establish historical truth or alter the solution.
- Preserve full-case completion when the model is unavailable. Fallback behavior must be honest about reduced capability.
- Moderate student text before generation when a provider key is configured. Enforce schema bounds, route rate limits, request cancellation, one explicit transient retry, and `store: false` on model responses. Provider or validation failures must preserve student work and deterministic status.
- Any future roster, graded assignment, or cross-device report requires authenticated server-side event storage and is outside the MVP authority model.
- Do not log raw student text or uploaded documents by default. Define and test redaction, temporary-file deletion, and retention before enabling uploads.

## Engineering Practice

- Use TypeScript strict mode and Zod at external and model boundaries.
- Write a failing test before feature or bug-fix implementation.
- Keep the case engine pure and deterministic; isolate OpenAI access behind an injectable gateway.
- Version case packages, schemas, prompts, and persisted state.
- Reject stale or duplicate state-changing responses.
- Keep modules focused and avoid framework or infrastructure additions without a concrete requirement.
- Preserve accessibility: keyboard operation, semantic labels, color-independent state, reduced motion, and text that fits at supported viewports.
- Keep all reading, comparison, dialogue captions, caseboard work, and assessment in accessible React DOM overlays. Do not make difficult-to-read 3D text the only path.
- Target ordinary school laptops and Chromebooks. The archive graybox must pass the plan's asset, loading, nonblank-canvas, and frame-rate gate before district expansion.
- Do not commit or push unless the user explicitly asks.
- Keep `.Codex/` ignored and do not add generated scratch plans to version control.

## Parallel Agent Protocol

The coordinating agent assigns each worker a disjoint write set and a concrete acceptance check. Workers must:

1. State the intent and owned files before editing.
2. Read this guide and the controlling documents for their slice.
3. Assume other agents are editing nearby files; never revert or overwrite their work.
4. Avoid edits outside the assigned write set. Report a needed cross-boundary change instead.
5. Run the narrowest relevant tests and report exact commands and outcomes.
6. List changed files, unresolved risks, and any assumption that needs coordinator approval.
7. Update `docs/BUILD_LOG.md` only when explicitly assigned; otherwise provide the coordinator with the facts needed for the log.
8. Never commit, push, deploy, purchase assets, or modify ignored planning artifacts unless the coordinator explicitly assigns that action.

Suggested implementation ownership after Phase 0:

| Workstream | Primary ownership |
|---|---|
| Case engine | `lib/case-engine/`, case-engine unit tests |
| Historical content | `data/cases/varennes/`, historical-integrity tests |
| AI contracts | `lib/openai/`, `schemas/ai-contracts.ts`, `schemas/model-policy.ts`, `data/cases/varennes/model-policy.json`, model evals |
| 3D runtime | `components/world/`, `app/play/world/`, world integration tests |
| World contracts | `schemas/world-manifest.ts`, `schemas/spatial-session.ts`, `lib/world/`, `data/cases/varennes/world/`, world integrity tests |
| Investigation UI | investigation routes and `components/characters/`, `components/evidence/` |
| Caseboard and repair | `components/caseboard/`, `components/repair/` |
| Teacher alignment | teacher routes and `lib/course-alignment/` |
| Accessibility and E2E | accessibility components and end-to-end tests |

Do not launch overlapping workers on shared contracts until the coordinating agent freezes the interface and assigns one owner.

## Completion Standard

Before claiming a slice complete, verify the real user flow, not only compilation or isolated tests. Report what was exercised, what passed, what remains untested, and whether the result still satisfies the project intent at the top of this file.
