# Build Log

## Purpose

This file documents genuine Codex collaboration for the Build Week submission.

Each entry should distinguish:

- what Codex proposed
- what Codex implemented
- what the user decided
- what the user rejected or changed
- why important decisions were made
- relevant tests or commits
- new risks
- next checkpoint

Do not rewrite the log at the end to make the process cleaner than it was.

## 2026-07-14 / Planning Conversation Imported

### What Codex proposed

- Pressure-tested the original concept as a causal-reasoning mystery rather than a generic AI historical chatbot.
- Identified that the strongest differentiator is evidence changing the world and assessment.
- Warned against a broad "why did the French Revolution happen" scenario.
- Proposed three MVP mysteries:
  - Flight to Varennes
  - October Days / Women's March on Versailles
  - Cuban Missile Crisis communication channel
- Recommended Flight to Varennes as the best balance of game feel, historical defensibility, visual demo potential, and French Revolution fit.

### What the user decided

- Use **The Road That Should Have Closed**, centered on the Flight to Varennes.
- Use a **bounded temporal fracture**, not a fully simulated alternate history and not a purely archival corruption.
- Use **act-based open investigation**: authored opening and ending, nonlinear investigation in the middle.
- Use **bounded teacher-packet alignment**: teacher materials affect vocabulary, hints, objectives, and reporting but do not rewrite facts or solution.
- Use a **mix of open AI evaluation and deterministic guardrails** for hypothesis assessment.
- Make the game self-contained for students who do not already know Varennes.

### What the user rejected or changed

- Rejected fully open sandbox investigation.
- Rejected upload-driven mystery generation.
- Rejected one exact canonical causal-chain answer.
- Corrected the corruption decision from timeline-only Option A to bounded fracture Option C.
- Asked that planning continue without holding back solely because implementation might be hard.

### Why decisions mattered

- Bounded fracture preserves the game fantasy while avoiding unsupported alternate-history claims.
- Act-based openness allows player agency without losing pacing or testability.
- Teacher-packet alignment improves classroom adoption without making uploaded materials historical ground truth.
- Hybrid assessment gives GPT-5.6 a meaningful role while deterministic logic protects facts and fairness.
- Self-contained context prevents the game from being unfair to students who have not memorized the French Revolution.

### New risks discovered

- Drouet could accidentally become a lone hero who "saved the Revolution."
- Sauce and Barnave need stronger source support before becoming open AI characters.
- Exact route timing, bridge geography, escort details, and press excerpts require verification.
- Teacher packet upload could look like generic "chat with PDF" if not tied to game mechanics.
- Free-form assessment could become inconsistent without hard gates and eval tests.

### Next checkpoint

Phase 0: historical verification and wireframe approval.

## 2026-07-14 / Planning Bundle Materialized

### What Codex proposed

- Create the planning bundle directly in the current workspace because prior sandbox links were not visible to the user.
- Keep the documents as planning artifacts only.
- Add `.gitignore` with `.Codex/` ignored before later project work.

### What Codex implemented

- Created:
  - `README.md`
  - `CODEX_MASTER_BRIEF.md`
  - `docs/PRODUCT_SPEC.md`
  - `docs/CASE_CANON.md`
  - `docs/CONTEXT_AND_CURRICULUM_CANON.md`
  - `docs/ANSWERABILITY_MATRIX.md`
  - `docs/HISTORICAL_SOURCES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/AI_CONTRACTS.md`
  - `docs/IMPLEMENTATION_ROADMAP.md`
  - `docs/DEMO_SCRIPT.md`
  - `docs/BUILD_LOG.md`
  - `.gitignore`

### What the user decided

- The user asked for the bundle to be created directly in the current project repository and explicitly requested no commit.

### What was not done

- No application code was written.
- No commit was made.
- No historical source verification was performed yet.

### New risks discovered

- The current workspace did not appear to be a Git repository when checked. Future work should confirm whether this folder should be initialized as the repo or moved into an existing project repository.

### Next checkpoint

Run Phase 0 using `CODEX_MASTER_BRIEF.md` as the controlling instruction.

## 2026-07-14 / Repository And Guardrails Established

### What Codex proposed

- Move the planning bundle into the empty `CadenMinami/History-Unbroken` repository without committing.
- Test a reusable historical-integrity workflow against deadline pressure before relying on it.
- Put reusable historical review behavior in a global skill and project-specific coordination rules in `AGENTS.md`.
- Replace the answer-revealing fictional route item with three equally labeled anomaly candidates.

### What Codex implemented

- Cloned the empty GitHub repository to `/Users/caden/Documents/Codex/History-Unbroken`.
- Migrated the planning bundle as uncommitted working-tree files.
- Created and validated the global `historical-integrity` skill.
- Added root `AGENTS.md` with historical, AI-authority, engineering, and parallel-agent rules.
- Updated the product, case canon, answerability matrix, and demo plan for layered mystery Option C.
- Corrected the future-dated planning entry from July 15 to July 14.

### What the user decided

- Use layered mystery Option C: reveal the fracture window but require the player to identify the active link.
- Create a historical-integrity skill.
- Establish strong instructions for future parallel coding agents.
- Use `CadenMinami/History-Unbroken` as the project repository.

### What the user rejected or changed

- Rejected an evidence inventory that names the corrupted route item and therefore reveals the solution.

### Why the decision mattered

- Multiple anomaly candidates preserve deduction while keeping all fictional artifacts visibly labeled.
- Skill baseline testing showed that a coding agent under deadline pressure may encode plausible route and bridge details before the source ledger authorizes them.
- Repository-level agent rules prevent independent workers from hardening unresolved claims or overwriting each other's work.

### What was not done

- No application code was written.
- No commit or push was made.

## 2026-07-14 / Historical Gate Reconciliation

### What Codex proposed

- Audit travel-preparation evidence, source excerpts, novice context, condition authority, and anomaly answerability as independent workstreams.
- Separate historical authority from authored alternate-branch state so neither is asked to prove what it cannot establish.

### What Codex implemented

- Added source-lineage groups and a text-only excerpt/reuse policy.
- Added independent bodyguard, Fersen, passport, and novice-context source entries with atomic fact IDs and bounded claims.
- Corrected the Cordeliers petition chronology by separating the 21 June and 14 July petitions.
- Replaced broad voluntariness claims with the narrower supported conclusion that Louis knowingly and intentionally participated while his complete motives and political constraints remain open.
- Restricted deterministic broader conditions to an approved whitelist and removed deferred claims from scoring.
- Added FO1-FO3 as proposed fixed fictional branch observations, clearly separated from historical evidence and generated dialogue.
- Updated the case canon, answerability matrix, repair-gate traceability, architecture, design system, wireframes, demo script, and deterministic implementation plan.

### Independent review

- Separate historical audits examined E2 independence, student excerpts, novice context, municipal authority, and anomaly answerability.
- A second historical re-review found and then confirmed correction of condition-precedence, authority-label, and voluntariness conflicts.
- Final historical re-review result: `APPROVED`.
- Final implementation-plan re-review result: `APPROVED`.

### Important source and product boundaries

- E1 and E2 may support knowing and intentional participation but not every private motive or unconstrained voluntariness.
- Drouet's account remains attributed participant testimony; derivative reproductions do not create independent corroboration.
- Valory is optional corroboration and cannot control scoring until its remaining editorial validation is complete.
- FO records may identify the fictional branch mechanism but never count toward historical evidence or the three-line corroboration rule.
- Scan images are excluded by default unless item-level reuse rights are clear.

### What remains before application code

- The user must approve FO1-FO3 as the fixed branch-observation design.
- After that decision, reconcile the three FO-dependent statuses in `docs/REPAIR_GATE_TRACEABILITY.md` and record final Phase 0 approval.

### What was not done

- No application code was written.
- No commit or push was made.

## 2026-07-14 / Phase 0 Approved For Implementation

### What the user decided

- Approved FO1, FO2, and FO3 as fixed fictional branch observations.
- Authorized work to begin on the next implementation steps.

### What Codex implemented

- Changed the three FO-dependent repair gates from `BLOCKS_CANON` to `APPROVED`.
- Updated the repository agent gate and wireframe status to permit deterministic vertical-slice implementation.
- Preserved the rule that FO records may identify the authored alternate-branch mechanism but never count as historical evidence.

### Why the decision mattered

- Historical records establish the restored sequence, while fixed branch observations establish what happened in the fictional fracture.
- The student can now determine which anomaly is active without asking historical sources to prove an alternate event or allowing generated dialogue to reveal the answer.

### Next checkpoint

- Freeze shared TypeScript contracts, scaffold the tested application, and build the deterministic vertical slice without model calls.

### What was not done

- No commit or push was made.
- Claims still marked partial or deferred remain outside production scoring and repair gates.

### Next checkpoint

Resolve repair authority, complete claim-level historical verification, and approve critical wireframes before application implementation.

## 2026-07-14 / Phase 0 Parallel Source Audit

### What Codex proposed

- Split source verification into four independent workstreams: Louis's declaration, Drouet and the route, Varennes civic action, and political reaction/Barnave.
- Apply the new historical-integrity skill to each workstream.

### What Codex implemented

- Added atomic fact IDs, bibliographic records, source locators, permitted uses, and limitations to `docs/HISTORICAL_SOURCES.md`.
- Replaced the over-specific "returning postilions sent Drouet toward Metz" mechanism. Drouet's Assembly report says he first followed the announced Verdun road, then learned near Clermont that the carriage had taken the Varennes road; it does not identify the informant.
- Changed the causal and repair model so bridge obstruction constrains onward passage rather than physically arresting the carriage.
- Separated local mobilization, armed halt, passport inspection, and guarded collective detention.
- Replaced open Sauce roleplay with a static Varennes civic-response station for the MVP.
- Bounded Louis's declaration to his stated rationale and intentional participation; it does not prove every private motive.
- Reframed political reaction as a multi-voice dossier rather than universal immediate loss of trust.
- Established a source-bounded 15 July 1791 Barnave role as historically possible, with a later product-value decision still required.

### What changed from the earlier plan

- Exact minute-by-minute route timing is no longer part of the planned mechanic.
- The bridge is not a literal carriage-stop animation.
- Exact bridge actor attribution remains contested between Drouet and municipal evidence.
- Teacher-facing or student-facing claims cannot say the Assembly's kidnapping language proves an actual abduction or a coordinated lie.

### Why the changes mattered

- The prior route and bridge details were derived from simplified narratives and would have become deterministic win conditions.
- Independent municipal and royal-party evidence supports collective detention while preserving disagreement about individual credit.
- A multi-voice reaction packet better teaches source perspective and avoids claiming that all of France changed opinion at once.

### What remains unresolved

- Final reviewed English translations and excerpt permissions.
- Original archival locator for Valory's deposition.
- Period or critically edited Varennes layout before exact map coordinates.
- Independent travel-preparation evidence for the intentional-departure hard gate.
- Whether Barnave earns enough gameplay value to remain an AI character within the target runtime.
- Repair authority between deterministic selections and GPT-5.6 rubric output.

### What was not done

- No application code was written.
- No commit or push was made.

### Next checkpoint

Resolve repair authority, complete the remaining source gaps, and produce critical-screen wireframes.

## 2026-07-14 / Deterministic Repair Authority Locked

### What Codex proposed

- Make validated caseboard and evidence actions the only authority for timeline repair.
- Keep GPT-5.6 responsible for prose interpretation, formative rubric feedback, revision prompts, and report narration without allowing a model score to block progression.

### What the user decided

- Selected Option A: deterministic unlock with AI feedback only.

### What Codex implemented

- Removed the 14/20 model-score threshold, category minimums, and borderline second-pass adjudication from the specification.
- Updated product, architecture, AI contracts, roadmap, master brief, and agent rules so model output cannot unlock, block, delay, or revoke repair.
- Preserved the five-part AI-assisted rubric as formative feedback requiring teacher review before grading use.

### Why the decision mattered

- Equivalent historical reasoning cannot receive different win states because of model variation.
- The complete case remains playable during API failure.
- GPT-5.6 remains consequential through adaptive dialogue, argument analysis, revision feedback, curricular alignment, and reporting without becoming the historical judge.

### What was not done

- No application code was written.
- No commit or push was made.

### Next checkpoint

Approve the critical interaction wireframes and begin the deterministic vertical slice.

## 2026-07-14 / Visual Direction Locked

