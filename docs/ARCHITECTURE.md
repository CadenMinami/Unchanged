# Architecture

## Architecture Goal

Build a deterministic historical game system that uses GPT-5.6 for flexible language and reasoning support while preventing the model from controlling historical truth, game state, or assessment gates.

## Recommended Stack

- Next.js
- TypeScript
- Tailwind CSS
- OpenAI API with GPT-5.6
- server-side model calls only
- Zod validation
- structured model outputs
- authored case data in JSON
- local browser persistence
- Node.js 22.18 or newer below Node.js 23, and npm 10.5.1 or newer
- Vercel deployment target
- React Three Fiber and Three.js for the client-only spatial presentation

No live Vercel deployment, production environment/API credential validation, or live-provider smoke test has been completed. Deployment readiness remains unverified. The public no-provider `/api/health` route reports only the active case versions and a validated Vercel commit identifier when one exists; it never checks provider availability or exposes configuration.

## System Flow

```text
Browser UI
  -> typed reducer commands -> deterministic client state -> local persistence
  -> reviewed scene manifest -> fail-closed interaction adapter -> existing DOM focus overlays
  -> versioned formative request snapshot -> Next.js API route
  -> pre-consumption rate limit -> bounded JSON read -> schema and version checks
  -> station, evidence, moderation, and policy checks
  -> source-bounded policy catalog -> OpenAI Responses API
  -> strict ID-only plan -> server authorization and coherence checks
  -> server-rendered authored response -> optional exact-caption speech authorization
  -> strict public response -> advisory UI only

Teacher setup
  -> reviewed sample, pasted text, or bounded TXT/Markdown text
  -> version/case/catalog checks -> bounded JSON -> ephemeral server segments
  -> deterministic matcher or strict GPT-5.6 ID/segment plan
  -> exact-segment authorization -> pending review profile
  -> explicit teacher approval -> separate learning-session persistence
  -> authored vocabulary/hints/support variants + deterministic teacher report
```

The deterministic command path, spatial path, model path, and teacher-alignment path are intentionally separate. The spatial runtime may resolve proximity to a reviewed canonical ID, but only the interaction adapter and existing reducer can authorize effects. Model responses never enter the reducer. Character and Case Brief responses are correlated to contract, case schema, case content, policy, state, prompt, request, and revision versions, then displayed only while that request snapshot remains current. Course alignment is instead bound to course-alignment, prompt, catalog, case-content, and request versions; its output can become active only after exact-segment server authorization and explicit teacher approval.

## Active Compatibility Matrix

| Contract | Version |
|---|---|
| Case schema | `1.0.0` |
| Varennes case content | `1.0.3` |
| Case state | `1.2.0` |
| Persistence envelope | `1.2.0` |
| Reconstruction companion | `1.1.0` |
| Scene manifest | `1.3.0` |
| World asset ledger | `1.0.0` |
| Spatial session | `1.0.0` |
| Model policy | `1.0.1` |
| AI contract | `1.1.0` |
| Media contract | `1.0.0` |
| Course alignment/catalog | `1.1.0` |
| Course alignment prompt | `1.0.0` |
| Learning session | `1.0.0` |

AI `1.1.0` is the sole active browser/server contract. Character success and fallback responses require nullable speech authorization; Case Brief responses do not. Media `1.0.0` independently versions the implemented transcription and speech transforms. The routes remain presentation-only and cannot issue reducer commands.

Course alignment `1.1.0` is a separate `alignment_only` contract. It cannot carry evidence, repair, scoring, or case-state authority. Learning session `1.0.0` persists approved alignment, support preferences, and bounded observable event codes independently of deterministic case-state persistence `1.2.0`.

### World asset boundary

