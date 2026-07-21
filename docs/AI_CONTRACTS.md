# AI Contracts

## Purpose

This document records the implemented authority boundary for GPT-5.6 in History Unbroken. The model interprets student language and selects from authored policy units. It does not define historical truth, write visible historical prose, mutate game state, or affect repair eligibility.

No model output, rubric score, feedback status, or extracted span can unlock, block, delay, or revoke the repair.

## Implementation Status

| Contract | Status | Runtime authority |
|---|---|---|
| Character turn | Implemented for Drouet and Louis | Formative only |
| Case Brief feedback | Implemented | Formative only |
| Browser speech rendering | Implemented as an explicit local fallback | Presentation only |
| Contract F: player transcription | Implemented with bounded recorder, route, provider adapter, and editable transcript | Presentation only |
| Contract G: authorized speech | Implemented with exact-caption route, provider adapter, and browser fallback | Presentation only |
| Contract C: course packet alignment | Implemented for sample, pasted text, and TXT/Markdown | Alignment only |
| Contract D: hint adaptation | Implemented as deterministic selection from authored hints | Presentation/support only |
| Contract E: teacher report | Implemented deterministically; no narration model | Formative reporting only |

The Varennes civic station and Assembly reaction station are static dossiers. They do not call GPT-5.6.

Current binding: AI contract `1.1.0`, media contract `1.0.0`, course alignment/catalog `1.1.0`, course-alignment prompt `1.0.0`, learning session `1.0.0`, model policy `1.0.1`, case schema `1.0.0`, case content `1.0.3`, and state `1.2.0`. AI `1.1.0` is the only accepted active character/Case Brief version; `1.0.0` requests receive a classified HTTP 409 before provider invocation. Character success and fallback envelopes require top-level `speechAuthorization`, which is `null` without a usable server secret and signed when one is available. Case Brief responses do not carry speech authorization. Course alignment is independently versioned and rejects stale case or catalog versions before processing packet content.

### Browser Speech Exception

The implemented browser speech fallback is outside model authority and must satisfy all of these rules:

- playback is explicitly player-initiated and never automatic
- the spoken input is exactly `turn.spokenResponse`; it is not rewritten or regenerated
- the visible caption remains authoritative and available throughout playback or failure
- the UI states that the sound is synthetic and is not the historical person's voice
- the adapter requests no historical-person imitation, accent performance, or identity claim
- active speech is cancelled when the station, case revision, response text, or mounted dialogue changes
- speech state is not persisted and cannot issue case commands
- unsupported browsers and playback errors preserve the complete text path

The browser adapter remains a deterministic fallback for Contract G and may ignore the authorization field. Provider-generated audio uses the implemented Task 12 route, provider service, cleanup, rate limiting, and explicit playback controls.

## Global Rules

Every implemented model request:

- runs from a Next.js server route
- uses a strict Zod-backed Structured Output
- treats user-supplied text as untrusted data
- uses bounded input schemas and sends only the reviewed catalog/policy context needed for the task
- sets `store: false`
- returns IDs, enums, and exact copied spans/terms rather than visible historical prose
- is authorized against repository-owned policy or catalog data after generation
- fails closed to an honest authored or deterministic fallback
- cannot issue a reducer command or change historical, scoring, or repair authority

Character and Case Brief requests additionally carry the full AI correlation tuple, moderate student text before generation when `OPENAI_API_KEY` is configured, propagate request cancellation, and perform at most one explicit retry after a classified transient failure. Course alignment instead carries course-alignment, prompt, catalog, case-content, and request versions; any provider or output failure falls back to deterministic exact-term matching without a retry. The OpenAI SDK disables provider retries, and the provider timeout is ten seconds.

## Character And Case Brief Request Correlation

Implemented requests and responses include:

- `contractVersion`
- `caseId`
- `caseSchemaVersion`
- `caseVersion`
- `policyVersion`
- `stateVersion`
- `requestId`
- `stateRevision`
- `promptVersion`

The browser displays a response only when its correlation metadata still matches the active request snapshot. Editing a question or evidence selection, switching stations, changing case state, or unmounting the component invalidates and aborts the previous request.

## Contract A: Character Turn

### Authorized Stations

