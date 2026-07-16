import { z } from "zod";

import {
  COURSE_ALIGNMENT_VERSION,
  approvedCourseAlignmentSchema,
  learningPreferencesSchema,
} from "@/schemas/course-alignment";

export const LEARNING_SESSION_VERSION = "1.0.0" as const;

export const observableLearningEventSchema = z
  .object({
    eventId: z.string().trim().min(1).max(80),
    occurredAt: z.string().datetime(),
    type: z.enum([
      "hint_viewed",
      "evidence_inspected",
      "evidence_pinned",
      "comparison_recorded",
      "case_brief_submitted",
      "formative_feedback_received",
    ]),
    subjectId: z.string().trim().min(1).max(80),
  })
  .strict();

export const learningSessionSchema = z
  .object({
    sessionVersion: z.literal(LEARNING_SESSION_VERSION),
    catalogVersion: z.literal(COURSE_ALIGNMENT_VERSION),
    caseId: z.string().trim().min(1).max(64),
    caseVersion: z.string().trim().min(1).max(32),
    preferences: learningPreferencesSchema,
    approvedAlignment: approvedCourseAlignmentSchema.nullable(),
    observableEvents: z.array(observableLearningEventSchema).max(256),
  })
  .strict();

export type ObservableLearningEvent = z.infer<typeof observableLearningEventSchema>;
export type LearningSession = z.infer<typeof learningSessionSchema>;