- Scene manifest `1.3.0` identifies interactable presentation as `grounded_reconstruction` while retaining low-confidence schematic placement and non-evidentiary status.
- Asset ledger `1.0.0` records imported CC0 files and repository-authored procedural presentation systems through a strict discriminated schema.
- Every shipped file below `public/world/` must close exactly over one ledger output with matching byte count and SHA-256. Raw acquisition files are excluded from `public/`.
- Downloaded assets require creator, source, retrieval date, original-file hashes, SPDX license ID, a locally preserved license proof, modification steps, and exact runtime outputs.
- Procedural assets use tracked repository source paths and repository-owned rights metadata. Tests require exact equality with an explicit reviewed inventory of 17 environment, figure, station, fallback, repair, styling, and audio source files; those assets cannot be mislabeled CC0.
- Drouet, Louis, the investigator, civic figures, and ambient residents currently use the shared repository-authored procedural figure path in every profile. No accepted rigged character asset is mounted, and the figures make no exact portrait or historical-likeness claim.
- The accepted 1K Poly Haven PBR plaster, stone, timber, and roof families and the Qwantani dusk HDRI are ledgered CC0 runtime assets. Their rights and technical provenance do not establish a historical facade, material, lighting condition, location, owner, or appearance in Varennes.
- Asset uses repeat the approved placement status, confidence, and location/ownership/scale/appearance limitations. All assets are permanently `countsAsHistoricalEvidence: false`.
- Visual GLBs and textures never own colliders, proximity IDs, evidence access, score, or progression. Authored primitive colliders and the reducer remain authoritative.
- Each optional downloaded model or texture is isolated behind a local error boundary with a repository-authored procedural fallback. An asset fetch failure cannot remove the world or require a retry of the historical session.
- Rich facade textures are requested only by High and Balanced profiles. Classroom chooses its low-texture procedural material before the texture-loading branch; it also omits the HDRI, point lights, contact shadows, and bloom pass.
- The optional Web Audio dusk soundscape starts muted, requires an explicit player action, and is a dramatization with no historical claim or game-state authority. Runtime failure destroys the current soundscape, and async completion is accepted only from that same live instance.

### Current world reasoning handoff

- The case reducer must enter `case_brief` before the world may open the caseboard.
- A pure handoff policy permits the overlay only from `exploring`, transitions the world to `focused`, and rejects close attempts after case authority has advanced to repair.
- The overlay renders the existing `CausalCaseboard`; it does not copy causal rules, evidence requirements, hypothesis state, or repair eligibility into the 3D runtime.
- Incomplete investigations route to the existing non-spatial case file. Repair and debrief resume their canonical routes.
- Locomotion remains disabled while the caseboard is focused.

### Current staged voice runtime

- Microphone capture starts only from an explicit push-to-talk gesture, stops at 20 seconds or 2 MB, and places the returned transcript into the editable question field.
- Provider speech starts only from the visible play control after a validated character reply is rendered and the server has minted an exact-caption authorization.
- The displayed caption remains authoritative and available when speech is unsupported or fails.
- Closing, replacing, changing, muting, or skipping a dialogue cancels active provider or browser speech.
- A student edit supersedes any in-flight transcription so late media cannot replace newer typed text.
- Provider and browser speech are presentation-only and have no reducer, evidence, scoring, or model authority.

### Media Security Contracts

- Transcription and speech are presentation-only transforms with strict schemas that cannot carry historical facts, sources, evidence, scores, reducer commands, or CaseState snapshots.
- Media correlation binds media version, case, generated station, original request UUID, and state revision. The browser rejects stale station, request, or revision data against its active interaction.
- The server is stateless with respect to the browser's globally current revision. Signed speech tickets prevent field tampering, client correlation rejects stale playback, and a 120-second expiry limits replay.
- The character service returns a validated internal result with no ticket or secret dependency. The character route alone attaches nullable authorization after it has the exact authorized caption, then validates the public response.
- Drouet and Louis use app-owned logical voice IDs. Their station mapping is private server policy and is not coupled to provider voice names.
- Speech authorization uses an exact UTF-8 caption SHA-256 and HMAC-SHA256 over byte-length-prefixed fields. Speech request parsing and verification perform no trim or Unicode normalization.
- The optional browser `SpeechSynthesis` fallback is used when provider speech is unavailable and does not consume provider audio.
- `/api/ai/transcribe` rate-limits before consuming the bounded multipart body, validates independently inspected MIME/duration/channel metadata, and uses `gpt-4o-transcribe`.
- `/api/ai/speech` rate-limits before consuming JSON, verifies the exact caption ticket, uses `gpt-4o-mini-tts` by default, and caps the binary WAV response at decimal `3,000,000` bytes (3 MB), below the 4.5 MB function payload limit.
- App-owned mutable audio buffers are cleared on success and failure. Immutable platform `File` objects are not retained and follow the platform lifecycle.

## MVP State Authority

The anonymous formative MVP uses a shared pure case reducer in the browser and versioned local persistence. The repository-owned case package defines canonical facts, IDs, evidence relationships, commands, and repair selectors.

The package has two independent versions: `schemaVersion` changes when its structure changes, while `caseVersion` changes whenever canonical content, IDs, evidence, or solution requirements change. Persisted state must match both.

`solution` is the sole runtime repair authority. `repairGates` contains human-readable, source-linked traceability records and is permanently marked `traceability_only`; the reducer and eligibility selector do not treat it as a second win-condition system. Required causal nodes, edges, comparisons, evidence groups, conditions, consequence boundaries, and uncertainty boundaries all come from `solution`.

