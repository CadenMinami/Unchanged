import OpenAI from "openai";

import type { MediaOperationLogger } from "@/lib/audio/transcription-service";
import { classifyProviderError } from "@/lib/openai/provider-error";
import {
  authorizedSpeechResponseSchema,
  MAX_SPEECH_AUDIO_BYTES,
  type ApprovedSpeechVoiceId,
  type AuthorizedSpeechRequest,
  type AuthorizedSpeechResponse,
  type MediaFailureReason,
} from "@/schemas/media-contracts";

const DEFAULT_SPEECH_MODEL = "gpt-4o-mini-tts";
const PROVIDER_TIMEOUT_MS = 10_000;
const providerVoiceByLogicalVoice = {
  "drouet-source-v1": "cedar",
  "louis-source-v1": "marin",
} as const satisfies Record<ApprovedSpeechVoiceId, "cedar" | "marin">;

export interface SpeechProviderInput {
  input: string;
  providerVoice: "cedar" | "marin";
  signal?: AbortSignal;
}

export interface SpeechProvider {
  synthesize(input: SpeechProviderInput): Promise<Uint8Array>;
}

export interface RetainedSpeechAudio {
  readonly bytes: Uint8Array | null;
  readonly byteLength: number;
  release(): void;
}

export type SpeechServiceResult =
  | Readonly<{
      ok: true;
      metadata: Extract<AuthorizedSpeechResponse, { status: "ok" }>;
      audio: RetainedSpeechAudio;
    }>
  | Readonly<{
      ok: false;
      response: Extract<AuthorizedSpeechResponse, { status: "error" }>;
    }>;

interface SpeechServiceOptions {
  provider: SpeechProvider | null;
  signal?: AbortSignal;
  logger?: MediaOperationLogger;
}

interface OpenAISpeechClient {
  audio: {
    speech: {
      create(
        body: {
          input: string;
          model: string;
          voice: "cedar" | "marin";
          instructions: string;
          response_format: "wav";
        },
        options: { timeout: number; signal?: AbortSignal },
      ): Promise<Response>;
    };
  };
}

class ReleasableSpeechAudio implements RetainedSpeechAudio {
  #bytes: Uint8Array | null;

  constructor(bytes: Uint8Array) {
    this.#bytes = bytes;
  }

  get bytes(): Uint8Array | null {
    return this.#bytes;
  }

  get byteLength(): number {
    return this.#bytes?.byteLength ?? 0;
  }

  release(): void {
    this.#bytes?.fill(0);
    this.#bytes = null;
  }
}

function speechFailure(
  request: AuthorizedSpeechRequest,
  reason: MediaFailureReason,
  retryable: boolean,
): Extract<AuthorizedSpeechResponse, { status: "error" }> {
  return authorizedSpeechResponseSchema.parse({
    mediaVersion: request.authorization.mediaVersion,
    caseId: request.authorization.caseId,
    stationId: request.authorization.stationId,
    requestId: request.authorization.requestId,
    stateRevision: request.authorization.stateRevision,
    status: "error",
    reason,
    retryable,
  }) as Extract<AuthorizedSpeechResponse, { status: "error" }>;
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
  request: AuthorizedSpeechRequest,
  reason: MediaFailureReason,
  retryable: boolean,
): void {
  logger?.warn("media_operation_failed", {
    operation: "speech",
    reason,
    retryable,
    caseId: request.authorization.caseId,
    stationId: request.authorization.stationId,
    requestId: request.authorization.requestId,
    stateRevision: request.authorization.stateRevision,
  });
}

export class OpenAISpeechProvider implements SpeechProvider {
  readonly #client: OpenAISpeechClient;
  readonly #model: string;

  constructor(options: { client?: OpenAISpeechClient; model?: string } = {}) {
    this.#client =
      options.client ??
      (new OpenAI({ maxRetries: 0 }) as unknown as OpenAISpeechClient);
    this.#model = options.model?.trim() || DEFAULT_SPEECH_MODEL;
  }

  async synthesize(input: SpeechProviderInput): Promise<Uint8Array> {
    const response = await this.#client.audio.speech.create(
      {
        input: input.input,
        model: this.#model,
        voice: input.providerVoice,
        response_format: "wav",
        instructions:
          "Use clear modern English with restrained delivery. This is a synthetic educational dramatization. Do not imitate a historical person or perform a caricatured accent.",
      },
      {
        timeout: PROVIDER_TIMEOUT_MS,
        ...(input.signal ? { signal: input.signal } : {}),
      },
    );
    return new Uint8Array(await response.arrayBuffer());
  }
}

export function createServerSpeechProvider(): SpeechProvider | null {
  if (!process.env.OPENAI_API_KEY?.trim()) return null;
  return new OpenAISpeechProvider({ model: process.env.OPENAI_SPEECH_MODEL });
}

export async function generateAuthorizedSpeech(
  request: AuthorizedSpeechRequest,
  { provider, signal, logger }: SpeechServiceOptions,
): Promise<SpeechServiceResult> {
  if (!provider) {
    return { ok: false, response: speechFailure(request, "missing_api_key", false) };
  }

  let providerBytes: Uint8Array | null = null;
  let finalFailure: ReturnType<typeof classifyMediaProviderFailure> | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      providerBytes = await provider.synthesize({
        input: request.caption,
        providerVoice: providerVoiceByLogicalVoice[request.authorization.voiceId],
        ...(signal ? { signal } : {}),
      });
      break;
    } catch (error) {
      finalFailure = classifyMediaProviderFailure(error);
      if (!finalFailure.retryable || finalFailure.reason === "aborted" || attempt === 1) break;
    }
  }

  if (!providerBytes) {
    const failure = finalFailure ?? { reason: "provider_error" as const, retryable: false };
    logFailure(logger, request, failure.reason, failure.retryable);
    return { ok: false, response: speechFailure(request, failure.reason, failure.retryable) };
  }

  try {
    if (
      providerBytes.byteLength === 0 ||
      providerBytes.byteLength > MAX_SPEECH_AUDIO_BYTES
    ) {
      logFailure(logger, request, "provider_error", false);
      return { ok: false, response: speechFailure(request, "provider_error", false) };
    }
    const retainedBytes = providerBytes.slice();
    const metadata = authorizedSpeechResponseSchema.parse({
      mediaVersion: request.authorization.mediaVersion,
      caseId: request.authorization.caseId,
      stationId: request.authorization.stationId,
      requestId: request.authorization.requestId,
      stateRevision: request.authorization.stateRevision,
      status: "ok",
      voiceId: request.authorization.voiceId,
      captionSha256: request.authorization.captionSha256,
      audioMimeType: "audio/wav",
      audioByteLength: retainedBytes.byteLength,
    }) as Extract<AuthorizedSpeechResponse, { status: "ok" }>;
    return { ok: true, metadata, audio: new ReleasableSpeechAudio(retainedBytes) };
  } finally {
    providerBytes.fill(0);
  }
}