### What Codex proposed

- Use an archival control-room aesthetic with the route and evidence as the visual center.
- Express temporal corruption through archival registration errors and broken chronology rather than neon science-fiction effects.

### What the user decided

- Approved and locked the archival control-room direction.

### What Codex implemented

- Added `docs/DESIGN_SYSTEM.md` with palette, typography, provenance, layout, responsive, motion, asset, and accessibility rules.
- Added `docs/WIREFRAMES.md` covering the primer, fracture, investigation hub, character interview, comparison workspace, causal board, Case Brief, repair, reconstruction, and debrief.
- Kept the route map central and conversation subordinate to evidence mechanics.
- Drafted the deterministic vertical-slice implementation plan under the ignored `.Codex/plans/` directory.

### Why the decision mattered

- The interface should read immediately as historical investigation, not a generic chatbot or conventional dashboard.
- Equal visual treatment for the three fictional anomalies protects the mystery.
- A stable shell and explicit responsive behavior reduce implementation conflict across parallel agents.

### What was not done

- No application code was written.
- No commit or push was made.

### Next checkpoint

Review the interactive wireframe and implementation-plan artifacts, then begin application scaffolding after approval.

## 2026-07-14 / Phase 0 Plan Independently Reviewed

### What Codex proposed

- Freeze the deterministic interaction contracts before dividing implementation among parallel agents.
- Map every repair requirement to approved facts, evidence, visible controls, state transitions, and tests.
- Treat anonymous browser persistence as formative local state rather than a tamper-resistant grading record.

### What Codex implemented

- Added `docs/REPAIR_GATE_TRACEABILITY.md` and linked it from the repository index.
- Updated `AGENTS.md` and `docs/ARCHITECTURE.md` to distinguish repository canon, the shared pure reducer, local session persistence, and server-owned model calls.
- Hardened the vertical-slice plan with explicit source-approval gates, separate provenance dimensions, synthetic-only unresolved fixtures, deterministic Drouet and civic-response stations, refresh/resume coverage, and timed novice playtests.
- Updated the interactive HTML plan to match the reviewed Markdown plan.

### Independent review

- A separate Codex reviewer examined the full corrected plan against `AGENTS.md` and the controlling documents.
- The reviewer returned `APPROVED` with no remaining blocking issues.

### Why the changes mattered

- Parallel workers now have a stable authority boundary and disjoint implementation contracts.
- An unresolved historical claim cannot silently become a production repair gate.
- Local persistence is adequate for the anonymous hackathon experience without being misrepresented as secure classroom-grade storage.

### What remains before application code

- Close every `BLOCKS_CANON` source dependency listed in `docs/REPAIR_GATE_TRACEABILITY.md`.
- Approve final student-facing excerpts, translations, source lineages, and contextual condition IDs.
- Obtain explicit user approval of the complete Phase 0 interaction package.

### What was not done

- No application code was written.
- No commit or push was made.

## 2026-07-14 / Deterministic Vertical Slice Foundation

### What Codex proposed

- Establish the complete test harness before feature implementation.
- Encode the approved Varennes canon as a versioned, schema-validated package rather than duplicating historical logic in components.
- Make every learner action a typed command handled by one pure reducer with deterministic repair eligibility and versioned local recovery.

### What Codex implemented

- Scaffolded a strict Next.js, TypeScript, Tailwind, Vitest, Testing Library, and Playwright application.
- Added the six reviewed historical evidence items, three equal anomaly candidates, FO1-FO3, approved conditions, causal nodes and edges, comparison findings, uncertainty boundaries, and repair gates as validated repository data.
- Added referential-integrity checks for sources, facts, evidence lineages, comparison items, causal references, consequence nodes, and uncertainty IDs.
- Added a pure case reducer with revision checks, idempotent command IDs, phase authority, historical-evidence pinning, authored comparison results, causal-board actions, and repair completion.
- Added deterministic eligibility checks that ignore free-form prose and never count fictional branch observations as historical corroboration.
- Added versioned local persistence with invalid-state recovery and a shared browser session provider.
- Added production-build and real-browser smoke verification; the local development watcher remains constrained by this sandbox's file-descriptor behavior, while the production server path works.

### What the user decided

- Approved FO1-FO3 and authorized the deterministic implementation phase.
- Preserved Option A repair authority: explicit validated actions control progression; future AI feedback is formative only.

### Why the decisions mattered

- Historical authority is now inspectable in one package and one reducer instead of being distributed across UI labels, model prompts, or prose parsing.
- The complete learning loop can remain available if every model endpoint fails.
- Parallel UI agents can build against frozen commands and IDs without receiving authority to alter canon.

### Verification

- Unit, schema, historical-integrity, session-provider, and shell tests pass.
- TypeScript strict checking and ESLint pass.
- A production Next.js build and Playwright Chromium smoke path passed before feature-screen work began.

### What was not done

- No GPT-5.6 call, course-packet ingestion, or generated dialogue was added.
- No commit or push was made.

### Next checkpoint

- Complete and independently review the novice primer and bounded fracture opening, then implement source comparison against the frozen engine contract.

## 2026-07-14 / Case Authority And Engine Freeze Review

### What Codex proposed

- Treat the first passing package as a review candidate, not an automatic freeze.
- Run independent historical-integrity and engineering reviews before allowing parallel UI work to depend on the contract.

### What independent reviewers found

- Historical evidence initially trusted its own eligibility flag too broadly.
- Source, fact, evidence, condition, causal-node, and causal-edge verification did not yet close over one another.
- Repair requirements appeared in more than one representation without an explicit sole authority.
- Source dependencies and independently countable corroboration lineages were conflated.
- Comparison effects could be inconsistent or unreachable through reducer commands.
- A broad political-crisis inference had been promoted into a deterministic consequence and uncertainty gate.
- The Assembly proclamation and September Constitution were aggregated under one structured citation.
- Local persistence initially validated known IDs without proving the state could have been produced by the reducer.

### What Codex implemented

- Restricted historical evidence to compatible historical-record, source-claim, and reconstruction metadata.
- Rejected fiction, dramatization, class material, unresolved sources, and unresolved facts from every machine authority path.
- Made `solution` the sole runtime repair authority and marked `repairGates` as `traceability_only`.
- Added unique-ID, comparison coverage, branch-plus-history, feasibility, and source-lineage closure checks.
- Split dependency lineages from independently countable historical lineages.
- Added atomic citation URLs and limitation notes to structured sources, including separate proclamation and Constitution records.
- Replaced the political-crisis gate with observable competing framings and institutional continuity; broader trust and crisis arguments remain formative interpretations.
- Replaced causal uncertainty wording with fact-linked `claim_limit` records describing what the evidence does not establish.
- Added a separate `caseVersion` and rejected stale content state.
- Added reducer-reachability checks for phase history, command minima, duplicate state, comparison prerequisites, evidence inspection, anomaly decisions, causal endpoints, and repair/debrief status.
- Added a full reducer-produced primer-to-debrief persistence test.

### Review outcome

- Historical-integrity reviewer: `FREEZE`.
- Focused engineering persistence reviewer: `FREEZE`.
- The contract passed 50 tests before the final persistence additions; the final suite is rerun at every subsequent checkpoint.

### Why the changes mattered

- A plausible sentence can no longer become a scored historical fact merely because it appears in JSON.
- Every deterministic outcome is both source-authorized and reachable through visible learner actions.
- Saved local state is still explicitly formative and not tamper-resistant, but ordinary corruption or stale content cannot bypass the reducer's learning sequence.

### What was not done

- No model output was given historical or progression authority.
- No commit or push was made.

### Next checkpoint

- Complete the primer and fracture opening against the frozen package, then begin the nonlinear investigation and comparison workspace.

## 2026-07-14 / Primer, Fracture, And Investigation Checkpoint

### What Codex proposed

- Make the novice path self-contained without revealing which anomaly is active.
- Present all three fictional anomaly candidates at equal weight and require explicit comparison before accepting or rejecting any candidate.
- Keep the visual center on historical evidence and visible learner actions rather than generated conversation.

### What Codex implemented

- Added a six-step, reduced-reading-compatible context primer with authored glossary support and a bounded fracture opening.
- Added structurally paired context interpretations so the mistrust framing cannot appear without the counterbalancing evidence of continued support for monarchy.
- Added the reviewed Saint-Cloud source and separated orientation-only interpretation from deterministic case conditions.
- Added a responsive investigation workspace containing the historical archive, equal anomaly candidates, fixed fictional branch observations, evidence comparison, anomaly decisions, evidence pinning, and phase-safe session hydration.
- Added keyboard focus management between primer steps and responsive layouts verified at 320px and 780px browser widths.
- Added regression coverage for provenance, branch-fiction evidence exclusion, comparison prerequisites, anomaly authority, unpinning, hydration, interpretation pairing, and viewport overflow.

### What independent reviewers found

- The first fracture draft made the route anomaly too visually diagnostic.
- Some novice context wording did not retain enough historical specificity in reduced-reading mode.
- Primer card transitions did not announce their new heading to keyboard and screen-reader users.
- The two-column primer overflowed at a narrow tablet width.
- Paired historical interpretations were documented in prose but not originally enforced by the schema.

### What Codex changed

- Removed the diagnostic route-specific branch clue from the fracture opening and loaded its historical side from the case package.
- Required all retained historical terms in both reading modes and made the 18 April Saint-Cloud event explicit.
- Focused each new primer heading after progression.
- Stacked the primer layout before its grid became unsafe.
- Added package-level `requiredInterpretationGroups` validation and a negative test for one-sided framing.

### Review outcome

- Primer specification reviewer: `SPEC APPROVED`.
- Primer historical-integrity reviewer: `HISTORICAL APPROVED`.
- Primer implementation reviewer: `QUALITY APPROVED`.
- Investigation specification reviewer: approved.
- Investigation implementation reviewer: approved.

### Why the decisions mattered

- A novice can acquire every prerequisite inside the experience without being handed the solution.
- Fictional branch observations remain useful for diagnosing the fracture but cannot masquerade as historical corroboration.
- The historical interpretation boundary is machine-enforced rather than dependent on careful prose alone.
- The first playable screens now preserve deterministic authority across keyboard, mobile, tablet, refresh, and nonlinear investigation order.

### Verification

- Focused primer tests: 10 passed.
- Primer tablet Playwright path at 780px: passed with no horizontal overflow.
- Investigation mobile Playwright path at 320px: passed with no horizontal overflow.
- The full suite is rerun after the next integrated slice.

### What was not done

- No model-generated dialogue or assessment was added.
- No commit or push was made.

### Next checkpoint

- Implement the causal caseboard and open-form Case Brief using only package-backed conditions, nodes, edges, consequences, uncertainties, and repair requirements.

## 2026-07-15 / Deterministic Evidence-To-Repair Vertical Slice

### What Codex proposed

- Require every anomaly decision before the investigation can enter synthesis.
- Build causal links through explicit cause, relationship, and effect controls rather than revealing the authored graph.
- Treat the student's prose as a recorded formative artifact; deterministic evidence and caseboard actions alone control repair eligibility.
- End the counterfactual branch at an explicit unknown boundary and reconstruct only source-authorized history.

### What Codex implemented

- Added the causal caseboard, required evidence progress, broader-condition selection, unordered node bank, supported-link tester, bounded consequence choice, uncertainty acknowledgements, and Case Brief submission.
- Added reducer and persistence guards that reject malformed phase advances and invalidate a submitted brief after any repair-relevant board change.
- Added a versioned reconstruction companion, six-step source-linked repair, reduced-motion completion path, and learning summary.
- Added a complete Playwright flow that starts from an empty browser session and performs every student action from context primer through persisted debrief state.
- Added explicit accessible names to the causal relationship controls after the full-flow test exposed ambiguous implicit labels.

### Historical review and corrections

- Replaced an over-specific local-action chain with the approved fork: local mobilization enables blocked onward passage and passport inspection as parallel actions; only passport inspection leads to guarded detention in the deterministic graph.
- Removed `armed halt` as a scored node. The source ledger retains it only as contextual language pending stronger archival verification.
- Corrected the repair text so it says Drouet `was informed` near Clermont; the primary report does not identify the informant, so the student-facing reconstruction does not name returning postilions.
- Required every debrief synthesis item to carry atomic fact IDs, an explicit `historical_reconstruction` classification, source IDs, evidence IDs, and limitations.
- Replaced historical-necessity language with observed-sequence language and limited necessity claims to the explicitly fictional fracture model.
- Restored the `UNKNOWN` counterfactual boundary in the final debrief and distinguished validated caseboard actions from recorded, non-AI-adjudicated prose.
- Added directional validation so a repair step cannot cite an authored edge that does not terminate at the step's restored node.

