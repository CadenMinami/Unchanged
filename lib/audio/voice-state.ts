import { isCurrentMediaCorrelation } from "@/lib/audio/media-contracts";
import type {
  AuthorizedSpeechRequest,
  AuthorizedSpeechResponse,
  MediaCorrelation,
  TranscriptionResponse,
} from "@/schemas/media-contracts";

export type VoiceState = Readonly<{
  capture: "idle" | "requesting_permission" | "recording" | "transcribing" | "error";
  playback: "idle" | "loading" | "playing" | "browser_fallback" | "text_only" | "error";
  muted: boolean;
}>;

export type VoiceStateAction =
  | Readonly<{ type: "capture_permission_requested" }>
  | Readonly<{ type: "capture_started" }>
  | Readonly<{ type: "capture_cancelled" }>
  | Readonly<{ type: "capture_failed" }>
  | Readonly<{ type: "transcription_started" }>
  | Readonly<{ type: "transcription_finished" }>
  | Readonly<{ type: "playback_requested" }>
  | Readonly<{ type: "playback_started" }>
  | Readonly<{ type: "playback_stopped" }>
  | Readonly<{ type: "playback_failed" }>
  | Readonly<{ type: "browser_fallback_started" }>
  | Readonly<{ type: "text_fallback" }>
  | Readonly<{ type: "mute_changed"; muted: boolean }>
  | Readonly<{ type: "reset" }>;

export const initialVoiceState: VoiceState = {
  capture: "idle",
  playback: "idle",
  muted: false,
};

export function voiceStateReducer(state: VoiceState, action: VoiceStateAction): VoiceState {
  switch (action.type) {
    case "capture_permission_requested":
      return { ...state, capture: "requesting_permission" };
    case "capture_started":
      return { ...state, capture: "recording" };
    case "transcription_started":
      return { ...state, capture: "transcribing" };
    case "capture_failed":
      return { ...state, capture: "error" };
    case "capture_cancelled":
    case "transcription_finished":
      return { ...state, capture: "idle" };
    case "playback_requested":
      return { ...state, playback: "loading" };
    case "playback_started":
      return { ...state, playback: "playing" };
    case "browser_fallback_started":
      return { ...state, playback: "browser_fallback" };
    case "text_fallback":
      return { ...state, playback: "text_only" };
    case "playback_failed":
      return { ...state, playback: "error" };
    case "playback_stopped":
      return { ...state, playback: "idle" };
    case "mute_changed":
      return {
        ...state,
        muted: action.muted,
        playback: action.muted ? "idle" : state.playback,
      };
    case "reset":
      return { ...initialVoiceState, muted: state.muted };
  }
}

export function isCurrentTranscriptionResult(
  current: MediaCorrelation,
  candidate: TranscriptionResponse,
): boolean {
  return isCurrentMediaCorrelation(current, candidate);
}

export function isCurrentAuthorizedSpeechResult(
  current: Readonly<{ correlation: MediaCorrelation; caption: string }>,
  request: AuthorizedSpeechRequest,
  candidate: AuthorizedSpeechResponse,
): boolean {
  return (
    candidate.status === "ok" &&
    current.caption === request.caption &&
    isCurrentMediaCorrelation(current.correlation, request.authorization) &&
    isCurrentMediaCorrelation(current.correlation, candidate) &&
    request.authorization.captionSha256 === candidate.captionSha256 &&
    request.authorization.voiceId === candidate.voiceId
  );
}
