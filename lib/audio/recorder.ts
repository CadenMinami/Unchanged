import { normalizeAudioMimeType } from "@/lib/audio/media-contracts";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  type CanonicalAudioMimeType,
} from "@/schemas/media-contracts";

const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4",
  "audio/wav",
] as const;

type TimerHandle = unknown;

interface MediaRecorderConstructor {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported(type: string): boolean;
}

export interface RecorderDependencies {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  MediaRecorder: MediaRecorderConstructor;
  now: () => number;
  setTimer: (callback: () => void, delayMs: number) => TimerHandle;
  clearTimer: (handle: TimerHandle) => void;
}

export type RecorderFailure = Readonly<{
  reason:
    | "unsupported_mime_type"
    | "permission_denied"
    | "payload_too_large"
    | "recorder_error"
    | "empty_recording";
}>;

export interface RetainedRecording {
  readonly blob: Blob | null;
  readonly byteLength: number;
  readonly advisoryDurationMs: number;
  readonly canonicalMimeType: CanonicalAudioMimeType;
  readonly recorderMimeType: string;
  release(): void;
}

export type RecorderSnapshot = Readonly<{
  state:
    | "idle"
    | "requesting_permission"
    | "recording"
    | "stopping"
    | "completed"
    | "cancelled"
    | "failed";
  canonicalMimeType: CanonicalAudioMimeType | null;
  retainedByteLength: number;
}>;

export interface BoundedAudioRecorder {
  start(): Promise<void>;
  stop(): void;
  cancel(): void;
  release(): void;
  getSnapshot(): RecorderSnapshot;
}

interface RecorderOptions {
  dependencies?: RecorderDependencies;
  onComplete: (recording: RetainedRecording) => void;
  onFailure: (failure: RecorderFailure) => void;
}

function getBrowserDependencies(): RecorderDependencies | null {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.mediaDevices?.getUserMedia !== "function" ||
    typeof globalThis.MediaRecorder !== "function"
  ) {
    return null;
  }

  return {
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    MediaRecorder: globalThis.MediaRecorder,
    now: () => performance.now(),
    setTimer: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimer: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  };
}

function stopTracks(stream: MediaStream | null): void {
  for (const track of stream?.getTracks() ?? []) {
    try {
      track.stop();
    } catch {
      // A failed track stop must not prevent the remaining tracks from being released.
    }
  }
}

function selectRecorderMimeType(
  MediaRecorderApi: MediaRecorderConstructor,
): { recorderMimeType: string; canonicalMimeType: CanonicalAudioMimeType } | null {
  for (const recorderMimeType of RECORDER_MIME_CANDIDATES) {
    if (!MediaRecorderApi.isTypeSupported(recorderMimeType)) continue;
    const canonicalMimeType = normalizeAudioMimeType(recorderMimeType);
    if (canonicalMimeType) return { recorderMimeType, canonicalMimeType };
  }
  return null;
}

class ReleasableRecording implements RetainedRecording {
  #blob: Blob | null;
  #released = false;
  readonly advisoryDurationMs: number;
  readonly canonicalMimeType: CanonicalAudioMimeType;
  readonly recorderMimeType: string;
  readonly #onRelease: () => void;

  constructor(
    blob: Blob,
    metadata: Readonly<{
      advisoryDurationMs: number;
      canonicalMimeType: CanonicalAudioMimeType;
      recorderMimeType: string;
    }>,
    onRelease: () => void,
  ) {
    this.#blob = blob;
    this.advisoryDurationMs = metadata.advisoryDurationMs;
    this.canonicalMimeType = metadata.canonicalMimeType;
    this.recorderMimeType = metadata.recorderMimeType;
    this.#onRelease = onRelease;
  }

  get blob(): Blob | null {
    return this.#blob;
  }

  get byteLength(): number {
    return this.#blob?.size ?? 0;
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    this.#blob = null;
    this.#onRelease();
  }
}

