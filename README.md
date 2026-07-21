# History Unbroken

**A source-grounded historical mystery game about the Flight to Varennes.**

History Unbroken puts students inside a fractured version of June 1791. They investigate reviewed sources, question historically bounded characters, build a multicausal argument, and repair one fictional break in the recognition-to-detention chain.

The case is designed for Grade 10 World History, takes 10-15 minutes, and does not require prior knowledge of the Flight to Varennes.

![History Unbroken spatial investigation](docs/assets/screenshots/00-grounded-world.png)

## What Students Do

- Explore a compact third-person reconstruction or use the complete non-spatial archive.
- Compare evidence with visible source, reconstruction, contestation, and fiction labels.
- Type or speak to source-bounded versions of Jean-Baptiste Drouet and Louis XVI.
- Organize conditions, mechanisms, and consequences on a causal caseboard.
- Submit an evidence-linked Case Brief, repair the altered link, and review the result.

Teachers can optionally align vocabulary, learning objectives, hints, and accessibility preferences with a reviewed sample, pasted text, or bounded TXT or Markdown file.

## Historical and AI Boundaries

Historical facts, evidence, case state, repair requirements, and teacher reporting are authored in the repository and evaluated deterministically.

With an OpenAI API key, GPT-5.6 selects constrained response units for character dialogue, course alignment, and formative Case Brief feedback. The server validates every selection before rendering it. Model output cannot create historical facts, change case state, or decide whether repair is allowed.

The complete case remains playable without an API key through clearly labeled authored fallbacks.

## Quick Start

Requirements:

- Node.js 22.18 or newer, below Node.js 23
- npm 10.5.1 or newer

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional OpenAI Setup

Create a local environment file:

```bash
cp .env.example .env.local
```

Add the server-only values you need:

```bash
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-5.6

SPEECH_AUTHORIZATION_SECRET=your_random_secret_of_at_least_32_bytes
OPENAI_SPEECH_MODEL=gpt-4o-mini-tts
```

The model variables already default to the values shown. Never expose these secrets through a `NEXT_PUBLIC_` variable.

Generate a stable production speech secret locally, then place the output only
in the Vercel Production environment:

```bash
openssl rand -base64 48 | tr -d '\n'
```

For Vercel Preview deployments, leave all four provider variables unset so the
reviewable deterministic fallback remains the default. Enable production
provider variables only after configuring shared rate limiting or equivalent
edge abuse protection; the repository's in-memory limiter is intentionally
process-local. Vercel applies a changed environment variable to subsequent
deployments, so redeploy after updating a secret.

### Optional Paid Live Smoke

The dedicated live smoke is opt-in, makes paid OpenAI requests, and has not yet been run in this repository session. Set `OPENAI_API_KEY` in your local shell or secret manager, then run:

```bash
HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1 OPENAI_API_KEY="$OPENAI_API_KEY" npm run test:live:openai
```

Do not paste credentials into chat, commit them, or store them in repository files. The isolated launcher validates the opt-in and key without printing them, builds with provider credentials, model settings, and speech secrets explicitly blanked so Next.js cannot reload them from local environment files, then starts the test runtime with the live key, pinned `gpt-5.6` and `gpt-4o-mini-tts` models, and a fresh ephemeral speech-ticket secret.

## Verification

Run the repository checks:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Install Chromium once, then run the browser suite:

```bash
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npx playwright install chromium
PLAYWRIGHT_BROWSERS_PATH=.playwright-browsers npm run test:e2e
```

Run every no-key local release gate, including the performance proxy and
reproducible screenshots:

```bash
npm run verify:release
```

The remaining credential, deployment, device, human-review, video, and
submission work is summarized in [Project Status](#project-status).

After Vercel creates an immutable HTTPS deployment URL, run the credential-free
fallback regression against that exact URL:

```bash
HISTORY_UNBROKEN_DEPLOYED_URL="https://your-deployment.vercel.app" npm run test:deployed
```

This runner never starts a local server and blocks any `/api/ai/*` request. It
checks `/api/health`, completes the deterministic non-spatial case, and opens
spatial E3 evidence. Record its result alongside the human-owned release checks
required for your deployment.

## Architecture

The application uses Next.js, TypeScript, React Three Fiber, authored JSON case data, Zod-validated AI contracts, local browser persistence, Vitest, and Playwright.

```text
Authored case data -> deterministic reducer -> local case state
Reviewed scene data -> spatial presentation -> authorized interactions
Student request -> server validation -> constrained model plan -> response
Teacher material -> bounded processing -> teacher review -> support profile
```

The spatial world is a schematic, non-evidentiary reconstruction. Visual assets and object placement cannot establish facts or change progression.

## Project Status

The repository contains one complete local case covering the Flight to Varennes. Spatial and non-spatial routes, no-key completion, teacher alignment, accessibility preferences, voice controls, printable reporting, and automated checks are implemented.

The latest local verification baseline includes 111 Vitest files with 910 tests, 53 ordinary production Playwright flows, reproducible submission captures, and the constrained Classroom performance proxy. Those automated results do not replace physical-device, screen-reader, live-provider, deployed, or classroom-user verification.

Before a production classroom release, the project still needs:

- Successful execution of the isolated live-provider smoke with a local credential
- Public deployment and regression testing
- Formal screen-reader and physical Chromebook checks
- Unfamiliar-user classroom playtesting
- Final demo video, `/feedback` Session ID, and submission confirmation

The current API rate limiter is process-local. A multi-instance deployment requires shared rate limiting and stronger edge protection.

`npm audit` currently reports two moderate PostCSS advisories through Next.js 16.2.10. No safe stable update is available at this checkpoint, and npm's forced Next.js 9 downgrade is incompatible with this application; the risk is explicitly deferred for the hackathon MVP rather than represented as remediated.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Historical source ledger](docs/HISTORICAL_SOURCES.md)
- [AI contracts](docs/AI_CONTRACTS.md)
- [Build log](docs/BUILD_LOG.md)

## License

This repository does not yet include a source-code license. Third-party world asset licenses are documented in [`docs/licenses`](docs/licenses).
