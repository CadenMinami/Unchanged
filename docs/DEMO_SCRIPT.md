# Demo Script

## Goal

Create a public YouTube demo under three minutes that explains:

- what was built
- why it matters educationally
- how Codex was used
- how GPT-5.6 is integrated
- why deterministic historical guardrails matter

## Core Demo Thesis

History Unbroken is not a historical chatbot. It is a playable evidence system where AI characters respond dynamically inside authored historical boundaries, and students must repair a causal link by making an evidence-based argument.

## Target Storyboard: 2:42

| Time | Visual | Voiceover purpose |
|---:|---|---|
| 0:00-0:12 | Carriage passes Varennes; three fictional anomaly candidates appear | "History has fractured somewhere between recognition and detention. The game does not reveal which link changed." |
| 0:12-0:34 | Drouet interview; player presents reviewed evidence | After a successful live-provider smoke: "GPT-5.6 selects a source-bound response that reacts to the evidence presented." Otherwise show and identify the authored fallback. |
| 0:34-0:58 | Comparison lab contrasts fixed fictional branch observations with reviewed records, eliminating recognition and authorization candidates | "Students distinguish what happened in the authored fracture from what the historical record supports, then reject plausible alternatives." |
| 0:58-1:18 | Causal board adds recognition, route information, warning, local action, and political context | "The altered information is one link in a larger network, not the sole cause of later history." |
| 1:18-1:38 | Student submits a theory; focused feedback appears | "GPT-5.6 provides non-authoritative formative feedback on the argument; the deterministic gate remains independent." Use this line only with a successful live-provider capture. |
| 1:38-1:58 | Student revises; deterministic requirements pass; repair restores the intended link | "Authored logic controls facts and progression. The model cannot rewrite the case." |
| 1:58-2:17 | Journey and political-meaning tracks reconstruct | "The repair restores supported history while the alternate future remains explicitly unknowable." |
| 2:17-2:30 | Teacher alignment and reasoning report | "A reviewed sample, pasted text, or bounded UTF-8 TXT or Markdown packet can change vocabulary and support, never historical truth." |
| 2:30-2:38 | Architecture and test proof | Show release-closure baseline `9f71cb0`, 554 Vitest tests, 33 Playwright tests, and the passing 4x-CPU classroom proxy. "Codex helped build and test the case engine, model contracts, evidence interactions, and release guards." |
| 2:38-2:42 | Title screen | "History is an argument built from evidence." |

## Required On-Screen Moments

- provenance labels visible
- all three fictional anomaly labels visible with equal treatment
- fixed branch observations visibly labeled as authored fiction, never historical evidence
- evidence presentation to character
- source comparison
- causal board
- hypothesis feedback
- repair sequence
- teacher report
- architecture or validation proof

## Voiceover Draft

> History Unbroken is a historical mystery game for classrooms. In this case, the timeline fractures during the Flight to Varennes: Louis XVI's carriage passes through a town where the historical record says he was stopped.
>
> Students do not need to know Varennes before playing. The game starts with the minimum context: France is in revolution, Louis is still king, and trust between the crown and revolutionary politics is fragile.
>
> The player investigates by questioning source-bound AI characters, presenting evidence, comparing accounts, and building a causal board. The fracture produces three equally labeled fictional anomaly candidates. Fixed branch observations show what occurred in the authored alternate branch; reviewed sources show what happened historically. Drouet can react to evidence, but generated dialogue cannot identify the answer or count as historical proof.
>
> The important part is that the student cannot win by chatting. They have to prove how recognition, route information, pursuit, local warning, collective action, passport inspection, and guarded detention worked together. The bridge constrained onward passage; it did not arrest the carriage by itself.
>
> When the provider is configured, GPT-5.6 provides non-authoritative formative feedback on the student's explanation and can identify unsupported assumptions, while deterministic logic controls the facts, evidence, causal graph, and repair eligibility.
>
> Teachers can use the reviewed sample, pasted text, or a bounded UTF-8 TXT or Markdown packet so hints, vocabulary, and the final report align to what students studied. The packet never changes the historical solution.
>
> I used Codex to design and implement the deterministic case engine, structured model contracts, evidence interactions, tests, documentation, and demo flow.
>
> History Unbroken makes historical reasoning playable: not a list of answers, but an argument built from evidence.

Only use the Codex sentence after the build log confirms those contributions.

## Recording Notes

- Record the submission take from the verified deployed URL. A localhost recording may be used for rehearsal or backup footage, but it does not satisfy the deployment gate.
- Use sample packet already processed to avoid live upload risk.
- Use pre-scripted but real interactions.
- Keep mouse movement slow and intentional.
- Zoom browser if text is not readable.
- Avoid long typing shots; use prefilled hypothesis text if needed.
- Show live model response briefly but do not depend on a slow response for pacing.
- Record fallback path separately as backup.

## Screenshots Needed

Regenerate all eight from a fresh production build with `npm run capture:screenshots`.

- [x] Additional grounded-world overview: `docs/assets/screenshots/00-grounded-world.png`
- [x] Fracture opening: `docs/assets/screenshots/01-fracture-opening.png`
- [x] Teacher setup: `docs/assets/screenshots/02-teacher-setup.png`
- [x] Character interview with evidence tray: `docs/assets/screenshots/03-evidence-interview.png`
- [x] Evidence comparison: `docs/assets/screenshots/04-evidence-comparison.png`
- [x] Causal board: `docs/assets/screenshots/05-causal-caseboard.png`
- [x] Hypothesis feedback: `docs/assets/screenshots/06-hypothesis-feedback.png`
- [x] Repair sequence: `docs/assets/screenshots/07-repair-sequence.png`
- [x] Teacher report: `docs/assets/screenshots/08-teacher-report.png`

The default capture intentionally runs without a provider key and visibly preserves authored fallback labels. After a successful live-provider smoke, recapture screenshots 03 and 06 with `HISTORY_UNBROKEN_LIVE_OPENAI_SMOKE=1`; do not represent the no-key fallback as a live GPT-5.6 result.