Each historical evidence record lists:

- every dependency lineage represented by its source set
- the subset explicitly eligible as independent historical corroboration
- only verified facts and verified historical or reconstruction sources

Fiction, dramatization, class packets, and unresolved material are rejected by the package validator before reducer state exists.

This local session is not tamper-resistant. The deterministic debrief and teacher-facing local summary must be labeled as formative artifacts, not secure grade records. Authentication, roster-linked assignments, cross-device state, and authoritative grading would require a server-side event store and are explicit post-MVP work.

Teacher alignment and accessibility/reporting data use a second local envelope at `history-unbroken:varennes:learning-session`, separate from `history-unbroken:varennes:state`. The versioned learning session contains case/catalog compatibility metadata, support preferences, an optional teacher-approved alignment profile, and at most 256 typed observable event records. It contains no raw packet, student identity, model transcript, repair authority, or copied `CaseState`. A case-content mismatch invalidates the learning session without changing case-engine rules.

The server remains authoritative for OpenAI calls, course-file processing, secret handling, and model-output validation. Model output never dispatches case commands directly.

Spatial preferences use a separate versioned envelope bound to case and scene-manifest versions. The chosen spatial/non-spatial route, camera mode, last safe spawn, discovered zones, guidance, and graphics tier do not belong in `CaseState` and cannot affect educational eligibility. Route-entry and fallback links persist the chosen investigation mode before navigation.

The scene manifest is parsed with strict Zod schemas and then cross-validated against the canonical case package, model policy, reconstruction checkpoints, and ambient-line companion. Unknown evidence, fact, source, station, checkpoint, zone, or spawn IDs fail closed. A 3D object is an authored entry point to a canonical record, never a new evidence artifact.

## Core Modules

### Case Engine

Responsibilities:

- load case data
- validate fact IDs
- validate evidence IDs
- track investigation state
- track evidence discovered/presented
- track claims recorded
- manage notebook entries
- enforce hard gates
- determine repair eligibility

### Provenance Registry

Responsibilities:

- source metadata
- evidence labels
- reconstruction labels
- fiction labels
- class-packet labels
- citation drawer

### Spatial Runtime Contracts

Responsibilities:

- four approved zone IDs and globally unique safe spawns
- schematic placement labels and explicit location, ownership, scale, and appearance limits
- canonical interaction targets that resolve only to reviewed evidence, station, surface, or repair-checkpoint IDs
- pure fail-closed interaction authorization with no synthesized fallback target
- separate spatial preference persistence bound to spatial-session, case, and scene-manifest versions
- discarded spatial state after any version mismatch, removed zone, or removed spawn without touching deterministic case progress
- ambient lines that are always dramatization, non-evidentiary, and progression-neutral

The current district renders exactly four player-facing zones: archive antechamber, post-road square, royal lodging and civic area, and bridge approach. Drouet and Louis are the only rendered, proximity-eligible generated stations. The repair route uses a separately versioned manifest path whose ordered checkpoints bind to the existing reconstruction IDs; it does not add historical facts or a second repair state.

Walking discovery resolves only against the four active zone IDs and each zone's authored safe spawn. The latest safe spawn and discovered-zone set are persisted in the spatial envelope. Fast travel is available only after a valid first visit and only where the manifest declares `first_valid_visit`; it remounts the controller at the authored spawn and cannot issue a case reducer command. The same authorization permits returning to the current district's safe point after discovery, which provides navigation recovery without bypassing first-visit travel.

The route journal is a semantic DOM dialog over the world. It displays a schematic, not-to-scale navigation diagram rather than historical geography or chronology. Its E6A/E6B/E6C anomaly candidates and FO1/FO2/FO3 branch observations have equal presentation weight and can be inspected only through the existing deterministic reducer. The journal has no model call path. Off, subtle, and guided objective settings are player-selected and persist only in the spatial envelope.

Static civic and Assembly stations are fixed dossiers with no free-form model input. E5 and E7 become inspected only after an explicit player action. The Assembly copy identifies its position as situated political interpretation rather than national consensus. Anonymous ambient residents use deterministic placements and captions, and every caption is labeled as authored dramatization rather than testimony or evidence.

### Guided Pursuit Repair

The standard-motion repair renders a compact third-person pursuit trace on `/play/repair`. W/Up advances, S/Down eases back, A/D or Left/Right steers inside the authored corridor, and Shift changes presentation pace. The runtime clamps movement between the last completed reducer checkpoint and the next available checkpoint. Movement speed, steering, spacing, checkpoint positions, local-action markers, camera behavior, and the paired embodiment are all `RECONSTRUCTION_ONLY`, explicitly not to scale, and never become evidence, scoring input, or persisted case state.

