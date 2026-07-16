import { z } from "zod";

export const COURSE_ALIGNMENT_VERSION = "1.1.0" as const;
export const COURSE_ALIGNMENT_PROMPT_VERSION = "1.0.0" as const;

export const courseObjectiveIdSchema = z.enum([
  "OBJ-SOURCE-CORROBORATION",
  "OBJ-CAUSAL-REASONING",
  "OBJ-UNCERTAINTY-MULTICAUSALITY",
]);

export const courseConceptIdSchema = z.enum([
  "CONCEPT-CONSTITUTIONAL-MONARCHY",
  "CONCEPT-VOLUNTARY-DEPARTURE",
  "CONCEPT-SOURCE-RELIABILITY",
  "CONCEPT-ROUTE-INFORMATION",
  "CONCEPT-COLLECTIVE-LOCAL-ACTION",
  "CONCEPT-POLITICAL-TRUST",
  "CONCEPT-MULTICAUSALITY",
]);

export const historicalBoundaryIdSchema = z.enum([
  "BOUNDARY-NOT-SOLE-CAUSE",
  "BOUNDARY-MOTIVE-UNRESOLVED",
  "BOUNDARY-CLASS-MATERIAL-NOT-EVIDENCE",
]);

export const alignmentLimitationIdSchema = z.enum([
  "LIMITATION-SAMPLE-MATERIAL",
  "LIMITATION-LOW-COVERAGE",
  "LIMITATION-NO-MODEL",
  "LIMITATION-INSTRUCTION-LIKE-TEXT",
  "LIMITATION-CONFLICT-REVIEW",
  "LIMITATION-FILE-UNEXTRACTED",
  "LIMITATION-EXCERPTS-ONLY",
]);

export const packetSegmentIdSchema = z.string().regex(/^SEG-\d{4}$/);

export const packetSegmentSchema = z
  .object({
    id: packetSegmentIdSchema,
    referenceLabel: z.string().trim().min(1).max(80),
    text: z.string().trim().min(1).max(800),
  })
  .strict();

const confidenceSchema = z.enum(["exact", "strong", "partial"]);
const readingSupportSchema = z.enum([
  "standard",
  "reduced_recommended",
  "unclear",
]);
const injectionKindSchema = z.enum([
  "instruction_like_text",
  "answer_disclosure",
  "authority_escalation",
]);

export const courseAlignmentPlanSchema = z
  .object({
    planVersion: z.literal(COURSE_ALIGNMENT_PROMPT_VERSION),
    objectiveMappings: z
      .array(
        z
          .object({
            objectiveId: courseObjectiveIdSchema,
            segmentId: packetSegmentIdSchema,
          })
          .strict(),
      )
      .max(12),
    conceptMappings: z
      .array(
        z
          .object({
            conceptId: courseConceptIdSchema,
            segmentId: packetSegmentIdSchema,
            packetTerm: z.string().trim().min(1).max(120),
            confidence: confidenceSchema,
          })
          .strict(),
      )
      .max(12),
    conflictCandidates: z
      .array(
        z
          .object({
            boundaryId: historicalBoundaryIdSchema,
            segmentId: packetSegmentIdSchema,
          })
          .strict(),
      )
      .max(8),
    injectionCandidates: z
      .array(
        z
          .object({
            kind: injectionKindSchema,
            segmentId: packetSegmentIdSchema,
          })
          .strict(),
      )
      .max(8),
    readingSupport: readingSupportSchema,
    limitationIds: z.array(alignmentLimitationIdSchema).max(8),
  })
  .strict();

const packetMetadataSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    sourceKind: z.enum(["sample_packet", "pasted_text", "uploaded_file"]),
    processor: z.enum(["reviewed_sample", "deterministic_fallback", "gpt_5_6"]),
    packetDigest: z.string().regex(/^[a-f0-9]{64}$/),
    rawRetained: z.literal(false),
  })
  .strict();

const authorizedConceptMappingSchema = z
  .object({
    conceptId: courseConceptIdSchema,
    segmentId: packetSegmentIdSchema,
    packetTerm: z.string().trim().min(1).max(120),
    referenceLabel: z.string().trim().min(1).max(80),
    excerpt: z.string().trim().min(1).max(480),
    confidence: confidenceSchema,
  })
  .strict();

const authorizedGlossaryEntrySchema = z
  .object({
    conceptId: courseConceptIdSchema,
    segmentId: packetSegmentIdSchema,
    packetTerm: z.string().trim().min(1).max(120),
    referenceLabel: z.string().trim().min(1).max(80),
  })
  .strict();

const authorizedConflictSchema = z
  .object({
    boundaryId: historicalBoundaryIdSchema,
    segmentId: packetSegmentIdSchema,
    referenceLabel: z.string().trim().min(1).max(80),
    excerpt: z.string().trim().min(1).max(480),
    requiresTeacherAttention: z.literal(true),
  })
  .strict();

const authorizedInjectionFlagSchema = z
  .object({
    kind: injectionKindSchema,
    segmentId: packetSegmentIdSchema,
    excerpt: z.string().trim().min(1).max(240),
    disposition: z.literal("ignored_as_data"),
  })
  .strict();

