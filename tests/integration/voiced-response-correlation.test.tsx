import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { VoicedResponse } from "@/components/world/dialogue/voiced-response";
import type { BrowserSpeechAdapter } from "@/lib/voice/browser-speech";
import type { MediaCorrelation } from "@/schemas/media-contracts";

const correlation: MediaCorrelation = {
  mediaVersion: "1.0.0",
  caseId: "varennes",
  stationId: "CHAR-DROUET",
  requestId: "voice-correlation-test",
  stateRevision: 7,
};

describe("voiced response correlation ownership", () => {
  it("cancels active playback when any correlation field changes", async () => {
    const user = userEvent.setup();
    const cancel = vi.fn(() => ({ status: "idle" as const }));
    const speak = vi.fn(
      () => new Promise<{ status: "completed" }>(() => undefined),
    );
    const speechAdapter: BrowserSpeechAdapter = {
      isSupported: () => true,
      getStatus: () => "idle",
      speak,
      cancel,
    };

    const { rerender } = render(
      <VoicedResponse
        authorization={null}
        caption="Exact visible caption."
        correlation={correlation}
        speakerName="Drouet"
        speechAdapterFactory={() => speechAdapter}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /play synthetic voice/i }),
    );
    await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
    cancel.mockClear();

    rerender(
      <VoicedResponse
        authorization={null}
        caption="Exact visible caption."
        correlation={{ ...correlation, caseId: "another-case" }}
        speakerName="Drouet"
        speechAdapterFactory={() => speechAdapter}
      />,
    );

    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
