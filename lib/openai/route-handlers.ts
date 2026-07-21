import { z } from "zod";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import {
  BoundedMultipartError,
  parseBoundedMultipartFormData,
} from "@/lib/audio/bounded-multipart";
import {
  createServerSpeechProvider,
  generateAuthorizedSpeech,
  type SpeechProvider,
} from "@/lib/audio/speech-service";
import { mintSpeechAuthorization } from "@/lib/audio/speech-ticket";
import { verifySpeechAuthorization } from "@/lib/audio/speech-ticket";
import {
  createServerTranscriptionProvider,
  inspectAudioMetadata,
  transcribeBoundedAudio,
  type InspectedAudioMetadata,
  type MediaOperationLogger,
  type TranscriptionProvider,
} from "@/lib/audio/transcription-service";
import { BoundedJsonError, readBoundedJson } from "@/lib/http/bounded-json";
import { createCaseBriefFeedback } from "@/lib/openai/case-brief-feedback-service";
import { createCharacterTurn } from "@/lib/openai/character-turn-service";
import { createServerInputSafetyGateway } from "@/lib/openai/create-server-input-safety";
import { createServerModelGateway } from "@/lib/openai/create-server-gateway";
import type { InputSafetyGateway } from "@/lib/openai/input-safety-gateway";
import { loadVarennesModelPolicy } from "@/lib/openai/load-model-policy";
import type { ModelGateway } from "@/lib/openai/model-gateway";
import {
  aiRequestRateLimiter,
  type RequestRateLimiter,
} from "@/lib/openai/request-rate-limit";
import {
  AI_CONTRACT_VERSION,
  caseBriefFeedbackRequestSchema,
  characterTurnRequestSchema,
  characterTurnResponseSchema,
} from "@/schemas/ai-contracts";
import {
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  MEDIA_CONTRACT_VERSION,
  authorizedSpeechRequestSchema,
  authorizedSpeechResponseSchema,
  canonicalAudioMimeTypeSchema,
  mediaCorrelationSchema,
  speechAuthorizationSchema,
  transcriptionRequestSchema,
  transcriptionResponseSchema,
  type MediaCorrelation,
  type MediaFailureReason,
} from "@/schemas/media-contracts";

interface HandlerDependencies {
  gateway?: ModelGateway | null;
  inputSafety?: InputSafetyGateway | null;
  rateLimiter?: RequestRateLimiter | null;
  speechAuthorizationSecret?: string | null;
  nowEpochSeconds?: () => number;
}

export const MAX_CHARACTER_TURN_BODY_BYTES = 8_192;
export const MAX_CASE_BRIEF_FEEDBACK_BODY_BYTES = 32_768;

export interface MediaHandlerDependencies {
  transcriptionProvider?: TranscriptionProvider | null;
  speechProvider?: SpeechProvider | null;
  rateLimiter?: RequestRateLimiter | null;
  speechAuthorizationSecret?: string | null;
  nowEpochSeconds?: () => number;
  logger?: MediaOperationLogger;
  inspectAudio?: (audio: Uint8Array) => Promise<InspectedAudioMetadata | null>;
}

const transcriptionUploadMetadataSchema = mediaCorrelationSchema
  .extend({
    declaredMimeType: canonicalAudioMimeTypeSchema,
    advisoryDurationMs: z.number().int().nonnegative(),
  })
  .strict();

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function hasVersionMismatch(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const record = body as Record<string, unknown>;
  const casePackage = loadVarennesCase();
  const policy = loadVarennesModelPolicy();
  const expected = {
    contractVersion: AI_CONTRACT_VERSION,
    caseId: casePackage.caseId,
    caseSchemaVersion: casePackage.schemaVersion,
    caseVersion: casePackage.caseVersion,
    policyVersion: policy.policyVersion,
    stateVersion: "1.2.0",
  } as const;
  return Object.entries(expected).some(
    ([key, value]) => record[key] !== undefined && record[key] !== value,
  );
}

function invalidRequest() {
  return json(
    { error: { code: "invalid_request", message: "The AI request did not match the contract." } },
    400,
  );
}

function versionMismatch() {
  return json(
    {
      error: {
        code: "version_mismatch",
        message: "The case changed before this request could be processed.",
      },
    },
    409,
  );
}

function payloadTooLarge() {
  return json(
    {
      error: {
        code: "payload_too_large",
        message: "The AI request body was too large.",
      },
    },
    413,
  );
}

