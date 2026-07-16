import { expect, test, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

const caseState = {
  persistenceVersion: "1.2.0",
  savedAt: "2026-07-16T08:00:00.000Z",
  state: {
    stateVersion: "1.2.0",
    caseId: "varennes",
    caseSchemaVersion: "1.0.0",
    caseVersion: "1.0.3",
    revision: 7,
    phase: "investigation",
    completedCommandIds: [],
    inspectedItemIds: ["E3"],
    completedComparisonIds: [],
    rejectedAnomalyIds: [],
    activeAnomalyId: null,
    pinnedEvidenceIds: [],
    selectedConditionIds: [],
    placedCausalNodeIds: [],
    connectedCausalEdgeIds: [],
    completedRepairActionIds: [],
    completedRepairStepIds: [],
    caseBrief: {
      argument: "",
      selectedConsequenceId: null,
      selectedUncertaintyIds: [],
      submitted: false,
    },
    repairCompleted: false,
  },
};

const spatialState = {
  spatialSessionVersion: "1.0.0",
  caseId: "varennes",
  caseVersion: "1.0.3",
  sceneManifestVersion: "1.0.0",
  mode: "spatial",
  lastSafeSpawn: {
    zoneId: "post-road-square",
    spawnId: "SPAWN-POST-ROAD-ENTRY",
  },
  discoveredZoneIds: ["archive-antechamber", "post-road-square"],
  guidanceSetting: "subtle",
  graphicsTier: "balanced",
};

async function openDrouetConversation(page: Page): Promise<void> {
  await page.goto("/play/world");
  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const prompt = page.getByRole("button", { name: /inspect drouet station/i });
  await expect(prompt).toBeVisible();
  await prompt.click();
  await expect(
    page.getByRole("dialog", { name: /conversation with drouet station/i }),
  ).toBeVisible();
}

test("uses explicit push-to-talk, editable transcription, and exact-caption provider speech", async ({
  page,
}) => {
  const transcript = "RAW_TRANSCRIPT_FOR_STUDENT_REVIEW";
  const correctedQuestion = "Which road did the postilions tell you to take?";
  const caption = "The postilions' route report directed my pursuit toward Varennes.";
  const captionSha256 = "a".repeat(64);

  await page.addInitScript(
    ({ caption, captionSha256, caseState, spatialState, transcript }) => {
      const voiceTest = {
        characterMessages: [] as string[],
        speechCaptions: [] as string[],
        transcriptionCalls: 0,
      };
      Object.assign(window, { __voiceTest: voiceTest });
      window.localStorage.setItem(
        "history-unbroken:varennes:state",
        JSON.stringify(caseState),
      );
      window.localStorage.setItem(
        "history-unbroken:varennes:spatial-session",
        JSON.stringify(spatialState),
      );

      class MockMediaRecorder extends EventTarget {
        static isTypeSupported(type: string): boolean {
          return type === "audio/wav";
        }

        readonly mimeType = "audio/wav";
        state: RecordingState = "inactive";

        start(): void {
          this.state = "recording";
        }

        stop(): void {
          if (this.state === "inactive") return;
          this.state = "inactive";
          const bytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
          this.dispatchEvent(
            new BlobEvent("dataavailable", {
              data: new Blob([bytes], { type: "audio/wav" }),
            }),
          );
          this.dispatchEvent(new Event("stop"));
        }
      }

      class MockAudio extends EventTarget {
        currentTime = 0;

        constructor(readonly src: string) {
          super();
        }

        pause(): void {}

        play(): Promise<void> {
          queueMicrotask(() => this.dispatchEvent(new Event("ended")));
          return Promise.resolve();
        }
      }

      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => ({
            getTracks: () => [{ stop: () => undefined }],
          }),
        },
      });
      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: MockMediaRecorder,
      });
      Object.defineProperty(window, "Audio", {
        configurable: true,
        value: MockAudio,
      });
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: () => "blob:voice-test",
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: () => undefined,
      });

      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const url = String(input);
        if (url.endsWith("/api/ai/transcribe")) {
          voiceTest.transcriptionCalls += 1;
          const formData = init?.body as FormData;
          const metadata = JSON.parse(String(formData.get("metadata"))) as Record<
            string,
            unknown
          >;
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
        if (url.endsWith("/api/ai/character-turn")) {
          const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
          voiceTest.characterMessages.push(String(body.playerMessage));
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
              expiresAt: 1_900_000_000,
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
        }
        if (url.endsWith("/api/ai/speech")) {
          const body = JSON.parse(String(init?.body)) as {
            authorization: Record<string, unknown>;
            caption: string;
          };
          voiceTest.speechCaptions.push(body.caption);
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
        return originalFetch(input, init);
      };
    },
    { caption, captionSha256, caseState, spatialState, transcript },
  );

  await openDrouetConversation(page);
  const conversation = page.getByRole("dialog", {
    name: /conversation with drouet station/i,
  });

  await conversation.getByRole("button", { name: /start push-to-talk/i }).click();
  await expect(conversation.getByRole("status")).toContainText(/recording/i);
  await conversation.getByRole("button", { name: /stop and transcribe/i }).click();

  const question = conversation.getByLabel(/question for the source station/i);
  await expect(question).toHaveValue(transcript);
  await question.fill(correctedQuestion);
  await conversation.getByRole("button", { name: /ask source/i }).click();
  await expect(conversation.getByText(caption)).toBeVisible();
  await conversation.getByRole("button", { name: /play synthetic voice/i }).click();
  await expect(conversation.getByText(/voice playback is optional/i)).toBeVisible();

  const observations = await page.evaluate(() => {
    const value = (window as typeof window & {
      __voiceTest: {
        characterMessages: string[];
        speechCaptions: string[];
        transcriptionCalls: number;
      };
    }).__voiceTest;
    return {
      ...value,
      persistedCase: window.localStorage.getItem("history-unbroken:varennes:state"),
      persistedSpatial: window.localStorage.getItem(
        "history-unbroken:varennes:spatial-session",
      ),
    };
  });
  expect(observations.transcriptionCalls).toBe(1);
  expect(observations.characterMessages).toEqual([correctedQuestion]);
  expect(observations.speechCaptions).toEqual([caption]);
  expect(observations.persistedCase).not.toContain(transcript);
  expect(observations.persistedCase).not.toContain(caption);
  expect(observations.persistedSpatial).not.toContain(transcript);
  expect(observations.persistedSpatial).not.toContain(caption);
});

