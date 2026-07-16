"use client";

import { ArrowRight, Check, CircleDashed, ExternalLink, FileSearch, Route, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";

import styles from "./timeline-repair.module.css";

const casePackage = loadVarennesCase();
const reconstruction = loadVarennesReconstruction();
const repairActionCopy = {
  "RA-05-OBSTRUCTION": {
    label: "Restore passage control",
    completedLabel: "Passage control restored",
    icon: Route,
  },
  "RA-05-PASSPORT": {
    label: "Restore passport inspection",
    completedLabel: "Passport inspection restored",
    icon: FileSearch,
  },
} as const;

export function TimelineRepair() {
  const { state, ready, issue } = useCaseSession();
  const [localReducedMotion, setLocalReducedMotion] = useState(false);
  const courseAlignment = useOptionalCourseAlignment();
  const reducedMotion = courseAlignment
    ? courseAlignment.preferences.motionMode === "reduced"
    : localReducedMotion;

  if (!ready) {
    return <main className={styles.gate} aria-busy="true"><p>Restoring the repair chamber.</p></main>;
  }

  if (state.phase === "debrief" && state.repairCompleted) {
    return (
      <main className={styles.handoff}>
        <ShieldCheck aria-hidden="true" />
        <p className={styles.eyebrow}>Deterministic state / Complete</p>
        <h1>Timeline repair recorded.</h1>
        <p>
          You completed the game&apos;s bounded reconstruction of the reviewed sequence. The sources do not prove the two local actions were necessary or sufficient, and the alternate future remains unknown.
        </p>
        <Link href="/play/debrief">Open learning summary<ArrowRight aria-hidden="true" /></Link>
      </main>
    );
  }

  if (state.phase !== "repair") {
    return (
      <main className={styles.gate}>
        <p className={styles.eyebrow}>Case protocol / Phase guard</p>
        <h1>Repair locked.</h1>
        <p>Complete and submit the validated causal caseboard before entering the repair.</p>
        <Link href="/play/caseboard">Return to caseboard<ArrowRight aria-hidden="true" /></Link>
      </main>
    );
  }

  const completedSteps = state.completedRepairStepIds.length;
  const currentStep = reconstruction.repairSteps[completedSteps];
  const sequenceComplete = completedSteps === reconstruction.repairSteps.length;
  const requiredActions = currentStep?.requiredActionIds ?? [];
  const completedRequiredActions = requiredActions.filter((actionId) =>
    state.completedRepairActionIds.includes(actionId),
  ).length;
  const allRequiredActionsComplete = requiredActions.every((actionId) =>
    state.completedRepairActionIds.includes(actionId),
  );
  const progressAnnouncement = sequenceComplete
    ? `All ${reconstruction.repairSteps.length} reconstruction steps reviewed.`
    : `Step ${completedSteps + 1} of ${reconstruction.repairSteps.length}: ${currentStep?.title}.${
        requiredActions.length > 0
          ? ` ${completedRequiredActions} of ${requiredActions.length} local actions restored.`
          : ""
      }`;

  function sourceLinks(sourceIds: string[]) {
    return sourceIds.map((sourceId) => {
      const source = casePackage.sources.find((item) => item.id === sourceId)!;
      return (
        <a aria-label={`Open repair source: ${source.title}`} href={source.citationUrl} key={source.id} rel="noreferrer" target="_blank">
          {source.title}<ExternalLink aria-hidden="true" />
        </a>
      );
    });
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.masthead}>
        <Link href="/">History Unbroken</Link>
        <span>CASE 01 / TIMELINE REPAIR</span>
        <label><input checked={reducedMotion} onChange={(event) => {
          if (courseAlignment) {
            courseAlignment.updatePreferences({ motionMode: event.target.checked ? "reduced" : "standard" });
          } else {
            setLocalReducedMotion(event.target.checked);
          }
        }} type="checkbox" />Reduced motion</label>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Act IV / Reconstruction</p>
          <h1>Restore the link. Preserve the uncertainty.</h1>
          <p>Rebuild only the sequence supported by the reviewed record. The repair does not predict a complete alternate France.</p>
        </div>
        <aside className={styles.unknown}>
          <span>Fictional counterfactual boundary</span>
          <strong>{reconstruction.counterfactualBoundary.label}</strong>
          <p>{reconstruction.counterfactualBoundary.statement}</p>
        </aside>
      </section>

      <section className={styles.routeStage} aria-labelledby="repair-stage-heading">
        <p
          aria-atomic="true"
          aria-live="polite"
          className={styles.srOnly}
          role="status"
        >
          {progressAnnouncement}
        </p>
        <div className={styles.corruptedTrack}>
          <span>Fictional branch</span>
          <div><b>Recognition</b><i /><b>Announced Verdun road</b><i className={styles.break} /><b>Varennes trace ends</b></div>
        </div>
        <div className={styles.restoredTrack}>
          <span>Historical reconstruction</span>
          <ol>
            {reconstruction.repairSteps.map((step, index) => (
              <li className={index < completedSteps ? styles.stepComplete : styles.stepPending} key={step.id}>
                {index < completedSteps ? <Check aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
                <div><small>{String(step.sequence).padStart(2, "0")}</small><strong>{step.title}</strong></div>
              </li>
            ))}
          </ol>
        </div>

        {reducedMotion && !sequenceComplete ? (
          <section className={styles.reducedReview} aria-label="Static reconstruction sequence">
            <div>
              <span className={styles.reconstructionLabel}>Reduced-motion reconstruction</span>
              <h2>Review the complete supported sequence.</h2>
              <p>The actions remain separate and must still be completed in order.</p>
            </div>
            <ol>
              {reconstruction.repairSteps.map((step) => (
                <li key={step.id}>
                  <div><small>{String(step.sequence).padStart(2, "0")}</small><h3>{step.title}</h3></div>
                  <p>{step.statement}</p>
                  <div className={styles.sourceLinks}>{sourceLinks(step.sourceIds)}</div>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {!sequenceComplete && currentStep ? (
          <section className={styles.activeStep} aria-labelledby="repair-stage-heading">
            <div>
              <span className={styles.reconstructionLabel}>Historical reconstruction</span>
              <h2 id="repair-stage-heading">{currentStep.title}</h2>
              {!reducedMotion ? <p>{currentStep.statement}</p> : null}
              {!reducedMotion ? <div className={styles.sourceLinks}>{sourceLinks(currentStep.sourceIds)}</div> : null}
            </div>
            {requiredActions.length > 0 ? (
              <div className={styles.actionPanel}>
                {requiredActions.map((actionId) => {
                  const action = repairActionCopy[actionId];
                  const complete = state.completedRepairActionIds.includes(actionId);
                  const ActionIcon = action.icon;
                  return (
                    <button
                      disabled={complete}
                      key={actionId}
                      onClick={() => issue({ type: "complete_repair_action", actionId })}
                      type="button"
                    >
                      {complete ? <Check aria-hidden="true" /> : <ActionIcon aria-hidden="true" />}
                      {complete ? action.completedLabel : action.label}
                    </button>
                  );
                })}
                {allRequiredActionsComplete ? (
                  <button
                    onClick={() => issue({ type: "complete_repair_step", stepId: currentStep.id })}
                    type="button"
                  >
                    <ShieldCheck aria-hidden="true" />{currentStep.actionLabel}
                  </button>
                ) : null}
              </div>
            ) : (
              <button onClick={() => issue({ type: "complete_repair_step", stepId: currentStep.id })} type="button">
                <Route aria-hidden="true" />{currentStep.actionLabel}
              </button>
            )}
          </section>
        ) : (
          <section className={styles.completion} aria-labelledby="repair-stage-heading">
            <p className={styles.eyebrow}>Bounded consequence</p>
            <h2 id="repair-stage-heading">Reconstruct meaning without claiming inevitability.</h2>
            <div className={styles.meaningGrid}>
              {reconstruction.politicalMeaning.map((item) => (
                <article key={item.id}>
                  <span>Bounded historical observation</span>
                  <p>{item.statement}</p>
                  <div className={styles.sourceLinks}>{sourceLinks(item.sourceIds)}</div>
                </article>
              ))}
            </div>
            <button onClick={() => issue({ type: "complete_repair" })} type="button">
              <ShieldCheck aria-hidden="true" />Complete reconstruction
            </button>
          </section>
        )}
      </section>
    </main>
  );
}
