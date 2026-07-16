import { describe, expect, it } from "vitest";

import { createInitialCaseState } from "@/lib/case-engine/state";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import {
  AI_CONTRACT_VERSION,
  CASE_BRIEF_PROMPT_VERSION,
  CHARACTER_PROMPT_VERSION,
  MODEL_POLICY_VERSION,
  caseBriefFeedbackPlanSchema,
  caseBriefFeedbackRequestSchema,
  caseBriefFeedbackResponseSchema,
  characterTurnPlanSchema,
  characterTurnRequestSchema,
  characterTurnResponseSchema,
} from "@/schemas/ai-contracts";

const correlation = {
  contractVersion: AI_CONTRACT_VERSION,
  caseId: "varennes",
  caseSchemaVersion: "1.0.0",
  caseVersion: "1.0.3",
  policyVersion: MODEL_POLICY_VERSION,
  stateVersion: "1.2.0",
  requestId: "00000000-0000-4000-8000-000000000001",
  stateRevision: 12,
};

const requestEnvelope = {
  ...correlation,
  promptVersion: CHARACTER_PROMPT_VERSION,
  stationId: "CHAR-DROUET",
  playerMessage: "How did you decide which road to take?",
  inspectedEvidenceIds: ["E3"],
  presentedEvidenceIds: ["E3"],
  readingMode: "standard",
};