At a reached checkpoint the runtime may request only `complete_repair_step`. At the parallel local-response checkpoint it may instead request either `complete_repair_action` first; the reducer requires both actions before accepting the joint step and the later guarded-detention step. The old atomic `review_repair_sequence` command has been removed, so standard, reduced-motion, and direct non-WebGL routes share the same granular reducer commands. Visible links into detention remain `contributed_to`, with the limitation that the records do not prove either local action or their pair as necessary or sufficient.

Refresh resumes at the last completed reducer checkpoint rather than persisting transient path position. The counterfactual branch ends at the manifest-owned `UNKNOWN` boundary after the carriage passes Varennes. Reduced motion replaces the canvas with a source-linked stepped DOM sequence; a failed WebGL capability check, renderer error, or active context loss exposes direct controls for the same current step and actions. Graphics-failure state lives above checkpoint-local motion state, so direct fallback persists for the remainder of the repair. The Canvas stays mounted while motion refs reset between checkpoints, avoiding repeated renderer and graphics-context creation. Held input is cleared on step changes, blur, visibility loss, renderer failure, and unmount.

The repair shell loads the standard-motion pursuit through a client-only `next/dynamic` boundary. An initially reduced-motion session therefore keeps the Three.js/R3F runtime outside its executed path; the deterministic DOM sequence, case state, and completion authority do not depend on the spatial chunk.

### Spatial Presentation Resilience

The world shell performs one cached browser WebGL capability check before mounting the renderer and rechecks only when the player explicitly retries. It contains runtime failures in a local React error boundary. Capability failure, render failure, or active WebGL context loss always leaves a retry action and a direct link to the complete non-spatial route. The context-loss listener is removed before an intentional renderer replacement, so safe-spawn travel is not misclassified as a graphics failure. Case progress is outside the canvas boundary and is never cleared by a graphics retry. Invalid persisted spatial data is replaced with the recovered authored-safe session on mount instead of being discarded again on every reload.

The renderer has `high`, `balanced`, and `classroom` presentation profiles. Profiles may change DPR, shadow-map budget, fog distance, post-processing permission, ambient-population limit, texture tier, character-detail policy, environment density, contact shadows, and restrained bloom/multisampling only. High and Balanced own the optional PBR/HDRI, lantern, shadow, contact-shadow, and bloom budgets; Classroom uses the procedural low-texture/no-HDRI/no-effects branch. Profiles may not change canonical IDs, interaction distance, readable content, evidence availability, repair gates, or assessment behavior.

`ZoneReadinessRegistry` separately aggregates each of the four zones' resolved asset state (`loaded` or `fallback`) and canonical-interaction readiness. `WorldShell` exposes the aggregate only as stable runtime diagnostics for performance and fallback verification; it cannot advance case state or make a visual asset authoritative.

A pure rolling monitor receives timestamped FPS samples outside React render. Sustained averages below 28 FPS for three seconds step down one tier. At `classroom`, a sustained average below 24 FPS for five seconds displays a voluntary non-spatial-route offer. The runtime supports `NEXT_PUBLIC_WORLD_TEST_MODE=1`; the frozen canvas E2E path opts in through a session-scoped test flag so movement tests can exercise the normal frame loop from the same production build.

All Playwright routes use a dedicated `127.0.0.1:3100` production server, never reuse a running development server, and leave the user-facing `localhost:3000` route independent. The Phase 1 automated performance gate additionally disables retries and browser cache. A Chromium CDP profile sets 1366 x 768, four logical processors, 4x CPU slowdown, the `classroom` graphics tier, and Chromium DevTools' effective Fast 4G throughput and latency values. The test measures navigation start through a successful canonical E3 overlay open for interactivity, sums same-origin `Network.loadingFinished.encodedDataLength` values for compressed transfer, verifies nonblank canvas pixels, warms the scene for ten seconds, then records 60 one-second frame buckets from the renderer's R3F `useFrame` callback while a scripted movement loop runs. It also requires measured investigator displacement and a healthy nonblank canvas after the sample. The gate fails above 15,000,000 bytes, above 8,000 ms to interaction, below 30 median FPS, below 24 10th-percentile FPS, or above a 250 ms renderer-frame stall.

The automated proxy is a regression gate, not evidence of physical-device performance. A current ChromeOS browser on a 4 GB integrated-graphics Chromebook in the N4500 class or a documented equivalent must still pass before the spatial route can become the default classroom mode.

