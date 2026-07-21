import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { reduceCase } from "@/lib/case-engine/reducer";
import type { CaseCommand } from "@/lib/case-engine/commands";
import type { CaseState } from "@/schemas/case-state";

const casePackage = loadVarennesCase();
type CaseCommandInput = CaseCommand extends infer Command
  ? Command extends CaseCommand
    ? Omit<Command, "commandId" | "expectedRevision">
    : never
  : never;

describe("case reducer", () => {
  it("records a comparison only after every required item was inspected", () => {
    let state: CaseState = { ...createInitialCaseState(casePackage), phase: "investigation" };

    const early = reduceCase(casePackage, state, {
      type: "record_comparison",
      commandId: "early-comparison",
      expectedRevision: 0,
      comparisonId: "CMP-REJECT-E6A",
    });
    expect(early.status).toBe("rejected");

    for (const itemId of ["E6A", "FO1", "E3", "E4"]) {
      const result = reduceCase(casePackage, state, {
        type: "inspect_item",
        commandId: `inspect-${itemId}`,
        expectedRevision: state.revision,
        itemId,
      });
      expect(result.status).toBe("applied");
      state = result.state;
    }

    const compared = reduceCase(casePackage, state, {
      type: "record_comparison",
      commandId: "compare-recognition",
      expectedRevision: state.revision,
      comparisonId: "CMP-REJECT-E6A",
    });

    expect(compared.status).toBe("applied");
    expect(compared.state.completedComparisonIds).toContain("CMP-REJECT-E6A");
  });

  it("allows anomaly decisions only after their authored finding is recorded", () => {
    let state: CaseState = { ...createInitialCaseState(casePackage), phase: "investigation" };

    const blocked = reduceCase(casePackage, state, {
      type: "reject_anomaly",
      commandId: "reject-too-early",
      expectedRevision: 0,
      anomalyId: "E6A",
    });
    expect(blocked.status).toBe("rejected");

    state = {
      ...state,
      completedComparisonIds: ["CMP-REJECT-E6A"],
    };
    const rejected = reduceCase(casePackage, state, {
      type: "reject_anomaly",
      commandId: "reject-supported",
      expectedRevision: 0,
      anomalyId: "E6A",
    });

    expect(rejected.status).toBe("applied");
    expect(rejected.state.rejectedAnomalyIds).toEqual(["E6A"]);
  });

  it("never lets a fictional branch observation become pinned historical evidence", () => {
    let state: CaseState = { ...createInitialCaseState(casePackage), phase: "investigation" };
    state = { ...state, inspectedItemIds: ["FO1"] };

    const result = reduceCase(casePackage, state, {
      type: "pin_evidence",
      commandId: "pin-fiction",
      expectedRevision: 0,
      evidenceId: "FO1",
    });

    expect(result.status).toBe("rejected");
    expect(result.state.pinnedEvidenceIds).toEqual([]);
  });

  it("rejects unpinning when malformed state claims uninspected evidence is pinned", () => {
    const state: CaseState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
      pinnedEvidenceIds: ["E3"],
    };

    const result = reduceCase(casePackage, state, {
      type: "unpin_evidence",
      commandId: "unpin-uninspected",
      expectedRevision: 0,
      evidenceId: "E3",
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("evidence-not-inspected");
    expect(result.state.pinnedEvidenceIds).toEqual(["E3"]);
  });

  it("unpins inspected historical evidence and records the command once", () => {
    const state: CaseState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
      revision: 1,
      completedCommandIds: ["pin-e3"],
      inspectedItemIds: ["E3"],
      pinnedEvidenceIds: ["E3"],
    };

    const result = reduceCase(casePackage, state, {
      type: "unpin_evidence",
      commandId: "unpin-e3",
      expectedRevision: 1,
      evidenceId: "E3",
    });

    expect(result.status).toBe("applied");
    expect(result.state.pinnedEvidenceIds).toEqual([]);
    expect(result.state.revision).toBe(2);
    expect(result.state.completedCommandIds).toEqual(["pin-e3", "unpin-e3"]);
  });

  it("treats duplicate commands as idempotent and stale revisions as conflicts", () => {
    const initial = { ...createInitialCaseState(casePackage), phase: "investigation" as const };
    const first = reduceCase(casePackage, initial, {
      type: "inspect_item",
      commandId: "inspect-e1",
      expectedRevision: 0,
      itemId: "E1",
    });

    const duplicate = reduceCase(casePackage, first.state, {
      type: "inspect_item",
      commandId: "inspect-e1",
      expectedRevision: 0,
      itemId: "E1",
    });
    const stale = reduceCase(casePackage, first.state, {
      type: "inspect_item",
      commandId: "inspect-e2",
      expectedRevision: 0,
      itemId: "E2",
    });

    expect(duplicate.status).toBe("duplicate");
    expect(duplicate.state).toEqual(first.state);
    expect(stale.status).toBe("stale");
    expect(stale.state).toEqual(first.state);
  });

  it("treats an already-inspected item as a semantic duplicate", () => {
    const initial = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    const first = reduceCase(casePackage, initial, {
      type: "inspect_item",
      commandId: "inspect-e1-first",
      expectedRevision: 0,
      itemId: "E1",
    });

    const repeated = reduceCase(casePackage, first.state, {
      type: "inspect_item",
      commandId: "inspect-e1-again",
      expectedRevision: first.state.revision,
      itemId: "E1",
    });

    expect(repeated).toEqual({ status: "duplicate", state: first.state });
    expect(repeated.state).toBe(first.state);
    expect(repeated.state.revision).toBe(1);
    expect(repeated.state.completedCommandIds).toEqual(["inspect-e1-first"]);
  });

  it("connects a causal edge only after both endpoint nodes are placed", () => {
    const initial = { ...createInitialCaseState(casePackage), phase: "case_brief" as const };
    const blocked = reduceCase(casePackage, initial, {
      type: "connect_causal_edge",
      commandId: "connect-too-early",
      expectedRevision: 0,
      edgeId: "EDGE-RECOGNITION-ROUTE",
    });

    expect(blocked.status).toBe("rejected");
  });

  it("rejects investigation actions before the investigation phase", () => {
    const initial = createInitialCaseState(casePackage);
    const result = reduceCase(casePackage, initial, {
      type: "inspect_item",
      commandId: "inspect-during-primer",
      expectedRevision: 0,
      itemId: "E1",
    });

    expect(result.status).toBe("rejected");
    expect(result.reason).toBe("command-not-allowed-in-phase");
  });

  it("rejects unknown IDs for removal commands instead of advancing revision", () => {
    const investigation = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    const caseBrief = { ...createInitialCaseState(casePackage), phase: "case_brief" as const };

    const results = [
      reduceCase(casePackage, investigation, {
        type: "unpin_evidence",
        commandId: "unpin-missing",
        expectedRevision: 0,
        evidenceId: "E-MISSING",
      }),
      reduceCase(casePackage, caseBrief, {
        type: "unselect_condition",
        commandId: "unselect-missing",
        expectedRevision: 0,
        conditionId: "COND-MISSING",
      }),
      reduceCase(casePackage, caseBrief, {
        type: "remove_causal_node",
        commandId: "remove-missing",
        expectedRevision: 0,
        nodeId: "NODE-MISSING",
      }),
      reduceCase(casePackage, caseBrief, {
        type: "disconnect_causal_edge",
        commandId: "disconnect-missing",
        expectedRevision: 0,
        edgeId: "EDGE-MISSING",
      }),
    ];

    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(results.every((result) => result.state.revision === 0)).toBe(true);
  });

  it("blocks synthesis until every comparison and anomaly decision is validated", () => {
    const investigation = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    const bypass = reduceCase(casePackage, investigation, {
      type: "advance_phase",
      phase: "case_brief",
      commandId: "bypass-investigation",
      expectedRevision: 0,
    });

    expect(bypass.status).toBe("rejected");
    expect(bypass.reason).toBe("investigation-incomplete");
  });

  it("invalidates a submitted Case Brief after every repair-relevant state change", () => {
    const submittedBrief = {
      argument: "A submitted explanation.",
      selectedConsequenceId: "CONS-REACTION-CONTINUITY",
      selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
      submitted: true,
    };
    const recognitionFinding = casePackage.comparisonFindings.find(
      (finding) => finding.id === "CMP-REJECT-E6A",
    )!;
    const routeFinding = casePackage.comparisonFindings.find(
      (finding) => finding.id === "CMP-SUPPORT-E6B",
    )!;
    const firstEdge = casePackage.causalEdges[0];

    const cases: Array<{
      name: string;
      patch: Partial<CaseState>;
      command: CaseCommandInput;
    }> = [
      {
        name: "comparison",
        patch: { inspectedItemIds: recognitionFinding.requiredItemIds },
        command: { type: "record_comparison", comparisonId: recognitionFinding.id },
      },
      {
        name: "anomaly rejection",
        patch: {
          inspectedItemIds: recognitionFinding.requiredItemIds,
          completedComparisonIds: [recognitionFinding.id],
        },
        command: { type: "reject_anomaly", anomalyId: "E6A" },
      },
      {
        name: "active anomaly",
        patch: {
          inspectedItemIds: routeFinding.requiredItemIds,
          completedComparisonIds: [routeFinding.id],
        },
        command: { type: "select_active_anomaly", anomalyId: "E6B" },
      },
      {
        name: "evidence pin",
        patch: { inspectedItemIds: ["E1"] },
        command: { type: "pin_evidence", evidenceId: "E1" },
      },
      {
        name: "evidence unpin",
        patch: { inspectedItemIds: ["E1"], pinnedEvidenceIds: ["E1"] },
        command: { type: "unpin_evidence", evidenceId: "E1" },
      },
      {
        name: "condition select",
        patch: {},
        command: { type: "select_condition", conditionId: "COND-BG-001" },
      },
      {
        name: "condition unselect",
        patch: { selectedConditionIds: ["COND-BG-001"] },
        command: { type: "unselect_condition", conditionId: "COND-BG-001" },
      },
      {
        name: "node place",
        patch: {},
        command: { type: "place_causal_node", nodeId: firstEdge.fromNodeId },
      },
      {
        name: "node remove",
        patch: {
          placedCausalNodeIds: [firstEdge.fromNodeId, firstEdge.toNodeId],
          connectedCausalEdgeIds: [firstEdge.id],
        },
        command: { type: "remove_causal_node", nodeId: firstEdge.fromNodeId },
      },
      {
        name: "edge connect",
        patch: { placedCausalNodeIds: [firstEdge.fromNodeId, firstEdge.toNodeId] },
        command: { type: "connect_causal_edge", edgeId: firstEdge.id },
      },
      {
        name: "edge disconnect",
        patch: {
          placedCausalNodeIds: [firstEdge.fromNodeId, firstEdge.toNodeId],
          connectedCausalEdgeIds: [firstEdge.id],
        },
        command: { type: "disconnect_causal_edge", edgeId: firstEdge.id },
      },
      {
        name: "brief update",
        patch: {},
        command: {
          type: "update_case_brief",
          argument: "A changed explanation.",
          selectedConsequenceId: "CONS-REACTION-CONTINUITY",
          selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
        },
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const state: CaseState = {
        ...createInitialCaseState(casePackage),
        phase: "case_brief",
        caseBrief: submittedBrief,
        ...testCase.patch,
      };
      const changed = reduceCase(casePackage, state, {
        ...testCase.command,
        commandId: `change-${index}`,
        expectedRevision: 0,
      } as CaseCommand);

      expect(changed.status, testCase.name).toBe("applied");
      expect(changed.state.caseBrief.submitted, testCase.name).toBe(false);
      if (testCase.name === "node remove") {
        expect(changed.state.connectedCausalEdgeIds).not.toContain(firstEdge.id);
      }
    }
  });
});
