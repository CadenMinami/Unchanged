import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { getRepairEligibility } from "@/lib/case-engine/repair-eligibility";
import { reduceCase } from "@/lib/case-engine/reducer";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { repairActionIds, repairStepIds } from "@/schemas/reconstruction";
import type { CaseState } from "@/schemas/case-state";

const casePackage = loadVarennesCase();

function createRepairReadyState() {
  const initial = createInitialCaseState(casePackage);
  const pinnedEvidenceIds = ["E1", "E2", "E3", "E5", "E7"];
  const comparisonItemIds = casePackage.solution.requiredComparisonIds.flatMap(
    (comparisonId) =>
      casePackage.comparisonFindings.find((item) => item.id === comparisonId)?.requiredItemIds ?? [],
  );

  return {
    ...initial,
    phase: "repair" as const,
    inspectedItemIds: [...new Set([...pinnedEvidenceIds, ...comparisonItemIds])],
    completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
    rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    activeAnomalyId: casePackage.solution.activeAnomalyId,
    pinnedEvidenceIds,
    selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
    placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
    connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
    caseBrief: {
      argument: "A source-based explanation.",
      selectedConsequenceId: "CONS-REACTION-CONTINUITY",
      selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
      submitted: true,
    },
  };
}

describe("repair eligibility", () => {
  it("accepts the complete deterministic case state", () => {
    const eligibility = getRepairEligibility(casePackage, createRepairReadyState());

    expect(eligibility.eligible).toBe(true);
    expect(eligibility.missingRequirementIds).toEqual([]);
  });

  it("does not count fictional branch observations toward historical evidence", () => {
    const state = createRepairReadyState();
    state.pinnedEvidenceIds = ["E1", "E2", "FO1", "FO2", "FO3"];

    const eligibility = getRepairEligibility(casePackage, state);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.missingRequirementIds).toContain("evidence-groups");
  });

  it("requires the inspections that make evidence pins and comparisons reachable", () => {
    const state = { ...createRepairReadyState(), inspectedItemIds: [] };

    const eligibility = getRepairEligibility(casePackage, state);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.missingRequirementIds).toContain("evidence-inspection");
    expect(eligibility.missingRequirementIds).toContain("comparison-prerequisites");
  });

  it("does not inspect or score the student's free-form prose", () => {
    const strongWords = createRepairReadyState();
    const emptyWords = {
      ...createRepairReadyState(),
      caseBrief: { ...createRepairReadyState().caseBrief, argument: "" },
    };

    expect(getRepairEligibility(casePackage, strongWords)).toEqual(
      getRepairEligibility(casePackage, emptyWords),
    );
  });

  it("rejects otherwise complete state from a different case content version", () => {
    const state = { ...createRepairReadyState(), caseVersion: "0.9.0" };

    const eligibility = getRepairEligibility(casePackage, state);

    expect(eligibility.eligible).toBe(false);
    expect(eligibility.missingRequirementIds).toContain("case-version");
  });

  it("does not complete repair before the source-linked reconstruction is reviewed", () => {
    const state = createRepairReadyState();
    const result = reduceCase(casePackage, state, {
      type: "complete_repair",
      commandId: "repair-timeline",
      expectedRevision: state.revision,
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("repair-steps-incomplete");
    expect(result.state.repairCompleted).toBe(false);
  });

  it("records ordered repair progress before entering debrief", () => {
    let state: CaseState = createRepairReadyState();
    for (const [index, stepId] of repairStepIds.entries()) {
      if (stepId === "RS-05-OBSTRUCTION") {
        for (const [actionIndex, actionId] of repairActionIds.entries()) {
          const action = reduceCase(casePackage, state, {
            type: "complete_repair_action",
            commandId: `repair-action-${actionIndex + 1}`,
            expectedRevision: state.revision,
            actionId,
          });
          expect(action.status).toBe("applied");
          state = action.state;
        }
      }
      const progressed = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        commandId: `repair-step-${index + 1}`,
        expectedRevision: state.revision,
        stepId,
      });
      expect(progressed.status).toBe("applied");
      state = progressed.state;
    }

    const completed = reduceCase(casePackage, state, {
      type: "complete_repair",
      commandId: "complete-repair",
      expectedRevision: state.revision,
    });

    expect(completed.status).toBe("applied");
    expect(completed.state.phase).toBe("debrief");
  });

  it.each([
    [["RA-05-OBSTRUCTION", "RA-05-PASSPORT"]],
    [["RA-05-PASSPORT", "RA-05-OBSTRUCTION"]],
  ] as const)("accepts the two collective detention actions in either order", (actionOrder) => {
    let state: CaseState = createRepairReadyState();

    for (const [index, stepId] of repairStepIds.slice(0, 4).entries()) {
      state = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        commandId: `repair-step-${index + 1}`,
        expectedRevision: state.revision,
        stepId,
      }).state;
    }

    for (const [index, actionId] of actionOrder.entries()) {
      const action = reduceCase(casePackage, state, {
        type: "complete_repair_action",
        commandId: `repair-action-${index + 1}`,
        expectedRevision: state.revision,
        actionId,
      });
      expect(action.status).toBe("applied");
      state = action.state;
    }

    expect(state.completedRepairActionIds).toEqual(actionOrder);
  });

  it("keeps the joint detention step locked until both collective actions are complete", () => {
    let state: CaseState = createRepairReadyState();

    for (const [index, stepId] of repairStepIds.slice(0, 4).entries()) {
      state = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        commandId: `repair-step-${index + 1}`,
        expectedRevision: state.revision,
        stepId,
      }).state;
    }

    const beforeActions = reduceCase(casePackage, state, {
      type: "complete_repair_step",
      commandId: "joint-step-before-actions",
      expectedRevision: state.revision,
      stepId: "RS-05-OBSTRUCTION",
    });
    expect(beforeActions.status).toBe("rejected");
    expect(beforeActions.reason).toBe("repair-actions-incomplete");

    state = reduceCase(casePackage, state, {
      type: "complete_repair_action",
      commandId: "obstruction-action",
      expectedRevision: state.revision,
      actionId: "RA-05-OBSTRUCTION",
    }).state;

    const afterOneAction = reduceCase(casePackage, state, {
      type: "complete_repair_step",
      commandId: "joint-step-after-one-action",
      expectedRevision: state.revision,
      stepId: "RS-05-OBSTRUCTION",
    });
    expect(afterOneAction.status).toBe("rejected");
    expect(afterOneAction.reason).toBe("repair-actions-incomplete");

    state = reduceCase(casePackage, state, {
      type: "complete_repair_action",
      commandId: "passport-action",
      expectedRevision: state.revision,
      actionId: "RA-05-PASSPORT",
    }).state;

    const jointStep = reduceCase(casePackage, state, {
      type: "complete_repair_step",
      commandId: "joint-step-after-both-actions",
      expectedRevision: state.revision,
      stepId: "RS-05-OBSTRUCTION",
    });
    expect(jointStep.status).toBe("applied");
  });

  it("rejects the same repair action twice without changing revision", () => {
    let state: CaseState = createRepairReadyState();

    for (const [index, stepId] of repairStepIds.slice(0, 4).entries()) {
      state = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        commandId: `duplicate-check-step-${index + 1}`,
        expectedRevision: state.revision,
        stepId,
      }).state;
    }

    state = reduceCase(casePackage, state, {
      type: "complete_repair_action",
      commandId: "first-obstruction-action",
      expectedRevision: state.revision,
      actionId: "RA-05-OBSTRUCTION",
    }).state;
    const revisionAfterFirstAction = state.revision;

    const duplicateAction = reduceCase(casePackage, state, {
      type: "complete_repair_action",
      commandId: "second-obstruction-action",
      expectedRevision: state.revision,
      actionId: "RA-05-OBSTRUCTION",
    });

    expect(duplicateAction.status).toBe("rejected");
    expect(duplicateAction.reason).toBe("repair-action-already-complete");
    expect(duplicateAction.state.revision).toBe(revisionAfterFirstAction);
  });

  it("derives step prerequisites from the validated reconstruction descriptor", () => {
    let state: CaseState = createRepairReadyState();
    const reconstruction = loadVarennesReconstruction();

    for (const [index, stepId] of repairStepIds.slice(0, 4).entries()) {
      state = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        commandId: `descriptor-step-${index + 1}`,
        expectedRevision: state.revision,
        stepId,
      }).state;
    }
    state = reduceCase(casePackage, state, {
      type: "complete_repair_action",
      commandId: "descriptor-passport-action",
      expectedRevision: state.revision,
      actionId: "RA-05-PASSPORT",
    }).state;

    const descriptor = {
      ...reconstruction,
      repairSteps: reconstruction.repairSteps.map((step) =>
        step.id === "RS-05-OBSTRUCTION"
          ? { ...step, requiredActionIds: ["RA-05-PASSPORT"] }
          : step,
      ),
    } as typeof reconstruction;
    const result = reduceCase(
      casePackage,
      state,
      {
        type: "complete_repair_step",
        commandId: "descriptor-joint-step",
        expectedRevision: state.revision,
        stepId: "RS-05-OBSTRUCTION",
      },
      descriptor,
    );

    expect(result.status).toBe("applied");
  });

  it("rejects final repair when step progress exists without both collective actions", () => {
    const state: CaseState = {
      ...createRepairReadyState(),
      completedRepairStepIds: [...repairStepIds],
    };

    const result = reduceCase(casePackage, state, {
      type: "complete_repair",
      commandId: "complete-with-forged-step-progress",
      expectedRevision: state.revision,
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("repair-actions-incomplete");
  });

  it("requires reduced-motion repair to use the same granular action and step commands", () => {
    let state: CaseState = createRepairReadyState();
    let commandSequence = 0;

    for (const stepId of repairStepIds) {
      if (stepId === "RS-05-OBSTRUCTION") {
        for (const actionId of repairActionIds) {
          commandSequence += 1;
          const action = reduceCase(casePackage, state, {
            type: "complete_repair_action",
            actionId,
            commandId: `reduced-action-${commandSequence}`,
            expectedRevision: state.revision,
          });
          expect(action.status).toBe("applied");
          state = action.state;
        }
      }

      commandSequence += 1;
      const step = reduceCase(casePackage, state, {
        type: "complete_repair_step",
        stepId,
        commandId: `reduced-step-${commandSequence}`,
        expectedRevision: state.revision,
      });
      expect(step.status).toBe("applied");
      state = step.state;
    }

    expect(state.completedRepairActionIds).toEqual([...repairActionIds]);
    expect(state.completedRepairStepIds).toEqual([...repairStepIds]);
  });

  it("does not complete repair from an earlier phase", () => {
    const state = { ...createRepairReadyState(), phase: "case_brief" as const };
    const result = reduceCase(casePackage, state, {
      type: "complete_repair",
      commandId: "repair-too-early",
      expectedRevision: state.revision,
    });

    expect(result.status).toBe("rejected");
    expect(result.state.repairCompleted).toBe(false);
  });
});
