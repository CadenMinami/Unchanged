# Answerability Matrix

## Purpose

Every required final conclusion must be learnable from in-game content. If the student can be marked wrong for missing a claim, the game must provide a clear path to discovering that claim.

## Student Knowledge Contract

Students are not expected to know the Flight to Varennes before playing.

The game must provide:

- minimum historical context
- relevant vocabulary
- evidence needed for every required conclusion
- guided source comparison
- notebook support
- revision feedback

## Matrix

| Required conclusion | Where student learns it | Evidence or interaction | Assessment use |
|---|---|---|---|
| France was undergoing a revolution | Context primer | Primer card 1 | Background condition |
| France still had a king in 1791 | Context primer | Primer card 2 | Prevents republic-anachronism |
| Louis's authority was contested | Context primer and glossary | Primer cards 3-5 | Background condition |
| The royal family secretly left Paris | Context primer and E1/E2 | Primer card 6, declaration, travel dossier | Initial event |
| Student is not expected to know Varennes | Context primer | Final primer card | Novice fairness |
| Louis intentionally participated in leaving Paris | E1 and independently verified E2 travel preparations | Declaration as a source claim plus separate travel evidence | Hard gate; complete private motive remains open |
| Louis's motives require caution | E1 and notebook; optional E1-bound Louis station | Declaration is a source claim, not mind-reading; generated dialogue adds no evidence | Uncertainty criterion |
| Drouet suspected or recognized the travelers | E3 and FO1 | Drouet account plus fixed fictional-branch observation | Mechanism; generated dialogue is optional and non-evidentiary |
| The fracture lies within recognition-to-detention | Fracture opening | Three equally labeled anomaly candidates | Investigation frame, not the answer |
| Recognition candidate is unsupported in the fractured branch | FO1 compared with E6A and E3/E4 | Comparison lab | Alternative rejection; FO1 is fictional branch state, not historical evidence |
| Route information mattered historically | E3/E4 | Comparison lab | Historical mechanism |
| Route information is the active fictional fracture | FO1-FO3 compared with E6A-E6C and E3/E4/E5 | Anomaly set, fixed branch observations, Drouet account, route board, civic dossier | Hard gate |
| Authorization candidate is unsupported in the fractured branch | FO2/FO3 compared with E6C and E5 | Comparison lab | Alternative rejection; FO2/FO3 are fictional branch state, not historical evidence |
| Drouet alone did not stop or detain the travelers | E5 and Drouet account | Civic-response, passage, and detention dossier | Anti-single-cause gate |
| The reviewed record describes a collective local response beyond Drouet alone | E5 and static Varennes civic station | Civic response | Anti-single-cause mechanism; not proof of strict necessity |
| Geography and relative timing mattered without a literal bridge-stop story | E4 and E5 | Route board and civic-response dossier | Causal reasoning |
| Post-flight records used competing political framings | E7 | Press and political reaction packet | Bounded reaction observation |
| Monarchical government continued under the September Constitution | E7 and context note | Post-case reconstruction | Prevents immediate-collapse overclaim |
| The case record does not establish that the flight alone made later outcomes inevitable | E7 continuity record and debrief | claim-limit selector and faded downstream nodes | Anti-inevitability claim limit, not a scored causal inference |
| A valid answer must reject an alternative | Hypothesis composer | selected alternative | Alternatives criterion |
| Evidence must be pinned, not merely named | Hypothesis composer | evidence pins | Claim/evidence fit |
| Teacher packet is class material, not historical ground truth | Teacher setup and class-material/source labels | Pending review, explicit approval, historical-boundary review, and labeled class-material connections | Alignment only; cannot create required conclusions or change evidence, scoring, or repair |

## Required Discovery Paths

### Path A: Direct Route Investigation

1. Inspect the E6 anomaly set without being told which candidate is active.
2. Inspect the equally labeled fixed branch observations FO1-FO3.
3. Compare deterministic FO1 with E3. The optional generated Drouet station may react only after E3, E4, or E5 is presented and cannot create recordable evidence.
4. Compare FO1 with E6A and E3/E4; compare FO2/FO3 with E6B, E6C, and E5.
5. Record why E6A and E6C do not fit the observed branch.
6. Add the E6B route-information contradiction to the notebook.
7. Connect route information to pursuit on the caseboard.

### Path B: Local Action Investigation

1. Inspect route board.
2. Visit the static Varennes civic station; there is no generated Sauce roleplay.
3. Inspect the civic-response, passage, and detention dossier.
4. Compare Drouet's account with local response.
5. Add the bounded reconstruction that warning was followed by collective local action; do not convert the sequence into a strict historical necessity claim.

### Path C: Political Meaning Investigation

1. Inspect Louis's declaration.
2. Optionally question the generated Louis station after presenting E1. The station is limited to S1 and cannot use E2, S8, or S9.
3. Inspect press reaction packet.
4. Compare stated rationale with public interpretation.
5. Add the bounded observation that later records used competing political framings while the September Constitution retained monarchy.

## Fairness Rules

- If a required conclusion is not in this matrix, it cannot be a hard gate.
- If a source is unavailable because of a bug or locked path, any dependent hard gate must not block repair.
- If GPT-5.6 asks for a new requirement not present here or in the rubric, the response must be invalidated.
- Every required path must remain completable with static case content when GPT-5.6 is unavailable.
- Generated dialogue cannot be pinned, scored, or used as the only path to a hard-gate conclusion.
- Formative corroboration feedback must count independent `sourceLineageIds`, not multiple artifacts derived from one dependency lineage.
- E5 may cite S3 as an informing dependency, but S3/L3 does not count as an independent corroborating lineage because Drouet signed that municipal record as well as authoring S2.
- Teacher packet passages may reinforce matrix items but may not create new required conclusions.
- Fictional branch observations may identify the authored counterfactual mechanism but may not count toward historical evidence or corroboration requirements.

## Enforced Verification Rules

- Keep Drouet's route-information claim attributed to S2 and leave the Clermont informant unspecified.
- Preserve disagreement about the obstruction's actors and keep blocked onward passage, passport inspection, and guarded detention distinct. Do not score an armed-halt node without verified independent archival support.
- Treat the required passage-control and passport-inspection pair as an authored reconstruction of the collective response. Both incoming detention edges use `contributed_to`; neither edge may be described as a sole arrest mechanism, and their pair may not be described as a proven strict but-for cause.
- Preserve the source-backed Verdun-to-Varennes route correction while leaving the informant unspecified unless an independent source verifies that detail.
- Keep FO1-FO3 fixed, learner-accessible, and sufficient to distinguish the active anomaly without generated dialogue.
- Keep E7 political-reaction statements bounded to situated records rather than national consensus.
- Require every hard gate to map to at least one accessible deterministic artifact.
