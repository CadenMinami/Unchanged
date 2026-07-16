"use client";

import {
  ArrowRight,
  BookOpenCheck,
  Check,
  CircleAlert,
  FileCheck2,
  FileClock,
  FileQuestion,
  MapPinned,
  Pin,
  PinOff,
  ScanSearch,
  ShieldAlert,
  X,
} from "lucide-react";
import Link from "next/link";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { CharacterInterview } from "@/components/characters/character-interview";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { HintDrawer } from "@/components/guidance/hint-drawer";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { isInvestigationComplete } from "@/lib/case-engine/selectors";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";

import styles from "./investigation-workspace.module.css";

const casePackage = loadVarennesCase();
const alignmentCatalog = loadVarennesAlignmentCatalog();

const comparisonActions: Record<
  string,
  { record: string; decision: string }
> = {
  "CMP-REJECT-E6A": {
    record: "Record recognition finding",
    decision: "Eliminate Recognition Echo",
  },
  "CMP-SUPPORT-E6B": {
    record: "Record route finding",
    decision: "Mark Route Echo as best fit",
  },
  "CMP-REJECT-E6C": {
    record: "Record authorization finding",
    decision: "Eliminate Authorization Echo",
  },
};

function formatSourceType(sourceType: string): string {
  if (sourceType === "primary") return "Primary record";
  if (sourceType === "secondary") return "Historical scholarship";
  return "Cited reconstruction";
}

function StatusMark({ complete }: { complete: boolean }) {
  return complete ? <Check aria-hidden="true" /> : <span aria-hidden="true">0</span>;
}

