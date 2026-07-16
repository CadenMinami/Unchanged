import { getRepairEligibility } from "@/lib/case-engine/repair-eligibility";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { getPinnedHistoricalLineageIds } from "@/lib/case-engine/selectors";
import { authorizeCaseBriefFeedbackPlan } from "@/lib/openai/authorize-model-output";
import { loadVarennesModelPolicy } from "@/lib/openai/load-model-policy";
import type { ModelGateway } from "@/lib/openai/model-gateway";
import { classifyProviderError } from "@/lib/openai/provider-error";
import type { InputSafetyGateway } from "@/lib/openai/input-safety-gateway";
import type { CasePackage } from "@/schemas/case-package";
import {
  caseBriefFeedbackPlanSchema,
  caseBriefFeedbackResponseSchema,
  type CaseBriefFeedbackPlan,
  type CaseBriefFeedbackRequest,
  type CaseBriefFeedbackResponse,
  type ModelFailureReason,
} from "@/schemas/ai-contracts";
import type { ModelPolicy } from "@/schemas/model-policy";

interface CaseBriefFeedbackDependencies {
  gateway: ModelGateway | null;
  inputSafety?: InputSafetyGateway | null;
  signal?: AbortSignal;
}

function responseMetadata(request: CaseBriefFeedbackRequest) {
  return {
    contractVersion: request.contractVersion,
    caseId: request.caseId,
    caseSchemaVersion: request.caseSchemaVersion,
    caseVersion: request.caseVersion,
    policyVersion: request.policyVersion,
    stateVersion: request.stateVersion,
    requestId: request.requestId,
    stateRevision: request.stateRevision,
    promptVersion: request.promptVersion,
  } as const;
}

function scoreBand(score: number): "missing" | "developing" | "strong" {
  if (score <= 1) return "missing";
  if (score === 2) return "developing";
  return "strong";
}

function feedbackPlanPolicy(policy: ModelPolicy, evidenceIds: readonly string[]) {
  return {
    summaryTemplateIds: policy.feedbackUnits.summaryTemplates.map(
      (unit) => unit.summaryTemplateId,
    ),
    rubricReasonIds: policy.feedbackUnits.rubricReasonTemplates.map(
      (unit) => unit.rubricReasonId,
    ),
    revisionPromptIds: policy.feedbackUnits.revisionPromptTemplates.map(
      (unit) => unit.revisionPromptId,
    ),
    issueTemplateIds: policy.feedbackUnits.issueExplanationTemplates.map(
      (unit) => unit.issueTemplateId,
    ),
    evidenceIds,
  };
}

function validateRubricTemplateFit(plan: CaseBriefFeedbackPlan, policy: ModelPolicy) {
  const criteria = [
    "sourcing",
    "corroboration",
    "causalReasoning",
    "claimEvidenceFit",
    "uncertainty",
  ] as const;
  for (const criterion of criteria) {
    const reasonId = plan.rubricReasonIds[criterion];
    const template = policy.feedbackUnits.rubricReasonTemplates.find(
      (candidate) => candidate.rubricReasonId === reasonId,
    );
    if (
      !template ||
      template.criterion !== criterion ||
      template.scoreBand !== scoreBand(plan.rubricScores[criterion])
    ) {
      throw new Error(`Rubric reason ${reasonId} does not fit ${criterion}.`);
    }
  }
}

function validateFeedbackCoherence(
  plan: CaseBriefFeedbackPlan,
  casePackage: CasePackage,
) {
  const linkedEvidenceIds = new Set(
    plan.evidenceClaimLinks
      .filter((link) => link.fit !== "unclear")
      .map((link) => link.evidenceId),
  );
  const linkedHistoricalLineages = new Set(
    casePackage.evidence
      .filter(
        (evidence) =>
          linkedEvidenceIds.has(evidence.id) && evidence.countsAsHistoricalEvidence,
      )
      .flatMap((evidence) => evidence.sourceLineageIds),
  );

  if (linkedHistoricalLineages.size < 2 && plan.rubricScores.corroboration >= 3) {
    throw new Error("Strong corroboration requires at least two independent historical lineages.");
  }
  if (
    plan.evidenceClaimLinks.length === 0 &&
    (plan.rubricScores.corroboration > 1 || plan.rubricScores.claimEvidenceFit > 1)
  ) {
    throw new Error("Evidence-fit scores require at least one evidence-to-claim link.");
  }
  if (
    plan.formativeStatus === "contradicted_by_record" &&
    !plan.evidenceClaimLinks.some((link) => link.fit === "contradicts")
  ) {
    throw new Error("A contradicted status requires a contradictory evidence link.");
  }
  if (
    plan.formativeStatus === "contradicted_by_record" &&
    plan.rubricScores.claimEvidenceFit > 1
  ) {
    throw new Error("A contradicted status requires a missing claim-to-evidence fit score.");
  }
  if (
    plan.formativeStatus === "plausible_under_evidenced" &&
    plan.rubricScores.corroboration > 2 &&
    plan.rubricScores.claimEvidenceFit > 2
  ) {
    throw new Error("Under-evidenced feedback must identify an evidence or corroboration weakness.");
  }
  if (
    plan.formativeStatus === "supported_incomplete" &&
    plan.rubricScores.causalReasoning > 2 &&
    plan.rubricScores.uncertainty > 2
  ) {
    throw new Error("Supported-incomplete feedback must identify a causal or claim-limit weakness.");
  }
  if (plan.formativeStatus === "well_supported") {
    const distinctLinkedEvidence = new Set(
      plan.evidenceClaimLinks.map((link) => link.evidenceId),
    );
    if (
      plan.concernSpans.length > 0 ||
      linkedHistoricalLineages.size < 2 ||
      distinctLinkedEvidence.size < 2 ||
      Object.values(plan.rubricScores).some((score) => score < 3)
    ) {
      throw new Error("Well-supported feedback conflicts with its evidence or rubric details.");
    }
  }
}

