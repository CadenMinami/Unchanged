import type { CaseCommand } from "./commands";
import { loadVarennesReconstruction } from "./load-reconstruction";
import { getRepairEligibility } from "./repair-eligibility";
import { isInvestigationComplete } from "./selectors";
import type { CasePackage } from "@/schemas/case-package";
import type { CaseState } from "@/schemas/case-state";
import type { Reconstruction } from "@/schemas/reconstruction";

export type ReducerStatus = "applied" | "duplicate" | "stale" | "rejected";

export interface ReducerResult {
  state: CaseState;
  status: ReducerStatus;
  reason?: string;
}

const defaultReconstruction = loadVarennesReconstruction();

function addUnique<T>(items: readonly T[], item: T): T[] {
  return items.includes(item) ? [...items] : [...items, item];
}

function removeItem<T>(items: readonly T[], item: T): T[] {
  return items.filter((candidate) => candidate !== item);
}

function invalidatedCaseBrief(state: CaseState): CaseState["caseBrief"] {
  return { ...state.caseBrief, submitted: false };
}

function applyCommand(state: CaseState, commandId: string, patch: Partial<CaseState>): ReducerResult {
  return {
    status: "applied",
    state: {
      ...state,
      ...patch,
      revision: state.revision + 1,
      completedCommandIds: [...state.completedCommandIds, commandId],
    },
  };
}

function reject(state: CaseState, reason: string): ReducerResult {
  return { state, status: "rejected", reason };
}