export function InvestigationWorkspace() {
  const { state, ready, issue } = useCaseSession();
  const courseAlignment = useOptionalCourseAlignment();
  const reducedReading = courseAlignment?.preferences.readingMode === "reduced";

  if (!ready) {
    return (
      <main className={styles.routeGate} aria-busy="true" aria-live="polite">
        <p className={styles.eyebrow}>Case archive / Restoring session</p>
        <h1>Reopening the evidence file.</h1>
        <p>Checking the last validated case state before enabling investigation actions.</p>
      </main>
    );
  }

  if (state.phase !== "investigation" && state.phase !== "case_brief") {
    return (
      <main className={styles.routeGate}>
        <p className={styles.eyebrow}>Case protocol / Phase guard</p>
        <h1>Investigation locked.</h1>
        <p>Complete the context briefing and temporal fracture before opening the archive desk.</p>
        <Link className={styles.gateLink} href="/play">
          Return to case
          <ArrowRight aria-hidden="true" />
        </Link>
      </main>
    );
  }

  const inspected = new Set(state.inspectedItemIds);
  const completedComparisons = new Set(state.completedComparisonIds);
  const rejectedAnomalies = new Set(state.rejectedAnomalyIds);
  const pinnedEvidence = new Set(state.pinnedEvidenceIds);

  function inspect(itemId: string) {
    if (!inspected.has(itemId)) {
      issue({ type: "inspect_item", itemId });
      courseAlignment?.recordObservableEvent({
        type: "evidence_inspected",
        subjectId: itemId,
      });
    }
  }

  function togglePin(evidenceId: string) {
    const pinning = !pinnedEvidence.has(evidenceId);
    issue(
      !pinning
        ? { type: "unpin_evidence", evidenceId }
        : { type: "pin_evidence", evidenceId },
    );
    if (pinning) {
      courseAlignment?.recordObservableEvent({
        type: "evidence_pinned",
        subjectId: evidenceId,
      });
    }
  }

  function makeAnomalyDecision(comparisonId: string) {
    const finding = casePackage.comparisonFindings.find(
      (candidate) => candidate.id === comparisonId,
    );
    if (!finding) return;
    issue(
      finding.result.action === "reject_anomaly"
        ? { type: "reject_anomaly", anomalyId: finding.result.anomalyId }
        : { type: "select_active_anomaly", anomalyId: finding.result.anomalyId },
    );
  }

  const completedEvidence = casePackage.evidence.filter((item) => inspected.has(item.id)).length;
  const completedComparisonsCount = casePackage.comparisonFindings.filter((item) =>
    completedComparisons.has(item.id),
  ).length;
  const synthesisReady = isInvestigationComplete(casePackage, state);

  return (
    <main className={styles.workspace}>
      <header className={styles.masthead}>
        <div>
          <Link className={styles.wordmark} href="/">
            History Unbroken
          </Link>
          <span className={styles.caseCode}>CASE 01 / INVESTIGATION</span>
        </div>
        <div className={styles.progress} aria-label="Investigation progress" aria-live="polite">
          <span>
            <b>{completedEvidence}</b>/6 records inspected
          </span>
          <span>
            <b>{completedComparisonsCount}</b>/3 findings recorded
          </span>
        </div>
      </header>

      <section className={styles.routeBand} aria-labelledby="investigation-heading">
        <div>
          <p className={styles.eyebrow}>Act II / Open investigation</p>
          <h1 id="investigation-heading">Find the broken link.</h1>
          <p>
            Test three competing anomalies against what the fractured branch records and what
            reviewed historical sources can support.
          </p>
        </div>
        <div className={styles.routeDiagram} aria-label="Route handoff under review">
          <span>DEPARTURE</span>
          <i />
          <span>ROUTE HANDOFF</span>
          <i className={styles.brokenRoute} />
          <span>VARENNES</span>
        </div>
      </section>

      <HintDrawer />

      <div className={styles.layout}>
        <aside className={styles.stations} aria-labelledby="stations-heading">
          <div className={styles.sectionHeading}>
            <span>01</span>
            <div>
              <p className={styles.eyebrow}>Source stations</p>
              <h2 id="stations-heading">Question the record</h2>
            </div>
          </div>

          <article className={styles.station}>
            <div className={styles.stationIcon}>
              <FileClock aria-hidden="true" />
            </div>
            <div>
              <p className={styles.fictionLabel}>Dramatized branch station</p>
              <h3>Jean-Baptiste Drouet</h3>
              <p>
                The altered station may discuss only FO1: suspicion, departure on the announced
                Verdun road, and the missing route correction.
              </p>
            </div>
          </article>

          <article className={styles.station}>
            <div className={styles.stationIcon}>
              <ShieldAlert aria-hidden="true" />
            </div>
            <div>
              <p className={styles.reconstructionLabel}>Historical reconstruction station</p>
              <h3>Varennes civic record</h3>
              <p>
                The E5 dossier reconstructs the collective alarm, obstruction, inspection, and
                guard. It is not a verbatim witness transcript.
              </p>
            </div>
          </article>

          <CharacterInterview />

          <div className={styles.protocolNote}>
            <CircleAlert aria-hidden="true" />
            <p>
              Character stations provide bounded claims. They do not become historical evidence
              unless a reviewed record independently supports them.
            </p>
          </div>
        </aside>

        <section className={styles.records} aria-labelledby="records-heading">
          <div className={styles.sectionHeading}>
            <span>02</span>
            <div>
              <p className={styles.eyebrow}>Archive desk</p>
              <h2 id="records-heading">Inspect and compare</h2>
            </div>
          </div>

          <section className={styles.recordGroup} aria-labelledby="anomaly-heading">
            <div className={styles.groupHeading}>
              <div>
                <FileQuestion aria-hidden="true" />
                <h3 id="anomaly-heading">Competing anomalies</h3>
              </div>
              <span>Equal weight until tested</span>
            </div>
            <div className={styles.recordGrid}>
              {casePackage.anomalies.map((anomaly) => {
                const isRejected = rejectedAnomalies.has(anomaly.id);
                const isActive = state.activeAnomalyId === anomaly.id;
                return (
                  <article className={styles.anomalyRecord} key={anomaly.id}>
                    <div className={styles.cardTopline}>
                      <span className={styles.fictionLabel}>Fictional temporal anomaly</span>
                      <span className={styles.recordId}>{anomaly.id}</span>
                    </div>
                    <h4>{anomaly.title}</h4>
                    <p>{anomaly.summary}</p>
                    <div className={styles.cardActions}>
                      <button
                        aria-label={`${inspected.has(anomaly.id) ? "Inspected" : "Inspect"} ${anomaly.title} (${anomaly.id})`}
                        className={styles.inspectButton}
                        data-testid={`inspect-${anomaly.id}`}
                        onClick={() => inspect(anomaly.id)}
                        type="button"
                      >
                        <ScanSearch aria-hidden="true" />
                        {inspected.has(anomaly.id) ? "Inspected" : "Inspect"}
                      </button>
                      <span
                        className={
                          isRejected
                            ? styles.statusRejected
                            : isActive
                              ? styles.statusActive
                              : styles.statusOpen
                        }
                        data-testid={`anomaly-status-${anomaly.id}`}
                      >
                        {isRejected ? "Eliminated" : isActive ? "Best fit" : "Unresolved"}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.recordGroup} aria-labelledby="branch-heading">
            <div className={styles.groupHeading}>
              <div>
                <FileClock aria-hidden="true" />
                <h3 id="branch-heading">Fractured branch observations</h3>
              </div>
              <span>Fictional observations</span>
            </div>
            <p className={styles.boundaryNotice}>
              These observations describe only the fictional branch. They never count as
              historical evidence and cannot be pinned to the final case brief.
            </p>
            <div className={styles.branchList}>
              {casePackage.branchObservations.map((observation) => (
                <article className={styles.branchRecord} key={observation.id}>
                  <div className={styles.cardTopline}>
                    <span className={styles.branchLabel}>Fictional branch observation</span>
                    <span className={styles.recordId}>{observation.id}</span>
                  </div>
                  <h4>{observation.title}</h4>
                  <p>{observation.content}</p>
                  <button
                    aria-label={`${inspected.has(observation.id) ? "Inspected" : "Inspect"} ${observation.title} (${observation.id})`}
                    className={styles.inspectButton}
                    data-testid={`inspect-${observation.id}`}
                    onClick={() => inspect(observation.id)}
                    type="button"
                  >
                    <ScanSearch aria-hidden="true" />
                    {inspected.has(observation.id) ? "Inspected" : "Inspect"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recordGroup} aria-labelledby="evidence-heading">
            <div className={styles.groupHeading}>
              <div>
                <FileCheck2 aria-hidden="true" />
                <h3 id="evidence-heading">Reviewed evidence file</h3>
              </div>
              <span>Six countable records</span>
            </div>
            <div className={styles.evidenceList}>
              {casePackage.evidence.map((evidence) => {
                const isInspected = inspected.has(evidence.id);
                const isPinned = pinnedEvidence.has(evidence.id);
                const classConnections = courseAlignment?.approvedAlignment
                  ? courseAlignment.approvedAlignment.profile.conceptMappings.filter(
                      (mapping) => {
                        const concept = alignmentCatalog.concepts.find(
                          (candidate) => candidate.id === mapping.conceptId,
                        );
                        return concept?.caseFactIds.some((factId) =>
                          evidence.factIds.includes(factId),
                        );
                      },
                    )
                  : [];
                return (
                  <article className={styles.evidenceRecord} key={evidence.id}>
                    <div className={styles.evidenceBody}>
                      <div className={styles.cardTopline}>
                        <span className={styles.historyLabel}>Historical evidence</span>
                        <span className={styles.recordId}>
                          {evidence.id} / {formatSourceType(evidence.sourceType)}
                        </span>
                      </div>
                      <h4>{evidence.title}</h4>
                      <blockquote>{evidence.studentExcerpt}</blockquote>
                      {reducedReading ? (
                        <details className={styles.sourceLimit}>
                          <summary>Source limit</summary>
                          <p>{evidence.description}</p>
                        </details>
                      ) : (
                        <p>{evidence.description}</p>
                      )}
                      {classConnections.length > 0 ? (
                        <aside className={styles.classConnection} aria-label="Class material connection">
                          <strong>Class material</strong>
                          {classConnections.slice(0, 2).map((mapping) => (
                            <span key={`${evidence.id}-${mapping.conceptId}`}>
                              {mapping.packetTerm} / {mapping.referenceLabel}
                            </span>
                          ))}
                        </aside>
                      ) : null}
                    </div>
                    <div className={styles.evidenceActions}>
                      <button
                        aria-label={`${isInspected ? "Inspected" : "Inspect source"} ${evidence.title} (${evidence.id})`}
                        className={styles.inspectButton}
                        data-testid={`inspect-${evidence.id}`}
                        onClick={() => inspect(evidence.id)}
                        type="button"
                      >
                        <ScanSearch aria-hidden="true" />
                        {isInspected ? "Inspected" : "Inspect source"}
                      </button>
                      {isInspected ? (
                        <button
                          aria-label={`${isPinned ? "Unpin" : "Pin"} ${evidence.shortTitle}`}
                          className={styles.iconButton}
                          onClick={() => togglePin(evidence.id)}
                          title={`${isPinned ? "Unpin" : "Pin"} ${evidence.shortTitle}`}
                          type="button"
                        >
                          {isPinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </section>

        <aside className={styles.notebook} aria-labelledby="notebook-heading">
          <div className={styles.sectionHeading}>
            <span>03</span>
            <div>
              <p className={styles.eyebrow}>Case notebook</p>
              <h2 id="notebook-heading">Earn the finding</h2>
            </div>
          </div>

          <div className={styles.pinSummary}>
            <BookOpenCheck aria-hidden="true" />
            <div>
              <b data-testid="notebook-pinned-count">{state.pinnedEvidenceIds.length}</b>
              <span>historical records pinned</span>
            </div>
          </div>

          <div className={styles.findings}>
            {casePackage.comparisonFindings.map((finding) => {
              const ready = finding.requiredItemIds.every((itemId) => inspected.has(itemId));
              const completed = completedComparisons.has(finding.id);
              const action = comparisonActions[finding.id];
              const decisionMade =
                finding.result.action === "reject_anomaly"
                  ? rejectedAnomalies.has(finding.result.anomalyId)
                  : state.activeAnomalyId === finding.result.anomalyId;

              return (
                <section className={styles.finding} key={finding.id}>
                  <div className={styles.findingTitle}>
                    <StatusMark complete={completed} />
                    <h3>{finding.label}</h3>
                  </div>
                  <ul aria-label={`${finding.label} requirements`}>
                    {finding.requiredItemIds.map((itemId) => (
                      <li className={inspected.has(itemId) ? styles.requirementDone : ""} key={itemId}>
                        {inspected.has(itemId) ? <Check aria-hidden="true" /> : <span aria-hidden="true" />}
                        {itemId}
                      </li>
                    ))}
                  </ul>
                  {!completed ? (
                    <button
                      className={styles.findingButton}
                      disabled={!ready}
                      onClick={() => issue({ type: "record_comparison", comparisonId: finding.id })}
                      type="button"
                    >
                      {action.record}
                    </button>
                  ) : (
                    <>
                      <p className={styles.conclusion}>{finding.conclusion}</p>
                      <button
                        className={styles.decisionButton}
                        disabled={decisionMade}
                        onClick={() => makeAnomalyDecision(finding.id)}
                        type="button"
                      >
                        {finding.result.action === "reject_anomaly" ? (
                          <X aria-hidden="true" />
                        ) : (
                          <MapPinned aria-hidden="true" />
                        )}
                        {decisionMade ? "Decision recorded" : action.decision}
                      </button>
                    </>
                  )}
                </section>
              );
            })}
          </div>

          {synthesisReady ? (
            <Link
              className={styles.boardLink}
              href="/play/caseboard"
              onClick={() => {
                if (state.phase === "investigation") {
                  issue({ type: "advance_phase", phase: "case_brief" });
                }
              }}
            >
              Open causal caseboard
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <button className={styles.boardLink} disabled type="button">
              Complete all findings to open the caseboard
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </aside>
      </div>
    </main>
  );
}
