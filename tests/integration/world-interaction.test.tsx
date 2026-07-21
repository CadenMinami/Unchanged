import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import {
  CaseSessionProvider,
  useCaseSession,
} from "@/components/case-session/case-session-provider";
import { useWorldInteractionAdapter } from "@/components/world/interaction-adapter";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";

const casePackage = loadVarennesCase();
const manifest = loadVarennesSceneManifest();
const e3Interactable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "evidence" &&
    item.canonicalTarget.evidenceId === "E3",
);

if (!e3Interactable) throw new Error("E3 world interactable is required.");

const e3Request = {
  interactableId: e3Interactable.interactableId,
  zoneId: e3Interactable.zoneId,
  interactionType: e3Interactable.interactionType,
  canonicalTarget: e3Interactable.canonicalTarget,
};
const drouetInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "station" &&
    item.canonicalTarget.stationId === "CHAR-DROUET",
);
if (!drouetInteractable) throw new Error("Drouet world station is required.");
const drouetRequest = {
  interactableId: drouetInteractable.interactableId,
  zoneId: drouetInteractable.zoneId,
  interactionType: drouetInteractable.interactionType,
  canonicalTarget: drouetInteractable.canonicalTarget,
};
const journalInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "case_surface" &&
    item.canonicalTarget.surfaceId === "journal",
);
if (!journalInteractable) throw new Error("The world journal is required.");
const journalRequest = {
  interactableId: journalInteractable.interactableId,
  zoneId: journalInteractable.zoneId,
  interactionType: journalInteractable.interactionType,
  canonicalTarget: journalInteractable.canonicalTarget,
};

function Harness() {
  const { state } = useCaseSession();
  const { prepareWorldInteraction, commitPreparedWorldInteraction } =
    useWorldInteractionAdapter();
  const [result, setResult] = useState("");

  return (
    <div>
      <button
        onClick={() => {
          const preparation = prepareWorldInteraction(e3Request);
          if (preparation.status === "rejected") {
            setResult(`rejected:${preparation.reason}`);
            return;
          }

          const outcome = commitPreparedWorldInteraction(preparation.prepared);
          setResult(
            outcome.status === "opened" && outcome.target.targetType === "evidence"
              ? `${outcome.target.evidenceId}:${outcome.reducerResult?.status ?? "already-inspected"}`
              : `rejected:${outcome.status === "rejected" ? outcome.reason : "wrong-target"}`,
          );
        }}
      >
        Inspect physical table
      </button>
      <output data-testid="interaction-result">{result}</output>
      <output data-testid="inspected-items">{state.inspectedItemIds.join(",")}</output>
      <output data-testid="pinned-items">{state.pinnedEvidenceIds.join(",")}</output>
    </div>
  );
}

describe("world interaction adapter", () => {
  it("opens canonical E3 and records inspection only through commit", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    render(
      <CaseSessionProvider initialState={initialState} persist={false}>
        <Harness />
      </CaseSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: /inspect physical table/i }));

    expect(screen.getByTestId("interaction-result")).toHaveTextContent("E3:applied");
    expect(screen.getByTestId("inspected-items")).toHaveTextContent("E3");
    expect(screen.getByTestId("pinned-items")).toBeEmptyDOMElement();
  });

  it("fails closed when a world request changes the canonical target", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    function RejectedHarness() {
      const { prepareWorldInteraction } = useWorldInteractionAdapter();
      const [result, setResult] = useState("");
      return (
        <button
          onClick={() => {
            const outcome = prepareWorldInteraction({
              ...e3Request,
              canonicalTarget: { targetType: "evidence", evidenceId: "E4" },
            });
            setResult(outcome.status === "rejected" ? outcome.reason : "prepared");
          }}
        >
          Tampered request {result}
        </button>
      );
    }

    render(
      <CaseSessionProvider initialState={initialState} persist={false}>
        <RejectedHarness />
      </CaseSessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: /tampered request/i }));
    expect(
      screen.getByRole("button", { name: /canonical_target_mismatch/i }),
    ).toBeInTheDocument();
  });

  it("opens an authorized station without issuing a case command", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    function StationHarness() {
      const { state } = useCaseSession();
      const { prepareWorldInteraction, commitPreparedWorldInteraction } =
        useWorldInteractionAdapter();
      const [result, setResult] = useState("");
      return (
        <div>
          <button
            onClick={() => {
              const preparation = prepareWorldInteraction(drouetRequest);
              if (preparation.status === "rejected") {
                setResult("rejected");
                return;
              }
              const outcome = commitPreparedWorldInteraction(preparation.prepared);
              setResult(
                outcome.status === "opened" && outcome.target.targetType === "station"
                  ? outcome.target.stationId
                  : "rejected",
              );
            }}
          >
            Open Drouet
          </button>
          <output>{result}</output>
          <output data-testid="station-revision">{state.revision}</output>
        </div>
      );
    }

    render(
      <CaseSessionProvider initialState={initialState} persist={false}>
        <StationHarness />
      </CaseSessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open drouet/i }));

    expect(screen.getByText("CHAR-DROUET")).toBeInTheDocument();
    expect(screen.getByTestId("station-revision")).toHaveTextContent("0");
  });

  it("opens only the authorized journal case surface without issuing a case command", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    function JournalHarness() {
      const { state } = useCaseSession();
      const { prepareWorldInteraction, commitPreparedWorldInteraction } =
        useWorldInteractionAdapter();
      const [result, setResult] = useState("");
      return (
        <div>
          <button
            onClick={() => {
              const preparation = prepareWorldInteraction(journalRequest);
              if (preparation.status === "rejected") {
                setResult("rejected");
                return;
              }
              const outcome = commitPreparedWorldInteraction(preparation.prepared);
              setResult(
                outcome.status === "opened" &&
                  outcome.target.targetType === "case_surface"
                  ? outcome.target.surfaceId
                  : "rejected",
              );
            }}
          >
            Open journal
          </button>
          <output>{result}</output>
          <output data-testid="journal-revision">{state.revision}</output>
        </div>
      );
    }

    render(
      <CaseSessionProvider initialState={initialState} persist={false}>
        <JournalHarness />
      </CaseSessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: /open journal/i }));

    expect(screen.getByText("journal")).toBeInTheDocument();
    expect(screen.getByTestId("journal-revision")).toHaveTextContent("0");
  });
});