### Independent review

- Caseboard specification and historical review: `SPEC/HISTORICAL APPROVED`.
- Caseboard implementation review: `QUALITY APPROVED`.
- Repair and debrief historical review initially blocked the over-specific informant, synthesis provenance, necessity language, and missing final counterfactual boundary.
- After correction and targeted tests, repair and debrief historical review returned `SPEC/HISTORICAL APPROVED`.
- Repair and debrief implementation review initially found visual-only repair progress, a reduced-motion path that skipped source-linked content, and citation validation that checked ID existence without proving support relationships.
- Codex moved the six-step progression into typed reducer state, blocked premature completion, added ordered-prefix persistence validation, made reduced motion information-equivalent, and enforced fact-evidence-source closure.
- After correction and focused regression tests, repair and debrief implementation review returned `QUALITY APPROVED`.

### Verification at this checkpoint

- Focused reconstruction, repair-state, persistence, and debrief tests: 29 passed before the final integrated run.
- Focused caseboard integration tests: 7 passed.
- Full empty-session Playwright journey: passed in Chromium and ended with `phase: debrief` and `repairCompleted: true` in persisted state.
- Full Vitest suite: 95 tests passed.
- TypeScript strict checking and ESLint passed.
- Optimized Next.js production build completed for all seven application routes.
- Full Playwright suite: 6 Chromium tests passed, including 320px repair/debrief and the complete empty-session journey.
- Direct visual review covered 1440px desktop and 320px mobile views for the primer, investigation, repair, reduced-motion reconstruction, and debrief without incoherent overlap or horizontal overflow.
- Lighthouse snapshot audits returned 100 for accessibility, best practices, SEO, and agentic browsing on both mobile and desktop after correcting one dark-footer contrast token.

### What was not done

- No GPT-5.6 call, generated character dialogue, teacher-packet ingestion, or AI-authored report was added.
- No commit or push was made.

### Next checkpoint

- Begin server-owned GPT-5.6 integration for bounded character dialogue and formative reasoning feedback without changing deterministic historical or progression authority.

## 2026-07-15 / GPT-5.6 Source-Bounded Layer And Integrity Review

### What Codex proposed

- Add meaningful GPT-5.6 interaction without giving the model historical, evidentiary, state, or repair authority.
- Let the model interpret student language by selecting repository-authored response and feedback units rather than generating visible historical prose.
- Keep the complete investigation and repair path available without an API key.
- Split implementation and review across disjoint agent-owned files, then reconcile the result against the historical-integrity rules.

### What the user decided

- Approved continuing with the bounded AI layer and parallel-agent workflow.
- Approved the current case and deterministic-authority boundaries before implementation.
- Did not authorize a commit, push, or deployment.

### What Codex implemented

- Added versioned, strict character-turn and Case Brief feedback contracts.
- Added generated stations for Drouet and Louis only; kept the Varennes civic and Assembly reaction stations static.
- Limited Louis to E1 and S1. E2, S8, and S9 remain deterministic archive records and cannot enter Louis's generated context.
- Added ID-only model plans. GPT-5.6 selects authored claim, reaction, follow-up, refusal, summary, issue, rubric-reason, and revision IDs; the server renders visible prose.
- Added post-generation authorization for station allowlists, exact student spans, pinned evidence, evidence prerequisites, source lineage, rubric-template fit, and cross-field feedback coherence.
- Added provenance, source type, dependency lineage, independent historical lineage, verification, and limitation context to Case Brief feedback.
- Added moderation with `omni-moderation-latest`, authored no-fact safety refusals, schema input bounds, process-local route rate limiting, abort propagation, one explicit transient retry, SDK retry disabling, timeout handling, and honest deterministic fallbacks.
- Added browser controls that invalidate stale responses when the question, evidence, station, or case revision changes.
- Added a source-bounded model-policy eval corpus and historical-integrity tests for station source closure and fictional/historical separation.

### Independent review findings

- Evidence-reaction units initially lacked the same presented-evidence authorization enforced for claim units, allowing an authored fallback to leak a reaction without its record.
- The first E3 reaction reached beyond E3's fact/source closure.
- Louis's initial policy let the generated station appraise E2 preparation evidence that should remain a deterministic dossier.
- Early Case Brief feedback lacked sufficient provenance and lineage context and could overrate corroboration from one source lineage.
- Cross-field feedback states needed deterministic coherence checks.
- Input moderation, request bounds, effective retry counts, provider cancellation, stale draft handling, and route-level rate limiting needed explicit implementation and tests.

### Corrections made after review

- Applied `requiresPresentedEvidenceIds` checks to both claims and evidence reactions, including fallback selection.
- Restricted the E3 Drouet reaction to F-S2-002/S2 and added tests that every reaction stays inside the presented evidence's fact/source closure.
- Restricted Louis to E1/S1 and removed E2/S8/S9 from his policy and UI evidence options.
- Added independent-lineage-aware corroboration checks, pinned-evidence-only concerns, exact-span checks, and contradictory-status/`well_supported` coherence rules.
- Required non-empty audible character plans and validated final response envelopes.
- Added moderation, bounds, cancellation, retry, provider-error, rate-limit, and stale-response controls with targeted tests.

### Authority and product result

- Generated dialogue remains dramatization and has an empty recordable-claim allowlist.
- Model feedback is formative only and cannot unlock, block, delay, or revoke repair.
- The browser reducer and case-package `solution` remain the only runtime progression authority.
- The no-key path remains a complete and honestly labeled product path.

### Verification boundary

- Unit, integration, historical-integrity, model-policy eval, build, and browser checks cover the source-bounded contracts and no-key behavior.
- A live `OPENAI_API_KEY` smoke test has not yet been completed, so provider-level GPT-5.6 and moderation behavior is not claimed as verified.

### What was not done

- No teacher-packet ingestion or packet-aware report was added.
- No Barnave or Sauce generated roleplay was added.
- No commit, push, or deployment was made.

### Final historical-integrity re-review

- The re-review found that unrelated pinned records could still inflate a strong corroboration score, that incomplete or contradicted formative statuses could carry rubric scores denying the named weakness, and that one Louis E1 reaction phrased his public declaration too much like independent proof.
- Codex changed corroboration to count only independent lineages from non-`unclear` evidence-to-claim links, added status-specific score coherence rules, and rewrote Louis's reaction as his public description rather than independent proof of voluntariness.
- Focused regression tests passed after the changes. The historical-integrity reviewer returned `APPROVED` with no remaining `BLOCKS_CANON` issue in the GPT-5.6 layer.
- `CASE_CANON.md` and `PRODUCT_SPEC.md` were reconciled with the runtime policy: Barnave is excluded, Louis is E1/S1-only, and the Assembly content remains a static dossier.

## 2026-07-15 / Diegetic 3D Investigation Pivot

### What the user requested

- Reframe the investigation so the student controls a character and moves through a world with a grounded, cinematic feel inspired by Red Dead Redemption.
- Preserve the existing project rather than replace it with an unrelated action game.
- Gather clarifying decisions first, then produce an implementation plan before changing production code.

### What Codex proposed

- Treat the reference as a presentation and embodiment target, not an open-world scope target.
- Build a compact browser-based third-person temporal reconstruction using the existing Next.js and deterministic case engine.
- Keep exploration, character encounters, evidence discovery, and the final pursuit in 3D.
- Open reading-heavy educational work as focused React DOM overlays from physical objects inside the world.
- Use staged transcription, the existing authorized GPT-5.6 character-turn service, and text-to-speech so the spoken audio always matches the authorized caption.

### What the user decided

- Browser-only delivery.
- A fixed unnamed, period-dressed timeline investigator.
- A temporal reconstruction rather than a claim that every station coexisted literally.
- Grounded stylized realism.
- Short required travel for first discovery, followed by journal fast travel.
- One guided playable pursuit without combat or an open riding system.
- Cinematic NPC conversations with typed and optional push-to-talk input, voiced replies, and captions.
- Ordinary school laptops and Chromebooks as the primary hardware target.
- A diegetic hybrid: one continuous 3D fiction with readable focus overlays opened from physical world objects.
- A 10-20 minute session target.
- Dynamic source-bounded Drouet and Louis stations, static civic and Assembly stations, and scripted ambient residents.
- Four compact connected zones.
- Clear modern English voices without performed accent stereotypes.
- Teacher-packet alignment after the first complete 3D vertical slice.
- A mixed licensed, modified, custom, and generated asset pipeline, with approval required before paid assets.
- One fixed investigator appearance, a medium-distance third-person camera, late-evening lighting, subtle navigation guidance, and a guided route pursuit.
- React Three Fiber inside the existing Next.js application.

### What was rejected

- A Red Dead-scale open world, combat, stealth, survival, unrestricted horse riding, and alternate-France simulation.
- Photorealism as the production target.
- A downloadable desktop-only game.
- Full avatar customization.
- Four unconstrained historical chatbots.
- Rendering documents and assessment as difficult-to-read 3D text.
- A parallel Unity WebGL runtime and JavaScript-to-C# state bridge.
- Babylon.js as a second engine loop requiring a custom React state adapter.
- Unconstrained speech-to-speech character output.

### Why the decision matters

- The 3D world strengthens presence and game feel without giving spatial presentation authority over evidence, history, scoring, or repair.
- Focused DOM overlays preserve the project's accessibility, source metadata, and evidence-comparison quality.
- The React Three Fiber path retains one application, one case reducer, one AI authorization boundary, and one deployment.
- The voice pipeline keeps generated speech downstream of the existing historical authorization controls.
- The graybox performance gate prevents asset production from outrunning browser feasibility on classroom hardware.

### Artifacts created

- Added `docs/superpowers/specs/2026-07-15-diegetic-3d-investigation-design.md` as the controlling design specification for the proposed pivot.
- Added temporary interactive brainstorming comparisons under ignored `.superpowers/` state.
- Installed the official OpenAI developer-docs MCP server configuration for future Codex sessions; this session used official web documentation because a restart is required before the new MCP tools are exposed.

### What was not done

- No production 3D dependency, route, scene, asset, or voice endpoint was added.
- No existing game route was replaced.
- No commit, push, deployment, or paid asset purchase was made.

### Next checkpoint

- Complete independent specification review.
- Produce the repository implementation plan and interactive plan rendering.
- Obtain explicit approval of the written plan before beginning the graybox technical spike.

### Independent specification review result

- The first review identified five major gaps: informal voice-transform contracts, an oversimplified detention sequence, spatial placement that could imply unsupported history, a non-spatial route offered only after failure, and subjective performance targets.
- Codex added versioned transcription and signed-speech contracts, correlation and cleanup requirements, manifest provenance and placement limitations, a directly selectable equivalent non-spatial route, screen-reader equivalence testing, and measurable physical/proxy hardware budgets.
- The second review found two remaining sentences that made passport inspection alone lead to detention. Codex corrected both so blocked onward passage and passport inspection operate in parallel and jointly enable guarded collective detention.
- The independent reviewer returned `APPROVED` after the full corrected specification was rechecked.
- The approved specification is now the controlling design input for the implementation plan. Production implementation still has not begun.

## 2026-07-15 / Diegetic 3D Implementation Plan

### What Codex proposed

- Execute the 3D pivot as 18 test-driven tasks with a hard graybox vertical-slice gate before district expansion.
- Keep the current non-spatial case complete and directly selectable.
- Use the existing reducer as the only educational authority and add a fail-closed scene-manifest adapter around it.
- Sequence historical versioning, browser performance, staged voice, accessible equivalence, teacher alignment, and submission hardening as separate gates.

### Plan review findings and corrections

