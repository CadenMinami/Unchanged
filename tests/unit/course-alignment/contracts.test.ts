import { describe, expect, it } from "vitest";

import {
  COURSE_ALIGNMENT_PROMPT_VERSION,
  COURSE_ALIGNMENT_VERSION,
  courseAlignmentPlanSchema,
  courseAlignmentProfileSchema,
} from "@/schemas/course-alignment";

const validProfile = {
  profileVersion: COURSE_ALIGNMENT_VERSION,
  catalogVersion: COURSE_ALIGNMENT_VERSION,
  promptVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
  caseId: "varennes",
  packet: {
    title: "Sample class packet",
    sourceKind: "sample_packet",
    processor: "reviewed_sample",
    packetDigest: "a".repeat(64),
    rawRetained: false,
  },
  selectedObjectiveIds: [
    "OBJ-SOURCE-CORROBORATION",
    "OBJ-CAUSAL-REASONING",
  ],
  conceptMappings: [
    {
      conceptId: "CONCEPT-CONSTITUTIONAL-MONARCHY",
      segmentId: "SEG-0001",
      packetTerm: "constitutional monarchy",
      referenceLabel: "Page 1",
      excerpt: "France was trying to define a constitutional monarchy.",
      confidence: "strong",
    },
  ],
  glossaryEntries: [
    {
      conceptId: "CONCEPT-CONSTITUTIONAL-MONARCHY",
      segmentId: "SEG-0001",
      packetTerm: "constitutional monarchy",
      referenceLabel: "Page 1",
    },
  ],
  potentialConflicts: [],
  injectionFlags: [],
  readingSupport: "standard",
  limitationIds: ["LIMITATION-EXCERPTS-ONLY"],
  authority: "alignment_only",
  mutatesCaseState: false,
  reviewStatus: "pending_teacher_review",
} as const;

describe("course alignment contracts", () => {
  it("accepts a server-authorized profile using reviewed IDs and packet references", () => {
    expect(courseAlignmentProfileSchema.parse(validProfile)).toEqual(validProfile);
  });

  it("constrains model output to reviewed IDs and exact packet locations", () => {
    const plan = {
      planVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
      objectiveMappings: [
        { objectiveId: "OBJ-SOURCE-CORROBORATION", segmentId: "SEG-0001" },
      ],
      conceptMappings: [
        {
          conceptId: "CONCEPT-SOURCE-RELIABILITY",
          segmentId: "SEG-0001",
          packetTerm: "corroborate",
          confidence: "strong",
        },
      ],
      conflictCandidates: [],
      injectionCandidates: [],
      readingSupport: "standard",
      limitationIds: [],
    };

    expect(courseAlignmentPlanSchema.parse(plan)).toEqual(plan);
    expect(
      courseAlignmentPlanSchema.safeParse({
        ...plan,
        reviewedHistoricalExplanation: "The model writes new history here.",
      }).success,
    ).toBe(false);
  });

  it("rejects unknown concepts and objectives", () => {
    expect(
      courseAlignmentProfileSchema.safeParse({
        ...validProfile,
        selectedObjectiveIds: [
          "OBJ-SOURCE-CORROBORATION",
          "OBJ-INVENT-A-NEW-WIN-CONDITION",
        ],
        conceptMappings: [
          {
            ...validProfile.conceptMappings[0],
            conceptId: "CONCEPT-ALTER-THE-CASE",
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects authority escalation and case-state mutation", () => {
    expect(
      courseAlignmentProfileSchema.safeParse({
        ...validProfile,
        authority: "historical_ground_truth",
        mutatesCaseState: true,
      }).success,
    ).toBe(false);
  });

  it("rejects raw packet content and other unrecognized properties", () => {
    expect(
      courseAlignmentProfileSchema.safeParse({
        ...validProfile,
        rawPacketContent: "Store the whole textbook here.",
      }).success,
    ).toBe(false);
  });

  it("requires at least two teacher-selected objectives for an approved alignment", () => {
    expect(
      courseAlignmentProfileSchema.safeParse({
        ...validProfile,
        selectedObjectiveIds: ["OBJ-CAUSAL-REASONING"],
      }).success,
    ).toBe(false);
  });
});