export function reduceCase(
  casePackage: CasePackage,
  state: CaseState,
  command: CaseCommand,
  reconstruction: Reconstruction = defaultReconstruction,
): ReducerResult {
  const repairStepIds = reconstruction.repairSteps.map((step) => step.id);
  const repairActionIds = [
    ...new Set(reconstruction.repairSteps.flatMap((step) => step.requiredActionIds)),
  ];
  if (state.completedCommandIds.includes(command.commandId)) {
    return { state, status: "duplicate" };
  }
  if (command.expectedRevision !== state.revision) {
    return { state, status: "stale", reason: "revision-mismatch" };
  }

  const investigationCommands = new Set<CaseCommand["type"]>([
    "inspect_item",
    "record_comparison",
    "reject_anomaly",
    "select_active_anomaly",
    "pin_evidence",
    "unpin_evidence",
  ]);
  const caseBriefCommands = new Set<CaseCommand["type"]>([
    "select_condition",
    "unselect_condition",
    "place_causal_node",
    "remove_causal_node",
    "connect_causal_edge",
    "disconnect_causal_edge",
    "update_case_brief",
    "submit_case_brief",
  ]);

  if (
    investigationCommands.has(command.type) &&
    state.phase !== "investigation" &&
    state.phase !== "case_brief"
  ) {
    return reject(state, "command-not-allowed-in-phase");
  }
  if (caseBriefCommands.has(command.type) && state.phase !== "case_brief") {
    return reject(state, "command-not-allowed-in-phase");
  }
  if (
    [
      "complete_repair_action",
      "complete_repair_step",
      "complete_repair",
    ].includes(command.type) &&
    state.phase !== "repair"
  ) {
    return reject(state, "command-not-allowed-in-phase");
  }

  switch (command.type) {
    case "inspect_item": {
      const validIds = new Set([
        ...casePackage.evidence.map((item) => item.id),
        ...casePackage.anomalies.map((item) => item.id),
        ...casePackage.branchObservations.map((item) => item.id),
      ]);
      if (!validIds.has(command.itemId)) return reject(state, "unknown-item");
      if (state.inspectedItemIds.includes(command.itemId)) {
        return { state, status: "duplicate" };
      }
      return applyCommand(state, command.commandId, {
        inspectedItemIds: addUnique(state.inspectedItemIds, command.itemId),
      });
    }

    case "record_comparison": {
      const finding = casePackage.comparisonFindings.find(
        (item) => item.id === command.comparisonId,
      );
      if (!finding) return reject(state, "unknown-comparison");
      if (!finding.requiredItemIds.every((itemId) => state.inspectedItemIds.includes(itemId))) {
        return reject(state, "comparison-items-not-inspected");
      }
      return applyCommand(state, command.commandId, {
        completedComparisonIds: addUnique(
          state.completedComparisonIds,
          command.comparisonId,
        ),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "reject_anomaly":
    case "select_active_anomaly": {
      const expectedAction =
        command.type === "reject_anomaly" ? "reject_anomaly" : "support_active_anomaly";
      const hasFinding = casePackage.comparisonFindings.some(
        (finding) =>
          state.completedComparisonIds.includes(finding.id) &&
          finding.result.action === expectedAction &&
          finding.result.anomalyId === command.anomalyId,
      );
      if (!hasFinding) return reject(state, "anomaly-decision-not-supported");

      return command.type === "reject_anomaly"
        ? applyCommand(state, command.commandId, {
            rejectedAnomalyIds: addUnique(state.rejectedAnomalyIds, command.anomalyId),
            caseBrief: invalidatedCaseBrief(state),
          })
        : applyCommand(state, command.commandId, {
            activeAnomalyId: command.anomalyId,
            caseBrief: invalidatedCaseBrief(state),
          });
    }

    case "pin_evidence": {
      const evidence = casePackage.evidence.find((item) => item.id === command.evidenceId);
      if (!evidence || !evidence.countsAsHistoricalEvidence) {
        return reject(state, "not-historical-evidence");
      }
      if (!state.inspectedItemIds.includes(command.evidenceId)) {
        return reject(state, "evidence-not-inspected");
      }
      return applyCommand(state, command.commandId, {
        pinnedEvidenceIds: addUnique(state.pinnedEvidenceIds, command.evidenceId),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "unpin_evidence": {
      const evidence = casePackage.evidence.find((item) => item.id === command.evidenceId);
      if (!evidence || !evidence.countsAsHistoricalEvidence) {
        return reject(state, "not-historical-evidence");
      }
      if (!state.inspectedItemIds.includes(command.evidenceId)) {
        return reject(state, "evidence-not-inspected");
      }
      return applyCommand(state, command.commandId, {
        pinnedEvidenceIds: removeItem(state.pinnedEvidenceIds, command.evidenceId),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "select_condition": {
      if (!casePackage.conditions.some((item) => item.id === command.conditionId)) {
        return reject(state, "unknown-condition");
      }
      return applyCommand(state, command.commandId, {
        selectedConditionIds: addUnique(state.selectedConditionIds, command.conditionId),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "unselect_condition":
      if (!casePackage.conditions.some((item) => item.id === command.conditionId)) {
        return reject(state, "unknown-condition");
      }
      return applyCommand(state, command.commandId, {
        selectedConditionIds: removeItem(state.selectedConditionIds, command.conditionId),
        caseBrief: invalidatedCaseBrief(state),
      });

    case "place_causal_node": {
      if (!casePackage.causalNodes.some((item) => item.id === command.nodeId)) {
        return reject(state, "unknown-causal-node");
      }
      return applyCommand(state, command.commandId, {
        placedCausalNodeIds: addUnique(state.placedCausalNodeIds, command.nodeId),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "remove_causal_node": {
      if (!casePackage.causalNodes.some((item) => item.id === command.nodeId)) {
        return reject(state, "unknown-causal-node");
      }
      const attachedEdgeIds = casePackage.causalEdges
        .filter(
          (edge) => edge.fromNodeId === command.nodeId || edge.toNodeId === command.nodeId,
        )
        .map((edge) => edge.id);
      return applyCommand(state, command.commandId, {
        placedCausalNodeIds: removeItem(state.placedCausalNodeIds, command.nodeId),
        connectedCausalEdgeIds: state.connectedCausalEdgeIds.filter(
          (edgeId) => !attachedEdgeIds.includes(edgeId),
        ),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "connect_causal_edge": {
      const edge = casePackage.causalEdges.find((item) => item.id === command.edgeId);
      if (!edge) return reject(state, "unknown-causal-edge");
      if (
        !state.placedCausalNodeIds.includes(edge.fromNodeId) ||
        !state.placedCausalNodeIds.includes(edge.toNodeId)
      ) {
        return reject(state, "causal-edge-endpoints-not-placed");
      }
      return applyCommand(state, command.commandId, {
        connectedCausalEdgeIds: addUnique(state.connectedCausalEdgeIds, command.edgeId),
        caseBrief: invalidatedCaseBrief(state),
      });
    }

    case "disconnect_causal_edge":
      if (!casePackage.causalEdges.some((item) => item.id === command.edgeId)) {
        return reject(state, "unknown-causal-edge");
      }
      return applyCommand(state, command.commandId, {
        connectedCausalEdgeIds: removeItem(state.connectedCausalEdgeIds, command.edgeId),
        caseBrief: invalidatedCaseBrief(state),
      });

    case "update_case_brief": {
      if (
        command.selectedConsequenceId &&
        !casePackage.solution.limitedConsequenceIds.includes(command.selectedConsequenceId)
      ) {
        return reject(state, "unsupported-consequence");
      }
      if (
        !command.selectedUncertaintyIds.every((id) =>
          casePackage.uncertainties.some((item) => item.id === id),
        )
      ) {
        return reject(state, "unknown-uncertainty");
      }
      return applyCommand(state, command.commandId, {
        caseBrief: {
          argument: command.argument,
          selectedConsequenceId: command.selectedConsequenceId,
          selectedUncertaintyIds: [...new Set(command.selectedUncertaintyIds)],
          submitted: false,
        },
      });
    }

    case "submit_case_brief":
      return applyCommand(state, command.commandId, {
        caseBrief: { ...state.caseBrief, submitted: true },
      });

    case "complete_repair_action": {
      if (!getRepairEligibility(casePackage, state).eligible) {
        return reject(state, "repair-not-eligible");
      }
      const currentStep = reconstruction.repairSteps[state.completedRepairStepIds.length];
      if (!currentStep?.requiredActionIds.includes(command.actionId)) {
        return reject(state, "repair-action-not-available");
      }
      if (state.completedRepairActionIds.includes(command.actionId)) {
        return reject(state, "repair-action-already-complete");
      }
      return applyCommand(state, command.commandId, {
        completedRepairActionIds: addUnique(
          state.completedRepairActionIds,
          command.actionId,
        ),
      });
    }

    case "complete_repair_step": {
      if (!getRepairEligibility(casePackage, state).eligible) {
        return reject(state, "repair-not-eligible");
      }
      const currentStepIndex = state.completedRepairStepIds.length;
      const currentStep = reconstruction.repairSteps[currentStepIndex];
      if (command.stepId !== currentStep?.id) {
        return reject(state, "repair-step-out-of-order");
      }
      const requiredActionsThroughStep = new Set(
        reconstruction.repairSteps
          .slice(0, currentStepIndex + 1)
          .flatMap((step) => step.requiredActionIds),
      );
      if (
        ![...requiredActionsThroughStep].every((actionId) =>
          state.completedRepairActionIds.includes(actionId),
        )
      ) {
        return reject(state, "repair-actions-incomplete");
      }
      return applyCommand(state, command.commandId, {
        completedRepairStepIds: [...state.completedRepairStepIds, command.stepId],
      });
    }

    case "complete_repair": {
      if (!getRepairEligibility(casePackage, state).eligible) {
        return reject(state, "repair-not-eligible");
      }
      if (
        state.completedRepairStepIds.length !== repairStepIds.length ||
        !repairStepIds.every((stepId, index) => state.completedRepairStepIds[index] === stepId)
      ) {
        return reject(state, "repair-steps-incomplete");
      }
      if (
        !repairActionIds.every((actionId) =>
          state.completedRepairActionIds.includes(actionId),
        )
      ) {
        return reject(state, "repair-actions-incomplete");
      }
      return applyCommand(state, command.commandId, { repairCompleted: true, phase: "debrief" });
    }

    case "advance_phase": {
      const nextPhase = {
        primer: "fracture",
        fracture: "investigation",
        investigation: "case_brief",
        case_brief: "repair",
        repair: null,
        debrief: null,
      } as const;
      if (nextPhase[state.phase] !== command.phase) return reject(state, "invalid-phase-transition");
      if (command.phase === "case_brief" && !isInvestigationComplete(casePackage, state)) {
        return reject(state, "investigation-incomplete");
      }
      if (command.phase === "repair" && !getRepairEligibility(casePackage, state).eligible) {
        return reject(state, "repair-not-eligible");
      }
      return applyCommand(state, command.commandId, { phase: command.phase });
    }
  }
}
