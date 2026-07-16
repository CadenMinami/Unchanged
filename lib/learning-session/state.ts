import {
  LEARNING_SESSION_VERSION,
  learningSessionSchema,
  type LearningSession,
} from "@/schemas/learning-session";
import { COURSE_ALIGNMENT_VERSION } from "@/schemas/course-alignment";

export function createInitialLearningSession(
  caseId: string,
  caseVersion: string,
): LearningSession {
  return learningSessionSchema.parse({
    sessionVersion: LEARNING_SESSION_VERSION,
    catalogVersion: COURSE_ALIGNMENT_VERSION,
    caseId,
    caseVersion,
    preferences: {
      readingMode: "standard",
      motionMode: "standard",
      guidanceMode: "guided",
    },
    approvedAlignment: null,
    observableEvents: [],
  });
}
