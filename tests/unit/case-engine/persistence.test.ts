import { describe, expect, it } from "vitest";

import type { CaseCommand } from "@/lib/case-engine/commands";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { restoreCaseState, serializeCaseState } from "@/lib/case-engine/persistence";
import { reduceCase } from "@/lib/case-engine/reducer";
import { createInitialCaseState } from "@/lib/case-engine/state";
import type { CaseState } from "@/schemas/case-state";
import { repairStepIds } from "@/schemas/reconstruction";

const casePackage = loadVarennesCase();

type CommandInput = CaseCommand extends infer Command
  ? Command extends CaseCommand
    ? Omit<Command, "commandId" | "expectedRevision">
    : never
  : never;

function issue(state: ReturnType<typeof createInitialCaseState>, command: CommandInput) {
  return reduceCase(casePackage, state, {
    ...command,
    commandId: `command-${state.revision + 1}`,
    expectedRevision: state.revision,
  } as CaseCommand).state;
}

describe("case-state persistence", () => {
  it("round-trips a versioned local state envelope", () => {
    const state = {
      ...createInitialCaseState(casePackage),
      revision: 1,
      phase: "fracture" as const,
      completedCommandIds: ["command-1"],
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(state));

    expect(restored.recovered).toBe(false);
    expect(restored.state).toEqual(state);
  });

  it("restores a real reducer-produced investigation state", () => {
    let state = createInitialCaseState(casePackage);
    state = reduceCase(casePackage, state, {
      type: "advance_phase",
      commandId: "to-fracture",
      expectedRevision: state.revision,
      phase: "fracture",
    }).state;
    state = reduceCase(casePackage, state, {
      type: "advance_phase",
      commandId: "to-investigation",
      expectedRevision: state.revision,
      phase: "investigation",
    }).state;
    state = reduceCase(casePackage, state, {
      type: "inspect_item",
      commandId: "inspect-e1",
      expectedRevision: state.revision,
      itemId: "E1",
    }).state;

    const restored = restoreCaseState(casePackage, serializeCaseState(state));

    expect(restored.recovered).toBe(false);
    expect(restored.state).toEqual(state);
  });

  it("restores the full reducer-produced repair and debrief path", () => {
    let state = createInitialCaseState(casePackage);
    state = issue(state, { type: "advance_phase", phase: "fracture" });
    state = issue(state, { type: "advance_phase", phase: "investigation" });

    const pinnedEvidenceIds = ["E1", "E2", "E3", "E5", "E7"];
    const comparisonItemIds = casePackage.solution.requiredComparisonIds.flatMap(
      (comparisonId) =>
        casePackage.comparisonFindings.find((item) => item.id === comparisonId)?.requiredItemIds ??
        [],
    );
    for (const itemId of new Set([...pinnedEvidenceIds, ...comparisonItemIds])) {
      state = issue(state, { type: "inspect_item", itemId });
    }
    for (const comparisonId of casePackage.solution.requiredComparisonIds) {
      state = issue(state, { type: "record_comparison", comparisonId });
    }
    for (const anomalyId of casePackage.solution.rejectedAnomalyIds) {
      state = issue(state, { type: "reject_anomaly", anomalyId });
    }
    state = issue(state, {
      type: "select_active_anomaly",
      anomalyId: casePackage.solution.activeAnomalyId,
    });
    for (const evidenceId of pinnedEvidenceIds) {
      state = issue(state, { type: "pin_evidence", evidenceId });
    }

    state = issue(state, { type: "advance_phase", phase: "case_brief" });
    for (const conditionId of ["COND-BG-001", "COND-CV-001"]) {
      state = issue(state, { type: "select_condition", conditionId });
    }
    for (const nodeId of casePackage.solution.requiredCausalNodeIds) {
      state = issue(state, { type: "place_causal_node", nodeId });
    }
    for (const edgeId of casePackage.solution.requiredCausalEdgeIds) {
      state = issue(state, { type: "connect_causal_edge", edgeId });
    }
    state = issue(state, {
      type: "update_case_brief",
      argument: "A bounded source-based explanation.",
      selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
      selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
    });
    state = issue(state, { type: "submit_case_brief" });
    state = issue(state, { type: "advance_phase", phase: "repair" });

    const repairedPhase = restoreCaseState(casePackage, serializeCaseState(state));
    expect(repairedPhase.recovered).toBe(false);
    expect(repairedPhase.state.phase).toBe("repair");

    for (const stepId of repairStepIds) {
      if (stepId === "RS-05-OBSTRUCTION") {
        state = issue(state, {
          type: "complete_repair_action",
          actionId: "RA-05-OBSTRUCTION",
        });
        state = issue(state, {
          type: "complete_repair_action",
          actionId: "RA-05-PASSPORT",
        });
      }
      state = issue(state, { type: "complete_repair_step", stepId });
    }
    expect(state.completedRepairActionIds).toEqual([
      "RA-05-OBSTRUCTION",
      "RA-05-PASSPORT",
    ]);
    state = issue(state, { type: "complete_repair" });
    const debrief = restoreCaseState(casePackage, serializeCaseState(state));
    expect(debrief.recovered).toBe(false);
    expect(debrief.state.phase).toBe("debrief");
  });

  it("round-trips partial collective-action progress without resetting the next step", () => {
    let state = createInitialCaseState(casePackage);
    state = {
      ...state,
      phase: "repair",
      revision: 64,
      completedCommandIds: Array.from({ length: 64 }, (_, index) => `reachable-${index}`),
      inspectedItemIds: ["E1", "E2", "E3", "E4", "E5", "E7", "E6A", "E6B", "E6C", "FO1", "FO2", "FO3"],
      completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
      rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
      activeAnomalyId: casePackage.solution.activeAnomalyId,
      pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
      selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
      placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
      connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
      completedRepairStepIds: [...repairStepIds.slice(0, 4)],
      completedRepairActionIds: ["RA-05-PASSPORT"],
      caseBrief: {
        argument: "A bounded source-based explanation.",
        selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
        selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
        submitted: true,
      },
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(state));

    expect(restored.recovered).toBe(false);
    expect(restored.state.completedRepairStepIds).toEqual(repairStepIds.slice(0, 4));
    expect(restored.state.completedRepairActionIds).toEqual(["RA-05-PASSPORT"]);
  });

  it("rejects collective-action progress before the joint response step is reachable", () => {
    const unreachable: CaseState = {
      ...createInitialCaseState(casePackage),
      phase: "repair" as const,
      revision: 64,
      completedCommandIds: Array.from({ length: 64 }, (_, index) => `reachable-${index}`),
      inspectedItemIds: ["E1", "E2", "E3", "E4", "E5", "E7", "E6A", "E6B", "E6C", "FO1", "FO2", "FO3"],
      completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
      rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
      activeAnomalyId: casePackage.solution.activeAnomalyId,
      pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
      selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
      placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
      connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
      completedRepairStepIds: [...repairStepIds.slice(0, 2)],
      completedRepairActionIds: ["RA-05-OBSTRUCTION"],
      caseBrief: {
        argument: "A bounded source-based explanation.",
        selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
        selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
        submitted: true,
      },
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(unreachable));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });

  it("rejects an older persistence envelope after the collective-action state bump", () => {
    const staleEnvelope = JSON.parse(
      serializeCaseState(createInitialCaseState(casePackage)),
    ) as { persistenceVersion: string };
    staleEnvelope.persistenceVersion = "1.1.0";

    const restored = restoreCaseState(casePackage, JSON.stringify(staleEnvelope));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("invalid-envelope");
  });

  it("recovers to a clean initial state when local data is invalid", () => {
    const restored = restoreCaseState(casePackage, "not-json");

    expect(restored.recovered).toBe(true);
    expect(restored.state).toEqual(createInitialCaseState(casePackage));
  });

  it("rejects state saved against an older content version", () => {
    const staleState = { ...createInitialCaseState(casePackage), caseVersion: "0.9.0" };

    const restored = restoreCaseState(casePackage, serializeCaseState(staleState));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("incompatible-state");
  });

  it("rejects known IDs assembled into an unreachable state", () => {
    const unreachable = {
      ...createInitialCaseState(casePackage),
      phase: "repair" as const,
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(unreachable));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });

  it("rejects a later phase without the commands needed to reach it", () => {
    const unreachable = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(unreachable));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });

  it("rejects a persisted synthesis phase that skipped the investigation findings", () => {
    const bypassed = {
      ...createInitialCaseState(casePackage),
      phase: "case_brief" as const,
      revision: 3,
      completedCommandIds: ["to-fracture", "to-investigation", "to-case-brief"],
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(bypassed));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });

  it.each([
    ["primer", 1],
    ["fracture", 2],
  ] as const)("rejects extra command history while still in %s", (phase, revision) => {
    const unreachable = {
      ...createInitialCaseState(casePackage),
      phase,
      revision,
      completedCommandIds: Array.from({ length: revision }, (_, index) => `command-${index}`),
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(unreachable));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });

  it("rejects duplicate state entries that the reducer cannot produce", () => {
    const unreachable = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 4,
      completedCommandIds: ["phase-1", "phase-2", "inspect-1", "inspect-2"],
      inspectedItemIds: ["E1", "E1"],
    };

    const restored = restoreCaseState(casePackage, serializeCaseState(unreachable));

    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("unreachable-state");
  });
});
