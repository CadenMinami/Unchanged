"use client";

import { ArrowLeft, BookOpenCheck, Printer, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { buildTeacherReport } from "@/lib/reporting/build-teacher-report";

import styles from "./teacher-report.module.css";

export function TeacherReport() {
  const { state, ready: caseReady } = useCaseSession();
  const {
    approvedAlignment,
    observableEvents,
    preferences,
    ready: alignmentReady,
  } = useCourseAlignment();

  if (!caseReady || !alignmentReady) {
    return <main className={styles.gate} aria-busy="true"><p>Preparing the learning report.</p></main>;
  }

  const report = buildTeacherReport({
    caseState: state,
    approvedAlignment,
    preferences,
    observableEvents,
  });

  return (
    <main className={styles.report}>
      <header className={styles.masthead}>
        <Link href="/play/debrief"><ArrowLeft aria-hidden="true" />Student debrief</Link>
        <span>CASE 01 / TEACHER REPORT</span>
        <button onClick={() => window.print()} type="button"><Printer aria-hidden="true" />Print</button>
      </header>

      <section className={styles.titleBand}>
        <div>
          <p>Formative learning record</p>
          <h1>The Road That Should Have Closed</h1>
          <span>{report.completionStatus === "case_reconstructed" ? "Case reconstructed" : "Session in progress"}</span>
        </div>
        <ShieldCheck aria-hidden="true" />
      </section>

      <section className={styles.metrics} aria-label="Recorded reasoning state">
        <div><b>{report.reasoningRecord.evidenceInspected}</b><span>records inspected</span></div>
        <div><b>{report.reasoningRecord.comparisons}</b><span>comparisons</span></div>
        <div><b>{report.reasoningRecord.causalLinks}</b><span>causal links</span></div>
        <div><b>{report.reasoningRecord.hintsViewed}</b><span>hints viewed</span></div>
      </section>

      <section className={styles.band} aria-labelledby="objectives-heading">
        <div className={styles.bandHeading}>
          <span>01</span>
          <div><p>Course alignment</p><h2 id="objectives-heading">Teacher-selected objectives</h2></div>
        </div>
        {report.courseAlignment ? (
          <>
            <p className={styles.packetLabel}><BookOpenCheck aria-hidden="true" />Class material / {report.courseAlignment.packetTitle}</p>
            <div className={styles.objectives}>
              {report.courseAlignment.objectives.map((objective) => (
                <article key={objective.id}>
                  <span>{objective.id}</span>
                  <h3>{objective.title}</h3>
                  <p>{objective.observation}</p>
                  <small>{objective.description}</small>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p>No teacher packet was approved for this session. The case used its built-in learning objectives.</p>
        )}
      </section>

      <section className={styles.band} aria-labelledby="argument-heading">
        <div className={styles.bandHeading}>
          <span>02</span>
          <div><p>Student work</p><h2 id="argument-heading">Final recorded argument</h2></div>
        </div>
        <blockquote>{report.reasoningRecord.argument || "No prose argument has been recorded yet."}</blockquote>
        <dl className={styles.settings}>
          <div><dt>Reading</dt><dd>{report.supportSettings.readingMode}</dd></div>
          <div><dt>Motion</dt><dd>{report.supportSettings.motionMode}</dd></div>
          <div><dt>Guidance</dt><dd>{report.supportSettings.guidanceMode}</dd></div>
        </dl>
      </section>

      <section className={styles.boundary}>
        <strong>Teacher review required</strong>
        <p>{report.narrativeBoundary}</p>
        <p>{report.aiBoundary}</p>
      </section>
    </main>
  );
}
