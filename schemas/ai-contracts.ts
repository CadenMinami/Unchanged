import { z } from "zod";

import { caseStateSchema } from "@/schemas/case-state";
import { speechAuthorizationSchema } from "@/schemas/media-contracts";

export const AI_CONTRACT_VERSION = "1.1.0" as const;
export const MODEL_POLICY_VERSION = "1.0.1" as const;
export const CHARACTER_PROMPT_VERSION = "character-turn-v1" as const;
export const CASE_BRIEF_PROMPT_VERSION = "case-brief-feedback-v1" as const;

const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

const correlationSchema = z
  .object({
    contractVersion: z.literal(AI_CONTRACT_VERSION),
    caseId: idSchema,
    caseSchemaVersion: z.literal("1.0.0"),
    caseVersion: semverSchema,
    policyVersion: z.literal(MODEL_POLICY_VERSION),
    stateVersion: z.literal("1.2.0"),
    requestId: z.uuid(),
    stateRevision: z.number().int().nonnegative(),
  })
  .strict();

export const readingModeSchema = z.enum(["standard", "reduced"]);
export const modelFailureReasonSchema = z.enum([
  "missing_api_key",
  "timeout",
  "aborted",
  "refusal",
  "unsafe_input",
  "unsafe_output",
  "invalid_model_output",
  "unauthorized_output",
  "version_mismatch",
  "rate_limited",
  "provider_error",
]);

export const characterTurnRequestSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CHARACTER_PROMPT_VERSION),
    stationId: z.enum(["CHAR-DROUET", "CHAR-LOUIS"]),
    playerMessage: z.string().trim().min(1).max(600),
    inspectedEvidenceIds: z.array(idSchema).max(8),
    presentedEvidenceIds: z.array(idSchema).max(2),
    readingMode: readingModeSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const inspected = new Set(value.inspectedEvidenceIds);
    const hasDuplicateInspected = inspected.size !== value.inspectedEvidenceIds.length;
    const hasDuplicatePresented =
      new Set(value.presentedEvidenceIds).size !== value.presentedEvidenceIds.length;
    if (hasDuplicateInspected || hasDuplicatePresented) {
      context.addIssue({ code: "custom", message: "Evidence IDs must be unique." });
    }
    if (value.presentedEvidenceIds.some((evidenceId) => !inspected.has(evidenceId))) {
      context.addIssue({
        code: "custom",
        message: "Presented evidence must already be inspected.",
        path: ["presentedEvidenceIds"],
      });
    }
  });

// GPT-5.6 returns only policy IDs. The server renders every visible historical sentence.
export const characterTurnPlanSchema = z
  .object({
    claimUnitIds: z.array(idSchema).max(3),
    evidenceReactionUnitId: idSchema.nullable(),
    followUpQuestionUnitId: idSchema.nullable(),
    refusalUnitId: idSchema.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.claimUnitIds.length === 0 &&
      value.evidenceReactionUnitId === null &&
      value.refusalUnitId === null
    ) {
      context.addIssue({
        code: "custom",
        message: "A character plan must include an audible authored response unit.",
      });
    }
    if (
      value.refusalUnitId &&
      (value.claimUnitIds.length > 0 || value.evidenceReactionUnitId !== null)
    ) {
      context.addIssue({
        code: "custom",
        message: "A refusal plan cannot include historical claims or evidence reactions.",
        path: ["refusalUnitId"],
      });
    }
  });

const characterTurnPayloadSchema = z
  .object({
    spokenResponse: z.string().trim().min(1).max(1600),
    renderedUnitIds: z.array(idSchema).min(1).max(8),
    claimIds: z.array(idSchema).max(3),
    factIdsUsed: z.array(idSchema).max(12),
    sourceIdsUsed: z.array(idSchema).max(8),
    evidenceIdsReferenced: z.array(idSchema).max(2),
    epistemicStatus: z.enum(["observed", "heard", "inferred", "uncertain", "refused"]),
    evidenceReaction: z.enum([
      "not_presented",
      "accepted",
      "challenged",
      "qualified",
      "irrelevant",
    ]),
    followUpQuestion: z.string().trim().min(1).max(300).nullable(),
  })
  .strict();

const responseAuthoritySchema = z.object({
  authority: z.literal("formative_only"),
  mutatesCaseState: z.literal(false),
});

const characterSuccessResultSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CHARACTER_PROMPT_VERSION),
    status: z.literal("ok"),
    source: z.literal("model"),
    ...responseAuthoritySchema.shape,
    turn: characterTurnPayloadSchema,
  })
  .strict();

const characterFallbackResultSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CHARACTER_PROMPT_VERSION),
    status: z.literal("fallback"),
    source: z.literal("deterministic_fallback"),
    ...responseAuthoritySchema.shape,
    reason: modelFailureReasonSchema,
    retryable: z.boolean(),
    turn: characterTurnPayloadSchema,
  })
  .strict();

export const characterTurnResultSchema = z.discriminatedUnion("status", [
  characterSuccessResultSchema,
  characterFallbackResultSchema,
]);

const characterSuccessSchema = characterSuccessResultSchema
  .extend({ speechAuthorization: speechAuthorizationSchema.nullable() })
  .strict();
const characterFallbackSchema = characterFallbackResultSchema
  .extend({ speechAuthorization: speechAuthorizationSchema.nullable() })
  .strict();

