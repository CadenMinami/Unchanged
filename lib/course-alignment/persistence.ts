import { z } from "zod";

import {
  COURSE_ALIGNMENT_VERSION,
  approvedCourseAlignmentSchema,
  type ApprovedCourseAlignment,
} from "@/schemas/course-alignment";

export const COURSE_ALIGNMENT_STORAGE_KEY =
  "history-unbroken:varennes:course-alignment";

const courseAlignmentEnvelopeSchema = z
  .object({
    persistenceVersion: z.literal("1.0.0"),
    caseId: z.string().min(1),
    caseVersion: z.string().min(1),
    catalogVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    alignment: approvedCourseAlignmentSchema,
  })
  .strict();

export interface CourseAlignmentCompatibility {
  caseId: string;
  caseVersion: string;
}

export interface CourseAlignmentRestoreResult {
  alignment: ApprovedCourseAlignment | null;
  recovered: boolean;
  reason?: "invalid-json" | "invalid-envelope" | "incompatible-alignment";
}

export function serializeApprovedCourseAlignment(
  alignment: ApprovedCourseAlignment,
  caseVersion: string,
): string {
  return JSON.stringify({
    persistenceVersion: "1.0.0",
    caseId: alignment.profile.caseId,
    caseVersion,
    catalogVersion: alignment.profile.catalogVersion,
    alignment,
  });
}

export function restoreApprovedCourseAlignment(
  serialized: string,
  compatibility: CourseAlignmentCompatibility,
): CourseAlignmentRestoreResult {
  try {
    const parsed = courseAlignmentEnvelopeSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success) {
      return { alignment: null, recovered: true, reason: "invalid-envelope" };
    }

    if (
      parsed.data.caseId !== compatibility.caseId ||
      parsed.data.caseVersion !== compatibility.caseVersion ||
      parsed.data.alignment.profile.caseId !== compatibility.caseId
    ) {
      return { alignment: null, recovered: true, reason: "incompatible-alignment" };
    }

    return { alignment: parsed.data.alignment, recovered: false };
  } catch {
    return { alignment: null, recovered: true, reason: "invalid-json" };
  }
}