- The first plan review found incomplete case-version propagation, premature `AGENTS.md` gate wording, insufficient reducer authority for parallel local actions, missing reducer-result propagation, an unreachable early performance route, and an unsafe speech-ticket minting boundary.
- Codex added the full case/model-policy/fixture compatibility set, preserved unfinished baseline verification, introduced reducer-owned repair action IDs and partial-order validation, required `CaseSessionProvider.issue` to return `ReducerResult`, split the first-zone and district performance gates, and moved ticket minting into the authorized server character-response path.
- The second review found that the reduced-motion shortcut, persistence envelope, multipart pre-parse body cap, and parallel-agent write map still needed explicit handling.
- Codex required the shortcut to authorize both repair actions, added an explicit case/state/persistence/reconstruction/policy matrix, required declared and streamed HTTP caps before multipart parsing plus server-side duration validation, and assigned all shared files to the main integrator.
- The final review found two remaining versioning omissions. Codex bound the spatial session to explicit session, case, and scene-manifest versions and made the strict AI contract bump from `1.0.0` to `1.1.0` unconditional when speech authorization enters the response envelope.
- The review loop stopped after the configured three iterations. The two final mechanical findings were corrected directly and verified in the current plan; no fourth external approval was claimed.

### Artifacts and verification

- Added the ignored source plan at `.Codex/plans/diegetic-3d-investigation-implementation.md`.
- Added the ignored interactive rendering at `.Codex/plans/diegetic-3d-investigation-implementation.html`.
- Verified 18 Markdown tasks and 18 interactive checklist steps, no unresolved template placeholders, successful Mermaid rendering, and checkbox persistence across reload.
- Opened the interactive plan locally for user review.

### What was not done

- No production code, dependency, route, asset, AI endpoint, or case version was changed.
- No commit, push, deployment, publication, or paid purchase was made.

### Next checkpoint

- Obtain explicit user approval of the implementation plan.
- Execute Task 1 through the main integrator, then start disjoint Task 2/Task 3 work only after the versioned authority baseline passes.

## 2026-07-15 / 3D Gate Task 1 Implementation

### What the user decided

- Approved the diegetic 3D implementation plan and asked Codex to begin with parallel subagents.
- Kept the existing deterministic historical case as the authority beneath the new spatial presentation.
- Did not authorize commits, pushes, deployment, paid assets, or publication.

### What Codex proposed

- Complete the shared historical/state compatibility gate through the main integrator before allowing disjoint 3D dependency and world-contract workers to edit production files.
- Preserve the complete 2D route as both a directly selectable non-spatial mode and the DOM focus-overlay system for the 3D route.
- Model passage control and passport inspection as separate reducer-owned repair actions that can occur in either order.

### What Codex implemented

- Added `EDGE-OBSTRUCTION-DETENTION` and required both authored incoming detention edges in the case solution.
- Added `RA-05-OBSTRUCTION` and `RA-05-PASSPORT`, strict command validation, reducer authorization, either-order completion, joint-step blocking, reduced-motion shortcut authorization, and final-repair rejection for missing actions.
- Added `completedRepairActionIds`, bumped state and persistence to `1.2.0`, and added partial-order persistence reachability checks.
- Bumped case content to `1.0.3` and reconstruction to `1.1.0`; kept case schema, model policy, and AI contract at `1.0.0`.
- Propagated contract, case schema, case content, policy, state, prompt, request, and revision metadata through browser AI request correlation.
- Updated the existing repair UI with independent passage-control and passport-inspection controls so the non-spatial route remains complete during the 3D transition.
- Updated controlling agent, product, visual, architecture, answerability, source, repair-traceability, and AI-contract documentation for the approved spatial gate.
- Installed the Playwright Chromium runtime required for end-to-end verification.

### Historical-integrity review and correction

- Read-only historical reviewers agreed that the sources document obstruction, passport inspection, guarded lodging, and a collective local response, but do not prove that the two actions are a strict historically necessary or sufficient pair.
- Codex therefore tightened learner-facing copy: requiring both actions is explicitly an authored reconstruction, neither incoming edge is a sole physical arrest mechanism, and the bridge constrains onward passage rather than physically arresting the carriage.
- Recorded that S2 and S3 are separate but not fully independent lineages because Drouet authored S2 and signed S3's municipal record.
- Reconciled the source ledger so only optional layout, troop-position, and quantitative review remains deferred for S3; the core printed pages supporting the gate are reviewed.
- A fresh review found that the caseboard still described the authored detention links too strongly and that E5 counted S2 and the partly overlapping S3 record as independent lineages.
- Codex changed both incoming detention-edge verbs to `contributed_to`, exposed the reconstruction limitation while the learner constructs and reviews those links, and conservatively retained S3 only as an E5 dependency rather than an independently scored lineage.
- A code-quality review also found repair prerequisites duplicated in reducer constants and normal-motion progress unavailable to screen readers. Codex made the reducer and persistence reachability derive prerequisites from the validated reconstruction descriptor and added a polite live progress status.

### Verification

- Confirmed the historical-integrity and command-schema tests failed before implementation for the missing obstruction edge, reconstruction version, and action command.
- Confirmed reducer and persistence tests failed before action-state implementation.
- Passed `npm run typecheck`.
- Passed the focused correction suite: 4 files and 34 tests covering historical integrity, caseboard disclosure, repair accessibility, and data-driven repair eligibility.
- Cleared stale duplicate generated `.next/types` cache files and passed `npm run typecheck` against the source tree.
- After the production build regenerated numbered duplicate type artifacts, generalized the TypeScript exclusion for generated filenames containing a copy suffix and re-passed typecheck without clearing the cache.
- Earlier in this task, passed `npm test`: 28 files and 178 tests, plus all six configured Chromium end-to-end tests including the complete novice-to-debrief path and mobile repair checks. A fresh full verification run follows the review corrections.
- The fresh browser run caught the new screen-reader-only status positioned one pixel outside the 320px viewport. Moved the clipped live region inside the viewport and passed the targeted repair/debrief mobile test.
- The live-key GPT-5.6 smoke test remains unverified because no configured key was used in this task.

### What was not done

- No 3D dependency, world route, canvas, manifest, spatial session, asset, or voice endpoint was added in Task 1.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Fresh specification-compliance and code-quality reviews of Task 1.
- After Task 1 review passes, execute the React Three Fiber production-build spike and the fail-closed scene-manifest/spatial-session task with disjoint ownership.

## 2026-07-15 / 3D Gate Task 2 Build Spike

### What Codex implemented

- Locked `three@0.185.1`, `@types/three@0.185.1`, `@react-three/fiber@9.6.1`, `@react-three/drei@10.7.7`, `@react-three/rapier@2.2.0`, and `ecctrl@2.0.0` exactly in the package lock.
- Added a repository-local HTTPS npm registry override after detecting that the machine-level npm setting used plaintext HTTP.
- Added `/play/world` as a server-safe page whose heavy WebGL implementation loads through a client-only `next/dynamic` boundary.
- Added an accessible loading state with a direct non-spatial investigation link.
- Added a full-bleed, lit schematic district graybox with a stable canvas shell, visible reconstruction disclosure, and DOM status region.
- Added screenshot-pixel verification through `sharp@0.34.5` without enabling WebGL `preserveDrawingBuffer` in production.

### Test-driven checkpoints

- Confirmed `tests/integration/world-entry.test.tsx` failed first because the world route did not exist.
- Passed the loading-shell integration test after implementing the client boundary.
- The first framebuffer test failed because the performant WebGL default clears the drawing buffer after compositing. Replaced that invalid assertion with decoded screenshot-pixel variation while keeping production rendering settings intact.

### Verification

- Passed `npm run typecheck`.
- Passed `npm run lint`.
- Passed `npm run build`; the production route table includes static `/play/world`.
- Passed `tests/integration/world-entry.test.tsx`.
- Passed `tests/e2e/world-graybox.spec.ts` at 1280 x 720 with nonzero canvas dimensions, more than 20 sampled screenshot colors, and the non-spatial escape route present.
- Inspected the local page in the in-app browser. The canvas was nonblank and the DOM exposed the ready status and non-spatial link. No runtime errors were recorded. The exact dependency set emits an upstream Three.js clock deprecation warning; Codex selected basic shadows to avoid the separate deprecated soft-shadow mode.

### What was not done

- No player controller, physics, interaction adapter, canonical scene manifest, final art, or evidence placement was added in this spike.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Complete and review the fail-closed Task 3 world contracts.
- Then add direct investigation-mode choice and a resilient world shell before introducing player movement.

## 2026-07-15 / 3D Gate Task 3 World Contracts

### What Codex delegated

- A disjoint worker owned only the new world schemas, manifest and ambient fixtures, interaction policy, spatial persistence, and their focused tests.
- The main integrator retained ownership of package files, application routes, components, shared documentation, and verification.
- The worker was instructed not to commit and not to edit any existing case authority.

### What was implemented

- Added strict scene-manifest and ambient-line schemas at version `1.0.0`.
- Added the four approved zones, graybox interactables, safe spawns, schematic placement labels, low reconstruction confidence, and explicit limitations.
- Cross-validated canonical evidence, facts, sources, generated/static station IDs, case surfaces, and repair checkpoints against the existing case package, model policy, and reconstruction.
- Added a pure interaction policy that rejects malformed, unknown, mismatched-zone, mismatched-type, and mismatched-target requests without synthesizing a fallback ID.
- Added a separate spatial-session envelope at version `1.0.0` containing only mode, last safe spawn, discovered zones, guidance, and graphics tier together with its session/case/manifest compatibility bindings.
- Added restore behavior that discards invalid or stale spatial state after version, case, zone, or spawn mismatch while leaving deterministic case progress outside the function boundary.
- Added four authored ambient remarks that carry no fact, source, evidence, or progression authority.

### Integration note

- The worker wrote the assigned files but did not return a usable final report through the agent channel. The main integrator stopped it, inspected the resulting files, and ran the complete focused verification directly.
- The integrator found one authority gap after the first green run: a canonical evidence target could name one valid record while the interactable metadata cited a different valid record. A new test failed first, then the manifest validator was tightened so every evidence target must belong to its own declared evidence relationship.

### Verification

- Passed 4 focused files and 27 tests covering manifest schema/reference closure, target-to-provenance consistency, historical placement boundaries, fail-closed interactions, and spatial persistence.
- Passed `npm run typecheck`.
- Passed `npm run lint`.

### What was not done

- The manifest is not yet connected to geometry or the case reducer.
- Spatial preferences are not yet wired to the investigation-mode UI.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Review the Task 3 contracts for authority leaks.
- Implement direct spatial/non-spatial mode selection, then the resilient world shell and graphics profiles.

## 2026-07-15 / 3D Gate Task 4 Mode Choice

### What Codex implemented

- Replaced the single post-fracture archive link with two directly visible, information-equivalent routes: `Enter 3D reconstruction` and `Use non-spatial investigation`.
- Added an unframed two-column command surface that explains the interaction difference while stating that evidence and repair requirements remain identical.
- Persisted only the voluntary presentation choice in the separate versioned spatial-session envelope; no case revision, evidence, or scoring field enters that record.
- Updated the complete end-to-end novice path to select the non-spatial route explicitly.

### Test-driven checkpoints

- Confirmed all three new mode-selection tests failed against the previous single-link screen.
- Passed tests for both route targets and for isolated `spatial`/`non_spatial` preference persistence.
- Preserved the existing primer/fracture mission-confirmation gate.

### Verification

- Passed 3 focused files and 15 tests covering mode selection, primer/fracture behavior, and spatial persistence.
- Passed the production-server full novice case and nonblank world-graybox browser tests together.
- A first run against the already-running development server stalled in server-rendered loading states because Playwright's `127.0.0.1` origin was blocked from that server's `localhost` HMR channel. Stopping the dev server and using Playwright's configured production build/start path passed both tests; this was a dev-server reuse issue, not a product failure.

### What was not done

- The world route still has no player controller, performance downgrade logic, or error boundary.
- Switching back to non-spatial is available in the world masthead; automatic low-performance offers arrive in Task 5.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Build Task 5 graphics profiles, performance monitor, capability/error boundaries, and test-mode controls.
- Then implement the finite world-mode state machine and player controller.

## 2026-07-15 / 3D Gate Task 5 Resilient Canvas

### What Codex delegated

- A disjoint worker owned only the pure graphics-profile and performance-monitor modules plus their focused unit tests.
- The main integrator owned the React canvas shell, WebGL failure boundary, adaptive-quality wiring, browser-test configuration, documentation, and integrated verification.
- The worker was explicitly prohibited from committing or editing case authority.

### What was implemented

