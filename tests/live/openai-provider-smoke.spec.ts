import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";
import { parseBuffer } from "music-metadata";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesModelPolicy } from "@/lib/openai/load-model-policy";
import {
  AI_CONTRACT_VERSION,
  CHARACTER_PROMPT_VERSION,
  characterTurnRequestSchema,
  characterTurnResponseSchema,
} from "@/schemas/ai-contracts";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MAX_SPEECH_AUDIO_BYTES,
  MEDIA_CONTRACT_VERSION,
  authorizedSpeechRequestSchema,
  authorizedSpeechResponseSchema,
  transcriptionResponseSchema,
} from "@/schemas/media-contracts";

test.describe.configure({ mode: "serial" });

test("transcribes, selects a source-bounded Drouet turn, and speaks its exact caption", async ({
  request,
}) => {
  const fixturePath = resolve(
    process.cwd(),
    "tests/fixtures/live-openai/road-to-varennes.wav",
  );
  // Generated locally with macOS `say --voice Samantha --rate 190` and converted with `afconvert`.
  const fixture = await readFile(fixturePath);
  const fixtureMetadata = await parseBuffer(fixture, undefined, {
    duration: true,
    skipCovers: true,
    skipPostHeaders: true,
  });
  const fixtureDurationMs = Math.round(
    (fixtureMetadata.format.duration ?? 0) * 1_000,
  );

  expect(fixture.byteLength).toBeLessThan(MAX_AUDIO_BYTES);
  expect(fixtureMetadata.format.sampleRate).toBe(16_000);
  expect(fixtureMetadata.format.numberOfChannels).toBe(1);
  expect(fixtureMetadata.format.bitsPerSample).toBe(16);
  expect(fixtureDurationMs).toBeGreaterThan(0);
  expect(fixtureDurationMs).toBeLessThan(5_000);

  const casePackage = loadVarennesCase();
  const modelPolicy = loadVarennesModelPolicy();
  const drouetPolicy = modelPolicy.stationPolicies.find(
    (station) => station.stationId === "CHAR-DROUET",
  );
  if (!drouetPolicy || drouetPolicy.mode !== "generated_dialogue") {
    throw new Error("Drouet must remain authorized for generated dialogue.");
  }
  const correlation = {
    mediaVersion: MEDIA_CONTRACT_VERSION,
    caseId: casePackage.caseId,
    stationId: "CHAR-DROUET" as const,
    requestId: randomUUID(),
    stateRevision: 0,
  };
  const transcriptionMetadata = {
    ...correlation,
    declaredMimeType: "audio/wav" as const,
    advisoryDurationMs: fixtureDurationMs,
  };

  expect(Object.keys(transcriptionMetadata).sort()).toEqual(
    [
      "advisoryDurationMs",
      "caseId",
      "declaredMimeType",
      "mediaVersion",
      "requestId",
      "stateRevision",
      "stationId",
    ].sort(),
  );
  const transcriptionHttpResponse = await request.post(
    "/api/ai/transcribe",
    {
      multipart: {
        metadata: JSON.stringify(transcriptionMetadata),
        audio: {
          name: "road-to-varennes.wav",
          mimeType: "audio/wav",
          buffer: fixture,
        },
      },
      timeout: 90_000,
    },
  );
  const transcriptionBody = await transcriptionHttpResponse.json();

  expect(
    transcriptionHttpResponse.status(),
    JSON.stringify(transcriptionBody),
  ).toBe(200);
  expect(transcriptionHttpResponse.headers()["cache-control"]).toBe(
    "no-store",
  );
  const transcription = transcriptionResponseSchema.parse(transcriptionBody);
  expect(transcription).toMatchObject({
    ...correlation,
    status: "ok",
    detectedMimeType: "audio/wav",
  });
  if (transcription.status !== "ok") {
    throw new Error(`Transcription fell back with ${transcription.reason}.`);
  }
  expect(transcription.detectedDurationMs).toBeGreaterThan(0);
  expect(transcription.detectedDurationMs).toBeLessThanOrEqual(
    MAX_AUDIO_DURATION_MS,
  );
  expect(transcription.detectedDurationMs).toBeLessThan(5_000);
  expect(transcription.transcript).toMatch(/\broad\b/i);
  expect(transcription.transcript).toMatch(/\bVarennes\b/i);

  const aiCorrelation = {
    contractVersion: AI_CONTRACT_VERSION,
    caseId: casePackage.caseId,
    caseSchemaVersion: casePackage.schemaVersion,
    caseVersion: casePackage.caseVersion,
    policyVersion: modelPolicy.policyVersion,
    stateVersion: "1.2.0" as const,
    requestId: correlation.requestId,
    stateRevision: correlation.stateRevision,
  };
  const characterRequest = characterTurnRequestSchema.parse({
    ...aiCorrelation,
    promptVersion: CHARACTER_PROMPT_VERSION,
    stationId: correlation.stationId,
    playerMessage: transcription.transcript,
    inspectedEvidenceIds: ["E3"],
    presentedEvidenceIds: ["E3"],
    readingMode: "standard",
  });
  const characterHttpResponse = await request.post(
    "/api/ai/character-turn",
    { data: characterRequest, timeout: 90_000 },
  );
  const characterBody = await characterHttpResponse.json();

  expect(
    characterHttpResponse.status(),
    JSON.stringify(characterBody),
  ).toBe(200);
  expect(characterHttpResponse.headers()["cache-control"]).toBe("no-store");
  const characterTurn = characterTurnResponseSchema.parse(characterBody);
  // `ok` from the model is only reachable after the production moderation gate accepts this benign transcript.
  expect(characterTurn).toMatchObject({
    ...aiCorrelation,
    promptVersion: CHARACTER_PROMPT_VERSION,
    status: "ok",
    source: "model",
    authority: "formative_only",
    mutatesCaseState: false,
    turn: {
      spokenResponse: expect.any(String),
      renderedUnitIds: expect.any(Array),
    },
  });
  if (characterTurn.status !== "ok") {
    throw new Error(
      `Character selection used ${characterTurn.source}: ${characterTurn.reason}.`,
    );
  }
  expect(characterTurn.turn.spokenResponse.trim().length).toBeGreaterThan(0);
  expect(characterTurn.turn.renderedUnitIds.length).toBeGreaterThan(0);

  const authorizedRenderedUnitIds = new Set([
    ...drouetPolicy.claimUnits.map((unit) => unit.claimId),
    ...drouetPolicy.evidenceReactionUnits.map(
      (unit) => unit.evidenceReactionUnitId,
    ),
    ...drouetPolicy.followUpQuestionUnits.map(
      (unit) => unit.followUpQuestionUnitId,
    ),
    ...drouetPolicy.refusalUnknownUnits.map((unit) => unit.refusalUnitId),
    drouetPolicy.safetyRefusalUnit.safetyRefusalUnitId,
  ]);
  for (const renderedUnitId of characterTurn.turn.renderedUnitIds) {
    expect(authorizedRenderedUnitIds).toContain(renderedUnitId);
  }
  for (const claimId of characterTurn.turn.claimIds) {
    expect(drouetPolicy.allowedClaimIds).toContain(claimId);
  }
  for (const factId of characterTurn.turn.factIdsUsed) {
    expect(drouetPolicy.allowedFactIds).toContain(factId);
  }
  for (const sourceId of characterTurn.turn.sourceIdsUsed) {
    expect(drouetPolicy.allowedSourceIds).toContain(sourceId);
  }
  for (const evidenceId of characterTurn.turn.evidenceIdsReferenced) {
    expect(drouetPolicy.allowedEvidenceIds).toContain(evidenceId);
    expect(characterRequest.presentedEvidenceIds).toContain(evidenceId);
  }

  const renderedReactionUnits = drouetPolicy.evidenceReactionUnits.filter(
    (unit) =>
      characterTurn.turn.renderedUnitIds.includes(
        unit.evidenceReactionUnitId,
      ),
  );
  expect(renderedReactionUnits.length).toBeLessThanOrEqual(1);
  const renderedReaction = renderedReactionUnits[0];
  if (renderedReaction) {
    expect(
      renderedReaction.requiresPresentedEvidenceIds.every((evidenceId) =>
        characterRequest.presentedEvidenceIds.includes(evidenceId),
      ),
    ).toBe(true);
    expect(characterTurn.turn.evidenceReaction).toBe(
      renderedReaction.reaction,
    );
    expect(characterTurn.turn.evidenceIdsReferenced).toEqual(
      renderedReaction.requiresPresentedEvidenceIds,
    );
  } else {
    expect(characterTurn.turn.evidenceReaction).toBe("not_presented");
    expect(characterTurn.turn.evidenceIdsReferenced).toEqual([]);
  }
  expect(characterTurn.speechAuthorization).not.toBeNull();
  if (!characterTurn.speechAuthorization) {
    throw new Error("Model turn did not mint a correlated speech ticket.");
  }

  const caption = characterTurn.turn.spokenResponse;
  const captionSha256 = createHash("sha256")
    .update(caption, "utf8")
    .digest("hex");
  expect(characterTurn.speechAuthorization).toMatchObject({
    ...correlation,
    voiceId: "drouet-source-v1",
    captionSha256,
  });

  const speechRequest = authorizedSpeechRequestSchema.parse({
    caption,
    authorization: characterTurn.speechAuthorization,
  });
  const speechHttpResponse = await request.post("/api/ai/speech", {
    data: speechRequest,
    timeout: 90_000,
  });
  const speechBytes = await speechHttpResponse.body();
  const speechHeaders = speechHttpResponse.headers();

  expect(speechHttpResponse.status(), speechBytes.toString("utf8")).toBe(200);
  expect(speechHeaders["content-type"]).toBe("audio/wav");
  expect(speechHeaders["cache-control"]).toBe("no-store");
  expect(speechHeaders["x-media-version"]).toBe(correlation.mediaVersion);
  expect(speechHeaders["x-case-id"]).toBe(correlation.caseId);
  expect(speechHeaders["x-station-id"]).toBe(correlation.stationId);
  expect(speechHeaders["x-request-id"]).toBe(correlation.requestId);
  expect(speechHeaders["x-state-revision"]).toBe(
    String(correlation.stateRevision),
  );
  expect(speechHeaders["x-voice-id"]).toBe(
    characterTurn.speechAuthorization.voiceId,
  );
  expect(speechHeaders["x-caption-sha256"]).toBe(captionSha256);
  expect(speechHeaders["x-audio-byte-length"]).toBe(
    String(speechBytes.byteLength),
  );
  expect(speechBytes.byteLength).toBeGreaterThan(44);
  expect(speechBytes.byteLength).toBeLessThanOrEqual(MAX_SPEECH_AUDIO_BYTES);
  expect(speechBytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(speechBytes.subarray(8, 12).toString("ascii")).toBe("WAVE");

  const speechMetadata = await parseBuffer(speechBytes, undefined, {
    duration: true,
    skipCovers: true,
    skipPostHeaders: true,
  });
  expect(speechMetadata.format.hasAudio).toBe(true);
  expect(speechMetadata.format.container).toBe("WAVE");
  expect(speechMetadata.format.codec).toBeTruthy();
  expect(speechMetadata.format.duration).toBeDefined();
  expect(Number.isFinite(speechMetadata.format.duration)).toBe(true);
  expect(speechMetadata.format.duration ?? 0).toBeGreaterThan(0);
  expect(speechMetadata.format.numberOfSamples ?? 0).toBeGreaterThan(0);
  expect(speechMetadata.format.sampleRate ?? 0).toBeGreaterThan(0);
  expect(speechMetadata.format.numberOfChannels ?? 0).toBeGreaterThan(0);
  expect(speechMetadata.format.bitsPerSample ?? 0).toBeGreaterThan(0);
  expect(
    Math.abs(
      (speechMetadata.format.duration ?? 0) -
        (speechMetadata.format.numberOfSamples ?? 0) /
          (speechMetadata.format.sampleRate ?? 1),
    ),
  ).toBeLessThan(0.1);

  expect(
    authorizedSpeechResponseSchema.parse({
      ...correlation,
      status: "ok",
      voiceId: speechHeaders["x-voice-id"],
      captionSha256: speechHeaders["x-caption-sha256"],
      audioMimeType: speechHeaders["content-type"],
      audioByteLength: speechBytes.byteLength,
    }),
  ).toBeTruthy();
});