Earlier failed and passing proxy runs remain chronological records in the build log. The latest 2026-07-20 single-worker Chromium Classroom-proxy rerun passes the archive and warm-traversal transfer, interaction, nonblank-canvas, movement, median-FPS, p10-FPS, and renderer-stall thresholds. This is an automated browser-proxy result, not a Chromebook measurement, and cannot close the physical-device gate. Portrait browser coverage separately requires a nonblank 390 x 844 canvas and non-overlapping top controls.

### Movement And Focus Authority

The spatial client uses a pure finite state machine with `exploring`, `focused`, `cinematic`, `repair`, and `suspended` modes. Locomotion and world pointer capture are permitted only in `exploring`. Visibility loss suspends the prior mode and visibility restoration returns to that exact mode; illegal transitions return a typed rejection without mutation.

Ecctrl owns only the investigator capsule and movement physics. Drei keyboard state is explicitly bridged into `EcctrlHandle.setMovement`; every movement boolean is set false and horizontal velocity is cleared when exploration stops. Rapier fixed colliders represent only schematic navigation boundaries. The controller starts from the manifest's validated safe spawn, never an arbitrary persisted physics transform.

`CameraInputBoundary` is the sole owner of browser pointer lock. It detects support, requests capture only while the world is eligible, derives acknowledged state from `document.pointerLockElement` and `pointerlockchange`, clears look input on loss, and exits an owned lock on blur, document hiding, canvas replacement, route teardown, or unmount. `ThirdPersonCameraRig` owns yaw, pitch, zoom, shoulder composition, collision distance, and damping, but never reads or changes pointer-lock state. Unsupported or denied pointer lock leaves keyboard traversal available and uses hold-right-mouse drag for look; context-menu suppression lasts only for an active drag that began on the world canvas.

Accepted overlays and route transitions use a release-before-commit handshake. `WorldShell` first records the pending action, disables locomotion, clears held movement, and stops horizontal velocity. It then asks `CameraInputBoundary` to release the cursor. Only an acknowledged release may commit an evidence interaction, change `WorldMode`, advance the case phase declared by `data-world-phase-after-release`, navigate, mount an overlay, or move DOM focus. The boundary waits up to 1,000 ms to observe unlock; `WorldShell` waits up to 1,500 ms for that acknowledgement. A still-active lock fails the action and leaves a retry surface. Closing an overlay returns to exploration with the cursor free and focus on its invoker. Blur or document hiding suspends the prior mode, and restoration requires both visible document state and window focus; cleared movement and pointer capture never resume without fresh input.

Ecctrl 2.0 consumes the active React Three Fiber camera as its native horizontal movement basis. The controller sends raw W/S/A/D flags with `useCustomForward={false}`; no world-space pre-rotation or second locomotion transform is applied. Camera pitch is projected out by Ecctrl, preserving horizontal speed and diagonal normalization. Standard motion damps follow-camera movement and collision recovery, while reduced motion uses immediate camera updates.

Camera settings are progression-neutral browser preferences stored in the strict versioned envelope `history-unbroken:world-camera-preferences` version `1.0.0`. The envelope owns bounded sensitivity, invert-Y, and `pointerLockIntroduced`; the onboarding flag is persisted only after acknowledged capture. It is separate from case and spatial-session authority.

Automated camera, collision, fallback, focus, performance, provenance, and fixed-position historical-integrity coverage does not close external release gates. Physical verification on the specified Chromebook class and human historical-expert review remain required before calling the spatial route classroom-ready; schematic world placement must not be represented as verified historical geography.

### Physical Evidence Entry Points

Proximity selection considers only manifest-authored candidates, rejects ineligible or out-of-radius candidates, selects one nearest target, and uses the stable interactable ID for equal-distance ties. The selected request must still pass the fail-closed manifest interaction policy.

After authorization, the interaction adapter may dispatch an existing case command. `CaseSessionProvider.issue` uses a current-state ref and returns the exact synchronous `ReducerResult`, so successive commands consume successive revisions and a world caller never infers success from a future React render. The provider remains the sole client educational state owner.

The 3D object opens a semantic React DOM overlay containing the canonical evidence record, provenance, citation, and source limitation. The object itself never enters inspected IDs, pinned evidence, source lineage, or scoring. Focus mode stops locomotion, the overlay receives focus, Escape/close exits, and focus returns to the invoking world control.

### Character System

Responsibilities:

- generated station policies for Drouet and Louis only
- static Varennes civic and Assembly reaction dossiers
- station-specific fact, source, evidence, and authored-unit allowlists
- explicit unknowns and response boundaries
- evidence reactions with required presented-evidence IDs
- ID-only model plans and server-rendered authored prose
- station-specific safety refusals and no-key/provider fallbacks
- model call assembly, correlation, authorization, and stale-response rejection

