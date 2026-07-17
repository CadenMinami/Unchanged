import { describe, expect, it } from "vitest";

import {
  isCurrentMediaCorrelation,
  isRetryableMediaFailure,
  normalizeAudioMimeType,
} from "@/lib/audio/media-contracts";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MAX_SPEECH_AUDIO_BYTES,
  MAX_SPEECH_CAPTION_CHARACTERS,
  MAX_TRANSCRIPT_CHARACTERS,
  MEDIA_CONTRACT_VERSION,
  authorizedSpeechRequestSchema,
  authorizedSpeechResponseSchema,
  canonicalAudioMimeTypeSchema,
  mediaCorrelationSchema,
  transcriptionRequestSchema,
  transcriptionResponseSchema,
  type MediaCorrelation,
} from "@/schemas/media-contracts";

const correlation = {
  mediaVersion: MEDIA_CONTRACT_VERSION,
  caseId: "varennes",
  stationId: "CHAR-DROUET",
  requestId: "00000000-0000-4000-8000-000000000001",
  stateRevision: 12,
} satisfies MediaCorrelation;

const transcriptionRequest = {
  ...correlation,
  declaredMimeType: "audio/webm",
  detectedMimeType: "audio/webm",
  audioByteLength: MAX_AUDIO_BYTES,
  advisoryDurationMs: MAX_AUDIO_DURATION_MS,
  channelCount: 1,
} as const;

const transcriptionResponse = {
  ...correlation,
  status: "ok",
  transcript: "Which road did you take?",
  detectedMimeType: "audio/webm",
  detectedDurationMs: MAX_AUDIO_DURATION_MS,
} as const;

const speechAuthorization = {
  ...correlation,
  voiceId: "drouet-source-v1",
  captionSha256: "a".repeat(64),
  expiresAt: 1_800_000_120,
  signature: "A".repeat(43),
} as const;

const authorizedSpeechRequest = {
  caption: "An exact authorized caption.",
  authorization: speechAuthorization,
} as const;

const authorizedSpeechResponse = {
  ...correlation,
  status: "ok",
  voiceId: "drouet-source-v1",
  captionSha256: "a".repeat(64),
  audioMimeType: "audio/mp4",
  audioByteLength: 42_000,
} as const;