function rateLimited() {
  return Response.json(
    {
      error: {
        code: "rate_limited",
        message: "Too many AI requests. Wait a moment and try again.",
      },
    },
    {
      status: 429,
      headers: { "cache-control": "no-store", "retry-after": "60" },
    },
  );
}

function clientKey(request: Request, endpoint: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${endpoint}:${forwarded || "unknown-client"}`;
}

function mediaStatus(reason: MediaFailureReason): number {
  switch (reason) {
    case "payload_too_large":
      return 413;
    case "unsupported_mime_type":
    case "mime_type_mismatch":
      return 415;
    case "duration_exceeded":
    case "transcript_too_long":
      return 422;
    case "version_mismatch":
    case "stale_correlation":
      return 409;
    case "invalid_authorization":
    case "authorization_expired":
      return 401;
    case "rate_limited":
      return 429;
    case "missing_api_key":
      return 503;
    case "timeout":
      return 504;
    case "aborted":
      return 499;
    case "provider_error":
      return 502;
    case "invalid_request":
      return 400;
  }
}

function mediaJson(body: unknown, status = 200, retryAfter = false): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...(retryAfter ? { "retry-after": "60" } : {}),
    },
  });
}

function correlatedMediaFailure(
  correlation: MediaCorrelation | null,
  reason: MediaFailureReason,
  retryable: boolean,
): Response {
  const body = {
    ...(correlation ?? {}),
    status: "error" as const,
    reason,
    retryable,
  };
  if (correlation) {
    transcriptionResponseSchema.parse(body);
    authorizedSpeechResponseSchema.parse(body);
  }
  return mediaJson(body, mediaStatus(reason), reason === "rate_limited");
}

function correlationFromAuthorization(value: unknown): MediaCorrelation | null {
  const parsed = speechAuthorizationSchema.safeParse(value);
  if (!parsed.success) return null;
  const { mediaVersion, caseId, stationId, requestId, stateRevision } = parsed.data;
  return { mediaVersion, caseId, stationId, requestId, stateRevision };
}

function isFilePart(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number"
  );
}

function isCanonicalCase(correlation: MediaCorrelation): boolean {
  return correlation.caseId === loadVarennesCase().caseId;
}

function responseBodyFromOwnedBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  if (bytes.buffer instanceof ArrayBuffer) {
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  return Uint8Array.from(bytes);
}

export async function handleCharacterTurnRequest(
  request: Request,
  dependencies: HandlerDependencies = {},
): Promise<Response> {
  const rateLimiter =
    dependencies.rateLimiter === undefined ? aiRequestRateLimiter : dependencies.rateLimiter;
  if (rateLimiter && !rateLimiter.allow(clientKey(request, "character-turn"))) {
    return rateLimited();
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_CHARACTER_TURN_BODY_BYTES);
  } catch (error) {
    if (error instanceof BoundedJsonError && error.reason === "payload_too_large") {
      return payloadTooLarge();
    }
    return invalidRequest();
  }
  if (hasVersionMismatch(body)) return versionMismatch();
  const parsed = characterTurnRequestSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();

  const gateway =
    dependencies.gateway === undefined ? createServerModelGateway() : dependencies.gateway;
  const inputSafety =
    dependencies.inputSafety === undefined
      ? createServerInputSafetyGateway()
      : dependencies.inputSafety;
  const speechAuthorizationSecret =
    dependencies.speechAuthorizationSecret === undefined
      ? process.env.SPEECH_AUTHORIZATION_SECRET
      : dependencies.speechAuthorizationSecret;
  const nowEpochSeconds =
    dependencies.nowEpochSeconds ?? (() => Math.floor(Date.now() / 1_000));

  try {
    const result = await createCharacterTurn(parsed.data, {
      gateway,
      inputSafety,
      signal: request.signal,
    });
    const speechAuthorization = mintSpeechAuthorization(
      {
        caption: result.turn.spokenResponse,
        correlation: {
          mediaVersion: MEDIA_CONTRACT_VERSION,
          caseId: parsed.data.caseId,
          stationId: parsed.data.stationId,
          requestId: parsed.data.requestId,
          stateRevision: parsed.data.stateRevision,
        },
      },
      speechAuthorizationSecret,
      nowEpochSeconds(),
    );
    return json(characterTurnResponseSchema.parse({ ...result, speechAuthorization }));
  } catch {
    return invalidRequest();
  }
}

export async function handleCaseBriefFeedbackRequest(
  request: Request,
  dependencies: HandlerDependencies = {},
): Promise<Response> {
  const rateLimiter =
    dependencies.rateLimiter === undefined ? aiRequestRateLimiter : dependencies.rateLimiter;
  if (rateLimiter && !rateLimiter.allow(clientKey(request, "case-brief-feedback"))) {
    return rateLimited();
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_CASE_BRIEF_FEEDBACK_BODY_BYTES);
  } catch (error) {
    if (error instanceof BoundedJsonError && error.reason === "payload_too_large") {
      return payloadTooLarge();
    }
    return invalidRequest();
  }
  if (hasVersionMismatch(body)) return versionMismatch();
  const parsed = caseBriefFeedbackRequestSchema.safeParse(body);
  if (!parsed.success) return invalidRequest();

  const gateway =
    dependencies.gateway === undefined ? createServerModelGateway() : dependencies.gateway;
  const inputSafety =
    dependencies.inputSafety === undefined
      ? createServerInputSafetyGateway()
      : dependencies.inputSafety;

  try {
    return json(
      await createCaseBriefFeedback(parsed.data, {
        gateway,
        inputSafety,
        signal: request.signal,
      }),
    );
  } catch {
    return invalidRequest();
  }
}

export async function handleTranscriptionRequest(
  request: Request,
  dependencies: MediaHandlerDependencies = {},
): Promise<Response> {
  const rateLimiter =
    dependencies.rateLimiter === undefined ? aiRequestRateLimiter : dependencies.rateLimiter;
  if (rateLimiter && !rateLimiter.allow(clientKey(request, "transcription"))) {
    return correlatedMediaFailure(null, "rate_limited", true);
  }
  const provider =
    dependencies.transcriptionProvider === undefined
      ? createServerTranscriptionProvider()
      : dependencies.transcriptionProvider;
  const inspectAudio = dependencies.inspectAudio ?? inspectAudioMetadata;

  let formData: FormData;
  try {
    formData = await parseBoundedMultipartFormData(request);
  } catch (error) {
    if (error instanceof BoundedMultipartError) {
      const reason: MediaFailureReason =
        error.reason === "payload_too_large"
          ? "payload_too_large"
          : error.reason === "aborted"
            ? "aborted"
            : "invalid_request";
      return correlatedMediaFailure(null, reason, false);
    }
    return correlatedMediaFailure(null, "invalid_request", false);
  }

  const metadataParts = formData.getAll("metadata");
  const audioParts = formData.getAll("audio");
  if (
    [...formData.entries()].length !== 2 ||
    metadataParts.length !== 1 ||
    audioParts.length !== 1 ||
    typeof metadataParts[0] !== "string" ||
    !isFilePart(audioParts[0])
  ) {
    return correlatedMediaFailure(null, "invalid_request", false);
  }

  let rawMetadata: unknown;
  try {
    rawMetadata = JSON.parse(metadataParts[0]);
  } catch {
    return correlatedMediaFailure(null, "invalid_request", false);
  }
  const parsedMetadata = transcriptionUploadMetadataSchema.safeParse(rawMetadata);
  if (!parsedMetadata.success) {
    const record =
      typeof rawMetadata === "object" && rawMetadata !== null
        ? (rawMetadata as Record<string, unknown>)
        : null;
    if (record?.mediaVersion !== undefined && record.mediaVersion !== MEDIA_CONTRACT_VERSION) {
      return correlatedMediaFailure(null, "version_mismatch", false);
    }
    if (
      typeof record?.advisoryDurationMs === "number" &&
      record.advisoryDurationMs > MAX_AUDIO_DURATION_MS
    ) {
      return correlatedMediaFailure(null, "duration_exceeded", false);
    }
    return correlatedMediaFailure(null, "invalid_request", false);
  }

  const {
    declaredMimeType,
    advisoryDurationMs,
    ...correlation
  } = parsedMetadata.data;
  if (!isCanonicalCase(correlation)) {
    return correlatedMediaFailure(correlation, "stale_correlation", false);
  }
  if (advisoryDurationMs > MAX_AUDIO_DURATION_MS) {
    return correlatedMediaFailure(correlation, "duration_exceeded", false);
  }

  const audioFile = audioParts[0];
  if (audioFile.size <= 0) {
    return correlatedMediaFailure(correlation, "invalid_request", false);
  }
  if (audioFile.size > MAX_AUDIO_BYTES) {
    return correlatedMediaFailure(correlation, "payload_too_large", false);
  }
  const audio = new Uint8Array(await audioFile.arrayBuffer());
  try {
    const inspected = await inspectAudio(audio);
    if (!inspected) {
      return correlatedMediaFailure(correlation, "unsupported_mime_type", false);
    }
    if (inspected.detectedMimeType !== declaredMimeType) {
      return correlatedMediaFailure(correlation, "mime_type_mismatch", false);
    }
    if (inspected.detectedMimeType === "audio/ogg") {
      return correlatedMediaFailure(correlation, "unsupported_mime_type", false);
    }
    if (inspected.channelCount !== 1) {
      return correlatedMediaFailure(correlation, "invalid_request", false);
    }
    if (inspected.durationMs > MAX_AUDIO_DURATION_MS) {
      return correlatedMediaFailure(correlation, "duration_exceeded", false);
    }

    const serviceRequest = transcriptionRequestSchema.safeParse({
      ...correlation,
      declaredMimeType,
      detectedMimeType: inspected.detectedMimeType,
      audioByteLength: audio.byteLength,
      advisoryDurationMs,
      channelCount: inspected.channelCount,
    });
    if (!serviceRequest.success) {
      return correlatedMediaFailure(correlation, "invalid_request", false);
    }
    const response = await transcribeBoundedAudio(serviceRequest.data, audio, {
      detectedDurationMs: inspected.durationMs,
      provider,
      signal: request.signal,
      logger: dependencies.logger,
    });
    return mediaJson(
      response,
      response.status === "ok" ? 200 : mediaStatus(response.reason),
      response.status === "error" && response.reason === "rate_limited",
    );
  } finally {
    audio.fill(0);
  }
}

export async function handleSpeechRequest(
  request: Request,
  dependencies: MediaHandlerDependencies = {},
): Promise<Response> {
  const rateLimiter =
    dependencies.rateLimiter === undefined ? aiRequestRateLimiter : dependencies.rateLimiter;
  if (rateLimiter && !rateLimiter.allow(clientKey(request, "speech"))) {
    return correlatedMediaFailure(null, "rate_limited", true);
  }
  const provider =
    dependencies.speechProvider === undefined
      ? createServerSpeechProvider()
      : dependencies.speechProvider;
  const secret =
    dependencies.speechAuthorizationSecret === undefined
      ? process.env.SPEECH_AUTHORIZATION_SECRET
      : dependencies.speechAuthorizationSecret;
  const nowEpochSeconds =
    dependencies.nowEpochSeconds ?? (() => Math.floor(Date.now() / 1_000));
  const body = await readBody(request);
  const candidateAuthorization =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>).authorization
      : null;
  const correlation = correlationFromAuthorization(candidateAuthorization);
  const parsed = authorizedSpeechRequestSchema.safeParse(body);
  if (!parsed.success) {
    return correlatedMediaFailure(correlation, "invalid_request", false);
  }
  if (!isCanonicalCase(parsed.data.authorization)) {
    return correlatedMediaFailure(correlation, "stale_correlation", false);
  }

  const verification = verifySpeechAuthorization(parsed.data, secret, nowEpochSeconds());
  if (!verification.ok) {
    return correlatedMediaFailure(correlation, verification.reason, false);
  }
  const result = await generateAuthorizedSpeech(parsed.data, {
    provider,
    signal: request.signal,
    logger: dependencies.logger,
  });
  if (!result.ok) {
    return mediaJson(
      result.response,
      mediaStatus(result.response.reason),
      result.response.reason === "rate_limited",
    );
  }

  const temporaryBytes = result.audio.bytes;
  if (!temporaryBytes) {
    result.audio.release();
    return correlatedMediaFailure(correlation, "provider_error", false);
  }
  const responseBody = responseBodyFromOwnedBytes(temporaryBytes);
  const metadata = result.metadata;
  try {
    return new Response(responseBody, {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "audio/wav",
        "x-media-version": metadata.mediaVersion,
        "x-case-id": metadata.caseId,
        "x-station-id": metadata.stationId,
        "x-request-id": metadata.requestId,
        "x-state-revision": String(metadata.stateRevision),
        "x-voice-id": metadata.voiceId,
        "x-caption-sha256": metadata.captionSha256,
        "x-audio-byte-length": String(temporaryBytes.byteLength),
      },
    });
  } finally {
    responseBody.fill(0);
    result.audio.release();
  }
}
