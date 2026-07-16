import { describe, expect, it, vi } from "vitest";

import { mintSpeechAuthorization } from "@/lib/audio/speech-ticket";
import type {
  MediaOperationLogger,
  TranscriptionProvider,
} from "@/lib/audio/transcription-service";
import type { SpeechProvider } from "@/lib/audio/speech-service";
import { MAX_MULTIPART_BODY_BYTES } from "@/lib/audio/bounded-multipart";
import {
  handleSpeechRequest,
  handleTranscriptionRequest,
} from "@/lib/openai/route-handlers";
import {
  MAX_AUDIO_DURATION_MS,
  MAX_SPEECH_AUDIO_BYTES,
  MEDIA_CONTRACT_VERSION,
  authorizedSpeechResponseSchema,
  transcriptionResponseSchema,
  type MediaCorrelation,
} from "@/schemas/media-contracts";

const SPEECH_SECRET = "0123456789abcdef0123456789abcdef";
const NOW_SECONDS = 1_800_000_000;
const correlation = {
  mediaVersion: MEDIA_CONTRACT_VERSION,
  caseId: "varennes",
  stationId: "CHAR-DROUET",
  requestId: "00000000-0000-4000-8000-000000000001",
  stateRevision: 12,
} satisfies MediaCorrelation;

function createPcmWav(options: {
  channels?: number;
  durationSeconds?: number;
  marker?: number;
} = {}): Uint8Array {
  const channels = options.channels ?? 1;
  const sampleRate = 8_000;
  const bytesPerSample = 2;
  const sampleCount = Math.max(1, Math.round(sampleRate * (options.durationSeconds ?? 1)));
  const dataLength = sampleCount * channels * bytesPerSample;
  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      bytes[offset + index] = value.charCodeAt(index);
    }
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, bytes.length - 8, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bytesPerSample * 8, true);
  writeAscii(36, "data");
  view.setUint32(40, dataLength, true);
  bytes.fill(options.marker ?? 7, 44);
  return bytes;
}

function transcriptionRequest(options: {
  audio?: Uint8Array;
  declaredMimeType?: string;
  advisoryDurationMs?: number;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
} = {}): Request {
  const declaredMimeType = options.declaredMimeType ?? "audio/wav";
  const audio = Uint8Array.from(options.audio ?? createPcmWav());
  const formData = new FormData();
  formData.set(
    "metadata",
    JSON.stringify({
      ...correlation,
      declaredMimeType,
      advisoryDurationMs: options.advisoryDurationMs ?? 1_000,
      ...options.metadata,
    }),
  );
  formData.set(
    "audio",
    new File([audio], "../../client-name-is-untrusted.wav", {
      type: declaredMimeType,
    }),
  );
  return new Request("http://localhost/api/ai/transcribe", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });
}

function expectReleasedAudio(bytes: Uint8Array | null): void {
  expect(bytes).not.toBeNull();
  expect(Array.from(bytes ?? []).every((byte) => byte === 0)).toBe(true);
}

function speechRequest(options: {
  caption?: string;
  correlation?: MediaCorrelation;
  expiresAt?: number;
  signal?: AbortSignal;
} = {}): Request {
  const caption = options.caption ?? "Exact authorized caption.";
  const requestCorrelation = options.correlation ?? correlation;
  const authorization = mintSpeechAuthorization(
    { caption, correlation: requestCorrelation },
    SPEECH_SECRET,
    options.expiresAt === undefined ? NOW_SECONDS : options.expiresAt - 120,
  );
  return new Request("http://localhost/api/ai/speech", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ caption, authorization }),
    signal: options.signal,
  });
}

function transcriptionProvider(
  result: { text: string } = {
    text: "Which road did you take?",
  },
): TranscriptionProvider & { transcribe: ReturnType<typeof vi.fn> } {
  return {
    transcribe: vi.fn(async () => result),
  };
}

async function json(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>;
}