Drouet's generated station may use FO1 as a fixed fictional-branch perspective and may react to E3, E4, or E5 only after the matching record is presented. Louis's generated station is limited to E1 and S1. E2, S8, and S9 remain deterministic archive content and are not available to Louis's model policy. Generated dialogue has an empty recordable-claim allowlist and never becomes evidence.

### Evidence System

Responsibilities:

- evidence archive
- evidence inspector
- comparison lab
- source metadata
- simplified/original versions
- glossary hooks
- evidence-to-claim links

### Causal Board

Responsibilities:

- node categories
- evidence pins
- relationship labels
- supported/unsupported/contested states
- deterministic solution checks

### Hypothesis System

Responsibilities:

- free-form student submission
- pinned evidence
- selected altered link
- selected conditions
- selected consequence
- rejected alternative
- deterministic hard gates
- deterministic repair eligibility
- GPT-5.6 classification of exact student spans, evidence fit, concerns, and rubric bands for formative feedback only
- provenance-, dependency-lineage-, and independent-source-lineage context in the feedback prompt
- server coherence checks for pinned evidence, source independence, score/template fit, and contradictory claims
- no-score deterministic fallback feedback

### Teacher Alignment

Responsibilities:

- selection of two or three IDs from the three authored objectives
- reviewed sample, pasted text, and UTF-8 TXT/Markdown inputs only
- client bounds of 40,000 pasted characters or 64 KB per text file
- server rate limiting before a 96,000-byte bounded JSON read
- case, catalog, contract, prompt, request, source-type, and size validation
- ephemeral segmentation into at most 64 segments of at most 800 characters
- deterministic exact-term matching when no model is available or model output is invalid
- strict GPT-5.6 output over reviewed IDs, existing segment IDs, exact terms, and bounded enums only
- server authorization of every segment reference, term, excerpt, conflict, injection flag, and limitation
- pending-review display and explicit teacher approval before persistence or student-facing use
- packet-aware authored hints, evidence class-material references, objectives, and reporting
- raw-packet non-retention

PDF and DOCX are intentionally rejected by the public request schema. The secure first phase has no hardened binary-document extraction/OCR subsystem with page, embedded-object, decompression, external-reference, malformed-container, and temporary-artifact limits. Accepting only directly inspectable bounded UTF-8 text keeps the request and retained excerpts auditable.

Exact server-authorized segments are a security and provenance requirement. The model can identify a reviewed concept and a server-created segment ID, but it cannot supply an authoritative excerpt. The server resolves that ID against its ephemeral segment map, requires the proposed packet term to be an exact case-sensitive substring, derives the short excerpt/reference, and drops any unresolved mapping. Because raw packet text is not retained, these authorized excerpts and the packet digest are the durable trace back to what the teacher reviewed.

### Learning Supports And Reporting

Responsibilities:

- four-tier route-finding hint selection from deterministic `CaseState`
- authored standard and reduced text for every hint
- optional approved packet-term prefix; no generated hint prose
- persistent standard/reduced reading, standard/reduced motion, and guided/challenge preferences
- first-load reduced-motion default from `prefers-reduced-motion` when no compatible learning session exists
- reduced-reading variants for the primer, character dialogue, Case Brief feedback, hints, and evidence descriptions
- global animation/transition suppression, zero ambient residents, direct follow camera, and static repair context in reduced-motion mode
- unchanged ordered repair commands, evidence access, scoring, and solution requirements in every support mode
- deterministic teacher-report assembly from final validated case state, approved alignment, preferences, and typed observable events
- printable formative UI with explicit teacher-review and non-inference boundaries

### Safety

Responsibilities:

- global response security headers, including a restrictive CSP with intentional `wasm-unsafe-eval` and same-document `blob:` fetch support for the WebAssembly and GLTF-dependent spatial runtime
- Node.js runtime and a 40-second maximum duration on every `/api/ai/*` route, leaving headroom beyond the bounded provider retry envelope
- `omni-moderation-latest` checks with a 10-second timeout before generation when a provider key is configured
- authored no-fact safety refusals and no-score safety feedback
- bounded request schemas: 600-character character questions and 2,400-character Case Briefs
- pre-consumption JSON body limits: 8,192 bytes for character turns and 32,768 bytes for Case Brief feedback
- HTTP 413 plus `Cache-Control: no-store` for declared or streamed oversize requests before provider or moderation work
- per-endpoint in-memory rate limiting at 20 requests per 60 seconds per forwarded client key
- browser-to-provider cancellation with `AbortSignal`
- one explicit retry for transient provider failures; OpenAI SDK retries disabled
- ten-second provider timeout, `store: false`, and typed failure classification
- minor-safety defaults, honest API fallback, and privacy rules

