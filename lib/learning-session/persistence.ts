import { z } from "zod";

import {
  LEARNING_SESSION_VERSION,
  learningSessionSchema,
  type LearningSession,
} from "@/schemas/learning-session";

export const LEARNING_SESSION_STORAGE_KEY =
  "history-unbroken:varennes:learning-session";

const learningSessionEnvelopeSchema = z
  .object({
    persistenceVersion: z.literal(LEARNING_SESSION_VERSION),
    savedAt: z.string().datetime(),
    session: learningSessionSchema,
  })
  .strict();

interface LearningSessionCompatibility {
  caseId: string;
  caseVersion: string;
}

export interface LearningSessionRestoreResult {
  session: LearningSession | null;
  recovered: boolean;
  reason?: "invalid-json" | "invalid-envelope" | "incompatible-session";
}

export function serializeLearningSession(session: LearningSession): string {
  return JSON.stringify({
    persistenceVersion: LEARNING_SESSION_VERSION,
    savedAt: new Date().toISOString(),
    session: learningSessionSchema.parse(session),
  });
}

export function restoreLearningSession(
  serialized: string,
  compatibility: LearningSessionCompatibility,
): LearningSessionRestoreResult {
  try {
    const parsed = learningSessionEnvelopeSchema.safeParse(JSON.parse(serialized));
    if (!parsed.success) {
      return { session: null, recovered: true, reason: "invalid-envelope" };
    }
    if (
      parsed.data.session.caseId !== compatibility.caseId ||
      parsed.data.session.caseVersion !== compatibility.caseVersion
    ) {
      return { session: null, recovered: true, reason: "incompatible-session" };
    }
    return { session: parsed.data.session, recovered: false };
  } catch {
    return { session: null, recovered: true, reason: "invalid-json" };
  }
}
