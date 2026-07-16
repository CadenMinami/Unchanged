"use client";

import { ArrowRight, BookOpenCheck, Check, ExternalLink, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";

import styles from "./learning-summary.module.css";

const casePackage = loadVarennesCase();
const reconstruction = loadVarennesReconstruction();

export function LearningSummary() {
  const { state, ready, reset } = useCaseSession();

  if (!ready) return <main className={styles.gate} aria-busy="true"><p>Restoring the learning summary.</p></main>;
  if (state.phase !== "debrief" || !state.repairCompleted) {
    return (
      <main className={styles.gate}>
        <p className={styles.eyebrow}>Case protocol / Phase guard</p>
        <h1>Debrief locked.</h1>
        <p>Complete the timeline reconstruction before opening the learning summary.</p>
        <Link href="/play/repair">Return to repair<ArrowRight aria-hidden="true" /></Link>
      </main>
    );
  }

  const pinnedEvidence = casePackage.evidence.filter((item) => state.pinnedEvidenceIds.includes(item.id));
  const selectedConditions = casePackage.conditions.filter((item) => state.selectedConditionIds.includes(item.id));

  function sourceLinks(sourceIds: string[]) {
    return sourceIds.map((sourceId) => {
      const source = casePackage.sources.find((item) => item.id === sourceId)!;
      return <a aria-label={`Open source: ${source.title}`} href={source.citationUrl} key={source.id} rel="noreferrer" target="_blank">Open source<ExternalLink aria-hidden="true" /></a>;
    });
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.masthead}><Link href="/">History Unbroken</Link><span>CASE 01 / LEARNING SUMMARY</span></header>
      <section className={styles.hero}>
        <ShieldCheck aria-hidden="true" />
        <p className={styles.eyebrow}>Deterministic completion</p>
        <h1>Case reconstructed.</h1>
        <p>The timeline repair is complete. This summary separates validated caseboard actions, the submitted argument, and authored historical reconstruction.</p>
      </section>

      <section className={styles.summaryBand} aria-labelledby="established-heading">
        <div className={styles.sectionIntro}><span>01</span><div><p className={styles.eyebrow}>Authored synthesis</p><h2 id="established-heading">What the reviewed record supports</h2></div></div>
        <div className={styles.establishedGrid}>
          {reconstruction.debrief.established.map((item) => <article key={item.id}><Check aria-hidden="true" /><div className={styles.establishedBody}><span className={styles.provenanceLabel}>Historical reconstruction</span><p>{item.statement}</p><small>{item.limitations}</small><div>{sourceLinks(item.sourceIds)}</div></div></article>)}
        </div>
      </section>

      <section className={styles.recordBand} aria-labelledby="record-heading">
        <div className={styles.sectionIntro}><span>02</span><div><p className={styles.eyebrow}>Reasoning record</p><h2 id="record-heading">Your final recorded state</h2></div></div>
        <div className={styles.metrics}><div><b>{state.completedComparisonIds.length}</b><span>comparisons</span></div><div><b>{pinnedEvidence.length}</b><span>records pinned</span></div><div><b>{selectedConditions.length}</b><span>conditions</span></div><div><b>{state.connectedCausalEdgeIds.length}</b><span>causal links</span></div></div>
        <div className={styles.recordColumns}>
          <section><h3>Historical evidence</h3><ul>{pinnedEvidence.map((item) => <li key={item.id}><span>{item.id}</span>{item.shortTitle}</li>)}</ul></section>
          <section><h3>Broader conditions</h3><ul>{selectedConditions.map((item) => <li key={item.id}>{item.label}</li>)}</ul></section>
        </div>
        <div className={styles.argumentHeading}>Submitted argument / Recorded, not AI-adjudicated</div>
        <blockquote>{state.caseBrief.argument || "No prose argument was stored; deterministic completion came from the validated caseboard."}</blockquote>
        <p className={styles.boundary}>{reconstruction.debrief.finalStateBoundary}</p>
      </section>

      <section className={styles.limitsBand} aria-labelledby="limits-heading">
        <div className={styles.sectionIntro}><span>03</span><div><p className={styles.eyebrow}>Claim limits</p><h2 id="limits-heading">What remains uncertain</h2></div></div>
        <aside className={styles.counterfactualBoundary}><span>Fictional counterfactual boundary</span><strong>{reconstruction.counterfactualBoundary.label}</strong><p>{reconstruction.counterfactualBoundary.statement}</p></aside>
        <div className={styles.limitList}>{reconstruction.debrief.claimLimits.map((item) => <article key={item.id}><BookOpenCheck aria-hidden="true" /><p>{item.statement}</p></article>)}</div>
      </section>

      <section className={styles.teacherBoundary}>
        <div><p className={styles.eyebrow}>Teacher review boundary</p><h2>Formative, not automatic grading.</h2><p>{reconstruction.debrief.teacherReviewBoundary}</p></div>
        <div>
          <Link href="/teacher/report">Open teacher report<FileText aria-hidden="true" /></Link>
          <Link href="/play" onClick={reset}>Start case again<RotateCcw aria-hidden="true" /></Link>
        </div>
      </section>
    </main>
  );
}