## Data Structure

Current case and model-policy structure:

```text
data/cases/varennes/
  case.json
  facts.json
  interpretations.json
  characters.json
  evidence.json
  branch-observations.json
  causal-graph.json
  course-alignment.json
  hints.json
  rubric.json
  sources.json
  model-policy.json
```

Each canonical item should have a stable ID.

Example ID families:

- `fact.*`
- `source.*`
- `evidence.*`
- `branch-observation.*`
- `claim.*`
- `character.*`
- `condition.*`
- `mechanism.*`
- `consequence.*`
- `hint.*`

## Deterministic Responsibilities

The application controls:

- canonical chronology
- verified facts
- evidence items
- provenance labels
- fictional alteration
- fixed fictional branch observations, which may identify the authored branch mechanism but never count as historical evidence
- character knowledge boundaries
- unlocked evidence
- claim recording
- caseboard node validity
- required solution components
- prohibited misconceptions
- hint availability
- repair eligibility
- final reconstruction
- report telemetry

## GPT-5.6 Responsibilities

Implemented GPT-5.6 responsibilities:

- select authored character claim, evidence-reaction, follow-up, or refusal unit IDs
- classify exact spans from the student's Case Brief against pinned evidence
- select authored summary, rubric-reason, issue, and revision-template IDs
- recommend non-authoritative rubric scores subject to lineage and coherence validation
- select reviewed alignment objective/concept/boundary/injection/limitation IDs and existing packet segment IDs
- copy an exact packet term from the named segment for later server authorization

The model does not generate visible historical sentences, hint prose, report narration, or packet excerpts. The server renders selected policy units after authorization, derives short class-material excerpts from exact server segments, and builds the teacher report deterministically. Hint adaptation is authored selection plus an optional approved packet term, not a model call.

## Teacher Packet Pipeline

Status: implemented for the secure text-first phase.

1. Teacher chooses the reviewed sample, pastes up to 40,000 characters, or selects a UTF-8 TXT/Markdown file up to 64 KB.
2. The browser reads text files as UTF-8 and sends versioned JSON; no uploaded binary document or server temporary file path is created.
3. The route rate-limits before consuming the body, rejects incompatible case/catalog/contract versions, streams through a 96,000-byte cap, and clears app-owned mutable request buffers.
4. The server normalizes and splits the transient text into numbered bounded segments.
5. The reviewed sample bypasses the model. Arbitrary text uses GPT-5.6 when configured and deterministic exact-term matching otherwise; provider or validation failure also falls back deterministically.
6. Model output is a strict plan of reviewed IDs, segment IDs, exact packet terms, and enums. Packet text is untrusted data, including instruction-like content.
7. The server authorizes the plan against its exact segment map and closed catalog, derives short excerpts/reference labels, marks conflicts and ignored instructions, and emits a `pending_teacher_review` profile.
8. The teacher reviews and explicitly approves or clears the profile. Only `teacher_approved` profiles are persisted and used.
9. The learning-session envelope stores approved references and a packet digest, not the raw pasted text or file.

PDF and DOCX remain unsupported until a separate hardened extraction/OCR design defines file-signature validation, page/object/decompression limits, external-resource handling, malformed-document behavior, temporary-artifact cleanup, and test coverage.

Packet profile can include:

- glossary entries
- relevant passages
- objective mappings
- reading profile
- possible conflicts
- injection flags
- limitations

Packet profile cannot:

- create facts
- modify evidence
- change solution
- change character knowledge
- define correctness

## Security and Prompt Injection

Controls:

- uploaded materials are untrusted
- course-alignment request bodies are byte-bounded and rate-limited before parsing
- public course-file types are restricted to UTF-8 TXT and Markdown; PDF/DOCX fail schema validation
- alignment model output can name only reviewed catalog IDs and existing server-created segment IDs
- packet terms must be exact case-sensitive substrings; the server, not the model, derives retained excerpts
- instruction-like and authority-escalation text is recorded as ignored class data
- only teacher-approved profiles can affect support and reporting
- raw packet text and files are not persisted
- student messages are untrusted
- raw conversation is not trusted as state
- model receives whitelisted facts
- model outputs only authored unit/template IDs and exact spans copied from submitted student text
- unknown IDs invalidate output
- claim and evidence-reaction prerequisites are checked against the evidence actually presented
- feedback evidence links and concerns are checked against the committed pinned-evidence snapshot
- feedback receives source type, provenance, dependency lineage, independent lineage, source limitations, and deterministic gate context
- strong corroboration requires at least two independently eligible historical lineages among evidence actually linked to the student's claims; unrelated pinned evidence does not count
- character prompts omit full solution
- no open-web calls during gameplay
- no model-generated evidence
- no model-generated win condition