| Station | Mode | Allowed historical evidence | Boundary |
|---|---|---|---|
| `CHAR-DROUET` | Generated dialogue | E3, E4, E5 | FO1 fictional-branch perspective plus attributed reactions to records the student presents |
| `CHAR-LOUIS` | Generated dialogue | E1 only | Louis's public position in the declaration; complete private motive remains unknown |
| `STATION-VARENNES-CIVIC` | Static dossier | E5 | No generated Sauce roleplay |
| `STATION-ASSEMBLY` | Static dossier | E7 | No generated Barnave dialogue |

Louis may not receive or discuss E2 through the generated station. S8 and S9 remain deterministic preparation records in E2, not part of Louis's model context.

### Input

- correlated request metadata
- station ID, restricted to Drouet or Louis
- player message, trimmed and limited to 600 characters
- inspected evidence IDs, unique and limited to eight
- presented evidence IDs, unique, limited to two, and required to be inspected
- reading mode

The service additionally rejects evidence outside the selected station's authored allowlist.

### Model Plan

GPT-5.6 returns only:

- `claimUnitIds`
- `evidenceReactionUnitId`
- `followUpQuestionUnitId`
- `refusalUnitId`

It returns no `spokenResponse`, historical sentence, fact ID, source ID, or recordable claim. At least one audible authored claim, reaction, or refusal unit is required. A refusal cannot be combined with claims or an evidence reaction.

### Server Authorization And Rendering

The server:

1. Loads the generated station policy.
2. Filters the prompt catalog to units whose evidence prerequisites are currently satisfied.
3. Validates every selected ID against that station's exact allowlists.
4. Rechecks `requiresPresentedEvidenceIds` for both claims and evidence reactions.
5. Rejects empty, mixed-refusal, unknown, or out-of-bound plans.
6. Renders visible text from authored standard or reduced-reading policy units.
7. Derives fact, source, evidence, epistemic, and rendered-unit metadata from those authored units.
8. Returns a validated internal result with no speech authorization or secret dependency.

The character route is the separate public trust boundary. After the service returns an authorized model or authored fallback caption, the route optionally signs that exact caption and validates the public response envelope. No other application path mints speech authorization.

Generated dialogue cannot be pinned, scored, or promoted to historical evidence. Every station's `recordableClaimIds` allowlist is empty in the MVP.

### Moderation And Safety Fallback

When the moderation gateway flags a message, generation is not called. The server renders the station's authored no-fact safety refusal and returns:

- no claim IDs
- no fact IDs
- no source IDs
- no evidence references
- `epistemicStatus: "refused"`
- `reason: "unsafe_input"`

If moderation itself fails, the request fails closed to the ordinary authored provider fallback.

## Contract B: Case Brief Feedback

### Input

- correlated request metadata
- a validated submitted CaseState snapshot
- the student's Case Brief, limited to 2,400 characters
- pinned evidence and selected board state
- deterministic repair eligibility and missing-gate IDs
- the fixed formative rubric

For each pinned evidence item, the prompt includes only reviewed case-package metadata:

- evidence ID, title, excerpt, and description
- source type and provenance
- fact IDs
- dependency lineage IDs
- independently eligible historical source lineage IDs
- source ID, type, lineage, eligibility, verification status, and limitation

The model receives deterministic gate results as context, not as authority it may alter.

### Model Plan

GPT-5.6 returns:

- a formative status
- a summary template ID
- evidence-to-claim links using pinned evidence IDs and exact spans copied from the student's argument
- concern spans with authored issue-template IDs
- five 0-4 rubric recommendations
- one authored rubric-reason ID per criterion
- a revision-prompt ID

The model does not write the summary, concern explanation, rubric reason, or revision prompt displayed to the student. The server renders those from authored feedback units.

### Server Authorization And Coherence

The server rejects feedback when:

- a template, evidence, or issue ID is not authorized
- a quoted student span does not appear in the submitted argument
- a link or concern cites evidence that was not pinned
- a rubric-reason template does not match its criterion and score band
- corroboration is rated strong with fewer than two independent historical lineages among the non-`unclear` evidence-to-claim links; unrelated pinned evidence does not count
- evidence-fit or corroboration scores exceed the allowed floor without an evidence-to-claim link
- `contradicted_by_record` has no contradictory evidence link
- a contradicted, under-evidenced, or supported-incomplete status carries rubric scores that deny the weakness named by that status
- `well_supported` conflicts with concerns, weak rubric scores, too few linked records, or too few independent lineages

Authorized results are advisory. Deterministic repair eligibility is computed separately from `solution` and remains visible even when feedback fails.

### Feedback Fallback