describe("media contracts", () => {
  it("uses a distinct strict media version and complete correlation record", () => {
    expect(MEDIA_CONTRACT_VERSION).toBe("1.0.0");
    expect(mediaCorrelationSchema.parse(correlation)).toEqual(correlation);
    expect(
      mediaCorrelationSchema.safeParse({ ...correlation, mediaVersion: "0.9.0" }).success,
    ).toBe(false);
    expect(mediaCorrelationSchema.safeParse({ ...correlation, stateRevision: -1 }).success).toBe(
      false,
    );
  });

  it("supports canonical browser audio MIME values and normalizes parameters only in a helper", () => {
    for (const mimeType of ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"]) {
      expect(canonicalAudioMimeTypeSchema.safeParse(mimeType).success).toBe(true);
    }

    expect(normalizeAudioMimeType("audio/webm; codecs=opus")).toBe("audio/webm");
    expect(normalizeAudioMimeType(" AUDIO/MP4 ; codecs=mp4a.40.2 ")).toBe("audio/mp4");
    expect(normalizeAudioMimeType("audio/mpeg")).toBeNull();
    expect(canonicalAudioMimeTypeSchema.safeParse("audio/webm; codecs=opus").success).toBe(false);
  });

  it("rejects audio just over the decimal two-megabyte limit", () => {
    expect(transcriptionRequestSchema.parse(transcriptionRequest)).toEqual(transcriptionRequest);
    expect(
      transcriptionRequestSchema.safeParse({
        ...transcriptionRequest,
        audioByteLength: 2_000_001,
      }).success,
    ).toBe(false);
  });

  it("rejects advisory or detected duration just over twenty seconds", () => {
    expect(
      transcriptionRequestSchema.safeParse({
        ...transcriptionRequest,
        advisoryDurationMs: 20_001,
      }).success,
    ).toBe(false);
    expect(
      transcriptionResponseSchema.safeParse({
        ...transcriptionResponse,
        detectedDurationMs: 20_001,
      }).success,
    ).toBe(false);
    expect(
      transcriptionResponseSchema.safeParse({
        ...correlation,
        status: "error",
        reason: "timeout",
        retryable: false,
      }).success,
    ).toBe(false);
  });

  it("accepts only mono transcription audio", () => {
    expect(transcriptionRequestSchema.safeParse(transcriptionRequest).success).toBe(true);
    expect(
      transcriptionRequestSchema.safeParse({ ...transcriptionRequest, channelCount: 2 }).success,
    ).toBe(false);
  });

  it("rejects a 601-character transcript and a 1601-character speech caption", () => {
    expect(
      transcriptionResponseSchema.safeParse({
        ...transcriptionResponse,
        transcript: "x".repeat(MAX_TRANSCRIPT_CHARACTERS + 1),
      }).success,
    ).toBe(false);
    expect(
      authorizedSpeechRequestSchema.safeParse({
        ...authorizedSpeechRequest,
        caption: "x".repeat(MAX_SPEECH_CAPTION_CHARACTERS + 1),
      }).success,
    ).toBe(false);
  });

  it("keeps the binary speech response below the deployment response ceiling", () => {
    expect(MAX_SPEECH_AUDIO_BYTES).toBe(3_000_000);
    expect(MAX_SPEECH_AUDIO_BYTES).toBeLessThan(4_500_000);
    expect(
      authorizedSpeechResponseSchema.safeParse({
        ...authorizedSpeechResponse,
        audioByteLength: MAX_SPEECH_AUDIO_BYTES,
      }).success,
    ).toBe(true);
    expect(
      authorizedSpeechResponseSchema.safeParse({
        ...authorizedSpeechResponse,
        audioByteLength: MAX_SPEECH_AUDIO_BYTES + 1,
      }).success,
    ).toBe(false);
  });

  it("rejects a declared and detected MIME mismatch", () => {
    expect(
      transcriptionRequestSchema.safeParse({
        ...transcriptionRequest,
        detectedMimeType: "audio/ogg",
      }).success,
    ).toBe(false);
  });

  it("rejects stale request, revision, and station correlation", () => {
    expect(isCurrentMediaCorrelation(correlation, correlation)).toBe(true);
    expect(
      isCurrentMediaCorrelation(correlation, {
        ...correlation,
        requestId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe(false);
    expect(
      isCurrentMediaCorrelation(correlation, { ...correlation, stateRevision: 13 }),
    ).toBe(false);
    expect(
      isCurrentMediaCorrelation(correlation, { ...correlation, stationId: "CHAR-LOUIS" }),
    ).toBe(false);
  });

  it("defines compatible operational failures with closed retry semantics", () => {
    expect(isRetryableMediaFailure("timeout")).toBe(true);
    expect(isRetryableMediaFailure("rate_limited")).toBe(true);
    expect(isRetryableMediaFailure("provider_error", true)).toBe(true);
    expect(isRetryableMediaFailure("provider_error", false)).toBe(false);
    expect(isRetryableMediaFailure("aborted")).toBe(false);
    expect(isRetryableMediaFailure("payload_too_large")).toBe(false);
    expect(isRetryableMediaFailure("mime_type_mismatch")).toBe(false);
    expect(isRetryableMediaFailure("stale_correlation")).toBe(false);
    expect(
      transcriptionResponseSchema.safeParse({
        ...correlation,
        status: "error",
        reason: "aborted",
        retryable: false,
      }).success,
    ).toBe(true);
    expect(
      transcriptionResponseSchema.safeParse({
        ...correlation,
        status: "error",
        reason: "aborted",
        retryable: true,
      }).success,
    ).toBe(false);
  });

  it("allows no historical, source, evidence, score, command, state, or authority fields", () => {
    const forbiddenFields = [
      "historicalFacts",
      "factIds",
      "sourceIds",
      "evidenceIds",
      "scores",
      "commands",
      "caseState",
      "authority",
      "mutatesCaseState",
    ] as const;
    const contracts = [
      [transcriptionRequestSchema, transcriptionRequest],
      [transcriptionResponseSchema, transcriptionResponse],
      [authorizedSpeechRequestSchema, authorizedSpeechRequest],
      [authorizedSpeechResponseSchema, authorizedSpeechResponse],
    ] as const;

    for (const field of forbiddenFields) {
      for (const [schema, value] of contracts) {
        expect(schema.safeParse({ ...value, [field]: "forbidden" }).success).toBe(false);
      }
    }
  });

  it("defines AuthorizedSpeechRequest as exactly caption plus its authorization", () => {
    expect(authorizedSpeechRequestSchema.parse(authorizedSpeechRequest)).toEqual(
      authorizedSpeechRequest,
    );
    expect(
      authorizedSpeechRequestSchema.safeParse({
        ...authorizedSpeechRequest,
        voiceId: "drouet-source-v1",
      }).success,
    ).toBe(false);
  });
});
