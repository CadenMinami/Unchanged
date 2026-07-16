import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";
import type {
  ApprovedCourseAlignment,
  LearningPreferences,
} from "@/schemas/course-alignment";
import type { CaseState } from "@/schemas/case-state";
import type { ObservableLearningEvent } from "@/schemas/learning-session";

interface BuildTeacherReportInput {
  caseState: CaseState;
  approvedAlignment: ApprovedCourseAlignment | null;
  preferences: LearningPreferences;
  observableEvents: ObservableLearningEvent[];
}

export function buildTeacherReport({
  caseState,
  approvedAlignment,
  preferences,
  observableEvents,
}: BuildTeacherReportInput) {
  const catalog = loadVarennesAlignmentCatalog();
  const evidenceInspected = new Set(caseState.inspectedItemIds).size;
  const evidencePinned = new Set(caseState.pinnedEvidenceIds).size;
  const comparisons = new Set(caseState.completedComparisonIds).size;
  const hintsViewed = observableEvents.filter((event) => event.type === "hint_viewed").length;

  const objectiveObservation = {
    "OBJ-SOURCE-CORROBORATION": `${comparisons} source comparisons recorded; ${evidencePinned} reviewed records pinned to the final brief.`,
    "OBJ-CAUSAL-REASONING": `${caseState.connectedCausalEdgeIds.length} causal links and ${caseState.selectedConditionIds.length} broader conditions remain in the final caseboard state.`,
    "OBJ-UNCERTAINTY-MULTICAUSALITY": `${caseState.caseBrief.selectedUncertaintyIds.length} authored uncertainty limits and ${caseState.caseBrief.selectedConsequenceId ? "one limited consequence" : "no limited consequence"} appear in the submitted brief.`,
  } as const;

  const courseAlignment = approvedAlignment
    ? {
        packetTitle: approvedAlignment.profile.packet.title,
        approvedAt: approvedAlignment.approvedAt,
        objectives: approvedAlignment.profile.selectedObjectiveIds.map((objectiveId) => {
          const objective = catalog.objectives.find((item) => item.id === objectiveId)!;
          return {
            id: objective.id,
            title: objective.title,
            description: objective.description,
            observation: objectiveObservation[objective.id],
          };
        }),
        packetConnections: approvedAlignment.profile.conceptMappings.map((mapping) => ({
          conceptId: mapping.conceptId,
          conceptLabel:
            catalog.concepts.find((concept) => concept.id === mapping.conceptId)?.label ??
            mapping.conceptId,
          packetTerm: mapping.packetTerm,
          referenceLabel: mapping.referenceLabel,
        })),
      }
    : null;

  return {
    reportVersion: "1.0.0" as const,
    completionStatus:
      caseState.phase === "debrief" && caseState.repairCompleted
        ? ("case_reconstructed" as const)
        : ("in_progress" as const),
    reasoningRecord: {
      evidenceInspected,
      evidencePinned,
      comparisons,
      conditions: caseState.selectedConditionIds.length,
      causalLinks: caseState.connectedCausalEdgeIds.length,
      hintsViewed,
      argument: caseState.caseBrief.argument,
      uncertaintyIds: [...caseState.caseBrief.selectedUncertaintyIds],
    },
    supportSettings: preferences,
    courseAlignment,
    teacherReviewRequired: true as const,
    narrativeBoundary:
      "This report describes validated case state and recorded interface events. It does not infer ability, motivation, personality, disability, or unobserved revision history.",
    aiBoundary:
      "AI-assisted dialogue and formative feedback may have appeared during play. This deterministic report does not invent or recalculate an AI rubric score.",
  };
}