export const characterTurnResponseSchema = z.discriminatedUnion("status", [
  characterSuccessSchema,
  characterFallbackSchema,
]).superRefine((value, context) => {
  const authorization = value.speechAuthorization;
  if (
    authorization &&
    (authorization.caseId !== value.caseId ||
      authorization.requestId !== value.requestId ||
      authorization.stateRevision !== value.stateRevision)
  ) {
    context.addIssue({
      code: "custom",
      message: "Speech authorization correlation must match the character response.",
      path: ["speechAuthorization"],
    });
  }
});

export const caseBriefFeedbackRequestSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CASE_BRIEF_PROMPT_VERSION),
    caseState: caseStateSchema,
    readingMode: readingModeSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.stateRevision !== value.caseState.revision ||
      value.stateVersion !== value.caseState.stateVersion ||
      value.caseId !== value.caseState.caseId ||
      value.caseSchemaVersion !== value.caseState.caseSchemaVersion ||
      value.caseVersion !== value.caseState.caseVersion
    ) {
      context.addIssue({
        code: "custom",
        message: "Feedback request metadata must match the supplied CaseState snapshot.",
      });
    }
  });

const rubricScoresSchema = z
  .object({
    sourcing: z.number().int().min(0).max(4),
    corroboration: z.number().int().min(0).max(4),
    causalReasoning: z.number().int().min(0).max(4),
    claimEvidenceFit: z.number().int().min(0).max(4),
    uncertainty: z.number().int().min(0).max(4),
  })
  .strict();

const rubricReasonIdsSchema = z
  .object({
    sourcing: idSchema,
    corroboration: idSchema,
    causalReasoning: idSchema,
    claimEvidenceFit: idSchema,
    uncertainty: idSchema,
  })
  .strict();

const feedbackEvidenceLinkSchema = z
  .object({
    evidenceId: idSchema,
    studentSpan: z.string().trim().min(1).max(400),
    fit: z.enum(["supports", "qualifies", "contradicts", "unclear"]),
  })
  .strict();

const concernSpanSchema = z
  .object({
    kind: z.enum([
      "unsupported",
      "overconfident",
      "single_cause",
      "inevitability",
      "source_fit",
    ]),
    studentSpan: z.string().trim().min(1).max(400),
    issueTemplateId: idSchema,
    evidenceIds: z.array(idSchema).max(5),
  })
  .strict();

// The model classifies student language and chooses authored feedback templates.
export const caseBriefFeedbackPlanSchema = z
  .object({
    formativeStatus: z.enum([
      "contradicted_by_record",
      "plausible_under_evidenced",
      "supported_incomplete",
      "well_supported",
    ]),
    summaryTemplateId: idSchema,
    evidenceClaimLinks: z.array(feedbackEvidenceLinkSchema).max(8),
    concernSpans: z.array(concernSpanSchema).max(6),
    rubricScores: rubricScoresSchema,
    rubricReasonIds: rubricReasonIdsSchema,
    revisionPromptId: idSchema,
  })
  .strict();

const rubricReasonsSchema = z
  .object({
    sourcing: z.string().trim().min(1).max(350),
    corroboration: z.string().trim().min(1).max(350),
    causalReasoning: z.string().trim().min(1).max(350),
    claimEvidenceFit: z.string().trim().min(1).max(350),
    uncertainty: z.string().trim().min(1).max(350),
  })
  .strict();

const renderedConcernSchema = z
  .object({
    kind: concernSpanSchema.shape.kind,
    studentSpan: concernSpanSchema.shape.studentSpan,
    explanation: z.string().trim().min(1).max(500),
    evidenceIds: z.array(idSchema).max(5),
  })
  .strict();

const feedbackPayloadSchema = z
  .object({
    formativeStatus: caseBriefFeedbackPlanSchema.shape.formativeStatus,
    summary: z.string().trim().min(1).max(700),
    evidenceClaimLinks: z.array(feedbackEvidenceLinkSchema).max(8),
    concerns: z.array(renderedConcernSchema).max(6),
    rubricScores: rubricScoresSchema,
    rubricReasons: rubricReasonsSchema,
    revisionPrompt: z.string().trim().min(1).max(500),
    renderedTemplateIds: z.array(idSchema).min(1).max(20),
  })
  .strict();

const feedbackSuccessSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CASE_BRIEF_PROMPT_VERSION),
    status: z.literal("ok"),
    source: z.literal("model"),
    ...responseAuthoritySchema.shape,
    feedback: feedbackPayloadSchema,
  })
  .strict();

const feedbackFallbackSchema = correlationSchema
  .extend({
    promptVersion: z.literal(CASE_BRIEF_PROMPT_VERSION),
    status: z.literal("fallback"),
    source: z.literal("deterministic_fallback"),
    ...responseAuthoritySchema.shape,
    reason: modelFailureReasonSchema,
    retryable: z.boolean(),
    displayMessage: z.string().trim().min(1).max(700),
  })
  .strict();

export const caseBriefFeedbackResponseSchema = z.discriminatedUnion("status", [
  feedbackSuccessSchema,
  feedbackFallbackSchema,
]);

export type CharacterTurnRequest = z.infer<typeof characterTurnRequestSchema>;
export type CharacterTurnPlan = z.infer<typeof characterTurnPlanSchema>;
export type CharacterTurnResult = z.infer<typeof characterTurnResultSchema>;
export type CharacterTurnResponse = z.infer<typeof characterTurnResponseSchema>;
export type CaseBriefFeedbackRequest = z.infer<typeof caseBriefFeedbackRequestSchema>;
export type CaseBriefFeedbackPlan = z.infer<typeof caseBriefFeedbackPlanSchema>;
export type CaseBriefFeedbackResponse = z.infer<typeof caseBriefFeedbackResponseSchema>;
export type ModelFailureReason = z.infer<typeof modelFailureReasonSchema>;
