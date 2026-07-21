import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import CaseboardPage from "@/app/play/caseboard/page";
import {
  CaseSessionProvider,
  useCaseSession,
} from "@/components/case-session/case-session-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import type { CaseState } from "@/schemas/case-state";

const casePackage = loadVarennesCase();

function caseBriefState(): CaseState {
  return {
    ...createInitialCaseState(casePackage),
    phase: "case_brief" as const,
    revision: 14,
    completedCommandIds: Array.from({ length: 14 }, (_, index) => `setup-${index}`),
    inspectedItemIds: [
      ...casePackage.evidence.map((item) => item.id),
      ...casePackage.anomalies.map((item) => item.id),
      ...casePackage.branchObservations.map((item) => item.id),
    ],
    completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
    rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    activeAnomalyId: casePackage.solution.activeAnomalyId,
    pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
  };
}

function renderCaseboard(state: CaseState = caseBriefState()) {
  return render(
    <CaseSessionProvider initialState={state} persist={false}>
      <CaseboardPage />
      <CaseStateProbe />
    </CaseSessionProvider>,
  );
}

function CaseStateProbe() {
  const { state } = useCaseSession();
  return (
    <output data-testid="caseboard-state-probe" hidden>
      {JSON.stringify(state)}
    </output>
  );
}

function readRenderedCaseState(): CaseState {
  return JSON.parse(
    screen.getByTestId("caseboard-state-probe").textContent ?? "null",
  ) as CaseState;
}

function submittedCaseBriefState(): CaseState {
  return {
    ...caseBriefState(),
    revision: 15,
    caseBrief: {
      argument:
        "The route information changed the pursuit, but local action also mattered and later outcomes were not inevitable.",
      selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
      selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
      submitted: true,
    },
  };
}

