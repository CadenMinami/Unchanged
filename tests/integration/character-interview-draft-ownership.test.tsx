import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseSessionProvider } from "@/components/case-session/case-session-provider";
import { CharacterInterview } from "@/components/characters/character-interview";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";

const pushToTalkHarness = vi.hoisted(() => ({
  finish: null as null | ((transcript: string) => void),
}));

vi.mock("@/components/world/dialogue/push-to-talk-control", () => ({
  PushToTalkControl: ({
    draftRevision,
    onTranscript,
  }: {
    draftRevision: number;
    onTranscript: (transcript: string, startingDraftRevision: number) => void;
  }) => (
    <div>
      <button
        onClick={() => {
          pushToTalkHarness.finish = (transcript) =>
            onTranscript(transcript, draftRevision);
        }}
        type="button"
      >
        Start test transcription
      </button>
      <button
        onClick={() => pushToTalkHarness.finish?.("Stale voice transcript")}
        type="button"
      >
        Finish test transcription
      </button>
    </div>
  ),
}));

const casePackage = loadVarennesCase();

afterEach(() => {
  pushToTalkHarness.finish = null;
});

describe("character interview draft ownership", () => {
  it("keeps a student edit when a stale transcription callback finishes", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 7,
    };

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterInterview lockedStationId="CHAR-DROUET" />
      </CaseSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Start test transcription" }));
    const textarea = screen.getByLabelText(/question for the source station/i);
    await user.type(textarea, "My newer typed question");
    await user.click(screen.getByRole("button", { name: "Finish test transcription" }));

    expect(textarea).toHaveValue("My newer typed question");
  });
});
