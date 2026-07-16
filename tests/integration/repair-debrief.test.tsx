import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import DebriefPage from "@/app/play/debrief/page";
import RepairPage from "@/app/play/repair/page";
import { CaseSessionProvider } from "@/components/case-session/case-session-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { createInitialCaseState } from "@/lib/case-engine/state";
import type { CaseState } from "@/schemas/case-state";
import { repairActionIds, repairStepIds } from "@/schemas/reconstruction";

const casePackage = loadVarennesCase();
const reconstruction = loadVarennesReconstruction();

function eligibleState(phase: "repair" | "debrief" = "repair"): CaseState {
  return {
    ...createInitialCaseState(casePackage),
    phase,
    inspectedItemIds: [
      ...casePackage.evidence.map((item) => item.id),
      ...casePackage.anomalies.map((item) => item.id),
      ...casePackage.branchObservations.map((item) => item.id),
    ],
    completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
    rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    activeAnomalyId: casePackage.solution.activeAnomalyId,
    pinnedEvidenceIds: [
      ...new Set(casePackage.solution.requiredEvidenceGroups.flatMap((group) => group.allOf)),
    ],
    selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
    placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
    connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
    completedRepairActionIds: phase === "debrief" ? [...repairActionIds] : [],
    completedRepairStepIds: phase === "debrief" ? [...repairStepIds] : [],
    caseBrief: {
      argument:
        "The route correction enabled pursuit, while local collective capacity shaped the detention. The later political future remained contingent.",
      selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
      selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
      submitted: true,
    },
    repairCompleted: phase === "debrief",
  };
}

describe("repair and debrief", () => {
  it("guards repair when deterministic eligibility has not been achieved", () => {
    render(
      <CaseSessionProvider
        initialState={{ ...createInitialCaseState(casePackage), phase: "case_brief" }}
        persist={false}
      >
        <RepairPage />
      </CaseSessionProvider>,
    );

    expect(screen.getByRole("heading", { name: /repair locked/i })).toBeInTheDocument();
  });

  it("reconstructs every authored step before completing the repair", async () => {
    const user = userEvent.setup();
    render(
      <CaseSessionProvider initialState={eligibleState()} persist={false}>
        <RepairPage />
      </CaseSessionProvider>,
    );

    expect(screen.getByText("Fictional counterfactual boundary")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    for (const step of reconstruction.repairSteps) {
      expect(screen.getAllByText(step.title).length).toBeGreaterThan(0);
      if (step.id === "RS-05-OBSTRUCTION") {
        await user.click(screen.getByRole("button", { name: /restore passage control/i }));
        await user.click(screen.getByRole("button", { name: /restore passport inspection/i }));
      }
      await user.click(await screen.findByRole("button", { name: step.actionLabel }));
    }

    expect(screen.getAllByText("Bounded historical observation")).toHaveLength(
      reconstruction.politicalMeaning.length,
    );
    await user.click(screen.getByRole("button", { name: /complete reconstruction/i }));
    expect(screen.getByRole("heading", { name: /timeline repair recorded/i })).toBeInTheDocument();
    expect(screen.getByText(/bounded reconstruction of the reviewed sequence/i)).toBeInTheDocument();
    expect(screen.getByText(/not prove the two local actions were necessary or sufficient/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open learning summary/i })).toBeInTheDocument();
  });

  it("announces normal-motion repair progress to assistive technology", async () => {
    const user = userEvent.setup();
    render(
      <CaseSessionProvider initialState={eligibleState()} persist={false}>
        <RepairPage />
      </CaseSessionProvider>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/step 1 of 6/i);
    await user.click(
      await screen.findByRole("button", { name: reconstruction.repairSteps[0].actionLabel }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(/step 2 of 6/i);
  });

  it("keeps the two local-response actions independent until both are complete", async () => {
    const user = userEvent.setup();
    render(
      <CaseSessionProvider initialState={eligibleState()} persist={false}>
        <RepairPage />
      </CaseSessionProvider>,
    );

    for (const step of reconstruction.repairSteps.slice(0, 4)) {
      await user.click(await screen.findByRole("button", { name: step.actionLabel }));
    }

    await user.click(screen.getByRole("button", { name: /restore passport inspection/i }));
    expect(screen.getByRole("button", { name: /restore passage control/i })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /place the travelers under guard/i }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /restore passage control/i }));
    expect(
      screen.getByRole("button", { name: /restore passage control and inspection/i }),
    ).toBeEnabled();
  });

  it("offers an information-equivalent reduced-motion reconstruction", async () => {
    const user = userEvent.setup();
    render(
      <CaseSessionProvider initialState={eligibleState()} persist={false}>
        <RepairPage />
      </CaseSessionProvider>,
    );

    await user.click(screen.getByLabelText("Reduced motion"));
    for (const step of reconstruction.repairSteps) {
      expect(screen.getByText(step.statement)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link", { name: /open repair source/i }).length).toBeGreaterThanOrEqual(
      reconstruction.repairSteps.length,
    );
  });

  it("resumes at the next source-linked repair step after persisted progress", async () => {
    const state = {
      ...eligibleState(),
      completedRepairStepIds: [...repairStepIds.slice(0, 2)],
    };
    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <RepairPage />
      </CaseSessionProvider>,
    );

    expect(screen.getByText(reconstruction.repairSteps[2].statement)).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: reconstruction.repairSteps[2].actionLabel }),
    ).toBeInTheDocument();
  });

  it("reports final validated work without inventing a revision history", () => {
    const state = eligibleState("debrief");
    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <DebriefPage />
      </CaseSessionProvider>,
    );

    expect(screen.getByRole("heading", { name: /case reconstructed/i })).toBeInTheDocument();
    expect(screen.getByText(state.caseBrief.argument)).toBeInTheDocument();
    expect(screen.getByText(reconstruction.debrief.finalStateBoundary)).toBeInTheDocument();
    expect(screen.getByText(reconstruction.debrief.teacherReviewBoundary)).toBeInTheDocument();
    expect(screen.getByText("Fictional counterfactual boundary")).toBeInTheDocument();
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    expect(screen.getAllByText("Historical reconstruction")).toHaveLength(
      reconstruction.debrief.established.length,
    );
    for (const item of reconstruction.debrief.established) {
      expect(screen.getByText(item.limitations)).toBeInTheDocument();
    }
    expect(screen.queryByText(/you revised/i)).toBeNull();
    expect(screen.getAllByRole("link", { name: /open source/i }).length).toBeGreaterThan(0);
  });
});
