# Submission Screenshots

These images are generated from one real, deterministic case session using a fresh production build. The set contains the eight required storyboard frames plus a spatial-world overview for repository presentation:

```bash
npm run capture:screenshots
```

The capture flow uses the reviewed sample packet and completes the same reducer-owned investigation, caseboard, repair, and reporting path used by the browser tests. It does not seed a privileged case state.

By default, `OPENAI_API_KEY` is removed from the capture server environment. Generated-character and Case Brief frames therefore show the product's labeled authored fallback. After live-provider smoke testing succeeds, those frames may be recaptured with:

```bash
HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1 \
OPENAI_API_KEY=your_key_here \
npm run capture:screenshots
```

Do not describe fallback captures as live GPT-5.6 output.