function renderFeedback(
  request: CaseBriefFeedbackRequest,
  plan: CaseBriefFeedbackPlan,
  policy: ModelPolicy,
) {
  const textKey = request.readingMode ?? "standard";
  const summary = policy.feedbackUnits.summaryTemplates.find(
    (unit) => unit.summaryTemplateId === plan.summaryTemplateId,
  );
  const revision = policy.feedbackUnits.revisionPromptTemplates.find(
    (unit) => unit.revisionPromptId === plan.revisionPromptId,
  );
  if (!summary || !revision || summary.formativeStatus !== plan.formativeStatus) {
    throw new Error("Feedback summary or revision template does not match the model plan.");
  }

  const criterionKeys = [
    "sourcing",
    "corroboration",
    "causalReasoning",
    "claimEvidenceFit",
    "uncertainty",
  ] as const;
  const rubricReasons = Object.fromEntries(
    criterionKeys.map((criterion) => {
      const reasonId = plan.rubricReasonIds[criterion];
      const template = policy.feedbackUnits.rubricReasonTemplates.find(
        (candidate) => candidate.rubricReasonId === reasonId,
      );
      if (!template) throw new Error(`Missing rubric reason template ${reasonId}.`);
      return [criterion, template.text[textKey]];
    }),
  ) as Record<(typeof criterionKeys)[number], string>;

  const concerns = plan.concernSpans.map((concern) => {
    const template = policy.feedbackUnits.issueExplanationTemplates.find(
      (candidate) => candidate.issueTemplateId === concern.issueTemplateId,
    );
    if (!template || template.issueType !== concern.kind) {
      throw new Error(`Issue template ${concern.issueTemplateId} does not fit the concern.`);
    }
    return {
      kind: concern.kind,
      studentSpan: concern.studentSpan,
      explanation: template.text[textKey],
      evidenceIds: concern.evidenceIds,
    };
  });

  return {
    formativeStatus: plan.formativeStatus,
    summary: summary.text[textKey],
    evidenceClaimLinks: plan.evidenceClaimLinks,
    concerns,
    rubricScores: plan.rubricScores,
    rubricReasons,
    revisionPrompt: revision.text[textKey],
    renderedTemplateIds: [
      plan.summaryTemplateId,
      ...Object.values(plan.rubricReasonIds),
      ...plan.concernSpans.map((concern) => concern.issueTemplateId),
      plan.revisionPromptId,
    ],
  };
}

function fallbackResponse(
  request: CaseBriefFeedbackRequest,
  reason: ModelFailureReason,
  retryable = reason === "timeout" || reason === "rate_limited",
): CaseBriefFeedbackResponse {
  return {
    ...responseMetadata(request),
    status: "fallback",
    source: "deterministic_fallback",
    authority: "formative_only",
    mutatesCaseState: false,
    reason,
    retryable,
    displayMessage:
      reason === "unsafe_input"
        ? "Your Case Brief was not sent for AI feedback because it needs safer wording. It is preserved and your deterministic repair status is unchanged."
        : "AI-assisted feedback is unavailable. Your Case Brief is preserved and your deterministic repair status is unchanged.",
  };
}

