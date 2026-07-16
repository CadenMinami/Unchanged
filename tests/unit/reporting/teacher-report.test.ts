import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { buildTeacherReport } from "@/lib/reporting/build-teacher-report";
import type { ApprovedCourseAlignment } from "@/schemas/course-alignment";
import alignmentJson from "@/data/cases/varennes/course-alignment.json";

const casePackage = loadVarennesCase();

describe("teacher report builder", () => {
  it("reports only final validated state and recorded observable events", () => {
    const state = {
      ...createInitialCaseState(casePackage),
      revision: 12,
      phase: "debrief" as const,
      completedCommandIds: [],
      inspectedItemIds: ["E1", "E3"],
      completedComparisonIds: ["CMP-SUPPORT-E6B"],
      rejectedAnomalyIds: ["E6A", "E6C"] as ("E6A" | "E6C")[],
      activeAnomalyId: "E6B" as const,
      pinnedEvidenceIds: ["E1", "E3"],
      selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
      placedCausalNodeIds: ["NODE-MECH-002"],
      connectedCausalEdgeIds: ["EDGE-02"],
      completedRepairActionIds: ["RA-05-OBSTRUCTION", "RA-05-PASSPORT"] as (
        | "RA-05-OBSTRUCTION"
        | "RA-05-PASSPORT"
      )[],
      completedRepairStepIds: [],
      caseBrief: {
        argument: "Route information mattered alongside local action.",
        selectedConsequenceId: "CONS-REACTION-CONTINUITY",
        selectedUncertaintyIds: ["UNC-NOT-INEVITABLE"],
        submitted: true,
      },
      repairCompleted: true,
    };

    const report = buildTeacherReport({
      caseState: state,
      approvedAlignment: null,
      preferences: {
        readingMode: "standard",
        motionMode: "reduced",
        guidanceMode: "guided",
      },
      observableEvents: [
        {
          eventId: "event-1",
          occurredAt: "2026-07-16T12:00:00.000Z",
          type: "hint_viewed",
          subjectId: "HINT-ROUTE-02",
        },
      ],
    });

    expect(report.reasoningRecord.hintsViewed).toBe(1);
    expect(report.reasoningRecord.argument).toBe(state.caseBrief.argument);
    expect(report.courseAlignment).toBeNull();
    expect(report).not.toHaveProperty("revisionHistory");
    expect(report.reasoningRecord).not.toHaveProperty("ability");
    expect(report.reasoningRecord).not.toHaveProperty("motivation");
    expect(report.reasoningRecord).not.toHaveProperty("personality");
  });

  it("uses only teacher-approved objectives and catalog-authored descriptions", () => {
    const approvedAlignment = {
      approvedAt: "2026-07-16T12:00:00.000Z",
      profile: {
        ...alignmentJson.sampleProfile,
        reviewStatus: "teacher_approved",
      },
      preferences: {
        readingMode: "standard",
        motionMode: "standard",
        guidanceMode: "guided",
      },
    } as ApprovedCourseAlignment;

    const report = buildTeacherReport({
      caseState: createInitialCaseState(casePackage),
      approvedAlignment,
      preferences: approvedAlignment.preferences,
      observableEvents: [],
    });

    expect(report.courseAlignment?.objectives).toHaveLength(3);
    expect(report.courseAlignment?.packetTitle).toMatch(/France in 1791/);
  });
});
