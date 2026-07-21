# Release Evidence Record

Copy this file to `docs/RELEASE_EVIDENCE.md` at submission freeze. Do not add
API keys, student input, transcripts, speech captions, authorization tickets,
or other sensitive material. Record a result only after the corresponding
action has occurred.

## Local Freeze

- UTC date and time:
- Commit SHA:
- `npm run verify:release` result:
- Screenshot set reviewed:
- Notes on intentional deviations:

## Live OpenAI Smoke

- UTC date and time:
- Command run: `HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1 OPENAI_API_KEY="$OPENAI_API_KEY" npm run test:live:openai`
- Result:
- Model / moderation / transcription / speech result summary:
- Safe failure details, if any:

## Deployment

- Vercel project:
- Immutable deployment URL:
- Vercel deployment ID:
- Commit SHA reported by `/api/health`:
- Fallback regression command: `HISTORY_UNBROKEN_DEPLOYED_URL="https://..." npm run test:deployed`
- Fallback regression result:
- Production AI secrets configured: yes / no
- Shared rate limit or WAF configured before production AI enablement: yes / no

## Device And Accessibility Checks

| Check | Person or device | UTC date | Result | Notes |
|---|---|---|---|---|
| Chromebook or equivalent route traversal |  |  |  |  |
| VoiceOver or NVDA review |  |  |  |  |
| Unfamiliar-user playtest 1 |  |  |  |  |
| Unfamiliar-user playtest 2 |  |  |  |  |
| History educator source-boundary review |  |  |  |  |

## Submission

- Public demo URL:
- Verified duration (under three minutes):
- `/feedback` Session ID:
- Repository URL and final commit SHA:
- Build Week form submitted at (Pacific time):
- Confirmation or receipt reference:

## Disclosure

The spatial world is a source-safe, schematic reconstruction. It is not a
verified map of Varennes, a photorealistic recreation, or a likeness of a
named historical person. GPT-5.6 output is source-bounded and formative; it
does not create historical evidence or determine repair eligibility.