export const courseAlignmentProfileSchema = z
  .object({
    profileVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    catalogVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    promptVersion: z.literal(COURSE_ALIGNMENT_PROMPT_VERSION),
    caseId: z.string().trim().min(1).max(64),
    packet: packetMetadataSchema,
    selectedObjectiveIds: z
      .array(courseObjectiveIdSchema)
      .min(2)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length, "Objectives must be unique."),
    conceptMappings: z.array(authorizedConceptMappingSchema).max(12),
    glossaryEntries: z.array(authorizedGlossaryEntrySchema).max(16),
    potentialConflicts: z.array(authorizedConflictSchema).max(8),
    injectionFlags: z.array(authorizedInjectionFlagSchema).max(8),
    readingSupport: readingSupportSchema,
    limitationIds: z.array(alignmentLimitationIdSchema).max(8),
    authority: z.literal("alignment_only"),
    mutatesCaseState: z.literal(false),
    reviewStatus: z.enum(["pending_teacher_review", "teacher_approved"]),
  })
  .strict();

const courseAlignmentSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sample") }).strict(),
  z
    .object({
      kind: z.literal("text"),
      title: z.string().trim().min(1).max(120),
      text: z.string().trim().min(1).max(40_000),
    })
    .strict(),
  z
    .object({
      kind: z.literal("file"),
      title: z.string().trim().min(1).max(120),
      filename: z.string().trim().min(1).max(160),
      mimeType: z.enum(["text/plain", "text/markdown"]),
      text: z.string().trim().min(1).max(64_000),
    })
    .strict(),
]);

export const courseAlignmentRequestSchema = z
  .object({
    contractVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    promptVersion: z.literal(COURSE_ALIGNMENT_PROMPT_VERSION),
    caseId: z.string().trim().min(1).max(64),
    caseVersion: z.string().trim().min(1).max(32),
    catalogVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    requestId: z.uuid(),
    selectedObjectiveIds: z
      .array(courseObjectiveIdSchema)
      .min(2)
      .max(3)
      .refine((ids) => new Set(ids).size === ids.length, "Objectives must be unique."),
    source: courseAlignmentSourceSchema,
  })
  .strict();

export const courseAlignmentResponseSchema = z
  .object({
    status: z.literal("ok"),
    contractVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    requestId: z.uuid(),
    profile: courseAlignmentProfileSchema,
  })
  .strict();

export const learningPreferencesSchema = z
  .object({
    readingMode: z.enum(["standard", "reduced"]),
    motionMode: z.enum(["standard", "reduced"]),
    guidanceMode: z.enum(["guided", "challenge"]),
  })
  .strict();

export const approvedCourseAlignmentSchema = z
  .object({
    approvedAt: z.string().datetime(),
    profile: courseAlignmentProfileSchema.refine(
      (profile) => profile.reviewStatus === "teacher_approved",
      "The teacher must approve the profile before it can be persisted.",
    ),
    preferences: learningPreferencesSchema,
  })
  .strict();

const courseObjectiveSchema = z
  .object({
    id: courseObjectiveIdSchema,
    title: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(320),
    observableBehaviors: z.array(z.string().trim().min(1).max(200)).min(1).max(6),
  })
  .strict();

const courseConceptSchema = z
  .object({
    id: courseConceptIdSchema,
    label: z.string().trim().min(1).max(100),
    canonicalDefinition: z.string().trim().min(1).max(400),
    caseFactIds: z.array(z.string().trim().min(1).max(64)).min(1).max(8),
    matchTerms: z.array(z.string().trim().min(2).max(80)).min(1).max(12),
  })
  .strict();

const samplePacketSectionSchema = z
  .object({
    segmentId: packetSegmentIdSchema,
    referenceLabel: z.string().trim().min(1).max(80),
    heading: z.string().trim().min(1).max(120),
    text: z.string().trim().min(1).max(1_200),
  })
  .strict();

export const courseAlignmentCatalogSchema = z
  .object({
    catalogVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    caseId: z.string().trim().min(1).max(64),
    objectives: z.array(courseObjectiveSchema).length(3),
    concepts: z.array(courseConceptSchema).length(7),
    boundaries: z
      .array(
        z
          .object({
            id: historicalBoundaryIdSchema,
            label: z.string().trim().min(1).max(120),
            reviewedExplanation: z.string().trim().min(1).max(480),
          })
          .strict(),
      )
      .length(3),
    limitations: z
      .array(
        z
          .object({
            id: alignmentLimitationIdSchema,
            message: z.string().trim().min(1).max(320),
          })
          .strict(),
      )
      .length(7),
    samplePacket: z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().min(1).max(320),
        sections: z.array(samplePacketSectionSchema).min(1).max(8),
      })
      .strict(),
    sampleProfile: courseAlignmentProfileSchema,
  })
  .strict();

export type CourseObjectiveId = z.infer<typeof courseObjectiveIdSchema>;
export type CourseConceptId = z.infer<typeof courseConceptIdSchema>;
export type HistoricalBoundaryId = z.infer<typeof historicalBoundaryIdSchema>;
export type AlignmentLimitationId = z.infer<typeof alignmentLimitationIdSchema>;
export type PacketSegment = z.infer<typeof packetSegmentSchema>;
export type CourseAlignmentPlan = z.infer<typeof courseAlignmentPlanSchema>;
export type CourseAlignmentProfile = z.infer<typeof courseAlignmentProfileSchema>;
export type CourseAlignmentRequest = z.infer<typeof courseAlignmentRequestSchema>;
export type LearningPreferences = z.infer<typeof learningPreferencesSchema>;
export type ApprovedCourseAlignment = z.infer<typeof approvedCourseAlignmentSchema>;
export type CourseAlignmentCatalog = z.infer<typeof courseAlignmentCatalogSchema>;
