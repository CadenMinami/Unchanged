import OpenAI, { toFile } from "openai";
import { parseBuffer } from "music-metadata";

import { classifyProviderError } from "@/lib/openai/provider-error";
import {
  MAX_AUDIO_DURATION_MS,
  MAX_TRANSCRIPT_CHARACTERS,
  transcriptionResponseSchema,
  type CanonicalAudioMimeType,
  type MediaFailureReason,
  type TranscriptionRequest,
  type TranscriptionResponse,
} from "@/schemas/media-contracts";

const TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
const PROVIDER_TIMEOUT_MS = 10_000;

export interface MediaOperationLogger {
  warn(event: string, context: Readonly<Record<string, string | number | boolean>>): void;
}

export interface TranscriptionProviderInput {
  audio: Uint8Array;
  fileName: string;
  mimeType: CanonicalAudioMimeType;
  signal?: AbortSignal;
}

export interface TranscriptionProvider {
  transcribe(
    input: TranscriptionProviderInput,
  ): Promise<{ text: string }>;
}

export interface InspectedAudioMetadata {
  detectedMimeType: CanonicalAudioMimeType;
  durationMs: number;
  channelCount: number;
}

interface OpenAITranscriptionClient {
  audio: {
    transcriptions: {
      create(
        body: {
          file: File;
          model: string;
          response_format: "json";
          language: "en";
        },
        options: { timeout: number; signal?: AbortSignal },
      ): Promise<{ text: string }>;
    };
  };
}

interface TranscriptionServiceOptions {
  detectedDurationMs: number;
  provider: TranscriptionProvider | null;
  signal?: AbortSignal;
  logger?: MediaOperationLogger;
}

function canonicalMimeFromContainer(container: string | undefined): CanonicalAudioMimeType | null {
  const normalized = container?.trim().toLowerCase() ?? "";
  if (normalized.includes("webm")) return "audio/webm";
  if (normalized.includes("ogg")) return "audio/ogg";
  if (normalized.includes("wave") || normalized === "wav") return "audio/wav";
  if (
    normalized.includes("mp4") ||
    normalized.includes("m4a") ||
    normalized.includes("isom") ||
    normalized.includes("quicktime")
  ) {
    return "audio/mp4";
  }
  return null;
}

function extensionForMimeType(mimeType: CanonicalAudioMimeType): string {
  switch (mimeType) {
    case "audio/webm":
      return "webm";
    case "audio/ogg":
      return "ogg";
    case "audio/mp4":
      return "mp4";
    case "audio/wav":
      return "wav";
  }
}

function mediaFailure(
  request: TranscriptionRequest,
  reason: MediaFailureReason,
  retryable: boolean,
): TranscriptionResponse {
  return transcriptionResponseSchema.parse({
    mediaVersion: request.mediaVersion,
    caseId: request.caseId,
    stationId: request.stationId,
    requestId: request.requestId,
    stateRevision: request.stateRevision,
    status: "error",
    reason,
    retryable,
  });
}

function classifyMediaProviderFailure(error: unknown): {
  reason: "timeout" | "aborted" | "rate_limited" | "provider_error";
  retryable: boolean;
} {
  const failure = classifyProviderError(error);
  if (
    failure.reason === "timeout" ||
    failure.reason === "aborted" ||
    failure.reason === "rate_limited"
  ) {
    return { reason: failure.reason, retryable: failure.retryable };
  }
  return { reason: "provider_error", retryable: failure.retryable };
}

function logFailure(
  logger: MediaOperationLogger | undefined,
  request: TranscriptionRequest,
  reason: MediaFailureReason,
  retryable: boolean,
): void {
  logger?.warn("media_operation_failed", {
    operation: "transcription",
    reason,
    retryable,
    caseId: request.caseId,
    stationId: request.stationId,
    requestId: request.requestId,
    stateRevision: request.stateRevision,
  });
}

