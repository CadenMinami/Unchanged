import { z } from "zod";

export const MEDIA_CONTRACT_VERSION = "1.0.0" as const;
export const MAX_AUDIO_BYTES = 2_000_000;
export const MAX_AUDIO_DURATION_MS = 20_000;
export const MAX_TRANSCRIPT_CHARACTERS = 600;
export const MAX_SPEECH_CAPTION_CHARACTERS = 1_600;
export const MAX_SPEECH_AUDIO_BYTES = 12_000_000;
export const SPEECH_AUTHORIZATION_TTL_SECONDS = 120;

const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);

export const generatedDialogueStationIdSchema = z.enum(["CHAR-DROUET", "CHAR-LOUIS"]);
export const approvedSpeechVoiceIdSchema = z.enum([
  "drouet-source-v1",
  "louis-source-v1",
]);
export const canonicalAudioMimeTypeSchema = z.enum([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);

export const mediaCorrelationSchema = z
  .object({
    mediaVersion: z.literal(MEDIA_CONTRACT_VERSION),
    caseId: idSchema,
    stationId: generatedDialogueStationIdSchema,
    requestId: z.uuid(),
    stateRevision: z.number().int().nonnegative(),
  })
  .strict();

export const mediaFailureReasonSchema = z.enum([
  "missing_api_key",
  "timeout",
  "aborted",
  "rate_limited",
  "provider_error",
  "invalid_request",
  "version_mismatch",
  "payload_too_large",
  "duration_exceeded",
  "unsupported_mime_type",
  "mime_type_mismatch",
  "transcript_too_long",
  "stale_correlation",
  "invalid_authorization",
  "authorization_expired",
]);

const transcriptionRequestBaseSchema = mediaCorrelationSchema
  .extend({
    declaredMimeType: canonicalAudioMimeTypeSchema,
    detectedMimeType: canonicalAudioMimeTypeSchema,
    audioByteLength: z.number().int().positive().max(MAX_AUDIO_BYTES),
    advisoryDurationMs: z.number().int().nonnegative().max(MAX_AUDIO_DURATION_MS),
    channelCount: z.literal(1),
  })
  .strict();

export const transcriptionRequestSchema = transcriptionRequestBaseSchema.superRefine(
  (value, context) => {
    if (value.declaredMimeType !== value.detectedMimeType) {
      context.addIssue({
        code: "custom",
        message: "Declared and detected audio MIME types must match.",
        path: ["detectedMimeType"],
      });
    }
  },
);

const transcriptionSuccessSchema = mediaCorrelationSchema
  .extend({
    status: z.literal("ok"),
    transcript: z.string().min(1).max(MAX_TRANSCRIPT_CHARACTERS),
    detectedMimeType: canonicalAudioMimeTypeSchema,
    detectedDurationMs: z.number().int().nonnegative().max(MAX_AUDIO_DURATION_MS),
  })
  .strict();

const nonRetryableFailureReasons = new Set<z.infer<typeof mediaFailureReasonSchema>>([
  "missing_api_key",
  "aborted",
  "invalid_request",
  "version_mismatch",
  "payload_too_large",
  "duration_exceeded",
  "unsupported_mime_type",
  "mime_type_mismatch",
  "transcript_too_long",
  "stale_correlation",
  "invalid_authorization",
  "authorization_expired",
]);

const mediaFailureSchema = mediaCorrelationSchema
  .extend({
    status: z.literal("error"),
    reason: mediaFailureReasonSchema,
    retryable: z.boolean(),
  })
  .strict()
  .superRefine((value, context) => {
    if ((value.reason === "timeout" || value.reason === "rate_limited") && !value.retryable) {
      context.addIssue({
        code: "custom",
        message: "This transient media failure must remain retryable.",
        path: ["retryable"],
      });
    }
    if (nonRetryableFailureReasons.has(value.reason) && value.retryable) {
      context.addIssue({
        code: "custom",
        message: "This media failure is not retryable.",
        path: ["retryable"],
      });
    }
  });

export const transcriptionResponseSchema = z.union([
  transcriptionSuccessSchema,
  mediaFailureSchema,
]);

export const speechCaptionSchema = z
  .string()
  .min(1)
  .max(MAX_SPEECH_CAPTION_CHARACTERS);

export const speechAuthorizationSchema = mediaCorrelationSchema
  .extend({
    voiceId: approvedSpeechVoiceIdSchema,
    captionSha256: z.string().regex(/^[a-f0-9]{64}$/),
    expiresAt: z.number().int().positive(),
    signature: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

export const authorizedSpeechRequestSchema = z
  .object({
    caption: speechCaptionSchema,
    authorization: speechAuthorizationSchema,
  })
  .strict();

const authorizedSpeechSuccessSchema = mediaCorrelationSchema
  .extend({
    status: z.literal("ok"),
    voiceId: approvedSpeechVoiceIdSchema,
    captionSha256: z.string().regex(/^[a-f0-9]{64}$/),
    audioMimeType: canonicalAudioMimeTypeSchema,
    audioByteLength: z.number().int().positive().max(MAX_SPEECH_AUDIO_BYTES),
  })
  .strict();

export const authorizedSpeechResponseSchema = z.union([
  authorizedSpeechSuccessSchema,
  mediaFailureSchema,
]);

export type CanonicalAudioMimeType = z.infer<typeof canonicalAudioMimeTypeSchema>;
export type GeneratedDialogueStationId = z.infer<typeof generatedDialogueStationIdSchema>;
export type ApprovedSpeechVoiceId = z.infer<typeof approvedSpeechVoiceIdSchema>;
export type MediaCorrelation = z.infer<typeof mediaCorrelationSchema>;
export type MediaFailureReason = z.infer<typeof mediaFailureReasonSchema>;
export type TranscriptionRequest = z.infer<typeof transcriptionRequestSchema>;
export type TranscriptionResponse = z.infer<typeof transcriptionResponseSchema>;
export type SpeechAuthorization = z.infer<typeof speechAuthorizationSchema>;
export type AuthorizedSpeechRequest = z.infer<typeof authorizedSpeechRequestSchema>;
export type AuthorizedSpeechResponse = z.infer<typeof authorizedSpeechResponseSchema>;