Missing keys, moderation flags, provider errors, timeouts, rate limits, aborts, invalid structured output, or failed authorization produce a no-score fallback. The student's Case Brief remains stored in the local case state, and repair eligibility does not change.

## Operational Boundary

### Input Bounds

- Character message: 600 characters
- Inspected evidence IDs: at most 8
- Presented evidence IDs: at most 2
- Case Brief argument: 2,400 characters
- Character-turn JSON body: 8,192 bytes while streaming
- Case Brief feedback JSON body: 32,768 bytes while streaming
- Pasted course text: 40,000 characters
- TXT/Markdown file: 64 KB at the teacher UI and 64,000 decoded characters at the strict request schema
- Course-alignment JSON body: 96,000 bytes while streaming
- Course packet segmentation: at most 64 server-created segments of at most 800 characters each

The UI and server enforce complementary character and byte bounds; the server independently validates the strict decoded request shape. Character-turn and Case Brief routes apply rate limiting before body consumption, provider-gateway resolution, or moderation. Declared or streamed bodies above their route limit fail with HTTP 413 and `Cache-Control: no-store` before any provider call.

### Rate Limiting

Each AI endpoint uses an in-memory sliding window of 20 requests per 60 seconds per forwarded client key. A rejected request returns HTTP 429 and `Retry-After: 60`.

This is hackathon-level process-local protection. A multi-instance or production classroom deployment needs a shared limiter and stronger client identity.

### Failure Classification

The Character and Case Brief services distinguish:

- missing API key
- timeout
- aborted request
- unsafe input
- invalid structured output
- unauthorized output
- rate limit
- provider error

Only timeout, connection, 408, 429, and 5xx-style failures are treated as transient. Non-transient 4xx errors and aborts are not retried.

Course alignment exposes only invalid request, payload-too-large, stale-version, and route-rate-limit errors. A missing key, provider failure, or invalid alignment plan is converted to the deterministic exact-term profile inside the service rather than exposed as a model failure.

## Contract C: Course Packet Alignment

Contract C is implemented for the reviewed sample, pasted text, and UTF-8 TXT/Markdown files. It is an alignment transform, not a historical-content or assessment transform.

### Supported Input And Retention

The public request accepts exactly:

- `{ kind: "sample" }`
- titled pasted text up to 40,000 characters
- titled `.txt` or `.md` content with MIME `text/plain` or `text/markdown`, originating from a file no larger than 64 KB

PDF and DOCX are intentionally unsupported in the secure first phase. The application does not yet provide hardened binary extraction/OCR with file-signature validation, page and embedded-object limits, decompression bounds, external-resource handling, malformed-container behavior, and temporary-artifact cleanup. The public schema therefore rejects those types rather than pretending to parse them safely.

The route rate-limits before body consumption, requires `application/json`, rejects a declared or streamed body above 96,000 bytes, validates course-alignment/prompt/catalog/case/request versions, and clears app-owned mutable body buffers. Text is processed transiently. The application persists no raw pasted text or uploaded file. An approved profile retains only a SHA-256 packet digest, reviewed IDs, exact short terms/excerpts, references, limitations, and approval metadata.

### Model Plan

For arbitrary supported text, the server creates sequential `SEG-####` records of at most 800 characters and supplies only those bounded segments plus the closed alignment catalog. GPT-5.6 may return:

- authored objective IDs paired with existing segment IDs
- authored concept IDs paired with an existing segment ID, an exact case-sensitive `packetTerm`, and a bounded confidence enum
- authored historical-boundary IDs and injection-kind enums paired with existing segment IDs
- a bounded reading-support enum and authored limitation IDs

The plan cannot contain facts, evidence IDs, source IDs, character knowledge, historical explanations, hint prose, scores, repair requirements, win conditions, or case state. Unknown properties or IDs fail strict schema validation.

### Exact-Segment Server Authorization

Exact server-authorized segments are mandatory. The server resolves every proposed segment ID against the transient segment map and verifies that `packetTerm` is an exact substring of that segment. It derives the retained excerpt and reference label itself and drops unresolved mappings. This prevents a model from fabricating packet quotations, citing text outside the bounded request, or converting packet instructions into authority. Because the raw packet is not retained, the exact short authorized excerpt plus segment/reference metadata is the auditable content the teacher approves.

The resulting profile is always `authority: "alignment_only"`, `mutatesCaseState: false`, and `reviewStatus: "pending_teacher_review"`. The teacher must inspect mappings, conflicts, instruction-like text marked `ignored_as_data`, and limitations before the application can persist a `teacher_approved` profile. A reviewed sample requires no model; a missing key or provider/validation failure uses deterministic exact-term matching.