function repairReadyCaseBriefState(): CaseState {
  return {
    ...submittedCaseBriefState(),
    revision: 24,
    selectedConditionIds: casePackage.conditions.map((condition) => condition.id),
    placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
    connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("causal caseboard and Case Brief", () => {
  it("guards the board until the investigation advances", () => {
    renderCaseboard({
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });

    expect(screen.getByRole("heading", { name: /caseboard locked/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /build the supported chain/i })).toBeNull();
  });

  it("guards a malformed synthesis state that lacks validated findings", () => {
    renderCaseboard({
      ...createInitialCaseState(casePackage),
      phase: "case_brief",
    });

    expect(screen.getByRole("heading", { name: /caseboard locked/i })).toBeInTheDocument();
    expect(screen.queryByText(/route handoff is one altered link/i)).toBeNull();
  });

  it("shows the exact package-backed evidence, consequence, and uncertainty requirements", () => {
    renderCaseboard();

    const requiredEvidenceIds = [
      ...new Set(casePackage.solution.requiredEvidenceGroups.flatMap((group) => group.allOf)),
    ];
    expect(
      screen.getByText(
        `${requiredEvidenceIds.length} / ${requiredEvidenceIds.length} required historical records pinned`,
      ),
    ).toBeInTheDocument();
    for (const evidenceId of requiredEvidenceIds) {
      expect(screen.getByTestId(`brief-evidence-${evidenceId}`)).toBeInTheDocument();
    }
    const consequence = casePackage.causalNodes.find((node) =>
      casePackage.solution.limitedConsequenceIds.includes(node.id),
    )!;
    expect(screen.getByText(consequence.label)).toBeInTheDocument();
    for (const uncertainty of casePackage.uncertainties) {
      expect(screen.getByLabelText(uncertainty.label)).toBeInTheDocument();
    }
    expect(screen.getByText(/prose cannot unlock or block the repair/i)).toBeInTheDocument();
  });

  it("reports partial evidence progress without overstating the deterministic gate", () => {
    renderCaseboard({ ...caseBriefState(), pinnedEvidenceIds: ["E1"] });

    expect(screen.getByText("1 / 5 required historical records pinned")).toBeInTheDocument();
  });

  it("does not let a polished essay bypass missing deterministic reasoning actions", async () => {
    const user = userEvent.setup();
    renderCaseboard();

    await user.type(
      screen.getByLabelText(/argument in your own words/i),
      "The route handoff mattered within a broader network of political and local conditions.",
    );
    await user.click(screen.getByRole("button", { name: /save and submit case brief/i }));

    expect(screen.getByText(/causal chain incomplete/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /review timeline repair/i })).toBeNull();
  });

  it("evaluates only the committed Case Brief snapshot and keeps the repair gate independent", async () => {
    let requestBody: Record<string, unknown> | null = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body));
        return Response.json({
          contractVersion: requestBody!.contractVersion,
          caseId: requestBody!.caseId,
          caseSchemaVersion: requestBody!.caseSchemaVersion,
          caseVersion: requestBody!.caseVersion,
          policyVersion: requestBody!.policyVersion,
          stateVersion: requestBody!.stateVersion,
          requestId: requestBody!.requestId,
          stateRevision: requestBody!.stateRevision,
          promptVersion: requestBody!.promptVersion,
          status: "ok",
          source: "model",
          authority: "formative_only",
          mutatesCaseState: false,
          feedback: {
            formativeStatus: "supported_incomplete",
            summary:
              "The explanation uses relevant evidence, but one part of the causal reasoning remains incomplete.",
            evidenceClaimLinks: [
              {
                evidenceId: "E3",
                studentSpan: "route information changed the pursuit",
                fit: "supports",
              },
            ],
            concerns: [],
            rubricScores: {
              sourcing: 3,
              corroboration: 2,
              causalReasoning: 3,
              claimEvidenceFit: 3,
              uncertainty: 3,
            },
            rubricReasons: {
              sourcing: "The brief distinguishes source claims from established facts.",
              corroboration: "The brief uses several records but needs a clearer comparison.",
              causalReasoning: "The altered link and local action are connected.",
              claimEvidenceFit: "The central claims match the pinned evidence.",
              uncertainty: "The brief limits what the evidence can prove.",
            },
            revisionPrompt: "Explain which local actions turned the warning into detention.",
            renderedTemplateIds: [
              "SUMMARY-SUPPORTED-INCOMPLETE",
              "RUBRIC-SOURCING-STRONG",
              "RUBRIC-CORROBORATION-DEVELOPING",
              "RUBRIC-CAUSAL-STRONG",
              "RUBRIC-FIT-STRONG",
              "RUBRIC-UNCERTAINTY-STRONG",
              "REVISION-LOCAL-ACTION",
            ],
          },
        });
      }),
    );

    renderCaseboard(submittedCaseBriefState());

    expect(await screen.findByText(/uses relevant evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/ai-assisted formative feedback/i)).toBeInTheDocument();
    expect(screen.getByText(/causal chain incomplete/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /review timeline repair/i })).toBeNull();
    await waitFor(() => expect(requestBody).not.toBeNull());
    expect(
      (requestBody!.caseState as CaseState).caseBrief.submitted,
    ).toBe(true);
    expect(requestBody!.stateRevision).toBe(15);
  });

  it("keeps a deterministic repair-ready result available when formative feedback falls back", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const request = JSON.parse(String(init?.body));
        return Response.json({
          contractVersion: request.contractVersion,
          caseId: request.caseId,
          caseSchemaVersion: request.caseSchemaVersion,
          caseVersion: request.caseVersion,
          policyVersion: request.policyVersion,
          stateVersion: request.stateVersion,
          requestId: request.requestId,
          stateRevision: request.stateRevision,
          promptVersion: request.promptVersion,
          status: "fallback",
          source: "deterministic_fallback",
          authority: "formative_only",
          mutatesCaseState: false,
          reason: "missing_api_key",
          retryable: false,
          displayMessage:
            "AI-assisted feedback is unavailable. Your Case Brief is preserved and your deterministic repair status is unchanged.",
        });
      }),
    );

    renderCaseboard(repairReadyCaseBriefState());

    expect(await screen.findByText(/ai-assisted feedback is unavailable/i)).toBeInTheDocument();
    expect(screen.getByText("Repair ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review timeline repair/i })).toBeInTheDocument();
    expect(screen.queryByText(/rubric score/i)).toBeNull();
  });

  it("advances a standalone repair-ready caseboard without a world camera transaction", () => {
    renderCaseboard(repairReadyCaseBriefState());
    const preventExternalNavigation = (event: MouseEvent) =>
      event.preventDefault();
    window.addEventListener("click", preventExternalNavigation);

    fireEvent.click(
      screen.getByRole("link", { name: /review timeline repair/i }),
    );

    window.removeEventListener("click", preventExternalNavigation);
    expect(readRenderedCaseState().phase).toBe("repair");
  });

  it("becomes repair-ready only after the full supported network is constructed", async () => {
    const user = userEvent.setup();
    renderCaseboard();

    await user.click(
      screen.getByRole("button", {
        name: `Select condition: ${casePackage.conditions[0].label}`,
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: `Select condition: ${casePackage.conditions.find((item) => item.category === "civic")!.label}`,
      }),
    );

    for (const node of casePackage.causalNodes.filter((item) => item.category !== "consequence")) {
      const placeButton = screen.getByRole("button", { name: `Place ${node.label}` });
      expect(placeButton).toHaveAttribute("aria-pressed", "false");
      await user.click(placeButton);
    }
    for (const edge of casePackage.causalEdges) {
      const from = casePackage.causalNodes.find((node) => node.id === edge.fromNodeId)!;
      const to = casePackage.causalNodes.find((node) => node.id === edge.toNodeId)!;
      await user.selectOptions(screen.getByLabelText("Cause"), from.id);
      await user.selectOptions(screen.getByLabelText("Relationship"), edge.verb);
      await user.selectOptions(screen.getByLabelText("Effect"), to.id);
      await user.click(screen.getByRole("button", { name: /test causal link/i }));
    }

    const consequence = casePackage.causalNodes.find((node) =>
      casePackage.solution.limitedConsequenceIds.includes(node.id),
    )!;
    await user.click(screen.getByLabelText(consequence.label));
    for (const uncertainty of casePackage.uncertainties) {
      await user.click(screen.getByLabelText(uncertainty.label));
    }
    await user.type(
      screen.getByLabelText(/argument in your own words/i),
      "The route correction enabled pursuit, but local capacity and the unsettled constitution shaped what followed. The evidence does not establish Louis's complete motives or make later outcomes inevitable.",
    );
    await user.click(screen.getByRole("button", { name: /save and submit case brief/i }));

    expect(screen.getByText("Repair ready")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review timeline repair/i })).toBeInTheDocument();
  });

  it("rejects an incorrect endpoint or relation proposal without connecting it", async () => {
    const user = userEvent.setup();
    renderCaseboard();
    const firstEdge = casePackage.causalEdges[0];
    const from = casePackage.causalNodes.find((node) => node.id === firstEdge.fromNodeId)!;
    const to = casePackage.causalNodes.find((node) => node.id === firstEdge.toNodeId)!;

    await user.click(screen.getByRole("button", { name: `Place ${from.label}` }));
    await user.click(screen.getByRole("button", { name: `Place ${to.label}` }));
    await user.selectOptions(screen.getByLabelText("Cause"), to.id);
    await user.selectOptions(screen.getByLabelText("Relationship"), firstEdge.verb);
    await user.selectOptions(screen.getByLabelText("Effect"), from.id);
    await user.click(screen.getByRole("button", { name: /test causal link/i }));

    expect(screen.getByText(/relationship is not supported by the reviewed record/i)).toBeInTheDocument();
    expect(screen.getByText(/place and connect every supported step/i)).toBeInTheDocument();
  });

  it("labels the detention links as bounded authored reconstructions during construction", async () => {
    const user = userEvent.setup();
    renderCaseboard();
    const obstruction = casePackage.causalNodes.find(
      (node) => node.id === "NODE-OBSTRUCTION",
    )!;
    const detention = casePackage.causalNodes.find((node) => node.id === "NODE-DETENTION")!;

    await user.click(screen.getByRole("button", { name: `Place ${obstruction.label}` }));
    await user.click(screen.getByRole("button", { name: `Place ${detention.label}` }));
    await user.selectOptions(screen.getByLabelText("Cause"), obstruction.id);
    await user.selectOptions(screen.getByLabelText("Relationship"), "contributed_to");
    await user.selectOptions(screen.getByLabelText("Effect"), detention.id);

    expect(screen.getByText("Authored reconstruction")).toBeInTheDocument();
    expect(screen.getByText(/do not prove.*strict but-for cause/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /test causal link/i }));
    expect(screen.getByText(/authored reconstruction recorded/i)).toBeInTheDocument();
  });
});