- Added `high`, `balanced`, and `classroom` presentation profiles for DPR, shadows, fog, post-processing permission, ambient count, and texture tier.
- Added deterministic initial profile selection from optional browser hardware signals; unknown hardware defaults to balanced.
- Added a pure rolling performance monitor that downgrades after less than 28 FPS for three seconds and offers the non-spatial route after the classroom tier remains below 24 FPS for five seconds.
- Wired profile changes into DPR, shadows, fog, and shadow-map size without changing any evidence or interaction rule.
- Added browser WebGL capability handling, a local React render boundary, context-loss handling, retry actions, and a direct non-spatial route in every failure state.
- Added an accessible ready status, current reconstruction location, visible quality tier, and a low-performance route offer.
- Kept all placement language explicitly schematic, compressed, and not to scale.
- Added `NEXT_PUBLIC_WORLD_TEST_MODE=1` to the Playwright production server so screenshot runs use a demand-driven, non-sampling frame loop.

### Test-driven checkpoints

- Confirmed the world-shell integration test failed before the shell existed.
- Confirmed the worker's profile and performance tests failed before their implementations existed.
- Added focused tests for all profile values, constrained/strong/unknown hardware, tier stepping, recovery, rolling-window behavior, downgrade thresholds, single non-spatial offer, monotonic time, and immutable deterministic results.
- Added integration coverage for WebGL failure and successful scene mounting with the non-spatial route retained.

### Verification

