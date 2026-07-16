"use client";

import { Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";

import { normalizeAudioMimeType } from "@/lib/audio/media-contracts";
import {
  initialVoiceState,
  isCurrentAuthorizedSpeechResult,
  voiceStateReducer,
} from "@/lib/audio/voice-state";
import {
  createBrowserSpeechAdapter,
  type BrowserSpeechAdapter,
} from "@/lib/voice/browser-speech";
import {
  authorizedSpeechRequestSchema,
  authorizedSpeechResponseSchema,
  type MediaCorrelation,
  type SpeechAuthorization,
} from "@/schemas/media-contracts";

export type ProviderAudioResult = Readonly<{
  status: "completed" | "cancelled" | "error";
}>;

export interface ProviderAudioAdapter {
  play(blob: Blob): Promise<ProviderAudioResult>;
  stop(): void;
}

interface VoicedResponseProps {
  authorization: SpeechAuthorization | null;
  caption: string;
  className?: string;
  correlation: MediaCorrelation;
  disclosureClassName?: string;
  providerAudioFactory?: () => ProviderAudioAdapter;
  speakerName: string;
  speechAdapterFactory?: () => BrowserSpeechAdapter;
}

function createProviderAudioAdapter(): ProviderAudioAdapter {
  let audio: HTMLAudioElement | null = null;
  let objectUrl: string | null = null;
  let settle: ((result: ProviderAudioResult) => void) | null = null;

  function release(): void {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    audio = null;
  }

  function stop(): void {
    const currentSettle = settle;
    settle = null;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    release();
    currentSettle?.({ status: "cancelled" });
  }

  async function play(blob: Blob): Promise<ProviderAudioResult> {
    stop();
    return new Promise((resolve) => {
      objectUrl = URL.createObjectURL(blob);
      audio = new Audio(objectUrl);
      settle = (result) => {
        if (!settle) return;
        settle = null;
        release();
        resolve(result);
      };
      audio.addEventListener("ended", () => settle?.({ status: "completed" }), { once: true });
      audio.addEventListener("error", () => settle?.({ status: "error" }), { once: true });
      void audio.play().catch(() => settle?.({ status: "error" }));
    });
  }

  return { play, stop };
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function VoicedResponse({
  authorization,
  caption,
  className,
  correlation,
  disclosureClassName,
  providerAudioFactory = createProviderAudioAdapter,
  speakerName,
  speechAdapterFactory = createBrowserSpeechAdapter,
}: VoicedResponseProps) {
  const { caseId, mediaVersion, requestId, stateRevision, stationId } = correlation;
  const [voiceState, dispatch] = useReducer(voiceStateReducer, initialVoiceState);
  const [message, setMessage] = useState("Voice playback is optional.");
  const providerAudioRef = useRef<ProviderAudioAdapter | null>(null);
  const browserSpeechRef = useRef<BrowserSpeechAdapter | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const operationRef = useRef(0);
  const currentRef = useRef({ correlation, caption });

  function stopPlayback(): void {
    operationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    providerAudioRef.current?.stop();
    browserSpeechRef.current?.cancel();
    dispatch({ type: "playback_stopped" });
  }

  useEffect(() => {
    currentRef.current = {
      correlation: { caseId, mediaVersion, requestId, stateRevision, stationId },
      caption,
    };
    return () => stopPlayback();
  }, [caption, caseId, mediaVersion, requestId, stateRevision, stationId]);

  async function playBrowserFallback(expectedOperation: number): Promise<void> {
    if (voiceState.muted || operationRef.current !== expectedOperation) return;
    const adapter = browserSpeechRef.current ?? speechAdapterFactory();
    browserSpeechRef.current = adapter;
    if (!adapter.isSupported()) {
      dispatch({ type: "text_fallback" });
      setMessage("Audio is unavailable. The complete caption remains visible.");
      return;
    }

    dispatch({ type: "browser_fallback_started" });
    setMessage("Playing the deterministic browser-voice fallback.");
    const result = await adapter.speak(caption);
    if (operationRef.current !== expectedOperation || currentRef.current.caption !== caption) return;
    if (result.status === "completed" || result.status === "cancelled") {
      dispatch({ type: "playback_stopped" });
      setMessage("Voice playback is optional.");
    } else if (result.status === "unsupported") {
      dispatch({ type: "text_fallback" });
      setMessage("Audio is unavailable. The complete caption remains visible.");
    } else {
      dispatch({ type: "playback_failed" });
      setMessage("Voice playback failed. The complete caption remains visible.");
    }
  }

  async function playResponse(): Promise<void> {
    stopPlayback();
    const operation = operationRef.current + 1;
    operationRef.current = operation;
    if (voiceState.muted) {
      dispatch({ type: "text_fallback" });
      setMessage("Voice is muted. The complete caption remains visible.");
      return;
    }
    if (!authorization) {
      await playBrowserFallback(operation);
      return;
    }

    const speechRequest = authorizedSpeechRequestSchema.safeParse({ caption, authorization });
    if (!speechRequest.success) {
      await playBrowserFallback(operation);
      return;
    }

    dispatch({ type: "playback_requested" });
    setMessage("Preparing synthetic provider voice...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/ai/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(speechRequest.data),
        signal: controller.signal,
      });
      if (operationRef.current !== operation) return;
      const responseMimeType = normalizeAudioMimeType(response.headers.get("content-type") ?? "");
      if (!response.ok || responseMimeType !== "audio/wav") {
        await playBrowserFallback(operation);
        return;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      let blob: Blob;
      try {
        const declaredByteLength = Number(response.headers.get("x-audio-byte-length"));
        const parsedMetadata = authorizedSpeechResponseSchema.safeParse({
          mediaVersion: response.headers.get("x-media-version"),
          caseId: response.headers.get("x-case-id"),
          stationId: response.headers.get("x-station-id"),
          requestId: response.headers.get("x-request-id"),
          stateRevision: Number(response.headers.get("x-state-revision")),
          status: "ok",
          voiceId: response.headers.get("x-voice-id"),
          captionSha256: response.headers.get("x-caption-sha256"),
          audioMimeType: responseMimeType,
          audioByteLength: bytes.byteLength,
        });
        if (
          !parsedMetadata.success ||
          declaredByteLength !== bytes.byteLength ||
          operationRef.current !== operation ||
          !isCurrentAuthorizedSpeechResult(
            currentRef.current,
            speechRequest.data,
            parsedMetadata.data,
          )
        ) {
          dispatch({ type: "playback_stopped" });
          setMessage("That audio response is stale. The current caption remains visible.");
          return;
        }
        blob = new Blob([bytes], { type: "audio/wav" });
      } finally {
        bytes.fill(0);
      }

      const adapter = providerAudioRef.current ?? providerAudioFactory();
      providerAudioRef.current = adapter;
      dispatch({ type: "playback_started" });
      setMessage("Playing synthetic provider voice.");
      const result = await adapter.play(blob);
      if (operationRef.current !== operation) return;
      if (result.status === "error") {
        await playBrowserFallback(operation);
      } else {
        dispatch({ type: "playback_stopped" });
        setMessage("Voice playback is optional.");
      }
    } catch (error) {
      if (!isAbortError(error) && operationRef.current === operation) {
        await playBrowserFallback(operation);
      }
    } finally {
      if (operationRef.current === operation) abortRef.current = null;
    }
  }

  function changeMute(): void {
    const muted = !voiceState.muted;
    if (muted) stopPlayback();
    dispatch({ type: "mute_changed", muted });
    setMessage(
      muted ? "Voice muted. The complete caption remains visible." : "Voice playback is optional.",
    );
  }

  const active =
    voiceState.playback === "loading" ||
    voiceState.playback === "playing" ||
    voiceState.playback === "browser_fallback";

  return (
    <div className={className}>
      {active ? (
        <button onClick={stopPlayback} type="button">
          <Square aria-hidden="true" />
          Stop or skip voice
        </button>
      ) : (
        <button
          aria-label="Play synthetic voice; hear response"
          onClick={() => void playResponse()}
          type="button"
        >
          <Volume2 aria-hidden="true" />
          Play voice
        </button>
      )}
      <button aria-label={voiceState.muted ? "Unmute voice" : "Mute voice"} onClick={changeMute} type="button">
        {voiceState.muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        {voiceState.muted ? "Unmute" : "Mute"}
      </button>
      <span className={disclosureClassName}>
        Synthetic {authorization ? "provider or browser" : "browser"} voice, not {speakerName}&apos;s historical voice. The visible caption is the authoritative text of this dramatized, non-evidentiary response.
      </span>
      <span aria-live="polite">{message}</span>
    </div>
  );
}
