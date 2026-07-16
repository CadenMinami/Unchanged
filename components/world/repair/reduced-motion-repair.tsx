"use client";

import { Check, ExternalLink, FileSearch, Route, ShieldCheck } from "lucide-react";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import { derivePursuitSequenceState } from "@/lib/world/pursuit-sequence";
import type { repairActionIds } from "@/schemas/reconstruction";

import styles from "./pursuit-repair.module.css";

const reconstruction = loadVarennesReconstruction();
const manifest = loadVarennesSceneManifest();
const casePackage = loadVarennesCase();

type RepairActionId = (typeof repairActionIds)[number];

const actionCopy: Record<RepairActionId, { label: string; icon: typeof Route }> = {
  "RA-05-OBSTRUCTION": { label: "Restore passage control", icon: Route },
  "RA-05-PASSPORT": { label: "Restore passport inspection", icon: FileSearch },
};

interface ReducedMotionRepairProps {
  completedActionIds: readonly string[];
  completedStepIds: readonly string[];
  onRequestAction: (id: RepairActionId) => void;
  onRequestStep: (id: (typeof reconstruction.repairSteps)[number]["id"]) => void;
}

function SourceLinks({ sourceIds }: { sourceIds: readonly string[] }) {
  return (
    <div className={styles.sourceLinks} aria-label="Canonical sources">
      {sourceIds.map((sourceId) => {
        const source = casePackage.sources.find((item) => item.id === sourceId);
        if (!source) return null;
        return (
          <a
            aria-label={`Open repair source: ${source.title}`}
            href={source.citationUrl}
            key={source.id}
            rel="noreferrer"
            target="_blank"
          >
            {source.title}
            <ExternalLink aria-hidden="true" />
          </a>
        );
      })}
    </div>
  );
}

export function ReducedMotionRepair({
  completedActionIds,
  completedStepIds,
  onRequestAction,
  onRequestStep,
}: ReducedMotionRepairProps) {
  const sequence = derivePursuitSequenceState(
    manifest.repairPath,
    completedStepIds,
    completedActionIds,
  );
  const currentStep = reconstruction.repairSteps.find((step) => step.id === sequence.currentStepId);
  const availableActionIds = sequence.availableActionIds as RepairActionId[];

  return (
    <section className={styles.reduced} aria-labelledby="reduced-motion-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>HISTORICAL RECONSTRUCTION / SCHEMATIC, NOT TO SCALE</p>
          <h2 id="reduced-motion-heading">Reduced-motion reconstruction</h2>
        </div>
        <p className={styles.manifestLabel}>{manifest.repairPath.placementLabel}</p>
      </header>

      <p className={styles.orderNote}>The two local actions can be completed in either order.</p>
      <ol className={styles.sequenceList}>
        {reconstruction.repairSteps.map((step) => {
          const isCurrent = step.id === currentStep?.id;
          const isComplete = completedStepIds.includes(step.id);
          return (
            <li data-current={isCurrent || undefined} data-complete={isComplete || undefined} key={step.id}>
              <div className={styles.stepHeading}>
                {isComplete ? <Check aria-hidden="true" /> : <span>{String(step.sequence).padStart(2, "0")}</span>}
                <h3>{step.title}</h3>
              </div>
              <p>{step.statement}</p>
              {step.id === "RS-06-DETENTION" ? (
                <p className={styles.detentionRelation}>The two local actions contributed to this bounded reconstruction of guarded detention.</p>
              ) : null}
              <SourceLinks sourceIds={step.sourceIds} />
              {isCurrent ? (
                <div className={styles.staticRequests}>
                  {availableActionIds.length > 0 ? (
                    <>
                      <p>Complete the local actions in either order before reviewing this step.</p>
                      {availableActionIds.map((actionId) => {
                        const action = actionCopy[actionId];
                        const Icon = action.icon;
                        return (
                          <button key={actionId} onClick={() => onRequestAction(actionId)} type="button">
                            <Icon aria-hidden="true" />
                            {action.label}
                          </button>
                        );
                      })}
                    </>
                  ) : (
                    <button onClick={() => onRequestStep(step.id)} type="button">
                      <ShieldCheck aria-hidden="true" />
                      {step.actionLabel}
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

    </section>
  );
}
