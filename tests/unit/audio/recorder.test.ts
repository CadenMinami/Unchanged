import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createBoundedAudioRecorder,
  type RecorderDependencies,
  type RecorderFailure,
  type RetainedRecording,
} from "@/lib/audio/recorder";
import { MAX_AUDIO_BYTES, MAX_AUDIO_DURATION_MS } from "@/schemas/media-contracts";

class FakeTrack {
  readonly stop = vi.fn();
}

class FakeStream {
  readonly track = new FakeTrack();

  getTracks(): MediaStreamTrack[] {
    return [this.track as unknown as MediaStreamTrack];
  }
}

class FakeMediaRecorder extends EventTarget {
  static supportedTypes = new Set<string>();
  static instances: FakeMediaRecorder[] = [];
  static throwOnStart = false;

  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supportedTypes.has(type);
  }

  readonly mimeType: string;
  readonly stream: MediaStream;
  state: RecordingState = "inactive";

  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    super();
    this.stream = stream;
    this.mimeType = options?.mimeType ?? "";
    FakeMediaRecorder.instances.push(this);
  }

  start(): void {
    if (FakeMediaRecorder.throwOnStart) throw new Error("start failed");
    this.state = "recording";
  }

  stop(): void {
    if (this.state === "inactive") return;
    this.state = "inactive";
    this.dispatchEvent(new Event("stop"));
  }

  emitData(size: number, type = this.mimeType): void {
    const data = new Blob([new Uint8Array(size)], { type });
    this.dispatchEvent(new BlobEvent("dataavailable", { data }));
  }

  emitError(): void {
    this.dispatchEvent(new Event("error"));
  }
}

function createHarness() {
  const stream = new FakeStream();
  const getUserMedia = vi.fn(async () => stream as unknown as MediaStream);
  const onComplete = vi.fn<(recording: RetainedRecording) => void>();
  const onFailure = vi.fn<(failure: RecorderFailure) => void>();
  let nowMs = 1_000;
  const dependencies: RecorderDependencies = {
    getUserMedia,
    MediaRecorder: FakeMediaRecorder as unknown as RecorderDependencies["MediaRecorder"],
    now: () => nowMs,
    setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
    clearTimer: (timer) => {
      if (typeof timer === "number") window.clearTimeout(timer);
    },
  };
  const recorder = createBoundedAudioRecorder({
    dependencies,
    onComplete,
    onFailure,
  });

  return {
    getUserMedia,
    onComplete,
    onFailure,
    recorder,
    setNow(value: number) {
      nowMs = value;
    },
    stream,
  };
}

beforeEach(() => {
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.supportedTypes = new Set(["audio/webm;codecs=opus"]);
  FakeMediaRecorder.throwOnStart = false;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("bounded audio recorder", () => {
  it("requests microphone permission only when start is called and asks for mono audio", async () => {
    const harness = createHarness();

    expect(harness.getUserMedia).not.toHaveBeenCalled();

    await harness.recorder.start();

    expect(harness.getUserMedia).toHaveBeenCalledTimes(1);
    expect(harness.getUserMedia).toHaveBeenCalledWith({
      audio: { channelCount: 1 },
      video: false,
    });
  });

  it("selects the first browser-supported contract MIME type", async () => {
    FakeMediaRecorder.supportedTypes = new Set(["audio/ogg;codecs=opus", "audio/wav"]);
    const harness = createHarness();

    await harness.recorder.start();

    expect(FakeMediaRecorder.instances).toHaveLength(1);
    expect(FakeMediaRecorder.instances[0]?.mimeType).toBe("audio/wav");
    expect(harness.recorder.getSnapshot()).toMatchObject({
      state: "recording",
      canonicalMimeType: "audio/wav",
    });
  });

  it("fails without requesting permission when the browser supports no contract MIME type", async () => {
    FakeMediaRecorder.supportedTypes.clear();
    const harness = createHarness();

    await harness.recorder.start();

    expect(harness.getUserMedia).not.toHaveBeenCalled();
    expect(harness.onFailure).toHaveBeenCalledWith({ reason: "unsupported_mime_type" });
  });

  it("automatically stops at 20 seconds and reports a bounded advisory duration", async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    await harness.recorder.start();
    const mediaRecorder = FakeMediaRecorder.instances[0];
    mediaRecorder?.emitData(128);
    harness.setNow(1_000 + MAX_AUDIO_DURATION_MS + 50);

    await vi.advanceTimersByTimeAsync(MAX_AUDIO_DURATION_MS);

    expect(mediaRecorder?.state).toBe("inactive");
    expect(harness.onComplete).toHaveBeenCalledTimes(1);
    expect(harness.onComplete.mock.calls[0]?.[0]).toMatchObject({
      byteLength: 128,
      advisoryDurationMs: MAX_AUDIO_DURATION_MS,
    });
    expect(harness.stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it("stops and discards retained chunks when recording crosses 2,000,000 bytes", async () => {
    expect(MAX_AUDIO_BYTES).toBe(2_000_000);
    const harness = createHarness();
    await harness.recorder.start();
    const mediaRecorder = FakeMediaRecorder.instances[0];

    mediaRecorder?.emitData(MAX_AUDIO_BYTES);
    mediaRecorder?.emitData(1);

    expect(harness.onComplete).not.toHaveBeenCalled();
    expect(harness.onFailure).toHaveBeenCalledWith({ reason: "payload_too_large" });
    expect(harness.recorder.getSnapshot()).toMatchObject({
      state: "failed",
      retainedByteLength: 0,
    });
    expect(harness.stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it("cancels without producing a recording and stops every stream track", async () => {
    const harness = createHarness();
    await harness.recorder.start();
    FakeMediaRecorder.instances[0]?.emitData(512);

    harness.recorder.cancel();

    expect(harness.onComplete).not.toHaveBeenCalled();
    expect(harness.onFailure).not.toHaveBeenCalled();
    expect(harness.recorder.getSnapshot()).toMatchObject({
      state: "cancelled",
      retainedByteLength: 0,
    });
    expect(harness.stream.track.stop).toHaveBeenCalledTimes(1);
  });

  it.each(["manual stop", "recorder error", "start failure"])(
    "stops tracks after %s",
    async (path) => {
      const harness = createHarness();
      if (path === "start failure") FakeMediaRecorder.throwOnStart = true;

      await harness.recorder.start();

      const mediaRecorder = FakeMediaRecorder.instances[0];
      if (path === "manual stop") {
        mediaRecorder?.emitData(32);
        harness.recorder.stop();
      }
      if (path === "recorder error") mediaRecorder?.emitError();

      expect(harness.stream.track.stop).toHaveBeenCalledTimes(1);
    },
  );

  it("releases the completed blob and retained byte accounting explicitly", async () => {
    const harness = createHarness();
    await harness.recorder.start();
    const mediaRecorder = FakeMediaRecorder.instances[0];
    mediaRecorder?.emitData(256);
    harness.setNow(2_500);

    harness.recorder.stop();

    const recording = harness.onComplete.mock.calls[0]?.[0];
    expect(recording?.blob).toBeInstanceOf(Blob);
    expect(recording?.byteLength).toBe(256);

    recording?.release();

    expect(recording?.blob).toBeNull();
    expect(recording?.byteLength).toBe(0);
    expect(harness.recorder.getSnapshot().retainedByteLength).toBe(0);
  });
});