describe("transcription media route", () => {
  it("rate limits before consuming multipart bytes or resolving a provider", async () => {
    const pull = vi.fn();
    const providerResolved = vi.fn();
    const request = new Request("http://localhost/api/ai/transcribe", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=bounded" },
      body: new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handleTranscriptionRequest(request, {
      rateLimiter: { allow: () => false },
      get transcriptionProvider() {
        providerResolved();
        return null;
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(request.bodyUsed).toBe(false);
    expect(pull).not.toHaveBeenCalled();
    expect(providerResolved).not.toHaveBeenCalled();
  });

  it("returns a classified no-key failure without invoking a provider", async () => {
    const response = await handleTranscriptionRequest(transcriptionRequest(), {
      transcriptionProvider: null,
    });

    expect(response.status).toBe(503);
    expect(await json(response)).toMatchObject({
      ...correlation,
      reason: "missing_api_key",
      retryable: false,
    });
  });

  it("rejects an oversized declared Content-Length before provider invocation", async () => {
    const provider = transcriptionProvider();
    const base = transcriptionRequest();
    const headers = new Headers(base.headers);
    headers.set("content-length", String(MAX_MULTIPART_BODY_BYTES + 1));
    const request = new Request(base, { headers });

    const response = await handleTranscriptionRequest(request, { transcriptionProvider: provider });

    expect(response.status).toBe(413);
    expect(await json(response)).toMatchObject({
      status: "error",
      reason: "payload_too_large",
      retryable: false,
    });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects an absent-length streamed body that crosses the cap", async () => {
    const provider = transcriptionProvider();
    const cancel = vi.fn();
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(
          pulls === 0 ? new Uint8Array(MAX_MULTIPART_BODY_BYTES) : new Uint8Array([1]),
        );
        pulls += 1;
      },
      cancel,
    });
    const request = new Request("http://localhost/api/ai/transcribe", {
      method: "POST",
      headers: { "content-type": "multipart/form-data; boundary=bounded" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handleTranscriptionRequest(request, { transcriptionProvider: provider });

    expect(response.status).toBe(413);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects malformed multipart without exposing parser details", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      new Request("http://localhost/api/ai/transcribe", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=bad" },
        body: "not multipart",
      }),
      { transcriptionProvider: provider },
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      status: "error",
      reason: "invalid_request",
      retryable: false,
    });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("detects unsupported bytes instead of trusting the File MIME", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      transcriptionRequest({ audio: new Uint8Array([1, 2, 3, 4]) }),
      { transcriptionProvider: provider },
    );

    expect(response.status).toBe(415);
    expect(await json(response)).toMatchObject({ reason: "unsupported_mime_type" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects declared MIME that disagrees with detected container bytes", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      transcriptionRequest({ declaredMimeType: "audio/webm", audio: createPcmWav() }),
      { transcriptionProvider: provider },
    );

    expect(response.status).toBe(415);
    expect(await json(response)).toMatchObject({ reason: "mime_type_mismatch" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects an audio container unsupported by the transcription provider", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      transcriptionRequest({
        declaredMimeType: "audio/ogg",
        audio: new Uint8Array([79, 103, 103, 83]),
      }),
      {
        inspectAudio: async () => ({
          detectedMimeType: "audio/ogg",
          durationMs: 500,
          channelCount: 1,
        }),
        transcriptionProvider: provider,
      },
    );

    expect(response.status).toBe(415);
    expect(await json(response)).toMatchObject({ reason: "unsupported_mime_type" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects non-mono server metadata", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      transcriptionRequest({ audio: createPcmWav({ channels: 2 }) }),
      { transcriptionProvider: provider },
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toMatchObject({ reason: "invalid_request" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects an advisory duration over 20 seconds before provider invocation", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(
      transcriptionRequest({ advisoryDurationMs: MAX_AUDIO_DURATION_MS + 1 }),
      { transcriptionProvider: provider },
    );

    expect(response.status).toBe(422);
    expect(await json(response)).toMatchObject({ reason: "duration_exceeded" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rejects server-detected duration over 20 seconds before provider invocation", async () => {
    const provider = transcriptionProvider();

    const response = await handleTranscriptionRequest(transcriptionRequest({
      audio: createPcmWav({ durationSeconds: 20.001 }),
    }), {
      transcriptionProvider: provider,
    });
    const payload = await json(response);

    expect(response.status).toBe(422);
    expect(payload).toMatchObject({ reason: "duration_exceeded" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("validates canonical case and generated-station correlation before provider invocation", async () => {
    const provider = transcriptionProvider();
    const staleCase = await handleTranscriptionRequest(
      transcriptionRequest({ metadata: { caseId: "another-case" } }),
      { transcriptionProvider: provider },
    );
    const invalidStation = await handleTranscriptionRequest(
      transcriptionRequest({ metadata: { stationId: "STATION-ASSEMBLY" } }),
      { transcriptionProvider: provider },
    );

    expect(staleCase.status).toBe(409);
    expect(await json(staleCase)).toMatchObject({ reason: "stale_correlation" });
    expect(invalidStation.status).toBe(400);
    expect(await json(invalidStation)).toMatchObject({ reason: "invalid_request" });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("rate limits before provider invocation", async () => {
    const provider = transcriptionProvider();
    const response = await handleTranscriptionRequest(transcriptionRequest(), {
      rateLimiter: { allow: () => false },
      transcriptionProvider: provider,
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await json(response)).toMatchObject({ reason: "rate_limited", retryable: true });
    expect(provider.transcribe).not.toHaveBeenCalled();
  });

  it("classifies request abort and releases the provider input buffer", async () => {
    const controller = new AbortController();
    let providerBytes: Uint8Array | null = null;
    const transcribe = vi.fn<TranscriptionProvider["transcribe"]>((input) => {
      providerBytes = input.audio;
      return new Promise((_resolve, reject) => {
        input.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      });
    });
    const pending = handleTranscriptionRequest(
      transcriptionRequest({ signal: controller.signal }),
      { transcriptionProvider: { transcribe } },
    );
    await vi.waitFor(() => expect(transcribe).toHaveBeenCalledTimes(1));

    controller.abort();
    const response = await pending;

    expect(response.status).toBe(499);
    expect(await json(response)).toMatchObject({ reason: "aborted", retryable: false });
    expectReleasedAudio(providerBytes);
  });

  it("classifies timeout with one explicit retry and releases input bytes", async () => {
    let providerBytes: Uint8Array | null = null;
    const timeout = Object.assign(new Error("private provider timeout"), {
      name: "APIConnectionTimeoutError",
    });
    const transcribe = vi.fn<TranscriptionProvider["transcribe"]>((input) => {
      providerBytes = input.audio;
      return Promise.reject(timeout);
    });

    const response = await handleTranscriptionRequest(transcriptionRequest(), {
      transcriptionProvider: { transcribe },
    });

    expect(response.status).toBe(504);
    expect(await json(response)).toMatchObject({ reason: "timeout", retryable: true });
    expect(transcribe).toHaveBeenCalledTimes(2);
    expectReleasedAudio(providerBytes);
  });

  it("classifies non-transient provider failure without retry and redacts logs", async () => {
    const rawText = "RAW_TRANSCRIPT_AND_AUDIO_SENTINEL";
    let providerBytes: Uint8Array | null = null;
    const warn = vi.fn<MediaOperationLogger["warn"]>();
    const transcribe = vi.fn<TranscriptionProvider["transcribe"]>((input) => {
      providerBytes = input.audio;
      return Promise.reject(Object.assign(new Error(rawText), { status: 400 }));
    });

    const response = await handleTranscriptionRequest(transcriptionRequest(), {
      logger: { warn },
      transcriptionProvider: { transcribe },
    });

    expect(response.status).toBe(502);
    expect(await json(response)).toMatchObject({ reason: "provider_error", retryable: false });
    expect(transcribe).toHaveBeenCalledTimes(1);
    expectReleasedAudio(providerBytes);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawText);
  });

  it("returns strict detected metadata and releases audio after successful transcription", async () => {
    let providerBytes: Uint8Array | null = null;
    const provider = transcriptionProvider({ text: "Which road did you take?" });
    provider.transcribe.mockImplementation(async (input) => {
      providerBytes = input.audio;
      expect(input.fileName).toBe("clip.wav");
      expect(input.mimeType).toBe("audio/wav");
      return { text: "Which road did you take?" };
    });

    const response = await handleTranscriptionRequest(transcriptionRequest(), {
      inspectAudio: async () => ({
        detectedMimeType: "audio/wav",
        durationMs: 1_250,
        channelCount: 1,
      }),
      transcriptionProvider: provider,
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(transcriptionResponseSchema.parse(payload)).toMatchObject({
      ...correlation,
      status: "ok",
      transcript: "Which road did you take?",
      detectedMimeType: "audio/wav",
      detectedDurationMs: 1_250,
    });
    expectReleasedAudio(providerBytes);
  });
});

describe("authorized speech media route", () => {
  it("rate limits before consuming JSON or resolving a provider", async () => {
    const pull = vi.fn();
    const providerResolved = vi.fn();
    const request = new Request("http://localhost/api/ai/speech", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await handleSpeechRequest(request, {
      rateLimiter: { allow: () => false },
      get speechProvider() {
        providerResolved();
        return null;
      },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(request.bodyUsed).toBe(false);
    expect(pull).not.toHaveBeenCalled();
    expect(providerResolved).not.toHaveBeenCalled();
  });

  it("returns a classified no-key failure after ticket verification", async () => {
    const response = await handleSpeechRequest(speechRequest(), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: null,
    });

    expect(response.status).toBe(503);
    expect(await json(response)).toMatchObject({
      ...correlation,
      reason: "missing_api_key",
      retryable: false,
    });
  });

  it("verifies the exact pre-minted ticket before provider invocation", async () => {
    const synthesize = vi.fn<SpeechProvider["synthesize"]>();
    const request = speechRequest();
    const body = (await request.json()) as { caption: string; authorization: unknown };
    const altered = new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...body, caption: `${body.caption} altered` }),
    });

    const response = await handleSpeechRequest(altered, {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({
      ...correlation,
      reason: "invalid_authorization",
      retryable: false,
    });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("classifies expired authorization before provider invocation", async () => {
    const synthesize = vi.fn<SpeechProvider["synthesize"]>();
    const response = await handleSpeechRequest(speechRequest({ expiresAt: NOW_SECONDS }), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(response.status).toBe(401);
    expect(await json(response)).toMatchObject({ reason: "authorization_expired" });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("rate limits authorized speech before provider invocation", async () => {
    const synthesize = vi.fn<SpeechProvider["synthesize"]>();
    const response = await handleSpeechRequest(speechRequest(), {
      nowEpochSeconds: () => NOW_SECONDS,
      rateLimiter: { allow: () => false },
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(synthesize).not.toHaveBeenCalled();
  });

  it.each([
    ["timeout", Object.assign(new Error("timeout"), { name: "APIConnectionTimeoutError" }), 504, 2],
    ["provider", Object.assign(new Error("provider"), { status: 400 }), 502, 1],
  ] as const)("classifies %s speech failure", async (_label, error, status, calls) => {
    const synthesize = vi.fn<SpeechProvider["synthesize"]>().mockRejectedValue(error);
    const response = await handleSpeechRequest(speechRequest(), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(response.status).toBe(status);
    expect(synthesize).toHaveBeenCalledTimes(calls);
  });

  it("classifies speech abort without retry", async () => {
    const controller = new AbortController();
    const synthesize = vi.fn<SpeechProvider["synthesize"]>((input) =>
      new Promise((_resolve, reject) => {
        input.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
    );
    const pending = handleSpeechRequest(speechRequest({ signal: controller.signal }), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });
    await vi.waitFor(() => expect(synthesize).toHaveBeenCalledTimes(1));

    controller.abort();
    const response = await pending;

    expect(response.status).toBe(499);
    expect(await json(response)).toMatchObject({ reason: "aborted" });
    expect(synthesize).toHaveBeenCalledTimes(1);
  });

  it("uses the exact caption, private voice mapping, strict headers, and copied bytes", async () => {
    const providerBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    const synthesize = vi.fn<SpeechProvider["synthesize"]>().mockResolvedValue(providerBytes);
    const caption = "Exact authorized caption.";

    const response = await handleSpeechRequest(speechRequest({ caption }), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });
    const responseBytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/wav");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-media-version")).toBe(MEDIA_CONTRACT_VERSION);
    expect(response.headers.get("x-station-id")).toBe(correlation.stationId);
    expect(response.headers.get("x-request-id")).toBe(correlation.requestId);
    expect(response.headers.get("x-state-revision")).toBe("12");
    expect(response.headers.get("x-voice-id")).toBe("drouet-source-v1");
    expect(response.headers.get("x-caption-sha256")).toMatch(/^[a-f0-9]{64}$/);
    expect(response.headers.get("x-audio-byte-length")).toBe("8");
    expect(synthesize).toHaveBeenCalledWith(
      expect.objectContaining({ input: caption, providerVoice: "cedar" }),
    );
    expect(responseBytes).toEqual(new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]));
    expect(providerBytes.every((byte) => byte === 0)).toBe(true);

    expect(
      authorizedSpeechResponseSchema.parse({
        ...correlation,
        status: "ok",
        voiceId: response.headers.get("x-voice-id"),
        captionSha256: response.headers.get("x-caption-sha256"),
        audioMimeType: "audio/wav",
        audioByteLength: responseBytes.byteLength,
      }),
    ).toBeTruthy();
  });

  it("rejects oversized speech output and releases provider bytes", async () => {
    const providerBytes = new Uint8Array(MAX_SPEECH_AUDIO_BYTES + 1).fill(7);
    const synthesize = vi.fn<SpeechProvider["synthesize"]>().mockResolvedValue(providerBytes);

    const response = await handleSpeechRequest(speechRequest(), {
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(response.status).toBe(502);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await json(response)).toMatchObject({ reason: "provider_error" });
    expect(providerBytes.every((byte) => byte === 0)).toBe(true);
  });

  it("uses one owned speech clone and releases it after constructing the response", async () => {
    const providerBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
    const ownedClones: Uint8Array[] = [];
    const originalSlice = Uint8Array.prototype.slice;
    const sliceSpy = vi
      .spyOn(Uint8Array.prototype, "slice")
      .mockImplementation(function (this: Uint8Array, start?: number, end?: number) {
        const clone = originalSlice.call(this, start, end);
        if (this === providerBytes || ownedClones.includes(this)) ownedClones.push(clone);
        return clone;
      });

    try {
      const response = await handleSpeechRequest(speechRequest(), {
        nowEpochSeconds: () => NOW_SECONDS,
        speechAuthorizationSecret: SPEECH_SECRET,
        speechProvider: {
          synthesize: vi.fn<SpeechProvider["synthesize"]>().mockResolvedValue(providerBytes),
        },
      });

      expect(response.status).toBe(200);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]),
      );
      expect(ownedClones).toHaveLength(1);
      expect(ownedClones[0]?.every((byte) => byte === 0)).toBe(true);
      expect(providerBytes.every((byte) => byte === 0)).toBe(true);
    } finally {
      sliceSpy.mockRestore();
    }
  });

  it("never logs the authorized caption or generated bytes", async () => {
    const rawCaption = "RAW_AUTHORIZED_CAPTION_SENTINEL";
    const warn = vi.fn<MediaOperationLogger["warn"]>();
    const synthesize = vi
      .fn<SpeechProvider["synthesize"]>()
      .mockRejectedValue(Object.assign(new Error(rawCaption), { status: 400 }));

    await handleSpeechRequest(speechRequest({ caption: rawCaption }), {
      logger: { warn },
      nowEpochSeconds: () => NOW_SECONDS,
      speechAuthorizationSecret: SPEECH_SECRET,
      speechProvider: { synthesize },
    });

    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawCaption);
  });
});

describe("media route entrypoints", () => {
  it("exposes transcription through a Node runtime POST route", async () => {
    const route = await import("@/app/api/ai/transcribe/route");

    expect(route.runtime).toBe("nodejs");
    expect(route.POST).toBeTypeOf("function");
  });

  it("exposes speech through a Node runtime POST route", async () => {
    const route = await import("@/app/api/ai/speech/route");

    expect(route.runtime).toBe("nodejs");
    expect(route.POST).toBeTypeOf("function");
  });
});
