"use client";

import { ArrowRight, Check, CircleDashed, FileCheck2, Route, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { getRepairEligibility } from "@/lib/case-engine/repair-eligibility";
import { describeRepairRequirement } from "@/lib/case-engine/repair-requirements";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { isInvestigationComplete, matchAuthoredCausalEdge } from "@/lib/case-engine/selectors";

import { CaseBriefForm } from "./case-brief-form";
import { CaseBriefFeedback } from "./case-brief-feedback";
import { CausalChain } from "./causal-chain";
import { ConditionSelector } from "./condition-selector";
import styles from "./causal-caseboard.module.css";

const casePackage = loadVarennesCase();
const reconstruction = loadVarennesReconstruction();
const detentionStep = reconstruction.repairSteps.find(
  (step) => step.id === "RS-06-DETENTION",
)!;
const edgeNotices = Object.fromEntries(
  detentionStep.edgeIds.map((edgeId) => [
    edgeId,
    { label: "Authored reconstruction", statement: detentionStep.statement },
  ]),
);

interface CausalCaseboardProps {
  embedded?: boolean;
  returnHref?: string;
}

export function CausalCaseboard({
  embedded = false,
  returnHref = "/play/investigate",
}: CausalCaseboardProps = {}) {
  const { state, ready, issue } = useCaseSession();
  const Root = embedded ? "div" : "main";

  if (!ready) {
    return (
      <Root className={styles.routeGate} aria-busy="true" aria-live="polite">
        <p className={styles.eyebrow}>Caseboard / Restoring session</p>
        <h1>Reopening your supported chain.</h1>
      </Root>
    );
  }

  if (state.phase !== "case_brief" || !isInvestigationComplete(casePackage, state)) {
    return (
      <Root className={styles.routeGate}>
        <p className={styles.eyebrow}>Case protocol / Phase guard</p>
        <h1>Caseboard locked.</h1>
        <p>Complete the anomaly comparisons before constructing the causal explanation.</p>
        <Link href={returnHref}>
          Return to investigation
          <ArrowRight aria-hidden="true" />
        </Link>
      </Root>
    );
  }

  const selectedConditionIds = new Set(state.selectedConditionIds);
  const placedNodeIds = new Set(state.placedCausalNodeIds);
  const connectedEdgeIds = new Set(state.connectedCausalEdgeIds);
  const eligibility = getRepairEligibility(casePackage, state);
  const mechanismNodes = casePackage.causalNodes.filter((node) => node.category !== "consequence");
  const requiredEvidenceIds = new Set(
    casePackage.solution.requiredEvidenceGroups.flatMap((group) => group.allOf),
  );
  const pinnedEvidence = casePackage.evidence.filter((evidence) =>
    requiredEvidenceIds.has(evidence.id) && state.pinnedEvidenceIds.includes(evidence.id),
  );

  return (
    <Root className={styles.workspace}>
      <header className={styles.masthead}>
        <div>
          <Link className={styles.wordmark} href="/">History Unbroken</Link>
          <span>CASE 01 / CASEBOARD</span>
        </div>
        <Link href={returnHref}>{embedded ? "Return to reconstruction" : "Return to archive"}</Link>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Act III / Synthesis</p>
          <h1>Build one defensible explanation.</h1>
          <p>
            The route handoff is one altered link. Reconstruct the historical mechanism around it,
            then limit what the evidence allows you to claim.
          </p>
        </div>
        <aside className={styles.diagnosis} aria-label="Anomaly diagnosis">
          <Route aria-hidden="true" />
          <div>
            <span>Best-fit anomaly</span>
            <strong>{casePackage.anomalies.find((item) => item.id === state.activeAnomalyId)?.title}</strong>
            <p>{state.rejectedAnomalyIds.length}/2 alternatives eliminated</p>
          </div>
        </aside>
      </section>

      <section className={styles.evidenceStrip} aria-label="Pinned historical evidence">
        <div>
          <FileCheck2 aria-hidden="true" />
          <p><strong>{pinnedEvidence.length} / {requiredEvidenceIds.size} required historical records pinned</strong><span>Fictional branch observations are excluded.</span></p>
        </div>
        <ul>
          {pinnedEvidence.map((evidence) => (
            <li data-testid={`brief-evidence-${evidence.id}`} key={evidence.id}>
              <span>{evidence.id}</span>{evidence.shortTitle}
            </li>
          ))}
        </ul>
      </section>

      <ConditionSelector
        conditions={casePackage.conditions}
        onToggle={(conditionId, selected) =>
          issue({ type: selected ? "unselect_condition" : "select_condition", conditionId })
        }
        selectedIds={selectedConditionIds}
      />

      <CausalChain
        connectedIds={connectedEdgeIds}
        edgeNotices={edgeNotices}
        edges={casePackage.causalEdges}
        nodes={mechanismNodes}
        onDisconnectEdge={(edgeId) => issue({ type: "disconnect_causal_edge", edgeId })}
        onProposeEdge={(proposal) => {
          const edge = matchAuthoredCausalEdge(casePackage, proposal);
          if (!edge) return false;
          if (!connectedEdgeIds.has(edge.id)) issue({ type: "connect_causal_edge", edgeId: edge.id });
          return true;
        }}
        onToggleNode={(nodeId, placed) =>
          issue({ type: placed ? "remove_causal_node" : "place_causal_node", nodeId })
        }
        placedIds={placedNodeIds}
      />

      <CaseBriefForm
        caseBrief={state.caseBrief}
        casePackage={casePackage}
        onSubmit={(draft) => {
          issue({ type: "update_case_brief", ...draft });
          issue({ type: "submit_case_brief" });
        }}
      />

      <CaseBriefFeedback />

      <section className={styles.requirements} aria-live="polite">
        <div className={eligibility.eligible ? styles.readyIcon : styles.pendingIcon}>
          {eligibility.eligible ? <ShieldCheck aria-hidden="true" /> : <CircleDashed aria-hidden="true" />}
        </div>
        <div>
          <p className={styles.eyebrow}>Deterministic repair gate</p>
          <h2>{eligibility.eligible ? "Repair ready" : "Causal chain incomplete"}</h2>
          {eligibility.eligible ? (
            <p>The validated evidence, conditions, mechanism, consequence, and claim limits are assembled.</p>
          ) : (
            <ul>
              {eligibility.missingRequirementIds.map((requirementId) => (
                <li key={requirementId}>
                  <Check aria-hidden="true" />
                  {describeRepairRequirement(requirementId)}
                </li>
              ))}
            </ul>
          )}
        </div>
        {eligibility.eligible ? (
          <Link
            data-world-phase-after-release="repair"
            href="/play/repair"
            onClick={(event) => {
              if (
                event.defaultPrevented ||
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                event.shiftKey
              ) {
                return;
              }
              issue({ type: "advance_phase", phase: "repair" });
            }}
          >
            Review timeline repair
            <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </section>
    </Root>
  );
}
