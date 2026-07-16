import { describe, expect, it } from "vitest";

import { createInitialLearningSession } from "@/lib/learning-session/state";
import {
  restoreLearningSession,
  serializeLearningSession,
} from "@/lib/learning-session/persistence";

describe("learning session persistence", () => {
  it("round-trips accessibility preferences without requiring teacher alignment", () => {
    const session = {
      ...createInitialLearningSession("varennes", "1.0.3"),
      preferences: {
        readingMode: "reduced" as const,
        motionMode: "reduced" as const,
        guidanceMode: "guided" as const,
      },
    };

    expect(
      restoreLearningSession(serializeLearningSession(session), {
        caseId: "varennes",
        caseVersion: "1.0.3",
      }),
    ).toEqual({ session, recovered: false });
  });

  it("stores only bounded observable event codes", () => {
    const session = {
      ...createInitialLearningSession("varennes", "1.0.3"),
      observableEvents: [
        {
          eventId: "event-1",
          occurredAt: "2026-07-16T12:00:00.000Z",
          type: "hint_viewed" as const,
          subjectId: "HINT-ROUTE-01",
        },
      ],
    };
    const serialized = serializeLearningSession(session);

    expect(serialized).toContain("hint_viewed");
    expect(serialized).not.toContain("student is confused");
    expect(serialized).not.toContain("rawPacketContent");
  });

  it("fails closed when the case version changes", () => {
    const serialized = serializeLearningSession(
      createInitialLearningSession("varennes", "1.0.2"),
    );

    expect(
      restoreLearningSession(serialized, {
        caseId: "varennes",
        caseVersion: "1.0.3",
      }),
    ).toMatchObject({
      recovered: true,
      reason: "incompatible-session",
      session: null,
    });
  });
});