export function createBoundedAudioRecorder(options: RecorderOptions): BoundedAudioRecorder {
  const dependencies = options.dependencies ?? getBrowserDependencies();
  let state: RecorderSnapshot["state"] = "idle";
  let canonicalMimeType: CanonicalAudioMimeType | null = null;
  let recorderMimeType: string | null = null;
  let stream: MediaStream | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let timer: TimerHandle | null = null;
  let chunks: Blob[] = [];
  let retainedByteLength = 0;
  let startedAtMs = 0;
  let pendingFailure: RecorderFailure | null = null;
  let activeRecording: RetainedRecording | null = null;
  let operationId = 0;

  function clearStopTimer(): void {
    if (timer === null || !dependencies) return;
    dependencies.clearTimer(timer);
    timer = null;
  }

  function detachRecorderEvents(): void {
    mediaRecorder?.removeEventListener("dataavailable", handleDataAvailable);
    mediaRecorder?.removeEventListener("error", handleRecorderError);
    mediaRecorder?.removeEventListener("stop", handleRecorderStop);
  }

  function releaseStream(): void {
    const currentStream = stream;
    stream = null;
    stopTracks(currentStream);
  }

  function discardChunks(): void {
    chunks = [];
    retainedByteLength = 0;
  }

  function finishFailure(failure: RecorderFailure): void {
    clearStopTimer();
    discardChunks();
    detachRecorderEvents();
    mediaRecorder = null;
    releaseStream();
    pendingFailure = null;
    state = "failed";
    options.onFailure(failure);
  }

  function requestRecorderStop(): void {
    const recorder = mediaRecorder;
    if (!recorder || recorder.state === "inactive") {
      handleRecorderStop();
      return;
    }
    try {
      recorder.stop();
    } catch {
      finishFailure({ reason: "recorder_error" });
    }
  }

  function handleDataAvailable(event: Event): void {
    if (state !== "recording" && state !== "stopping") return;
    const data = (event as BlobEvent).data;
    if (!(data instanceof Blob) || data.size === 0) return;

    if (retainedByteLength + data.size > MAX_AUDIO_BYTES) {
      pendingFailure = { reason: "payload_too_large" };
      state = "stopping";
      discardChunks();
      requestRecorderStop();
      return;
    }

    chunks.push(data);
    retainedByteLength += data.size;
  }

  function handleRecorderError(): void {
    if (state === "cancelled" || state === "completed" || state === "failed") return;
    pendingFailure = { reason: "recorder_error" };
    state = "stopping";
    discardChunks();
    requestRecorderStop();
  }

  function handleRecorderStop(): void {
    clearStopTimer();
    detachRecorderEvents();
    mediaRecorder = null;
    releaseStream();

    if (state === "cancelled") {
      discardChunks();
      return;
    }

    if (pendingFailure) {
      const failure = pendingFailure;
      pendingFailure = null;
      discardChunks();
      state = "failed";
      options.onFailure(failure);
      return;
    }

    if (!canonicalMimeType || !recorderMimeType || retainedByteLength === 0) {
      discardChunks();
      state = "failed";
      options.onFailure({ reason: "empty_recording" });
      return;
    }

    const blob = new Blob(chunks, { type: recorderMimeType });
    chunks = [];
    retainedByteLength = blob.size;
    const advisoryDurationMs = Math.max(
      0,
      Math.min(MAX_AUDIO_DURATION_MS, Math.round((dependencies?.now() ?? startedAtMs) - startedAtMs)),
    );
    const recording = new ReleasableRecording(
      blob,
      { advisoryDurationMs, canonicalMimeType, recorderMimeType },
      () => {
        if (activeRecording !== recording) return;
        activeRecording = null;
        retainedByteLength = 0;
      },
    );
    activeRecording = recording;
    state = "completed";
    options.onComplete(recording);
  }

  async function start(): Promise<void> {
    if (state === "recording" || state === "requesting_permission" || state === "stopping") {
      return;
    }

    activeRecording?.release();
    activeRecording = null;
    discardChunks();
    canonicalMimeType = null;
    recorderMimeType = null;
    pendingFailure = null;
    operationId += 1;
    const currentOperation = operationId;

    if (!dependencies) {
      state = "failed";
      options.onFailure({ reason: "unsupported_mime_type" });
      return;
    }

    const selectedMimeType = selectRecorderMimeType(dependencies.MediaRecorder);
    if (!selectedMimeType) {
      state = "failed";
      options.onFailure({ reason: "unsupported_mime_type" });
      return;
    }

    canonicalMimeType = selectedMimeType.canonicalMimeType;
    recorderMimeType = selectedMimeType.recorderMimeType;
    state = "requesting_permission";

    let acquiredStream: MediaStream;
    try {
      acquiredStream = await dependencies.getUserMedia({
        audio: { channelCount: 1 },
        video: false,
      });
    } catch {
      if (currentOperation !== operationId) return;
      state = "failed";
      options.onFailure({ reason: "permission_denied" });
      return;
    }

    if (currentOperation !== operationId || state !== "requesting_permission") {
      stopTracks(acquiredStream);
      return;
    }

    stream = acquiredStream;
    try {
      mediaRecorder = new dependencies.MediaRecorder(stream, {
        mimeType: recorderMimeType,
        audioBitsPerSecond: 64_000,
      });
      mediaRecorder.addEventListener("dataavailable", handleDataAvailable);
      mediaRecorder.addEventListener("error", handleRecorderError);
      mediaRecorder.addEventListener("stop", handleRecorderStop);
      startedAtMs = dependencies.now();
      mediaRecorder.start();
      state = "recording";
      timer = dependencies.setTimer(() => {
        if (state !== "recording") return;
        state = "stopping";
        requestRecorderStop();
      }, MAX_AUDIO_DURATION_MS);
    } catch {
      finishFailure({ reason: "recorder_error" });
    }
  }

  function stop(): void {
    if (state !== "recording") return;
    state = "stopping";
    requestRecorderStop();
  }

  function cancel(): void {
    if (state === "cancelled") return;
    operationId += 1;
    clearStopTimer();
    pendingFailure = null;
    discardChunks();
    activeRecording?.release();
    activeRecording = null;
    state = "cancelled";
    const recorder = mediaRecorder;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        detachRecorderEvents();
        mediaRecorder = null;
        releaseStream();
      }
      return;
    }
    detachRecorderEvents();
    mediaRecorder = null;
    releaseStream();
  }

  function release(): void {
    activeRecording?.release();
    activeRecording = null;
    if (state === "completed") state = "idle";
  }

  return {
    start,
    stop,
    cancel,
    release,
    getSnapshot: () => ({ state, canonicalMimeType, retainedByteLength }),
  };
}
