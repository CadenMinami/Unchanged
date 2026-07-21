# Submission Screenshots

These images are generated from one real, deterministic case session using a fresh production build. The set contains the eight required storyboard frames plus a spatial-world overview for repository presentation:

```bash
npm run capture:screenshots
```

The capture flow uses the reviewed sample packet and completes the same reducer-owned investigation, caseboard, repair, and reporting path used by the browser tests. It does not seed a privileged case state.

The capture launcher is intentionally always no-key. Its build and runtime explicitly blank the provider credential, model overrides, and speech-authorization secret; `HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE` does not enable live calls through `npm run capture:screenshots`. Generated-character and Case Brief frames therefore show the product's labeled authored fallback and must not be described as live GPT-5.6 output.

If live-provider images are later required, a separate credential-isolated capture launcher must be designed and reviewed. No such launcher exists now.