## Privacy

MVP privacy defaults:

- anonymous session
- no student account
- no names or emails
- no demographics
- no student note upload
- separate local case-state and learning-session persistence only unless explicitly changed
- no cross-session memory
- teacher report export controlled by teacher
- no raw teacher packet persistence; only a digest and short approved references survive processing

## API Failure Fallback

The case must complete if model calls fail.

Implemented fallbacks:

- source-bounded authored character turns selected only when their evidence prerequisites fit the current request
- deterministic hint library
- reviewed sample alignment with no model call
- deterministic exact-term alignment for supported teacher text when the key is absent or model output fails
- no-score Case Brief feedback that preserves the student's text and deterministic status
- deterministic repair eligibility independent of model availability
- deterministic report

Failure handling:

- preserve player text
- retry one transient provider failure while disabling SDK-level retries
- classify timeout, rate limit, connection, abort, invalid output, and non-transient provider failures
- cancel superseded or unmounted requests through the provider call
- show an explicit authored-fallback or unavailable state
- never strand player on a blank screen

The current limiter is process-local and intended for the hackathon MVP, not a distributed production abuse-control system. Production still requires durable edge/WAF/BotID protection or an equivalent distributed control before provider credentials are enabled. The complete no-key browser path has been exercised. A dedicated opt-in live Playwright configuration covers transcription, an E3-bounded Drouet turn, and exact-caption WAV generation with parsed audio metadata. Ordinary and screenshot Playwright build and runtime environments explicitly blank `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_SPEECH_MODEL`, and `SPEECH_AUTHORIZATION_SECRET`. The live launcher validates the opt-in/key without logging them, runs the production build with those four values explicitly blanked so Next.js cannot reload them from local environment files, then starts the runtime with the live key, pinned `gpt-5.6` and `gpt-4o-mini-tts`, and a fresh ephemeral secret of at least 32 bytes. The smoke has not been executed because no live key is configured. A separate deployed-origin Playwright configuration requires an immutable HTTPS URL, starts no local server, blocks every `/api/ai/*` request, checks `/api/health`, and exercises the deterministic fallback path plus spatial E3 evidence.

## Testing Strategy

Unit tests:

- reducer transitions
- evidence unlocks
- hard gates
- character authorization
- provenance labels
- hint selection
- packet boundaries
- learning-session compatibility and raw-packet exclusion
- deterministic teacher-report construction

Historical integrity tests:

- facts have source IDs
- evidence has provenance
- fiction is labeled
- reconstructions are not primary sources
- characters cannot use forbidden facts
- no consequence edge says "inevitable"

Model eval tests:

- direct answer requests
- out-of-bound questions
- prompt injections
- evidence reactions without the required presented record
- Louis's private-motive and E1-only boundary
- invented student quotations
- strong corroboration claimed from one lineage
- contradictory statuses without contradictory evidence
- incoherent high-confidence feedback
- unauthorized IDs and attempted solution leakage

Safety and operational tests additionally cover moderation mapping, bounded schemas, cancellation propagation, retry counts, provider-error classification, rate limiting, stale-response coordination, and authored fallbacks.

Release-boundary tests additionally cover the 8,192-byte character-turn and 32,768-byte Case Brief JSON limits, rate-limit-before-read ordering, no-store 413 responses, and credential isolation between ordinary, screenshot, and opt-in live Playwright configurations. The isolated live provider flow remains an unexecuted release gate until a local key is explicitly supplied.

End-to-end tests:

- clean path
- alternate character order
- early wrong hypothesis then revision
- reduced-reading mode
- teacher packet alignment
- API failure fallback
- refresh/resume
- keyboard-only path

Current evidence includes focused unit, integration, and historical-integrity coverage for schema closure, exact segment/term authorization, sample and no-key processing, instruction-like text, unsupported types and body limits, teacher approval, separate persistence, authored hint selection, deterministic reporting, controller readiness, response security policy, and deployment boundaries. The latest verified local baseline passes 111 Vitest files with 910 tests, typecheck, warning-free lint, the production build, all 53 ordinary production Playwright tests, the constrained Classroom proxy, and high/balanced/classroom capture coverage. Automated axe-core, cross-route state and keyboard equivalence, complete keyboard-only case, valid TXT/Markdown upload, aligned-hint, CSP texture-loading, and malicious/oversize teacher-packet gates pass. Formal screen-reader testing, live-provider execution, physical Chromebook verification, deployment, and unfamiliar-user testing remain outstanding.