test("keeps typed input complete when microphone permission is denied", async ({ page }) => {
  await page.addInitScript(
    ({ caseState, spatialState }) => {
      window.localStorage.setItem(
        "history-unbroken:varennes:state",
        JSON.stringify(caseState),
      );
      window.localStorage.setItem(
        "history-unbroken:varennes:spatial-session",
        JSON.stringify(spatialState),
      );
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        value: {
          getUserMedia: async () => {
            throw new DOMException("denied", "NotAllowedError");
          },
        },
      });
      Object.defineProperty(window, "MediaRecorder", {
        configurable: true,
        value: class extends EventTarget {
          static isTypeSupported(type: string): boolean {
            return type === "audio/wav";
          }
        },
      });
    },
    { caseState, spatialState },
  );

  await openDrouetConversation(page);
  const conversation = page.getByRole("dialog", {
    name: /conversation with drouet station/i,
  });
  await conversation.getByRole("button", { name: /start push-to-talk/i }).click();

  await expect(conversation.getByRole("status")).toContainText(
    /microphone permission was not granted/i,
  );
  const question = conversation.getByLabel(/question for the source station/i);
  await question.fill("Typed input still works.");
  await expect(question).toHaveValue("Typed input still works.");
  await expect(conversation.getByRole("button", { name: /ask source/i })).toBeEnabled();
});
