import { describe, expect, it } from "vitest";

import {
  initialVoiceState,
  isCurrentAuthorizedSpeechResult,
  isCurrentTranscriptionResult,
  voiceStateReducer,
} from "@/lib/audio/voice-state";
import {
  MEDIA_CONTRACT_VERSION,
  type AuthorizedSpeechRequest,
  type AuthorizedSpeechResponse,
  type MediaCorrelation,
  type TranscriptionResponse,
} from "@/schemas/media-contracts";

const correlation = {
  mediaVersion: MEDIA_CONTRACT_VERSION,
  caseId: "varennes",
  stationId: "CHAR-DROUET",
  requestId: "00000000-0000-4000-8000-000000000001",
  stateRevision: 7,
} satisfies MediaCorrelation;

const transcription = {
  ...correlation,
  status: "ok",
  transcript: "Which road did you take?",
  detectedMimeType: "audio/wav",
  detectedDurationMs: 1_200,
} satisfies TranscriptionResponse;

const authorization = {
  ...correlation,
  voiceId: "drouet-source-v1",
  captionSha256: "a".repeat(64),
  expiresAt: 1_800_000_120,
  signature: "A".repeat(43),
} as const;

const speechRequest = {
  caption: "Exact visible caption.",
  authorization,
} satisfies AuthorizedSpeechRequest;

const speechResponse = {
  ...correlation,
  status: "ok",
  voiceId: "drouet-source-v1",
  captionSha256: "a".repeat(64),
  audioMimeType: "audio/wav",
  audioByteLength: 128,
} satisfies AuthorizedSpeechResponse;

describe("voice presentation state", () => {
  it("tracks capture and playback without educational or persistence authority", () => {
    const requesting = voiceStateReducer(initialVoiceState, {
      type: "capture_permission_requested",
    });
    const recording = voiceStateReducer(requesting, { type: "capture_started" });
    const transcribing = voiceStateReducer(recording, { type: "transcription_started" });
    const playing = voiceStateReducer(transcribing, { type: "playback_started" });

    expect(requesting.capture).toBe("requesting_permission");
    expect(recording.capture).toBe("recording");
    expect(transcribing.capture).toBe("transcribing");
    expect(playing.playback).toBe("playing");
    expect(playing).not.toHaveProperty("commands");
    expect(playing).not.toHaveProperty("caseState");
    expect(playing).not.toHaveProperty("evidenceIds");
    expect(playing).not.toHaveProperty("scores");
    expect(playing).not.toHaveProperty("persist");
  });

  it("cancels capture and makes mute stop active playback", () => {
    const recording = voiceStateReducer(initialVoiceState, { type: "capture_started" });
    const cancelled = voiceStateReducer(recording, { type: "capture_cancelled" });
    const playing = voiceStateReducer(cancelled, { type: "playback_started" });
    const muted = voiceStateReducer(playing, { type: "mute_changed", muted: true });

    expect(cancelled.capture).toBe("idle");
    expect(muted).toMatchObject({ muted: true, playback: "idle" });
  });

  it("moves provider failure to deterministic browser fallback without hiding text", () => {
    const loading = voiceStateReducer(initialVoiceState, { type: "playback_requested" });
    const fallback = voiceStateReducer(loading, { type: "browser_fallback_started" });
    const textOnly = voiceStateReducer(fallback, { type: "text_fallback" });

    expect(loading.playback).toBe("loading");
    expect(fallback.playback).toBe("browser_fallback");
    expect(textOnly.playback).toBe("text_only");
  });
});

describe("voice result currency", () => {
  it("accepts only the active transcription request, station, and revision", () => {
    expect(isCurrentTranscriptionResult(correlation, transcription)).toBe(true);
    expect(
      isCurrentTranscriptionResult(correlation, {
        ...transcription,
        requestId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe(false);
    expect(
      isCurrentTranscriptionResult(correlation, {
        ...transcription,
        stationId: "CHAR-LOUIS",
      }),
    ).toBe(false);
    expect(
      isCurrentTranscriptionResult(correlation, {
        ...transcription,
        stateRevision: 8,
      }),
    ).toBe(false);
  });

  it("accepts speech only for the current exact caption, ticket hash, voice, and correlation", () => {
    const current = { correlation, caption: speechRequest.caption };

    expect(isCurrentAuthorizedSpeechResult(current, speechRequest, speechResponse)).toBe(true);
    expect(
      isCurrentAuthorizedSpeechResult(
        { ...current, caption: `${speechRequest.caption} changed` },
        speechRequest,
        speechResponse,
      ),
    ).toBe(false);
    expect(
      isCurrentAuthorizedSpeechResult(current, speechRequest, {
        ...speechResponse,
        captionSha256: "b".repeat(64),
      }),
    ).toBe(false);
    expect(
      isCurrentAuthorizedSpeechResult(current, speechRequest, {
        ...speechResponse,
        voiceId: "louis-source-v1",
      }),
    ).toBe(false);
    expect(
      isCurrentAuthorizedSpeechResult(current, speechRequest, {
        ...speechResponse,
        requestId: "00000000-0000-4000-8000-000000000002",
      }),
    ).toBe(false);
    expect(
      isCurrentAuthorizedSpeechResult(current, speechRequest, {
        ...speechResponse,
        stationId: "CHAR-LOUIS",
      }),
    ).toBe(false);
    expect(
      isCurrentAuthorizedSpeechResult(current, speechRequest, {
        ...speechResponse,
        stateRevision: 8,
      }),
    ).toBe(false);
  });
});