describe("AI contracts", () => {
  it("accepts only the active 1.1.0 AI contract", () => {
    expect(AI_CONTRACT_VERSION).toBe("1.1.0");
    expect(characterTurnRequestSchema.safeParse(requestEnvelope).success).toBe(true);
    expect(
      characterTurnRequestSchema.safeParse({
        ...requestEnvelope,
        contractVersion: "1.0.0",
      }).success,
    ).toBe(false);
  });

  it("accepts a strict versioned character-turn request", () => {
    expect(characterTurnRequestSchema.parse(requestEnvelope)).toEqual(requestEnvelope);
  });

  it("rejects unknown fields, oversized messages, and uninspected evidence", () => {
    expect(
      characterTurnRequestSchema.safeParse({ ...requestEnvelope, authority: "unlock_repair" })
        .success,
    ).toBe(false);
    expect(
      characterTurnRequestSchema.safeParse({
        ...requestEnvelope,
        playerMessage: "x".repeat(601),
      }).success,
    ).toBe(false);
    expect(
      characterTurnRequestSchema.safeParse({
        ...requestEnvelope,
        inspectedEvidenceIds: [],
      }).success,
    ).toBe(false);
  });

  it("limits raw character model output to response-plan IDs", () => {
    const plan = {
      claimUnitIds: ["CLAIM-DROUET-ROUTE"],
      evidenceReactionUnitId: "REACTION-DROUET-E3-QUALIFY",
      followUpQuestionUnitId: "FOLLOWUP-DROUET-CORROBORATE",
      refusalUnitId: null,
    };

    expect(characterTurnPlanSchema.parse(plan)).toEqual(plan);
    expect(characterTurnPlanSchema.safeParse({ ...plan, spokenResponse: "Unreviewed prose" }).success)
      .toBe(false);
    expect(
      characterTurnPlanSchema.safeParse({
        claimUnitIds: [],
        evidenceReactionUnitId: null,
        followUpQuestionUnitId: null,
        refusalUnitId: null,
      }).success,
    ).toBe(false);
    expect(
      characterTurnPlanSchema.safeParse({
        claimUnitIds: [],
        evidenceReactionUnitId: "REACTION-DROUET-E3-QUALIFY",
        followUpQuestionUnitId: null,
        refusalUnitId: "REFUSAL-DROUET-UNKNOWN-MOTIVE",
      }).success,
    ).toBe(false);
  });

  it("uses a discriminated character response with server-owned authority metadata", () => {
    const response = {
      ...correlation,
      promptVersion: CHARACTER_PROMPT_VERSION,
      status: "ok",
      source: "model",
      authority: "formative_only",
      mutatesCaseState: false,
      speechAuthorization: null,
      turn: {
        spokenResponse: "In my report, I said the route information redirected my pursuit.",
        renderedUnitIds: ["CLAIM-DROUET-ROUTE"],
        claimIds: ["CLAIM-DROUET-ROUTE"],
        factIdsUsed: ["F-S2-002"],
        sourceIdsUsed: ["S2"],
        evidenceIdsReferenced: ["E3"],
        epistemicStatus: "observed",
        evidenceReaction: "qualified",
        followUpQuestion: "Which independent record tests that account?",
      },
    };

    expect(characterTurnResponseSchema.parse(response)).toEqual(response);
    expect(
      characterTurnResponseSchema.safeParse({ ...response, mutatesCaseState: true }).success,
    ).toBe(false);
    const missingAuthorization = Object.fromEntries(
      Object.entries(response).filter(([key]) => key !== "speechAuthorization"),
    );
    expect(characterTurnResponseSchema.safeParse(missingAuthorization).success).toBe(false);

    const authorizedResponse = {
      ...response,
      speechAuthorization: {
        mediaVersion: "1.0.0",
        caseId: response.caseId,
        stationId: "CHAR-DROUET",
        requestId: response.requestId,
        stateRevision: response.stateRevision,
        voiceId: "drouet-source-v1",
        captionSha256: "a".repeat(64),
        expiresAt: 1_800_000_120,
        signature: "A".repeat(43),
      },
    };
    expect(characterTurnResponseSchema.safeParse(authorizedResponse).success).toBe(true);
    expect(
      characterTurnResponseSchema.safeParse({
        ...authorizedResponse,
        speechAuthorization: {
          ...authorizedResponse.speechAuthorization,
          requestId: "00000000-0000-4000-8000-000000000002",
        },
      }).success,
    ).toBe(false);

    const fallback = {
      ...response,
      status: "fallback",
      source: "deterministic_fallback",
      reason: "missing_api_key",
      retryable: false,
    };
    expect(characterTurnResponseSchema.safeParse(fallback).success).toBe(true);
    const missingFallbackAuthorization = Object.fromEntries(
      Object.entries(fallback).filter(([key]) => key !== "speechAuthorization"),
    );
    expect(characterTurnResponseSchema.safeParse(missingFallbackAuthorization).success).toBe(
      false,
    );
  });

  it("requires a parsed CaseState snapshot for feedback instead of a client authority boolean", () => {
    const caseState = createInitialCaseState(loadVarennesCase());
    const request = {
      ...correlation,
      stateRevision: caseState.revision,
      promptVersion: CASE_BRIEF_PROMPT_VERSION,
      caseState,
    };

    expect(caseBriefFeedbackRequestSchema.parse(request)).toEqual(request);
    expect(
      caseBriefFeedbackRequestSchema.safeParse({
        ...request,
        deterministicRepairReady: true,
      }).success,
    ).toBe(false);
    expect(
      caseBriefFeedbackRequestSchema.safeParse({
        ...request,
        caseState: {
          ...caseState,
          caseBrief: { ...caseState.caseBrief, argument: "x".repeat(2_401) },
        },
      }).success,
    ).toBe(false);
  });

  it("limits raw feedback output to template IDs and exact student spans", () => {
    const plan = {
      formativeStatus: "supported_incomplete",
      summaryTemplateId: "SUMMARY-SUPPORTED-INCOMPLETE",
      evidenceClaimLinks: [
        {
          evidenceId: "E3",
          studentSpan: "route information changed the pursuit",
          fit: "supports",
        },
      ],
      concernSpans: [],
      rubricScores: {
        sourcing: 3,
        corroboration: 3,
        causalReasoning: 3,
        claimEvidenceFit: 3,
        uncertainty: 2,
      },
      rubricReasonIds: {
        sourcing: "RUBRIC-SOURCING-STRONG",
        corroboration: "RUBRIC-CORROBORATION-STRONG",
        causalReasoning: "RUBRIC-CAUSAL-STRONG",
        claimEvidenceFit: "RUBRIC-FIT-STRONG",
        uncertainty: "RUBRIC-UNCERTAINTY-DEVELOPING",
      },
      revisionPromptId: "REVISION-UNCERTAINTY",
    };

    expect(caseBriefFeedbackPlanSchema.parse(plan)).toEqual(plan);
    expect(caseBriefFeedbackPlanSchema.safeParse({ ...plan, summary: "Generated prose" }).success)
      .toBe(false);
  });

  it("uses distinct success and fallback feedback envelopes", () => {
    const success = {
      ...correlation,
      promptVersion: CASE_BRIEF_PROMPT_VERSION,
      status: "ok",
      source: "model",
      authority: "formative_only",
      mutatesCaseState: false,
      feedback: {
        formativeStatus: "supported_incomplete",
        summary: "The route mechanism is supported, but the consequence needs a tighter limit.",
        evidenceClaimLinks: [
          {
            evidenceId: "E3",
            studentSpan: "route information changed the pursuit",
            fit: "supports",
          },
        ],
        concerns: [],
        rubricScores: {
          sourcing: 3,
          corroboration: 3,
          causalReasoning: 3,
          claimEvidenceFit: 3,
          uncertainty: 2,
        },
        rubricReasons: {
          sourcing: "The brief attributes its source claims.",
          corroboration: "The brief compares more than one record.",
          causalReasoning: "The brief explains a mechanism.",
          claimEvidenceFit: "The selected record fits the route claim.",
          uncertainty: "The consequence still needs a clearer limit.",
        },
        revisionPrompt: "State what this event did not make inevitable.",
        renderedTemplateIds: ["SUMMARY-SUPPORTED-INCOMPLETE", "REVISION-UNCERTAINTY"],
      },
    };
    const fallback = {
      ...correlation,
      promptVersion: CASE_BRIEF_PROMPT_VERSION,
      status: "fallback",
      source: "deterministic_fallback",
      authority: "formative_only",
      mutatesCaseState: false,
      reason: "missing_api_key",
      retryable: false,
      displayMessage: "AI-assisted feedback is unavailable. Your deterministic repair status is unchanged.",
    };

    expect(caseBriefFeedbackResponseSchema.safeParse(success).success).toBe(true);
    expect(caseBriefFeedbackResponseSchema.safeParse(fallback).success).toBe(true);
    expect(
      caseBriefFeedbackResponseSchema.safeParse({
        ...success,
        speechAuthorization: null,
      }).success,
    ).toBe(false);
    expect(
      caseBriefFeedbackResponseSchema.safeParse({ ...fallback, rubricScores: success.feedback.rubricScores })
        .success,
    ).toBe(false);
  });
});