Teacher material may align terminology, selected objectives, authored hint prefixes, class-material references, support preferences, and report emphasis. It may not add facts, change evidence, expand character knowledge, alter the causal graph or solution, define correctness, affect scoring, or change repair eligibility.

## Contract D: Authored Hint Adaptation

Hint adaptation is implemented without a model call. A pure selector chooses one of four authored route-finding hint IDs from deterministic inspected/comparison state. Each hint contains repository-authored standard and reduced-reading text plus an authored alignment-prefix template. If an approved profile has a mapping for the hint's reviewed concept ID, the renderer inserts only the approved exact packet term into that template.

The ladder becomes more explicit as the student inspects the authored prerequisites and disappears after the supported comparison is recorded. It cannot introduce a new clue, skip a reducer gate, reveal content outside the four authored hints, or change repair eligibility. Viewing a hint records only a bounded `hint_viewed` event code and hint ID in the separate learning session.

## Contract E: Deterministic Teacher Report

The implemented teacher report does not call GPT-5.6. A pure builder reads:

- validated current `CaseState`
- an optional teacher-approved alignment profile
- the three support preferences
- bounded typed observable events from the separate learning session

It emits completion status, final evidence/comparison/condition/causal-link counts, hint-use count, the student's recorded Case Brief, teacher-selected objective observations, approved packet references, and explicit teacher-review/AI boundaries. It does not reproduce raw packet text, recalculate an AI rubric, infer unobserved revision history, personality, ability, motivation, disability, emotion, belief, or future performance. It is a local printable formative artifact, not a secure grade record.

## Contract F: Player Transcription

Contract F is implemented as strict schemas, a bounded multipart route, a push-to-talk recorder, an OpenAI transcription provider, and an editable transcript UI.

### Correlation And Input

Every request and response carries media contract `1.0.0`, case ID, generated station ID, request UUID, and nonnegative state revision. Audio metadata is constructed from the bytes the server boundary actually receives rather than trusted client claims. It permits exactly one channel, at most decimal `2,000,000` audio bytes, and at most `20,000` milliseconds for both advisory and server-detected duration.

Canonical MIME values are `audio/webm`, `audio/mp4`, `audio/ogg`, and `audio/wav`. A pure helper may convert a browser value such as `audio/webm; codecs=opus` to its canonical value before schema parsing. The schema itself accepts only canonical values, and declared/detected MIME disagreement fails closed.

### Output And Non-Authority

A successful response returns the same correlation, a canonical detected MIME value, detected duration, and an untrusted transcript of at most 600 characters. The transcript enters the existing character-message path and moderation boundary; it is never a source, historical fact, model plan, score, command, or CaseState snapshot.

The strict request and response schemas reject historical facts, sources, evidence, scores, commands, CaseState snapshots, `authority`, `mutatesCaseState`, and unknown fields. Media transforms cannot unlock evidence, affect repair eligibility, or mutate case state.

### Staleness, Failures, And Privacy

The pure current-correlation check requires exact media version, case, station, request, and revision equality. It rejects stale request IDs, station changes, or revision changes. The stateless server cannot know the browser's globally current revision; the browser must compare the response to its active interaction snapshot before display or submission.

Failure reasons preserve the existing operational set of `missing_api_key`, `timeout`, `aborted`, `rate_limited`, and `provider_error`, plus invalid request/version, payload, duration, MIME, transcript, stale-correlation, and authorization failures. Timeout and rate-limit failures are transient. Provider errors are retryable only when separately classified transient. Abort and validation failures are never retryable.

The route keeps raw audio and full transcripts out of logs, enforces rate limits before body consumption, enforces the byte limit while streaming before multipart parsing, cancels aborted readers, and clears app-owned mutable byte buffers after success, rejection, timeout, abort, or provider failure. Platform `File` instances are immutable and cannot be zeroed; they are not retained beyond the request and remain subject to the platform lifecycle. No raw audio retention is authorized by this contract. The provider path uses `gpt-4o-transcribe` and JSON output.

## Contract G: Authorized Speech Synthesis

Contract G is implemented as strict schemas, route-bound character authorization, HMAC ticket verification, an exact-caption speech endpoint, an OpenAI provider gateway, and explicit provider/browser playback UI.

### Trusted Mint Boundary

