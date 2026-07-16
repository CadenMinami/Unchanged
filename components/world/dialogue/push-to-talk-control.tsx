"use client";

import { LoaderCircle, Mic, Square, X } from "lucide-react";
import { useEffect, useReducer, useRef, useState } from "react";

import {
  createBoundedAudioRecorder,
  type BoundedAudioRecorder,
  type RecorderFailure,
  type RetainedRecording,
} from "@/lib/audio/recorder";
import {
  initialVoiceState,
  isCurrentTranscriptionResult,
  voiceStateReducer,
} from "@/lib/audio/voice-state";
import {
  MEDIA_CONTRACT_VERSION,
  transcriptionResponseSchema,
  type GeneratedDialogueStationId,
  type MediaCorrelation,
} from "@/schemas/media-contracts";

type RecorderFactory = typeof createBoundedAudioRecorder;

interface PushToTalkControlProps {
  caseId: string;
  className?: string;
  draftRevision: number;
  disabled?: boolean;
  onTranscript: (transcript: string, startingDraftRevision: number) => void;
  recorderFactory?: RecorderFactory;
  stateRevision: number;
  stationId: GeneratedDialogueStationId;
}

function failureMessage(failure: RecorderFailure): string {
  switch (failure.reason) {
    case "permission_denied":
      return "Microphone permission was not granted. Typed input remains available.";
    case "unsupported_mime_type":
      return "This browser cannot record a supported audio format. Typed input remains available.";
    case "payload_too_large":
      return "The recording reached the two-megabyte limit. Try a shorter question or type it.";
    case "empty_recording":
      return "No audio was captured. Try again or type the question.";
    case "recorder_error":
      return "Recording failed locally. Typed input remains available.";
  }
}

function currentMatches(
  current: Readonly<{
    caseId: string;
    stationId: GeneratedDialogueStationId;
    stateRevision: number;
  }>,
  correlation: MediaCorrelation,
): boolean {
  return (
    current.caseId === correlation.caseId &&
    current.stationId === correlation.stationId &&
    current.stateRevision === correlation.stateRevision
  );
}