export async function inspectAudioMetadata(
  audio: Uint8Array,
): Promise<InspectedAudioMetadata | null> {
  try {
    const metadata = await parseBuffer(audio, undefined, {
      duration: true,
      skipCovers: true,
      skipPostHeaders: true,
    });
    const detectedMimeType = canonicalMimeFromContainer(metadata.format.container);
    const durationSeconds = metadata.format.duration;
    const channelCount = metadata.format.numberOfChannels;
    if (
      !detectedMimeType ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds === undefined ||
      durationSeconds < 0 ||
      !Number.isSafeInteger(channelCount) ||
      channelCount === undefined ||
      channelCount < 1
    ) {
      return null;
    }
    return {
      detectedMimeType,
      durationMs: Math.round(durationSeconds * 1_000),
      channelCount,
    };
  } catch {
    return null;
  }
}

export class OpenAITranscriptionProvider implements TranscriptionProvider {
  readonly #client: OpenAITranscriptionClient;

  constructor(
    client: OpenAITranscriptionClient = new OpenAI({
      maxRetries: 0,
    }) as unknown as OpenAITranscriptionClient,
  ) {
    this.#client = client;
  }

  async transcribe(input: TranscriptionProviderInput): Promise<{ text: string }> {
    const file = await toFile(input.audio, input.fileName, { type: input.mimeType });
    const response = await this.#client.audio.transcriptions.create(
      {
        file,
        model: TRANSCRIPTION_MODEL,
        response_format: "json",
        language: "en",
      },
      {
        timeout: PROVIDER_TIMEOUT_MS,
        ...(input.signal ? { signal: input.signal } : {}),
      },
    );
    return { text: response.text };
  }
}

export function createServerTranscriptionProvider(): TranscriptionProvider | null {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  return new OpenAITranscriptionProvider();
}

export async function transcribeBoundedAudio(
  request: TranscriptionRequest,
  audio: Uint8Array,
  { detectedDurationMs, provider, signal, logger }: TranscriptionServiceOptions,
): Promise<TranscriptionResponse> {
  try {
    if (!provider) return mediaFailure(request, "missing_api_key", false);

    let providerResult: { text: string } | null = null;
    let finalFailure: ReturnType<typeof classifyMediaProviderFailure> | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        providerResult = await provider.transcribe({
          audio,
          fileName: `clip.${extensionForMimeType(request.detectedMimeType)}`,
          mimeType: request.detectedMimeType,
          ...(signal ? { signal } : {}),
        });
        break;
      } catch (error) {
        finalFailure = classifyMediaProviderFailure(error);
        if (!finalFailure.retryable || finalFailure.reason === "aborted" || attempt === 1) break;
      }
    }

    if (!providerResult) {
      const failure = finalFailure ?? { reason: "provider_error" as const, retryable: false };
      logFailure(logger, request, failure.reason, failure.retryable);
      return mediaFailure(request, failure.reason, failure.retryable);
    }

    if (
      !Number.isSafeInteger(detectedDurationMs) ||
      detectedDurationMs < 0 ||
      detectedDurationMs > MAX_AUDIO_DURATION_MS
    ) {
      return mediaFailure(request, "duration_exceeded", false);
    }

    const transcript = providerResult.text.trim();
    if (transcript.length > MAX_TRANSCRIPT_CHARACTERS) {
      return mediaFailure(request, "transcript_too_long", false);
    }
    if (transcript.length === 0) {
      logFailure(logger, request, "provider_error", false);
      return mediaFailure(request, "provider_error", false);
    }

    return transcriptionResponseSchema.parse({
      mediaVersion: request.mediaVersion,
      caseId: request.caseId,
      stationId: request.stationId,
      requestId: request.requestId,
      stateRevision: request.stateRevision,
      status: "ok",
      transcript,
      detectedMimeType: request.detectedMimeType,
      detectedDurationMs,
    });
  } finally {
    audio.fill(0);
  }
}