- Passed 3 focused files and 21 Task 5 tests.
- Passed the full Vitest suite: 37 files and 235 tests.
- Passed `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed the production-server novice full-case and nonblank world-graybox E2E tests together at 1280 x 720.

### What was not done

- The canvas has no player controller, physics, proximity interaction, or reducer adapter yet.
- Graphics tier is session-local during this checkpoint; restoration through the spatial preference envelope can be added with the controller lifecycle.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Implement Task 6's finite world-mode state machine, visible investigator, physics colliders, follow camera, and input suspension.
- Then connect one archive evidence table to the existing reducer and accessible DOM evidence overlay.

## 2026-07-15 / 3D Gate Tasks 6-7 Movement And E3 Vertical Slice

### What Codex delegated

- A worker shared ownership of the pure world-mode state machine and its test while the main integrator retained the coupled React/physics work. It detected the concurrent implementation and preserved it instead of overwriting it.
- A read-only Ecctrl/Rapier API specialist inspected the installed package source and type declarations.
- The API specialist found that Ecctrl 2 does not consume Drei keyboard context automatically and that `setMovement({})` does not clear partial input state. This invalidated the first apparent movement success and led to an explicit input bridge and stronger settling-aware browser test.

### What Codex implemented

- Added a pure finite state machine for exploring, focused, cinematic, repair, and suspended modes with exploration-only locomotion and pointer permission.
- Added a visible primitive investigator, manifest-safe initial spawn, Ecctrl movement, explicit keyboard-state bridging, run toggle, Rapier ground/obstacle colliders, and a damped follow camera.
- Added a production browser test that waits for physics/camera settling before proving `W` changes more than 5,000 rendered color channels at 1366 x 768.
- Refactored `CaseSessionProvider.issue` to return the exact synchronous reducer result from a current-state ref; two immediate commands now use revisions 0, 1, and 2 rather than sharing a stale render closure.
- Added a nearest-eligible proximity selector with deterministic tie-breaking.
- Added one schematic archive table mapped only to the reviewed E3 manifest target.
- Added a fail-closed world interaction adapter that inspects E3 only through the existing reducer and never pins the 3D object.
- Added an accessible DOM evidence dialog with reviewed excerpt, provenance, source citation, source limitation, close/Escape handling, and focus restoration.
- Added an end-to-end primer to 3D E3 path proving reducer persistence and no automatic pinning.

### Test-driven checkpoints

- Confirmed the world-mode test failed while the module was absent, then passed 18 transition/input-gating tests.
- Confirmed the first movement browser test failed with zero changed channels against the static scene.
- Rejected the first green movement run after package inspection showed that the key context was not connected to Ecctrl; added the explicit bridge and a post-settling production test.
- Confirmed provider result tests failed while `issue` returned `void`, then passed exact result/revision and rejection/no-mutation cases.
- Confirmed world adapter, focus overlay, and proximity tests failed before their modules existed.

### Verification

- Passed 41 Vitest files and 261 tests.
- Passed `npm run typecheck`, `npm run lint`, and `npm run build`.
- Passed all three production world E2E tests: frozen nonblank canvas at 1280 x 720, keyboard movement at 1366 x 768, and primer-to-E3 interaction/focus restoration.
- Passed the complete production non-spatial novice case after the provider refactor.

### Historical integrity boundary

- The archive table remains `SCHEMATIC RECONSTRUCTION - NOT TO SCALE` and counts as no evidence.
- The overlay uses the existing reviewed E3 excerpt and S2 metadata; no unsupported full or "original" excerpt was invented.
- Drouet's report remains participant testimony with an explicit self-emphasis limitation and requires corroboration.

### What was not done

- Camera orbit/collision avoidance, animation clips, validated safe-spawn updates after travel, and focus-mode movement E2E telemetry remain unfinished.
- Only E3 is physically connected; no other world object can change case state yet.
- Drouet's cinematic conversation and evidence presentation are the next vertical-slice gate.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Complete the reusable source-bounded Drouet panel and cinematic world station.
- Prove the archive-to-E3-to-Drouet-to-board handoff before adding more zones or final art.

## 2026-07-15 / 3D Gate Task 8 Drouet Conversation Checkpoint

### What Codex delegated

- A disjoint worker was assigned the locked Drouet conversation integration test while the main integrator retained ownership of the world shell, spatial station, and end-to-end route.
- The worker did not return a usable completion report. Its test file was retained, reviewed against the canonical evidence data, and corrected by the main integrator rather than accepted blindly.

### What Codex implemented

- Added a locked character-conversation panel that accepts an authored station ID instead of exposing the non-spatial character picker.
- Added a schematic Drouet world figure and one manifest-authorized station candidate in the post-road zone.
- Centralized E3 and Drouet proximity selection through one registry so overlapping zones cannot race to control the interaction prompt.
- Added a cinematic DOM conversation surface with the dramatization disclosure, Escape/close handling, focus containment, and focus restoration.
- Preserved the existing server-side character contract: the request includes the current case revision and only inspected, authorized evidence IDs.
- Confirmed character dialogue cannot issue reducer commands or mutate case state.
- Added a production browser route from the novice primer through E3 inspection, physical travel to Drouet, a source-bounded question, an authored API fallback response, and return to the world.

### Test-driven checkpoints

- Corrected a worker-authored assertion that mislabeled canonical E4 as National Guard testimony; E4 is the reviewed route board.
- Added integration coverage proving the locked Drouet station has no character picker, excludes unrelated evidence, sends only authorized inspected/presented IDs, includes the current revision, and leaves the reducer revision unchanged.
- Added browser coverage proving input is suppressed while the evidence overlay is focused before the player travels to Drouet.

### Verification

- Passed the full Vitest suite: 42 files and 263 tests.
- Passed `npm run typecheck`, `npm run lint`, and `npm run build` after the Drouet integration.
- Passed four production browser tests together: frozen nonblank canvas, keyboard movement, the complete E3-to-Drouet embodied loop, and the full non-spatial novice case.

### Historical integrity boundary

- The Drouet figure and station placement are schematic navigation aids, not evidence about his exact location or appearance.
- Dialogue remains visibly labeled as generated dramatization and can use only the authored Drouet knowledge boundary.
- The model or authored fallback may discuss evidence, but its prose cannot become evidence or alter the case canon.

### What was not done

- Provider-generated NPC speech, microphone input, lip synchronization, final character art, and animation clips are not implemented. A local browser speech layer was added in the next checkpoint.
- The Drouet checkpoint originally returned to exploration; the authoritative caseboard and repair-ready handoff were integrated in the next checkpoint.
- Camera orbit/collision avoidance, safe-spawn updates after travel, and persisted graphics-tier restoration remain unfinished.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Connect the world loop to the existing causal caseboard and hypothesis/repair systems without duplicating their authority.
- Add the next spatial zones only after that end-to-end reasoning handoff passes browser tests.
- Build voice as an optional presentation layer over the same validated character-turn contract.

## 2026-07-15 / 3D Gate Task 8B Reasoning Handoff And Optional Voice

### What Codex delegated

- A reasoning-policy worker owned only `lib/world/reasoning-handoff.ts` and its unit test. It added fail-closed case-phase and world-mode rules without duplicating reducer authority.
- A voice worker owned only the browser speech adapter and its unit test. It implemented capability detection, explicit playback, cancellation, and error-as-data behavior without touching UI or case state.
- The main integrator reviewed both outputs, wired them into the existing world and character surfaces, and retained ownership of shared React components and browser tests.

### What Codex implemented

- Added a phase-aware world control that routes incomplete investigations to the case file, opens the caseboard only after reducer-owned `case_brief`, and resumes canonical repair/debrief routes.
- Added a full-screen accessible DOM caseboard overlay that renders the existing authoritative `CausalCaseboard`, suspends locomotion in focused mode, traps focus, closes through the handoff policy, and restores focus to its invoker.
- Added an embedded rendering mode to the existing caseboard so the overlay does not create a second HTML `main` landmark or a second educational implementation.
- Added a production browser path from a valid repair-ready case state through the 3D world, caseboard overlay, deterministic repair link, and canonical repair page.
- Added a dependency-free browser speech adapter and an explicit **Hear response** / **Stop voice** control for authorized Drouet captions.
- Kept captions authoritative, cancelled speech when dialogue is replaced or unmounted, and left unsupported/error states non-blocking.
- Replaced a load-sensitive canvas-pixel locomotion assertion with opt-in test telemetry that reads the Rapier player position without rerendering the Canvas.

### Debugging evidence

- The first repair-handoff fixture was rejected because it stored board work in the `investigation` phase; persistence correctly recovered the unreachable state.
- The second fixture was rejected because its revision ledger was smaller than the number of structural commands represented. Raising both the revision and unique command ledger produced a reachable state.
- The first position-telemetry implementation fed physics samples through React state above the Canvas and caused a WebGL context interruption. Moving test-only telemetry to a ref-backed DOM data attribute removed that render loop.

### Historical and AI authority boundaries

- The caseboard overlay uses the existing reducer, selectors, repair eligibility, and package-backed content. The world contributes no new scoring or historical rule.
- Browser speech renders only the validated visible caption after a user action. It cannot alter wording, become evidence, or affect progression.
- Generated and fallback Drouet replies remain dramatization with authored knowledge boundaries and visible non-evidentiary disclosure.
- Historical-integrity review required Drouet's evidence reactions to attribute participant reports, disclose overlapping S2/S3 lineage, and reject sufficiency claims; model policy was bumped to `1.0.1` and propagated through AI metadata and the scene-manifest compatibility binding.

### Verification

- Passed 44 Vitest files and 294 tests after the historical-integrity corrections and policy-version propagation.
- Passed `npm run typecheck`, `npm run lint`, and `npm run build` after the final HUD, telemetry, disclosure, and policy changes.
- Passed five production Chromium paths together: frozen nonblank canvas, keyboard movement, E3-to-Drouet dialogue with focused locomotion suppression, prevalidated world-to-caseboard-to-repair handoff, and the complete novice non-spatial case.
- The historical-integrity audit's four findings were resolved: attributed Drouet reports, synthetic-voice disclosure and contract exception, honest persisted-state test naming, and reconstruction-only final repair copy.

### What remains

- Provider speech, microphone transcription, signed audio authorization, lip synchronization, and final voices remain future gates.
- Task 8's scripted 60-second archive performance fixture and compressed-size report remain unfinished.
- Additional physical evidence zones, Louis, civic/Assembly stations, fast travel, final art, and the guided 3D repair remain unfinished.
- No commit, push, deployment, paid purchase, or publication occurred.

## 2026-07-15 / 3D Gate Task 8C Classroom Performance Proxy

### What Codex delegated

- A bounded worker owned the pure Phase 1 performance evaluator and its unit tests. The worker used a test-first red/green cycle and did not touch browser orchestration or shared documentation.
- The main integrator owned Chromium CDP setup, transfer accounting, the scripted browser fixture, production-server enforcement, report output, and documentation.
- An initial exploratory reviewer did not return a usable report and was stopped; its silence was not treated as approval.
- A specification reviewer then identified production-server reuse, missing tier assertion, the 15 MiB/MB mismatch, and a terminal-stall omission. After corrections, a fresh reviewer approved the Phase 1 gate with no remaining findings.

### What Codex implemented

- Added a typed fail-closed evaluator for the six Phase 1 metrics: nonblank canvas, initial compressed transfer, interaction time, median FPS, 10th-percentile FPS, and maximum post-load stall.
- Added a production-only Playwright command that refuses to reuse an already-running development server and runs with one worker.
- Added a Chromium CDP profile at 1366 x 768, four logical processors, 4x CPU slowdown, cache disabled, the lowest `classroom` presentation tier, and Chromium DevTools' effective Fast 4G values.
- Added same-origin transfer accounting from `Network.loadingFinished.encodedDataLength` rather than uncompressed bundle estimates.
- Defined archive interactivity as opening the canonical E3 evidence dialog, not merely rendering a loading label or HUD.
- Added a ten-second warm-up followed by a 60-second scripted archive movement loop with one-second FPS buckets and raw frame-delta stall detection.
- Exposed the complete JSON result in Playwright output and the HTML report attachment.
- Replaced browser-level `requestAnimationFrame` sampling with renderer-owned R3F `useFrame` telemetry after code-quality review showed the browser loop could stay healthy while Three.js failed.
- Required measured investigator displacement, post-run canvas visibility and pixel variation, zero performance retries, and dedicated opt-in test discovery.
- Added browser version, throttle profile, viewport, movement distance, segment count, and all 60 raw frame buckets to the report.

### Test-driven checkpoints

- The Playwright fixture first failed because its performance evaluator and helper did not exist.
- The pure evaluator's 23 tests failed before implementation, then passed boundary equality, every individual failure, invalid numeric inputs, deterministic ordering, immutability, and no input mutation.
- A stricter follow-up test changed the ambiguous 15 MB budget from 15 MiB to exactly 15,000,000 bytes; it failed against the looser implementation before the production threshold was corrected.
- The browser fixture now asserts that the actual page reports `Graphics quality: classroom` before measurement.
- A review-discovered regression test proves the final frame delta is included when a stall crosses the 60-second capture boundary.
- A code-quality review initially withheld approval because browser-level RAF, inherited CI retries, ordinary E2E discovery, and aggregate-only reporting could hide failures. A fresh review approved the renderer-owned implementation after all findings were resolved.

### Measured automated-proxy result

The final production run reported:

- Initial compressed transfer: 1,514,003 bytes, under 15,000,000.
- Canonical E3 interaction: 3,687.2 ms from navigation start, under 8,000.
- Median frame rate: 64 FPS, at or above 30.
- 10th-percentile frame rate: 62 FPS, at or above 24.
- Maximum renderer-frame stall: 26.1 ms, under 250.
- Canvas: nonblank.
- Movement: 2.77 world units maximum displacement across 58 input segments.
- Sustained renderer sample: all 60 one-second buckets were between 61 and 67 FPS after a ten-second warm-up.

### What this does not prove

- The current pass covers the first archive graybox and Drouet vertical slice only. The 35 MB complete-district budget and archive-to-bridge traversal remain reserved for the completed four-zone district.
- Chromium CPU/network emulation is a reproducible regression proxy, not proof of integrated-GPU behavior on the target Chromebook.
- The physical 4 GB ChromeOS/N4500-class check remains required before the 3D route can become the default.
- Final art, animation, ambient residents, additional evidence zones, and audio will change performance and must remain inside this gate as they are added.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Begin Task 9 graybox expansion with first-visit safe-spawn and fast-travel tests before adding new visual assets.
- Re-run this archive gate after every zone or asset-loading change; add the full-district 35 MB and archive-to-bridge gate only after the bridge route exists.

## 2026-07-15 / 3D Gate Task 9 Four-Zone Investigation District

### What Codex delegated

- A bounded spatial-state worker implemented manifest-safe restoration, three-dimensional discovery, and discovered-only fast travel with storage-failure tests.
- A historical-integrity audit reviewed the journal, Assembly dossier, ambient captions, and dormant Louis/repair bindings. It found no new source-research blocker and required the fictional records, situated Assembly position, and ambient dramatization boundaries to remain explicit.
- A journal worker produced only an incomplete red test and stalled. The main integrator stopped that worker, retained no unreviewed implementation, and completed the feature through the repository's existing case and world contracts.
- A specification reviewer found that `off`, `subtle`, and `guided` existed in the spatial schema but had no player-facing control. The gap was reproduced, fixed with a persisted segmented control, and returned for fresh review.

### What Codex implemented

- Expanded the graybox into four rendered zones with globally unique manifest-derived interaction candidates and safe-spawn discovery.
- Restored the investigator only at authored safe spawns, persisted spatial state separately from case state, and added discovered-only fast travel that leaves reducer revision and educational progress unchanged.
- Added a route journal with current/discovered/undiscovered zone states, explicit schematic and not-to-scale boundaries, deterministic inspection of E6A/E6B/E6C and FO1/FO2/FO3, and a link to the full comparison workspace.
- Added fixed Varennes civic and Assembly dossier stations. Each requires explicit evidence inspection, offers no free-form model prompt, and states its response boundary.
- Added deterministic anonymous ambient residents with capped graphics-profile counts, one caption per authored line, and a permanent dramatization/non-evidence disclosure.
- Added a player-selectable Off/Subtle/Guided objective control stored only in the spatial session.
- Fixed the world-label stacking policy so Three.js HTML annotations stay below semantic dialogs.
- Added portrait layout behavior that separates the interaction prompt from graphics controls, reduces the lower status footprint, hides clipped ambient captions, and preserves a visibly nonblank world canvas.

### Test-driven checkpoints

- Spatial visit, restore, storage failure, authored-coordinate, and fast-travel tests failed before their transition functions and shell wiring existed.
- Journal and static-dossier tests failed before the modal, fixed stations, and explicit reducer inspections existed.
- The guidance test failed because no control or update function existed, then passed after the spatial-only setting path was implemented.
- A visual browser review exposed world HTML above the journal. A shared z-index policy and unit contract now keep renderer-owned HTML below application dialogs.
- The portrait browser test first failed because the interaction prompt overlapped graphics quality at 390 x 844. It now verifies a 12-pixel separation and more than 20 sampled canvas colors.
- Route traversal debugging used position telemetry to establish the camera-relative key combination needed to reach the civic zone without falling off the authored corridor.

### Historical and authority boundaries

- E6A/E6B/E6C and FO1/FO2/FO3 are visibly fictional records with equal presentation weight. Their inspection is deterministic and cannot count as historical corroboration.
- E7 is inspected only through the fixed Assembly dossier, which describes a situated constitutional position rather than French national consensus.
- Ambient residents are anonymous presentation elements. Their captions cannot become testimony, evidence, facts, sources, or progression events.
- The journal map is a navigation diagram of the reconstruction, not documented geography, chronology, distance, or exact character location.
- Louis and the repair checkpoint remain unrendered and inaccessible even though future-compatible IDs remain registered in the manifest.

### Verification

- Passed 52 Vitest files and 358 tests after the final guidance, stacking, persistence, focus, and hot-loop corrections.
- Passed `npm run typecheck`, warning-free `npm run lint`, and the production build.
- Passed all 12 regular production Chromium paths, including novice full-case completion, keyboard movement, E3-to-Drouet interaction, walking discovery, progression-neutral fast travel, world-to-caseboard handoff, mobile non-overlap, and portrait canvas pixel variation.
- The post-review classroom proxy passed at 1,524,634 compressed bytes, 3,717.4 ms to canonical interaction, 55 median FPS, 53 10th-percentile FPS, 44.4 ms maximum renderer stall, nonblank canvas, and 2.61 world units of movement.

### Code-quality review corrections

- Cached the WebGL capability result across ordinary React rerenders while preserving an explicit retry recheck.
- Replaced discarded invalid spatial storage with the recovered authored-safe session immediately on mount.
- Restored journal focus to the physical interaction prompt on normal close and to the persistent HUD journal control after fast travel.
- Replaced proximity `filter`/`sort` work with a deterministic single pass, reused the player-position tuple, and reduced rolling performance monitoring to one retained-window allocation.
- Moved every Playwright route to a fresh production server on port 3100 so a running or stale development server on port 3000 cannot satisfy the E2E gate.

### What was not done

- The physical 4 GB Chromebook check remains required before the spatial route can be the classroom default.
- Louis, the guided physical repair, final environment art, character assets, recorded/provider speech, microphone transcription, and lip synchronization remain later gates.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Complete a fresh Task 9 specification and code-quality review.
- Then implement Louis as a source-bounded generated station without allowing dialogue to establish private motive or modify case state.

## 2026-07-15 / 3D Gate Task 10 Louis Source-Bounded Station

### What Codex delegated

- A model-policy worker added the standalone ordinary leading-motive refusal case and drafted the no-preload world acceptance path. The worker stopped after camera-relative movement could not reliably reach E1; that failure was retained as debugging evidence rather than weakened with preloaded progress.
- Two read-only historical/specification reviewers audited the E1/S1 boundary, E2/S8/S9 exclusion, static civic and Assembly stations, model non-authority, and complete world route. The first found missing acceptance coverage. The second found only a stale architecture statement after those tests were added.
- The main integrator repaired the route through an authored current-zone safe-point action, fixed the intentional WebGL-remount lifecycle, and reconciled the controlling documentation.

### What Codex implemented

- Added Louis as the second and final generated world station in the civic zone.
- Restricted the station UI to inspected E1, rendered a visible stated-rationale/private-motive boundary, and retained the server's existing E1/S1 fact, source, claim, reaction, refusal, and fallback allowlists.
- Kept generated dialogue non-evidentiary and unable to issue reducer commands, change case revision, pin evidence, or affect repair eligibility.
- Kept the Varennes civic and Assembly stations as static dossiers.
- Added a discovered-only current-zone safe-point action to the route journal. It uses the existing manifest-backed travel authorization, remains in the spatial envelope, and cannot bypass first discovery.
- Moved WebGL context-loss subscription into a cleanup-aware renderer lifecycle so intentional safe-spawn remounts do not trigger the graphics-failure fallback.

### Test-driven and debugging checkpoints

- Added separate model evals for ordinary leading questions, prompt injection, direct solution requests, hindsight, missing E1, and attempted E2/S8/S9 leakage.
- Added a real-entry browser path with no preloaded case or spatial state: context primer, fracture, E3, Drouet, physical civic discovery, safe-point recovery, E1, and Louis.
- The first complete browser route exposed fixed-duration movement and controller-readiness weaknesses. Tests now wait for physics telemetry before input and use authored safe-spawn recovery after first discovery.
- The safe-point path then exposed an unremoved `webglcontextlost` listener. A failing unit contract proved active loss must report while post-cleanup teardown must not; the cleanup-aware subscription fixed the browser failure.

### Historical and authority boundaries

- Louis may voice only his public declaration boundary through E1/S1. The station cannot establish complete private motive, use E2/S8/S9 as personal testimony, reveal the solution, or narrate a definitive alternate future.
- The rendered Louis figure and station placement are schematic dramatization, not evidence of exact appearance or location.
- No new historical claim, source, causal edge, score, or repair gate was introduced.

### Verification

- Passed 53 Vitest files and 365 tests.
- Passed `npm run typecheck` and warning-free `npm run lint`.
- Passed all 14 regular production Chromium paths, including the no-preload E3-to-Drouet-to-E1-to-Louis route and the focused Louis authority path.
- The post-integration classroom proxy passed at 1,525,007 compressed bytes, 3,759 ms to canonical interaction, 52 median FPS, 50 10th-percentile FPS, 47.5 ms maximum renderer stall, nonblank canvas, and 2.45 world units of movement.

### Quality-review closure

- A fresh code-quality review found that ordinary Playwright runs could inherit an ambient `OPENAI_API_KEY` and accidentally become paid, nondeterministic provider tests.
- The production-test web server now forces an empty provider key by default. Live-key smoke behavior requires the explicit `HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1` opt-in.
- Added a focused configuration contract for default key stripping and explicit smoke opt-in.
- Added shell-level coverage proving that active WebGL context loss enters the graphics fallback, can retry, and preserves inspected case progress.
- The specification reviewer and the post-fix code-quality reviewer both approved Task 10 with no remaining findings.

### What remains

- Live-key provider smoke testing remains unverified; browser acceptance used the deterministic no-key path.
- Provider speech, microphone transcription, guided physical repair, final assets, and the physical Chromebook gate remain later tasks.
- No commit, push, deployment, paid purchase, or publication occurred.

### Next checkpoint

- Version and test the non-authoritative transcription and speech contracts before adding provider code.

## 2026-07-15 / 3D Gate Task 11 Presentation-Only Media Security Contracts

### Intent and scope

- Defined and proved the transcription and authorized-speech security contracts before any provider route, recorder/playback UI, or media service exists.
- Kept historical case data, model policy, world production code, browser speech controls, API route files, provider gateways, and all Task 12 files unchanged.

### Test-driven checkpoints

- The initial focused RED command covered nine assigned test files. It exited 1 with eight failed files, one passed file, 11 failed assertions, and two new suites failing to resolve the intentionally absent media modules. Failures matched the missing media/ticket contracts, AI `1.1.0` bump, strict authorization field, route minting, legacy-version rejection, and strict browser fixtures.
- A second RED cycle added the controlling mono-audio requirement. `tests/unit/audio/media-contracts.test.ts` exited 1 with two failures because `channelCount` was not yet part of the strict request schema.
- The final focused command passed nine files and 60 tests.

### What Codex implemented

- Atomically advanced the only accepted AI contract to `1.1.0`; both current AI handlers classify legacy `1.0.0` as HTTP 409 before provider invocation.
- Added independent media contract `1.0.0` with strict correlation, mono audio, decimal 2,000,000-byte and 20,000-millisecond limits, 600-character transcripts, 1,600-character captions, canonical browser MIME values, mismatch rejection, logical voice IDs, and typed failure/retry semantics.
- Added pure MIME normalization and current-correlation checks. The client check rejects stale station, request, or revision data; documentation records that the stateless server cannot know the browser's globally current revision.
- Split the server-internal character result from the public response. `createCharacterTurn` has no ticket/secret dependency and returns no speech authorization.
- Made `handleCharacterTurnRequest` the sole production mint caller. Both model and authored fallback captions receive a ticket when a usable secret exists; absent/short secrets preserve the response with `null`.
- Bound HMAC-SHA256 authorization to media version, case, station, original request UUID, state revision, private station-owned logical voice mapping, exact UTF-8 caption SHA-256, and integer expiry using a domain-separated byte-length-prefixed representation.
- Added canonical base64url signature checks, equal-length `timingSafeEqual`, a minimum 32-byte secret, a 120-second expiry bound, and fail-closed handling for altered, expired, malformed, or wrongly signed requests.
- Kept speech request parsing exact: no trimming or Unicode normalization. `AuthorizedSpeechRequest` contains only caption plus pre-minted authorization, and no mint endpoint or client-text mint path was added.

### Verification

- `npm test -- tests/unit/audio/media-contracts.test.ts tests/unit/audio/speech-ticket.test.ts tests/unit/ai-contracts.test.ts tests/unit/ai-request-metadata.test.ts tests/unit/ai-request-coordinator.test.ts tests/unit/character-turn-service.test.ts tests/integration/ai-routes.test.ts tests/integration/investigation.test.tsx tests/integration/world-dialogue.test.tsx`: 9 files and 60 tests passed.
- `npm run typecheck`: passed.
- `npm run lint -- --quiet`: passed with no reported errors or warnings.
- `npm test`: 56 files and 396 tests passed.
- Live HTTP against the already-running Next.js app returned AI `1.1.0` authored fallback status 200 with `speechAuthorization: null`. Legacy `1.0.0` requests returned classified 409 responses from both `/api/ai/character-turn` and `/api/ai/case-brief-feedback`.
- Minted route behavior with an injected 32-byte server secret passed integration coverage for both model and authored fallback captions. The existing user dev process was not stopped or restarted to inject a live secret.

### Remaining Task 12 work

- Provider transcription and speech routes/services, bounded streaming and multipart cleanup, recorder/playback UI, microphone consent, media rate limiting, provider calls, generated-audio cleanup, and operational log-redaction tests are not implemented.
- No live transcription or provider-speech call was possible because those surfaces intentionally do not exist yet. The existing browser `SpeechSynthesis` fallback remains unchanged.
- Live-key GPT-5.6 verification and the physical Chromebook gate remain outstanding project-level checks.
- No commit, push, deployment, purchase, publication, or API route creation occurred.

## 2026-07-15 / Task 11 Closure And World Focus Reliability

### What Codex investigated

- Final production-browser verification exposed an intermittent Louis interaction failure while locomotion was ending near the edge of the station's proximity radius.
- Repeated runs showed that the prompt could legitimately unmount after the conversation opened because residual spatial updates continued. That made the prompt an unsafe sole focus-return target even though historical and case state remained correct.
- A failing integration test reproduced the accessibility defect by removing the nearby interaction while the cinematic dialog remained open.

### What Codex implemented

- Added a persistent focus fallback from the cinematic conversation to the route-journal control while preserving the nearby station prompt as the preferred target when it still exists.
- Kept the change presentation-only: no case command, evidence state, historical claim, scoring rule, or repair authority changed.
- Strengthened browser coverage so the Louis prompt must begin absent, appear only after measured world movement, remain available after movement keys are released, and open the source-bounded conversation.
- Added separate deterministic integration tests for both valid close paths: focus returns to the still-mounted station prompt, or to the persistent Journal control after the prompt disappears.

### Review and verification

- The focused world-shell suite passed 19 tests.
- The updated Louis world path passed 20 consecutive production-browser repetitions with five workers.
- Fresh `npm run typecheck` and warning-free `npm run lint -- --quiet` passed.
- Fresh `npm test` passed 56 files and 399 tests.
- Fresh regular Playwright verification passed all 14 production Chromium paths.
- The post-production-change classroom proxy passed at 1,527,322 compressed bytes, 3,824.1 ms to canonical interaction, 52 median FPS, 48 10th-percentile FPS, 54.2 ms maximum renderer stall, a nonblank canvas, and 2.43 world units of movement.
- A specification/accessibility reviewer and a post-correction code-quality reviewer both approved the focus behavior with no remaining findings.

### Next checkpoint

- Begin Task 12 with bounded push-to-talk transcription, exact-caption authorized speech, provider mocks, captions, mute/replay controls, and deterministic typed/browser-speech fallback.
- No commit, push, deployment, purchase, publication, or live paid provider call occurred.

## 2026-07-16 / 3D Gate Task 12 Staged Voice Runtime

### Intent and decisions

- Implemented optional staged voice without creating an unconstrained speech-to-speech character agent.
- Preserved typed input and visible captions as the authoritative, always-available interaction path.
- Kept all transcription and speech presentation-only: neither transform can add historical facts, become evidence, issue reducer commands, alter scores, or change repair eligibility.
- Used the official current OpenAI media paths: `gpt-4o-transcribe` with JSON output and `gpt-4o-mini-tts` with WAV output. A live paid-provider call was not made.

### What Codex implemented

- Added explicit push-to-talk recording with a 20-second, decimal 2 MB, mono-audio boundary and browser MIME negotiation limited to provider-supported WebM, MP4, and WAV paths.
- Added a bounded streaming multipart parser, independent server-side media inspection, MIME/duration/channel checks, and request rate limiting before body consumption.
- Added `/api/ai/transcribe` and `/api/ai/speech` Node routes with strict media `1.0.0` response contracts, classified failure behavior, retries only for transient provider errors, and no-key fallbacks.
- Added exact-caption provider speech behind the existing short-lived HMAC authorization, private logical-to-provider voice mapping, a 12 MB generated-WAV cap, and strict response-header correlation.
- Added explicit play, stop/skip, and mute controls; visible synthetic-voice disclosure; deterministic browser-speech fallback; and stale response rejection.
- Made transcripts editable before submission and ensured newer typed text supersedes an in-flight transcription instead of being overwritten by a late result.
- Cleared every app-owned mutable media buffer after use, cancelled aborted readers, retained no raw audio or generated audio in application persistence, and kept captions, transcripts, and audio bytes out of operational logs.
- Documented the unavoidable platform boundary honestly: immutable `File` instances cannot be zeroed, are not retained by the application, and follow the runtime's object lifecycle.

### Test-driven and review checkpoints

- Added provider contract tests for current OpenAI model IDs and formats.
- Added route tests for pre-consumption rate limits, exact-caption ticket verification, media inspection, failure classification, log redaction, output caps, and mutable-buffer release.
- Added recorder, multipart, voice-state, dialogue integration, and production-browser voice coverage, including microphone denial and editable transcription.
- An independent audit found rate-limit ordering, output-size, abort-cleanup, and late-transcript hazards. Each actionable finding was corrected and protected by a regression test.
- Focused media and dialogue verification passed 8 files and 81 tests. Fresh full verification passed 61 files and 455 tests, warning-free lint, typecheck, the production build, all 16 Playwright browser flows, and `git diff --check`.

### Verification boundary and next checkpoint

- Browser voice acceptance uses deterministic network fixtures, while real route handlers are exercised in integration tests with injected provider adapters. This layered coverage is not represented as a live OpenAI smoke test.
- Task 12 is locally verified. A live OpenAI media smoke test and physical Chromebook check remain separate project-level gates.
- No additional commit, push, deployment, publication, purchase, or live paid provider call occurred during this checkpoint.

## 2026-07-16 / Phase 4 Teacher Alignment And Accessibility

### Intent

- Make the authored Varennes case assignable with teacher-selected classroom language and accessibility preferences while keeping historical truth, evidence, scoring, and repair authority unchanged.
- Preserve a complete no-packet and no-key path, and keep the new learning/reporting data separate from deterministic `CaseState`.

### What Codex proposed

- A closed course-alignment catalog instead of open-ended teacher authoring.
- A reviewed sample plus bounded arbitrary-text processing, explicit teacher confirmation, separate local learning-session persistence, authored packet-aware hints, and a deterministic report.
- Exact segment references and short authorized excerpts so approved class-material connections remain auditable after raw input is discarded.

### What the user decided

- Phase 4 uses bounded ID-only alignment: model output may select reviewed IDs and exact terms tied to server-created segment IDs, but may not write new historical content or requirements.
- A teacher must review the proposed mappings, conflicts, ignored instructions, and limitations before approval makes the profile active.
- The secure first phase supports the reviewed sample, pasted text, and bounded UTF-8 TXT/Markdown files.
- Raw packet content is not retained. Accessibility/reporting metadata persists in a learning-session envelope separate from case progress.
- Hints remain an authored deterministic ladder, and the teacher report remains deterministic and teacher-reviewed rather than AI-narrated or automatically graded.

### What was rejected or deferred

- PDF and DOCX ingestion were rejected for this secure first phase. The repository has no hardened binary extraction/OCR boundary for file signatures, pages, embedded objects, decompression, external resources, malformed containers, or temporary-artifact cleanup.
- Silent alignment activation, raw packet persistence, packet-created facts/evidence/character knowledge, packet-defined correctness, generated hint prose, AI-authored report narration, and report-based high-stakes grading were rejected.
- A general teacher authoring platform, LMS/roster integration, authenticated cross-device reports, and tamper-resistant grade records remain outside the anonymous local MVP.

### Why the decisions mattered

- Exact server-authorized segments prevent the model from inventing quotations or citing text outside the bounded request. The server resolves every segment ID, verifies the term as an exact substring, and derives the retained excerpt/reference itself.
- Restricting files to directly inspectable UTF-8 text makes byte limits, segmentation, cleanup, and retained references auditable without introducing an unreviewed document-parser attack surface.
- Separating learning-session persistence from `CaseState` prevents teacher support metadata and observable events from becoming a second progression or repair authority.

### What Codex implemented

- Added course-alignment/catalog contract `1.1.0`, prompt contract `1.0.0`, learning-session contract `1.0.0`, three authored objectives, seven reviewed concepts, three historical boundaries, and a reviewed sample profile.
- Added `/teacher` and `/api/ai/course-alignment` with sample, pasted-text, TXT, and Markdown paths; 40,000-character pasted-text, 64 KB file, and 96,000-byte streamed JSON bounds; pre-consumption rate limiting; version checks; and strict source schemas.
- Added ephemeral packet segmentation, strict GPT-5.6 ID/segment plans when configured, deterministic exact-term fallback, exact-segment authorization, conflict/injection flags, limitations, packet digests, and `rawRetained: false`.
- Added pending-review and teacher-approved states, explicit confirmation/clear actions, and persistence that excludes raw packet text and files.
- Added a separate versioned learning session for approved alignment, reading/motion/guidance preferences, and at most 256 typed observable event records.
- Added a four-tier authored route-finding hint ladder; approved packet terms can appear only through authored prefix templates.
- Applied reduced-reading variants to primer, dialogue, Case Brief feedback, hints, and evidence details. Applied reduced motion to CSS timing, spatial ambient residents/camera behavior, and the repair presentation while preserving every reducer-owned repair action.
- Added approved class-material references to spatial and non-spatial evidence surfaces and a printable `/teacher/report` built from validated case state, approved alignment, preferences, and bounded recorded events.

### Verification completed

- Focused Phase 4 verification passed 11 files and 42 tests across course-alignment contracts/services/routes/provider/setup, learning-session persistence, hint selection, deterministic reporting, and historical-authority checks.
- Tests cover unknown-ID and authority rejection, exact sample excerpts, instruction-like packet text treated as data, stale versions, unsupported file types, body limits, approval before persistence/use, raw-packet exclusion, compatibility recovery, and report non-inference boundaries.
- The user-recorded focused run of `tests/e2e/phase4-classroom.spec.ts` passed 3/3 in 9.5 seconds. A fresh documentation-checkpoint rerun also passed 3/3 in 11.1 seconds after `npm run typecheck` passed.
- The focused browser flow proved that sample review and approval launch `/play`, persist the approved profile only in the separate learning-session envelope, leave canonical case state unchanged, and expose approved class-material connections on E3, E4, E5, and E7.
- Focused Playwright also proved that the 320 x 700 world Journal/route HUD/top links fit without overlap and that all six historical-record controls keep distinct accessible names.
- Manual browser QA found no overflow on `/teacher` at desktop or 390 x 844, rendered `/teacher/report` cleanly, and confirmed the 320 x 700 world controls remain stacked and inside the viewport.
- The browser console showed no application errors. Existing Three/dependency deprecation warnings remained.

### Verification boundary and next checkpoint

- The focused teacher/classroom browser path, targeted layout QA, and full integrated no-key suite are complete.
- Fresh integrated verification passed `git diff --check`, warning-free lint, typecheck, 75 Vitest files with 509 tests, the production build, and all 19 Playwright browser tests.
- A late lint review exposed incomplete full-tuple audio invalidation. A regression test first failed when `caseId` changed during playback, then passed after the effect was bound to every scalar correlation field without depending on object identity.
- Pasted TXT/Markdown browser paths, aligned-hint browser acceptance, screen-reader-oriented checks, reduced-reading browser acceptance, cross-route accessibility equivalence, live OpenAI smoke tests, and physical Chromebook verification remain open.
- This checkpoint records completed local Phase 4 implementation and integrated no-key verification, but it does not claim live-provider, production-classroom, deployment, or final submission readiness.
- No commit, push, deployment, publication, purchase, or live paid provider call occurred.

## 2026-07-16 / 3D Gate Task 13 Guided Pursuit Repair

### Intent and decisions

- Turn the repair climax into a short playable explanation without creating a second historical state engine.
- Keep pace and steering tactile but bounded: no combat, timer, fail state, score, unrestricted riding, or exact route simulation.
- Classify every path coordinate, checkpoint, movement rate, marker, and embodiment as schematic reconstruction rather than historical evidence.
- Preserve one semantic contract across standard motion, reduced motion, and non-WebGL fallback.

### What Codex proposed and implemented

- Added scene manifest `1.1.0` with a validated six-checkpoint repair path, two parallel local-action markers, corridor bounds, placement limitations, and an explicit fictional `UNKNOWN` boundary.
- Added pure pursuit derivation and movement functions. Completed steps must form a canonical prefix; transient travel is clamped from the last completed checkpoint to the next reducer checkpoint and is never persisted.
- Added a compact React Three Fiber pursuit with keyboard and pointer controls, a paired schematic trace, source-linked checkpoint copy, and direct controls when WebGL capability is unavailable.
- Added a source-linked reduced-motion sequence driven by the same reconstruction and the same granular action and step callbacks.
- Removed the unused `review_repair_sequence` command, which could atomically complete every repair step and conflicted with the approved no-shortcut accessibility contract.
- Corrected the pursuit statement from the unsupported comparative “shorter road” to the approved source wording that Drouet and Guillaume traveled “by side roads toward Varennes.”

### Historical-integrity boundaries

- The authored checkpoint order and the two-action joint gate are `RECONSTRUCTION_ONLY`; internal progression does not claim historical necessity or sufficiency.
- Obstruction and passport inspection may be restored in either order. Their visible relationship to guarded detention remains `contributed to`.
- The controls guide a reconstruction trace rather than assigning the player's actions to Drouet, Guillaume, or a single hero.
- Exact geography, speed, distance, timing, road choice, bridge architecture, obstruction appearance, and alternate outcomes remain excluded.

### Test-driven and review checkpoints

- Initial contract tests failed on the absent manifest path, pursuit derivation, movement function, WebGL/direct components, and reduced-motion component.
- Focused integrated verification passed 9 files and 68 tests after mounting the runtime on the canonical repair page.
- Lint and typecheck passed after making capability detection hydration-safe and correcting a deliberately invalid manifest-test assignment.
- A code-quality audit identified missing renderer-failure fallback, pointer-only movement controls, retained input after focus loss, per-frame React rerenders, fixed-delay WebGL tests, checkpoint-level renderer remounts, non-persistent fallback state, eager Three.js loading, and an unresolved section label. The runtime now contains renderer errors and active context loss, preserves direct fallback across later checkpoints, keeps one Canvas mounted, supports focused Enter/Space and pointer hold controls, clears input on step change, blur, or visibility loss, keeps motion in frame-loop refs, polls actual canvas readiness, lazy-loads the spatial chunk, and exposes a valid repair-region label.
- Production Chromium coverage validates standard pursuit completion, keyboard-held movement, nonblank canvas pixels, either-order local actions, reduced motion, refresh resume, malformed out-of-order recovery, ineligible-phase guarding, active WebGL context-loss fallback, and phone-width control fit.
- An independent specification and historical-integrity review approved the implementation with no remaining compliance findings.

### Fresh integrated verification

- `git diff --check`, warning-free lint, and typecheck passed.
- Vitest passed 78 files and 524 tests.
- The production Next.js build completed and generated all student, teacher, and API routes.
- Playwright passed all 26 no-key Chromium flows, including the seven guided-pursuit scenarios.
- The production classroom proxy performance gate passed under 4x CPU slowdown and throttled network: 3.65-second interactive time, 56 FPS median, 55 FPS p10, 24.7 ms maximum post-load stall, and a nonblank canvas.

### Remaining gates

- Physical Chromebook performance, final visual assets, cross-route accessibility review, live-provider smoke testing, deployment, unfamiliar-user playtesting, screenshots, and demo production remain separate gates.
- No push, deployment, purchase, publication, or live paid provider call occurred during this checkpoint.

## 2026-07-16 / Phase 5 Grounded World And Asset Integrity Pass

### Intent and user direction

- Advance the approved hybrid spatial experience from a technical graybox to a grounded stylized late-evening reconstruction without turning travel into the main learning mechanic.
- Preserve responsive source-bound NPC dialogue, audible responses, a small number of non-agent ambient residents, the complete non-spatial route, and deterministic historical authority.
- Aim for a more credible historical-game silhouette without claiming Red Dead Redemption-level photorealism or exact reconstruction.

### What Codex proposed and implemented

- Advanced the scene manifest from `1.1.0` to `1.2.0` and changed interactable presentation to `grounded_reconstruction` while retaining low-confidence schematic placement and explicit non-evidentiary limitations.
- Replaced the blockout district with a full-bleed late-evening environment using authored gabled facades, lit windows, street lanterns, water, fog, cobbled routes, stable building colliders, and a lower follow camera.
- Replaced block figures with articulated, late-18th-century-inspired procedural silhouettes for the investigator, Drouet, Louis, civic figures, and ambient residents. Walk, toggled run, idle, talk, and interact states remain presentation-only.
- Added a small optimized CC0 set: Wooden Table 01, Wooden Barrels 01, and Cobblestone Floor 08 from Poly Haven. The shipped world contains two optimized GLBs and three optimized texture maps; raw acquisition files are excluded from `public/`.
- Added asset ledger `1.0.0`, a strict Zod contract, case/scene cross-validation, exact byte and SHA-256 checks, shipped-file closure, procedural Canvas inverse closure, repository-source existence checks, and a project-authored license verification record.
- Added local procedural fallbacks and error boundaries for every downloaded model and texture. Optional asset failure can no longer remove the 3D investigation or require retrying the historical session.
- Added muted-by-default procedural dusk ambience with an explicit icon control, hidden-tab muting, cleanup, and no evidence or progression authority.
- Removed floating zone placards that read as debug geometry; the persistent DOM HUD remains the visible schematic-reconstruction disclosure.

### Reliability corrections from testing and review

- Moved initial proximity publication outside the visual Suspense boundary so authored interaction affordances do not wait for decorative assets.
- Added proximity exit hysteresis, immediate horizontal stopping when movement keys are released, and explicit proximity clearing on unmount, retry, and fast travel. This prevents prompt detachment without retaining a previous-zone interaction.
- Limited the general browser suite to four workers because seven simultaneous WebGL worlds created unrealistic GPU contention; the separate single-world classroom proxy remains the actual performance gate.
- Disposed cloned cobblestone textures on remount and changed custom roof geometry to declarative R3F geometry so repeated fast travel does not leak those resources.
- Propagated reduced motion to stationary source figures and made the investigator's visible gait follow the controller's toggled `runActive` state.
- Replaced a copied license-page snapshot with project-authored verification metadata, added the repair runtime to procedural-asset coverage, and rejected stale graybox wording through historical-integrity tests.
- Replaced Canvas-only procedural discovery with an explicit reviewed inventory of all 17 authored environment, figure, station, fallback, repair, styling, and audio source files represented by the asset ledger.
- Grouped the sound and graphics-quality controls in one measured flow layout so longer graphics-tier labels cannot overlap the sound control at phone widths.
- Destroyed enabled ambience whenever the 3D runtime becomes unavailable and guarded both success and rejection paths by soundscape identity, so a stale asynchronous failure cannot mute or destroy audio created after retry.
- Moved ambient dramatization text out of distance-scaled world anchors into one current-district HUD caption so disclosure text cannot be projected off-screen or duplicated across residents.
- Replaced two walking tests' accidental dependency on world-anchored caption timing with an explicit visible-canvas and animation-frame readiness barrier before keyboard input.

### Independent review

- Historical-integrity and licensing re-review: `APPROVED`, with exact closure over all five shipped world files and no evidence-authority or learner-answerability regression.
- Visual acceptance re-review: acceptable for this checkpoint with no blockers at desktop, `390 x 844`, and `320 x 720`. Remaining suggestions are optional variety and facial/facade polish.
- Final code-quality re-review: `APPROVED` after regression coverage closed runtime-failure audio teardown, stale rejected-unmute ordering, exact procedural-inventory closure, and sound/quality control overlap.

### Verification

- Warning-free lint and TypeScript checks passed.
- Vitest passed 81 files and 537 tests, including deferred stale-audio rejection and runtime-failure teardown regressions.
- The production build completed and generated every student, teacher, and API route.
- The production browser suite passed all 27 no-key Chromium flows, including the real-entry walking case, mobile layouts, staged voice, repair, context-loss fallback, and a forced failure of every downloaded world asset.
- Both canvas-readiness traversal regressions passed three consecutive isolated repetitions before the final full-suite run.
- The real-entry world case also passed four concurrent repetitions after the movement/proximity correction.
- The final classroom proxy passed under 4x CPU slowdown and throttled network: 4,145,016 compressed bytes, 4,001 ms to the first canonical interaction, 34 FPS median, 32 FPS p10, 79.6 ms maximum post-load stall, and a nonblank canvas.

### Remaining gates

- Physical Chromebook performance, live-provider smoke testing, formal screen-reader and cross-route equivalence review, deployment, unfamiliar-user playtesting, final screenshots, and demo production remain open.
- The classroom proxy passes but has less frame-rate margin than the graybox; do not add more always-rendered geometry before physical-device verification.
- No commit, push, deployment, purchase, publication, or live paid provider call occurred during this checkpoint.