function buildPrompt(request: CaseBriefFeedbackRequest, policy: ModelPolicy) {
  const casePackage = loadVarennesCase();
  const state = request.caseState;
  const eligibility = getRepairEligibility(casePackage, state);
  const pinnedEvidence = casePackage.evidence
    .filter((evidence) => state.pinnedEvidenceIds.includes(evidence.id))
    .map((evidence) => ({
      evidenceId: evidence.id,
      title: evidence.title,
      excerpt: evidence.studentExcerpt,
      description: evidence.description,
      sourceType: evidence.sourceType,
      provenance: evidence.provenance,
      factIds: evidence.factIds,
      dependencyLineageIds: evidence.dependencyLineageIds,
      sourceLineageIds: evidence.sourceLineageIds,
      sources: evidence.sourceIds.map((sourceId) => {
        const source = casePackage.sources.find((candidate) => candidate.id === sourceId);
        if (!source) throw new Error(`Missing source metadata for ${sourceId}.`);
        return {
          sourceId: source.id,
          sourceType: source.sourceType,
          lineageId: source.lineageId,
          historicalLineageEligible: source.historicalLineageEligible,
          limitations: source.limitations,
        };
      }),
    }));
  const catalog = {
    studentArgument: state.caseBrief.argument,
    boardSnapshot: {
      activeAnomalyId: state.activeAnomalyId,
      rejectedAnomalyIds: state.rejectedAnomalyIds,
      selectedConditionIds: state.selectedConditionIds,
      placedCausalNodeIds: state.placedCausalNodeIds,
      connectedCausalEdgeIds: state.connectedCausalEdgeIds,
      selectedConsequenceId: state.caseBrief.selectedConsequenceId,
      selectedUncertaintyIds: state.caseBrief.selectedUncertaintyIds,
      pinnedEvidence,
      independentHistoricalLineageIds: getPinnedHistoricalLineageIds(casePackage, state),
    },
    deterministicGate: {
      repairReady: eligibility.eligible,
      missingRequirementIds: eligibility.missingRequirementIds,
    },
    feedbackCatalog: policy.feedbackUnits,
  };
  return {
    instructions:
      "Evaluate only the student's submitted language and board snapshot. Select authored feedback IDs from the supplied catalog and quote only exact spans from studentArgument. Return no prose. The deterministic gate is context only and cannot be overridden or supplemented with new requirements.",
    input: JSON.stringify(catalog),
  };
}

export async function createCaseBriefFeedback(
  request: CaseBriefFeedbackRequest,
  { gateway, inputSafety, signal }: CaseBriefFeedbackDependencies,
): Promise<CaseBriefFeedbackResponse> {
  const policy = loadVarennesModelPolicy();
  const casePackage = loadVarennesCase();
  if (
    request.caseId !== policy.caseId ||
    request.caseVersion !== policy.caseVersion ||
    request.policyVersion !== policy.policyVersion ||
    request.caseSchemaVersion !== casePackage.schemaVersion
  ) {
    throw new Error("Case Brief feedback request versions do not match the case policy.");
  }
  if (!request.caseState.caseBrief.submitted) {
    throw new Error("Case Brief feedback requires a committed submission snapshot.");
  }
  if (!gateway) return fallbackResponse(request, "missing_api_key");

  if (inputSafety) {
    try {
      const safety = await inputSafety.check(request.caseState.caseBrief.argument, signal);
      if (safety.flagged) return fallbackResponse(request, "unsafe_input");
    } catch (error) {
      const failure = classifyProviderError(error);
      return fallbackResponse(request, failure.reason, failure.retryable);
    }
  }

  const prompt = buildPrompt(request, policy);
  let plan: CaseBriefFeedbackPlan;
  try {
    try {
      plan = await gateway.generateStructured({
        schema: caseBriefFeedbackPlanSchema,
        schemaName: "history_unbroken_case_brief_feedback_plan",
        instructions: prompt.instructions,
        input: prompt.input,
        maxOutputTokens: 800,
        signal,
      });
    } catch (error) {
      if (!classifyProviderError(error).retryable) throw error;
      plan = await gateway.generateStructured({
        schema: caseBriefFeedbackPlanSchema,
        schemaName: "history_unbroken_case_brief_feedback_plan",
        instructions: prompt.instructions,
        input: prompt.input,
        maxOutputTokens: 800,
        signal,
      });
    }
  } catch (error) {
    const failure = classifyProviderError(error);
    return fallbackResponse(request, failure.reason, failure.retryable);
  }

  try {
    const authorized = authorizeCaseBriefFeedbackPlan(
      request,
      plan,
      feedbackPlanPolicy(
        policy,
        casePackage.evidence.map((evidence) => evidence.id),
      ),
    );
    validateRubricTemplateFit(authorized, policy);
    validateFeedbackCoherence(
      authorized,
      casePackage,
    );
    return caseBriefFeedbackResponseSchema.parse({
      ...responseMetadata(request),
      status: "ok",
      source: "model",
      authority: "formative_only",
      mutatesCaseState: false,
      feedback: renderFeedback(request, authorized, policy),
    });
  } catch {
    return fallbackResponse(request, "unauthorized_output");
  }
}
