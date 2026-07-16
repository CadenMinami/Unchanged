import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CaseSessionProvider, useCaseSession } from "@/components/case-session/case-session-provider";
import { CharacterConversationPanel } from "@/components/characters/character-conversation-panel";
import { CharacterInterview } from "@/components/characters/character-interview";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import type { BrowserSpeechAdapter } from "@/lib/voice/browser-speech";

const casePackage = loadVarennesCase();

function CaseStateProbe() {
  const { state } = useCaseSession();

  return (
    <output data-testid="case-state">
      {state.revision}:{state.inspectedItemIds.join(",")}:{state.pinnedEvidenceIds.join(",")}
    </output>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("world character dialogue", () => {
  it("requests capture only after an explicit gesture and puts transcription in the editable textarea", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 7,
      inspectedItemIds: ["E3"],
    };
    const transcript = "RAW_TRANSCRIPT_FOR_CORRECTION";
    const correctedQuestion = "Which road did the route information let you take?";
    const release = vi.fn();
    let recorderOptions:
      | {
          onComplete: (recording: {
            blob: Blob | null;
            byteLength: number;
            advisoryDurationMs: number;
            canonicalMimeType: "audio/wav";
            recorderMimeType: string;
            release: () => void;
          }) => void;
        }
      | undefined;
    const start = vi.fn(async () => {
      recorderOptions?.onComplete({
        blob: new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" }),
        byteLength: 4,
        advisoryDurationMs: 500,
        canonicalMimeType: "audio/wav",
        recorderMimeType: "audio/wav",
        release,
      });
    });
    const recorderFactory = vi.fn((options: NonNullable<typeof recorderOptions>) => {
      recorderOptions = options;
      return {
        start,
        stop: vi.fn(),
        cancel: vi.fn(),
        release: vi.fn(),
        getSnapshot: () => ({
          state: "idle" as const,
          canonicalMimeType: null,
          retainedByteLength: 0,
        }),
      };
    });
    const requests: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        requests.push({ url, body: init?.body ?? null });
        if (url.endsWith("/api/ai/transcribe")) {
          const formData = init?.body as FormData;
          const metadata = JSON.parse(String(formData.get("metadata"))) as Record<string, unknown>;
          return Response.json({
            mediaVersion: metadata.mediaVersion,
            caseId: metadata.caseId,
            stationId: metadata.stationId,
            requestId: metadata.requestId,
            stateRevision: metadata.stateRevision,
            status: "ok",
            transcript,
            detectedMimeType: "audio/wav",
            detectedDurationMs: 500,
          });
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          contractVersion: body.contractVersion,
          caseId: body.caseId,
          caseSchemaVersion: body.caseSchemaVersion,
          caseVersion: body.caseVersion,
          policyVersion: body.policyVersion,
          stateVersion: body.stateVersion,
          requestId: body.requestId,
          stateRevision: body.stateRevision,
          promptVersion: body.promptVersion,
          status: "fallback",
          source: "deterministic_fallback",
          reason: "missing_api_key",
          retryable: false,
          authority: "formative_only",
          mutatesCaseState: false,
          speechAuthorization: null,
          turn: {
            spokenResponse: "The visible authored fallback remains available.",
            renderedUnitIds: ["FALLBACK-DROUET-BOUNDARY"],
            claimIds: [],
            factIdsUsed: [],
            sourceIdsUsed: [],
            evidenceIdsReferenced: [],
            epistemicStatus: "inferred",
            evidenceReaction: "not_presented",
            followUpQuestion: null,
          },
        });
      }),
    );

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterConversationPanel
          recorderFactory={recorderFactory}
          stationId="CHAR-DROUET"
        />
      </CaseSessionProvider>,
    );

    expect(start).not.toHaveBeenCalled();
    expect(requests).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /start push-to-talk/i }));

    expect(start).toHaveBeenCalledTimes(1);
    const textarea = await screen.findByLabelText(/question for the source station/i);
    await waitFor(() => expect(textarea).toHaveValue(transcript));
    expect(requests.map((request) => request.url)).toEqual(["/api/ai/transcribe"]);
    expect(screen.queryByRole("article", { name: /source response/i })).toBeNull();
    expect(release).toHaveBeenCalledTimes(1);

    await user.clear(textarea);
    await user.type(textarea, correctedQuestion);
    await user.click(screen.getByRole("button", { name: /ask source/i }));

    const characterRequest = requests.find((request) => request.url.endsWith("character-turn"));
    expect(JSON.parse(String(characterRequest?.body))).toMatchObject({
      playerMessage: correctedQuestion,
      stationId: "CHAR-DROUET",
      stateRevision: 7,
    });
  });

  it("keeps newer typed text when an older transcription finishes late", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 7,
    };
    let completeRecording:
      | ((recording: {
          blob: Blob | null;
          byteLength: number;
          advisoryDurationMs: number;
          canonicalMimeType: "audio/wav";
          recorderMimeType: string;
          release: () => void;
        }) => void)
      | undefined;
    const release = vi.fn();
    const recorderFactory = vi.fn((options: { onComplete: NonNullable<typeof completeRecording> }) => {
      completeRecording = options.onComplete;
      return {
        start: vi.fn(async () => {
          completeRecording?.({
            blob: new Blob([new Uint8Array([82, 73, 70, 70])], { type: "audio/wav" }),
            byteLength: 4,
            advisoryDurationMs: 500,
            canonicalMimeType: "audio/wav",
            recorderMimeType: "audio/wav",
            release,
          });
        }),
        stop: vi.fn(),
        cancel: vi.fn(),
        release: vi.fn(),
        getSnapshot: () => ({
          state: "idle" as const,
          canonicalMimeType: null,
          retainedByteLength: 0,
        }),
      };
    });
    let resolveTranscription: ((response: Response) => void) | undefined;
    const transcription = new Promise<Response>((resolve) => {
      resolveTranscription = resolve;
    });
    let metadata: Record<string, unknown> | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const formData = init?.body as FormData;
        metadata = JSON.parse(String(formData.get("metadata"))) as Record<string, unknown>;
        return transcription;
      }),
    );

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterConversationPanel
          recorderFactory={recorderFactory}
          stationId="CHAR-DROUET"
        />
      </CaseSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: /start push-to-talk/i }));
    const textarea = screen.getByLabelText(/question for the source station/i);
    await user.type(textarea, "My newer typed question");
    await waitFor(() =>
      expect(screen.getByText(/cancelled because the typed question changed/i)).toBeVisible(),
    );
    resolveTranscription?.(
      Response.json({
        ...metadata,
        status: "ok",
        transcript: "Stale transcript must not replace typing",
        detectedMimeType: "audio/wav",
        detectedDurationMs: 500,
      }),
    );

    await waitFor(() => expect(release).toHaveBeenCalledTimes(1));
    expect(textarea).toHaveValue("My newer typed question");
  });

  it("cancels and resets microphone capture when the source station changes", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 7,
    };
    const cancel = vi.fn();
    const release = vi.fn();
    const recorderFactory = vi.fn(() => ({
      start: vi.fn(async () => undefined),
      stop: vi.fn(),
      cancel,
      release,
      getSnapshot: () => ({
        state: "recording" as const,
        canonicalMimeType: "audio/wav" as const,
        retainedByteLength: 0,
      }),
    }));

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterInterview recorderFactory={recorderFactory} />
      </CaseSessionProvider>,
    );

    await user.click(screen.getByRole("button", { name: /start push-to-talk/i }));
    expect(screen.getByRole("button", { name: /stop and transcribe/i })).toBeVisible();

    await user.click(screen.getByRole("button", { name: /louis xvi station/i }));

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /start push-to-talk/i })).toBeVisible();
  });

  it("plays exact authorized provider speech only after explicit play and keeps browser fallback", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 9,
    };
    const caption = "Exact visible source-bounded caption.";
    const captionSha256 = "a".repeat(64);
    const speechBodies: unknown[] = [];
    const providerPlay = vi.fn(async () => ({ status: "completed" as const }));
    const providerStop = vi.fn();
    const browserSpeak = vi.fn(async () => ({ status: "completed" as const }));
    const browserSpeechAdapter: BrowserSpeechAdapter = {
      isSupported: () => true,
      getStatus: () => "idle",
      speak: browserSpeak,
      cancel: vi.fn(() => ({ status: "idle" as const })),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/ai/speech")) {
          speechBodies.push(JSON.parse(String(init?.body)));
          const body = speechBodies.at(-1) as {
            authorization: Record<string, unknown>;
          };
          return new Response(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]), {
            headers: {
              "cache-control": "no-store",
              "content-type": "audio/wav",
              "x-media-version": String(body.authorization.mediaVersion),
              "x-case-id": String(body.authorization.caseId),
              "x-station-id": String(body.authorization.stationId),
              "x-request-id": String(body.authorization.requestId),
              "x-state-revision": String(body.authorization.stateRevision),
              "x-voice-id": String(body.authorization.voiceId),
              "x-caption-sha256": String(body.authorization.captionSha256),
              "x-audio-byte-length": "8",
            },
          });
        }
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          contractVersion: body.contractVersion,
          caseId: body.caseId,
          caseSchemaVersion: body.caseSchemaVersion,
          caseVersion: body.caseVersion,
          policyVersion: body.policyVersion,
          stateVersion: body.stateVersion,
          requestId: body.requestId,
          stateRevision: body.stateRevision,
          promptVersion: body.promptVersion,
          status: "ok",
          source: "model",
          authority: "formative_only",
          mutatesCaseState: false,
          speechAuthorization: {
            mediaVersion: "1.0.0",
            caseId: body.caseId,
            stationId: body.stationId,
            requestId: body.requestId,
            stateRevision: body.stateRevision,
            voiceId: "drouet-source-v1",
            captionSha256,
            expiresAt: 1_800_000_120,
            signature: "A".repeat(43),
          },
          turn: {
            spokenResponse: caption,
            renderedUnitIds: ["CLAIM-DROUET-BRANCH-SUSPICION"],
            claimIds: [],
            factIdsUsed: [],
            sourceIdsUsed: [],
            evidenceIdsReferenced: [],
            epistemicStatus: "inferred",
            evidenceReaction: "not_presented",
            followUpQuestion: null,
          },
        });
      }),
    );

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterConversationPanel
          providerAudioFactory={() => ({ play: providerPlay, stop: providerStop })}
          speechAdapterFactory={() => browserSpeechAdapter}
          stationId="CHAR-DROUET"
        />
      </CaseSessionProvider>,
    );

    await user.type(
      screen.getByLabelText(/question for the source station/i),
      "What can this station say?",
    );
    await user.click(screen.getByRole("button", { name: /ask source/i }));
    expect(await screen.findByText(caption)).toBeVisible();
    expect(providerPlay).not.toHaveBeenCalled();
    expect(browserSpeak).not.toHaveBeenCalled();
    expect(speechBodies).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /play synthetic voice/i }));

    await waitFor(() => expect(providerPlay).toHaveBeenCalledTimes(1));
    expect(speechBodies).toEqual([
      expect.objectContaining({
        caption,
        authorization: expect.objectContaining({ captionSha256 }),
      }),
    ]);
    expect(browserSpeak).not.toHaveBeenCalled();
    expect(screen.getByText(caption)).toBeVisible();
    expect(screen.getByText(/not drouet's historical voice/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /mute voice/i })).toBeVisible();
  });

  it("sends Drouet only current authorized evidence and cannot issue a case command", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 7,
      inspectedItemIds: ["E1", "E3", "E4"],
    };
    let requestBody: Record<string, unknown> | undefined;
    const speak = vi.fn(async () => ({ status: "completed" as const }));
    const speechAdapter: BrowserSpeechAdapter = {
      isSupported: () => true,
      getStatus: () => "idle",
      speak,
      cancel: vi.fn(() => ({ status: "idle" as const })),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          contractVersion: requestBody.contractVersion,
          caseId: requestBody.caseId,
          caseSchemaVersion: requestBody.caseSchemaVersion,
          caseVersion: requestBody.caseVersion,
          policyVersion: requestBody.policyVersion,
          stateVersion: requestBody.stateVersion,
          requestId: requestBody.requestId,
          stateRevision: requestBody.stateRevision,
          promptVersion: requestBody.promptVersion,
          status: "ok",
          source: "model",
          authority: "formative_only",
          mutatesCaseState: false,
          speechAuthorization: null,
          turn: {
            spokenResponse:
              "The verified historical report conflicts with my experience in this fictional branch.",
            renderedUnitIds: ["REACTION-DROUET-E3-QUALIFY"],
            claimIds: [],
            factIdsUsed: ["F-S2-002"],
            sourceIdsUsed: ["S2"],
            evidenceIdsReferenced: ["E3"],
            epistemicStatus: "inferred",
            evidenceReaction: "qualified",
            followUpQuestion: "Which other record checks the timing?",
          },
        });
      }),
    );

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterConversationPanel
          speechAdapterFactory={() => speechAdapter}
          stationId="CHAR-DROUET"
        />
        <CaseStateProbe />
      </CaseSessionProvider>,
    );

    expect(screen.getByRole("option", { name: /E3 \/ Drouet's report/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /E4 \/ Route board/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /E1/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /E5/i })).toBeNull();

    await user.selectOptions(screen.getByLabelText(/present inspected evidence/i), "E3");
    await user.type(
      screen.getByLabelText(/question for the source station/i),
      "What changes when I compare this report with your branch?",
    );
    await user.click(screen.getByRole("button", { name: /ask source/i }));

    await waitFor(() => {
      expect(requestBody).toMatchObject({
        stationId: "CHAR-DROUET",
        inspectedEvidenceIds: ["E3", "E4"],
        presentedEvidenceIds: ["E3"],
        stateRevision: 7,
      });
    });
    expect(await screen.findByRole("article", { name: /source response/i })).toHaveTextContent(
      /verified historical report conflicts/i,
    );
    expect(screen.getByText(/ai-directed dramatization/i)).toBeInTheDocument();
    expect(
      screen.getByText(/synthetic browser voice, not drouet's historical voice/i),
    ).toBeInTheDocument();
    expect(speak).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /hear response/i }));
    expect(speak).toHaveBeenCalledWith(
      "The verified historical report conflicts with my experience in this fictional branch.",
    );
    expect(screen.queryByRole("button", { name: /pin|record|repair|command/i })).toBeNull();
    expect(screen.getByTestId("case-state")).toHaveTextContent("7:E1,E3,E4:");
  });

  it("sends Louis only inspected E1 while preserving the declaration and private-motive boundary", async () => {
    const user = userEvent.setup();
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      revision: 11,
      inspectedItemIds: ["E1", "E2", "E3", "E4", "E5"],
    };
    let requestBody: Record<string, unknown> | undefined;
    const spokenResponse =
      "That declaration records my public description of the departure as purposeful. It cannot independently establish every private motive I held.";
    const speak = vi.fn(async () => ({ status: "completed" as const }));
    const speechAdapter: BrowserSpeechAdapter = {
      isSupported: () => true,
      getStatus: () => "idle",
      speak,
      cancel: vi.fn(() => ({ status: "idle" as const })),
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({
          contractVersion: requestBody.contractVersion,
          caseId: requestBody.caseId,
          caseSchemaVersion: requestBody.caseSchemaVersion,
          caseVersion: requestBody.caseVersion,
          policyVersion: requestBody.policyVersion,
          stateVersion: requestBody.stateVersion,
          requestId: requestBody.requestId,
          stateRevision: requestBody.stateRevision,
          promptVersion: requestBody.promptVersion,
          status: "ok",
          source: "model",
          authority: "formative_only",
          mutatesCaseState: false,
          speechAuthorization: null,
          turn: {
            spokenResponse,
            renderedUnitIds: ["REACTION-LOUIS-E1-QUALIFY"],
            claimIds: [],
            factIdsUsed: ["F-S1-002", "F-S1-004"],
            sourceIdsUsed: ["S1"],
            evidenceIdsReferenced: ["E1"],
            epistemicStatus: "inferred",
            evidenceReaction: "qualified",
            followUpQuestion: "What does the declaration claim, and what can it not prove?",
          },
        });
      }),
    );

    render(
      <CaseSessionProvider initialState={state} persist={false}>
        <CharacterConversationPanel
          speechAdapterFactory={() => speechAdapter}
          stationId="CHAR-LOUIS"
        />
        <CaseStateProbe />
      </CaseSessionProvider>,
    );

    const caseStateBefore = screen.getByTestId("case-state").textContent;
    expect(caseStateBefore).toBe("11:E1,E2,E3,E4,E5:");
    expect.soft(
      screen.queryByText(
        /(?:public|stated) declaration.*(?:cannot|does not).*complete private motive/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /E1 \/ Louis's declaration/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /E2/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /E3/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /E4/i })).toBeNull();
    expect(screen.queryByRole("option", { name: /E5/i })).toBeNull();

    await user.selectOptions(screen.getByLabelText(/present inspected evidence/i), "E1");
    await user.type(
      screen.getByLabelText(/question for the source station/i),
      "What does your declaration say publicly, and what can it prove about private motive?",
    );
    await user.click(screen.getByRole("button", { name: /ask source/i }));

    await waitFor(() => {
      expect(requestBody).toMatchObject({
        stationId: "CHAR-LOUIS",
        inspectedEvidenceIds: ["E1"],
        presentedEvidenceIds: ["E1"],
        stateRevision: 11,
      });
    });
    expect(await screen.findByRole("article", { name: /source response/i })).toHaveTextContent(
      /public description.*private motive/i,
    );
    expect(screen.getByText(/ai-directed dramatization/i)).toBeInTheDocument();
    expect(
      screen.getByText(/synthetic browser voice, not louis xvi's historical voice/i),
    ).toBeInTheDocument();
    expect(speak).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /hear response/i }));
    expect(speak).toHaveBeenCalledWith(spokenResponse);
    expect(screen.queryByRole("button", { name: /record|pin|repair/i })).toBeNull();
    expect(screen.getByTestId("case-state").textContent).toBe(caseStateBefore);
  });
});