`createCharacterTurn` returns a server-internal validated result and imports no ticket or secret code. Only `handleCharacterTurnRequest` may attach `speechAuthorization`, and only after the service has returned an authorized visible caption. This applies equally to model-selected and authored fallback captions. If `SPEECH_AUTHORIZATION_SECRET` is absent or shorter than 32 UTF-8 bytes, the route preserves the complete character response with `speechAuthorization: null`.

There is no ticket-mint endpoint and no application path that mints from client-supplied text. `AuthorizedSpeechRequest` is exactly the caption plus the pre-minted authorization record; unknown top-level fields are rejected.

### Exact Text And Signature

The logical app-owned voices are `drouet-source-v1` and `louis-source-v1`. Their station mapping is private server policy, not a provider voice name or a client choice. The current server policy maps them to the provider's `cedar` and `marin` voices without exposing that choice as client authority.

The ticket binds media version, case ID, generated station ID, original character request UUID, state revision, logical voice ID, SHA-256 of the exact UTF-8 visible caption, and integer expiry. Signing uses HMAC-SHA256 over a domain-separated, byte-length-prefixed canonical representation and emits an unpadded base64url signature. Verification decodes a canonical 32-byte signature and uses `timingSafeEqual` only after equal-length checks.

Speech-request parsing and verification do not trim or Unicode-normalize the caption. Whitespace, code-point composition, or any other text alteration changes the caption hash and fails authorization. Malformed/short signatures, wrong or short secrets, altered correlation, altered voice, and altered text fail closed without logging secret material.

### Expiry, Replay, And Playback Correlation

Tickets expire after 120 seconds. Verification rejects expired tickets and tickets whose remaining lifetime exceeds that bound. Expiry limits replay but does not identify the browser's globally current interaction. Signed fields prevent tampering; the client must also run the current-correlation check against the active station, request, revision, and visible caption before playing returned audio. A station switch, superseding request, revision change, or caption change rejects stale playback.

A successful speech transform returns only WAV bytes plus correlated audio metadata, logical voice ID, and the authorized caption hash. It returns no new text, historical fact, source, evidence, score, command, CaseState, authority, or state transition. Generated audio is capped at decimal `3,000,000` bytes (3 MB) and is not application-persisted. Operational logs omit caption/audio content, and app-owned mutable provider and response buffers are cleared on every completion path. The default provider model is `gpt-4o-mini-tts`.

## Verification Boundary

The current automated corpus covers station allowlists, evidence prerequisites, exact-span validation, one-lineage corroboration rejection, contradictory-status coherence, prompt injection, attempted solution leakage, moderation mapping, request cancellation, retry behavior, provider-error classification, rate limiting, no-key fallbacks, strict media limits, MIME mismatch, stale media correlation, exact-caption hashes, ticket expiry, signature tampering, route-only nullable/minted authorization, legacy AI-contract rejection, alignment schema closure, exact segment/term authorization, sample and deterministic no-key alignment, instruction-like packet text, teacher approval, raw-packet exclusion from persistence, authored hint selection, and deterministic report construction.

The source-bounded paths have not yet been verified against a live `OPENAI_API_KEY` in this repository session. Media handlers are integration-tested with injected provider adapters, and browser voice flows use deterministic network fixtures; neither is a live paid-provider smoke test. The dedicated opt-in `npm run test:live:openai` path covers real transcription, a source-bounded Drouet turn with E3 inspected and presented, and an exact-caption WAV response with parsed audio metadata. Its separate launcher explicitly blanks `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_SPEECH_MODEL`, and `SPEECH_AUTHORIZATION_SECRET` during the build so Next.js cannot reload values from local environment files; only the runtime receives the live key, pinned `gpt-5.6` and `gpt-4o-mini-tts` models, and a fresh ephemeral speech-ticket secret. Ordinary and screenshot Playwright build and runtime environments explicitly blank the same four values. This infrastructure has not been executed against the provider because no key is configured, so documentation must continue to distinguish local contract/handler/browser verification from live OpenAI verification.

The latest verified local baseline passes 111 Vitest files with 910 tests, typecheck, warning-free lint, the production build, all 53 ordinary production Playwright tests, the constrained Classroom performance proxy, and high/balanced/classroom capture coverage. Automated axe-core, cross-route state and keyboard equivalence, complete keyboard-only case, valid TXT/Markdown upload, and aligned-hint gates pass. Formal screen-reader testing, live-provider execution, physical Chromebook verification, deployment, and unfamiliar-user testing remain open.