export function PushToTalkControl({
  caseId,
  className,
  draftRevision,
  disabled = false,
  onTranscript,
  recorderFactory = createBoundedAudioRecorder,
  stateRevision,
  stationId,
}: PushToTalkControlProps) {
  const [voiceState, dispatch] = useReducer(voiceStateReducer, initialVoiceState);
  const [message, setMessage] = useState("Voice input is optional.");
  const recorderRef = useRef<BoundedAudioRecorder | null>(null);
  const requestRef = useRef<MediaCorrelation | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const draftRevisionRef = useRef(draftRevision);
  const requestDraftRevisionRef = useRef<number | null>(null);
  const currentRef = useRef({ caseId, stationId, stateRevision });

  function clearActiveCapture(): void {
    requestRef.current = null;
    requestDraftRevisionRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    recorderRef.current?.cancel();
    recorderRef.current?.release();
    recorderRef.current = null;
  }

  useEffect(() => {
    const contextChanged =
      currentRef.current.caseId !== caseId ||
      currentRef.current.stationId !== stationId ||
      currentRef.current.stateRevision !== stateRevision;
    currentRef.current = { caseId, stationId, stateRevision };
    if (contextChanged) {
      dispatch({ type: "reset" });
      setMessage("Voice input reset for the current source context.");
    }
    return () => clearActiveCapture();
  }, [caseId, stateRevision, stationId]);

  useEffect(() => {
    draftRevisionRef.current = draftRevision;
    if (
      requestDraftRevisionRef.current !== null &&
      requestDraftRevisionRef.current !== draftRevision
    ) {
      clearActiveCapture();
      dispatch({ type: "capture_cancelled" });
      setMessage("Voice input was cancelled because the typed question changed.");
    }
  }, [draftRevision]);

  async function submitRecording(
    recording: RetainedRecording,
    correlation: MediaCorrelation,
  ): Promise<void> {
    const blob = recording.blob;
    if (!blob || !currentMatches(currentRef.current, correlation)) {
      recording.release();
      return;
    }

    dispatch({ type: "transcription_started" });
    setMessage("Transcribing the bounded clip...");
    const controller = new AbortController();
    abortRef.current = controller;
    const formData = new FormData();
    formData.set(
      "metadata",
      JSON.stringify({
        ...correlation,
        declaredMimeType: recording.canonicalMimeType,
        advisoryDurationMs: recording.advisoryDurationMs,
      }),
    );
    formData.set("audio", blob, `recording.${recording.canonicalMimeType.split("/")[1]}`);

    try {
      const response = await fetch("/api/ai/transcribe", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      const parsed = transcriptionResponseSchema.safeParse(payload);
      const startingDraftRevision = requestDraftRevisionRef.current;
      if (
        !parsed.success ||
        requestRef.current !== correlation ||
        startingDraftRevision === null ||
        startingDraftRevision !== draftRevisionRef.current ||
        !currentMatches(currentRef.current, correlation) ||
        !isCurrentTranscriptionResult(correlation, parsed.data)
      ) {
        if (requestRef.current === correlation) {
          dispatch({ type: "capture_failed" });
          setMessage("The transcription response was stale or invalid. Typed input remains available.");
        }
        return;
      }

      if (parsed.data.status === "ok") {
        onTranscript(parsed.data.transcript, startingDraftRevision);
        setMessage("Transcript added below. Review and correct it before asking the source.");
      } else {
        dispatch({ type: "capture_failed" });
        setMessage("Transcription was unavailable. Typed input remains available.");
        return;
      }
      dispatch({ type: "transcription_finished" });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (requestRef.current === correlation) {
        dispatch({ type: "capture_failed" });
        setMessage("Transcription failed. Typed input remains available.");
      }
    } finally {
      recording.release();
      recorderRef.current?.release();
      if (requestRef.current === correlation) {
        requestRef.current = null;
        abortRef.current = null;
      }
    }
  }

  async function startCapture(): Promise<void> {
    if (disabled || voiceState.capture === "requesting_permission" || voiceState.capture === "transcribing") {
      return;
    }
    if (voiceState.capture === "recording") {
      recorderRef.current?.stop();
      return;
    }

    clearActiveCapture();
    const correlation: MediaCorrelation = {
      mediaVersion: MEDIA_CONTRACT_VERSION,
      caseId,
      stationId,
      requestId: crypto.randomUUID(),
      stateRevision,
    };
    requestRef.current = correlation;
    requestDraftRevisionRef.current = draftRevision;
    dispatch({ type: "capture_permission_requested" });
    setMessage("Waiting for microphone permission...");
    const recorder = recorderFactory({
      onComplete: (recording) => void submitRecording(recording, correlation),
      onFailure: (failure) => {
        if (requestRef.current !== correlation) return;
        dispatch({ type: "capture_failed" });
        setMessage(failureMessage(failure));
      },
    });
    recorderRef.current = recorder;
    await recorder.start();
    if (
      requestRef.current === correlation &&
      recorder.getSnapshot().state === "recording"
    ) {
      dispatch({ type: "capture_started" });
      setMessage("Recording. Stop when your question is complete; recording ends at 20 seconds.");
    }
  }

  function cancelCapture(): void {
    clearActiveCapture();
    dispatch({ type: "capture_cancelled" });
    setMessage("Recording cancelled. Typed input remains available.");
  }

  const isRecording = voiceState.capture === "recording";
  const isBusy =
    voiceState.capture === "requesting_permission" || voiceState.capture === "transcribing";

  return (
    <div className={className}>
      <button disabled={disabled || isBusy} onClick={() => void startCapture()} type="button">
        {voiceState.capture === "transcribing" ? (
          <LoaderCircle aria-hidden="true" />
        ) : isRecording ? (
          <Square aria-hidden="true" />
        ) : (
          <Mic aria-hidden="true" />
        )}
        {voiceState.capture === "transcribing"
          ? "Transcribing"
          : isRecording
            ? "Stop and transcribe"
            : "Start push-to-talk"}
      </button>
      {isRecording || isBusy ? (
        <button onClick={cancelCapture} type="button">
          <X aria-hidden="true" />
          Cancel recording
        </button>
      ) : null}
      <span aria-live="polite" role="status">
        {message}
      </span>
    </div>
  );
}
