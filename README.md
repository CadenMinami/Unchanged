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

- Node.js 22.x
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

Before a production classroom release, the project still needs:

- Live provider testing with production credentials
- Public deployment and regression testing
- Formal screen-reader and physical Chromebook checks
- Unfamiliar-user classroom playtesting

The current API rate limiter is process-local. A multi-instance deployment requires shared rate limiting and stronger edge protection.

## Documentation

- [Product specification](docs/PRODUCT_SPEC.md)
- [Architecture and trust boundaries](docs/ARCHITECTURE.md)
- [Historical source ledger](docs/HISTORICAL_SOURCES.md)
- [AI contracts](docs/AI_CONTRACTS.md)
- [Build log](docs/BUILD_LOG.md)

## License

This repository does not yet include a source-code license. Third-party world asset licenses are documented in [`docs/licenses`](docs/licenses).
