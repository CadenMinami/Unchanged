import { describe, expect, it } from "vitest";

import {
  restoreApprovedCourseAlignment,
  serializeApprovedCourseAlignment,
} from "@/lib/course-alignment/persistence";
import {
  COURSE_ALIGNMENT_PROMPT_VERSION,
  COURSE_ALIGNMENT_VERSION,
  type ApprovedCourseAlignment,
} from "@/schemas/course-alignment";

const approvedAlignment: ApprovedCourseAlignment = {
  approvedAt: "2026-07-16T12:00:00.000Z",
  profile: {
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
    conceptMappings: [],
    glossaryEntries: [],
    potentialConflicts: [],
    injectionFlags: [],
    readingSupport: "standard",
    limitationIds: [],
    authority: "alignment_only",
    mutatesCaseState: false,
    reviewStatus: "teacher_approved",
  },
  preferences: {
    readingMode: "standard",
    motionMode: "standard",
    guidanceMode: "guided",
  },
};

describe("approved course alignment persistence", () => {
  it("round-trips a profile independently of the case state", () => {
    const serialized = serializeApprovedCourseAlignment(approvedAlignment, "1.0.3");
    const restored = restoreApprovedCourseAlignment(serialized, {
      caseId: "varennes",
      caseVersion: "1.0.3",
    });

    expect(restored).toEqual({ alignment: approvedAlignment, recovered: false });
  });

  it("does not persist raw teacher material", () => {
    const serialized = serializeApprovedCourseAlignment(approvedAlignment, "1.0.3");

    expect(serialized).not.toContain("rawPacketContent");
    expect(serialized).not.toContain("caseBrief");
    expect(serialized).not.toContain("repairCompleted");
  });

  it("rejects alignment saved for a different case version", () => {
    const serialized = serializeApprovedCourseAlignment(approvedAlignment, "1.0.2");
    const restored = restoreApprovedCourseAlignment(serialized, {
      caseId: "varennes",
      caseVersion: "1.0.3",
    });

    expect(restored.alignment).toBeNull();
    expect(restored.recovered).toBe(true);
    expect(restored.reason).toBe("incompatible-alignment");
  });

  it("rejects unapproved or malformed local data", () => {
    expect(
      restoreApprovedCourseAlignment("not-json", {
        caseId: "varennes",
        caseVersion: "1.0.3",
      }),
    ).toEqual({
      alignment: null,
      recovered: true,
      reason: "invalid-json",
    });
  });
});
