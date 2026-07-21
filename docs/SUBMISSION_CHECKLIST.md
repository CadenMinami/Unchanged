# Submission Checklist

Use this checklist after the final feature change. It separates repeatable local
evidence from work that requires credentials, devices, people, or submission
accounts. Do not mark an external item complete from a local test result.

## 1. Freeze The Local Package

- [ ] Run `npm run verify:release` from a clean working tree or after recording intentional changes.
- [ ] Confirm all nine images exist in `docs/assets/screenshots/`.
- [ ] Open the High world image, fracture opening, evidence interview, causal board, repair, and teacher report at desktop size.
- [ ] Read the README, demo script, and historical-source ledger after the final change.
- [ ] Record the final commit SHA only after committing the intended submission state.

`verify:release` preserves the environment for static/unit gates, then clears
OpenAI credentials before every build and browser gate. A pass proves the
complete deterministic fallback package, not a live GPT-5.6 integration.

## 2. Run The Deliberate Live Smoke

- [ ] Put `OPENAI_API_KEY` in a local shell or secret manager. Do not place it in chat or a commit.
- [ ] Run:

  ```bash
  HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1 OPENAI_API_KEY="$OPENAI_API_KEY" npm run test:live:openai
  ```

- [ ] Record the date, model response, moderation result, transcription result, and speech result in `docs/BUILD_LOG.md`.
- [ ] Capture one short live-model interaction for the video only after this smoke passes.

## 3. Deploy And Regress

- [ ] Deploy the final commit to the intended public Vercel project.
- [ ] Keep all provider variables unset in Preview. Configure server-only Production secrets only after shared rate limiting or equivalent edge protection is enabled; never use `NEXT_PUBLIC_` names.
- [ ] Confirm `/api/health` reports the intended case and commit SHA at the immutable deployment URL.
- [ ] Run `HISTORY_UNBROKEN_DEPLOYED_URL="https://..." npm run test:deployed`. It blocks AI requests and exercises health, the deterministic non-spatial case, and spatial E3 evidence without building or starting a local server.
- [ ] Repeat one live character turn and one speech request after the live smoke has passed.
- [ ] Check the deployed teacher report, route journal, source ledger, and mobile layout.
- [ ] Record the public URL, Vercel deployment ID, health commit, and deployed regression result in a copy of `docs/RELEASE_EVIDENCE_TEMPLATE.md`.

## 4. Human And Device Checks

- [ ] Test a current 4 GB integrated-graphics Chromebook or documented equivalent: route discovery, E3 inspection, Drouet interaction, repair, and return from an overlay.
- [ ] Run a VoiceOver or NVDA review of primer, world HUD, evidence dialog, caseboard, repair, and teacher report.
- [ ] Ask two people unfamiliar with the design to complete the case without coaching. Record where they hesitate and whether the historical labels are understood.
- [ ] Have a qualified history educator review the source ledger, character boundaries, and source-safe world labels before describing the spatial route as classroom-ready.

## 5. Produce The Submission

- [ ] Record the public YouTube demonstration in under three minutes using [the demo script](DEMO_SCRIPT.md).
- [ ] Show the evidence confrontation, causal board, repair, teacher report, Codex contribution, and GPT-5.6 boundary.
- [ ] Use the UI screenshots as primary visuals. The world overview is supporting material because it is grounded stylization, not photorealism.
- [ ] Run `/feedback` in the primary Codex task and save the resulting Session ID.
- [ ] Verify repository visibility, demo URL, screenshots, description, and final commit SHA in the Build Week form.
- [ ] Submit before the deadline buffer and record the timestamp in the release evidence record.

## Completion Rule

The project is submission-ready only when the local release command has passed
and every applicable external box above has dated evidence. The live-provider,
physical-device, human-review, deployment, video, and submission boxes cannot
be inferred from local automated tests.
