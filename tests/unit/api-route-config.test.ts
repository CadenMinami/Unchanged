import { describe, expect, it } from "vitest";

import * as caseBriefRoute from "@/app/api/ai/case-brief-feedback/route";
import * as characterTurnRoute from "@/app/api/ai/character-turn/route";
import * as courseAlignmentRoute from "@/app/api/ai/course-alignment/route";
import * as speechRoute from "@/app/api/ai/speech/route";
import * as transcriptionRoute from "@/app/api/ai/transcribe/route";

describe("AI route deployment limits", () => {
  it.each([
    ["case brief feedback", caseBriefRoute],
    ["character turn", characterTurnRoute],
    ["course alignment", courseAlignmentRoute],
    ["speech", speechRoute],
    ["transcription", transcriptionRoute],
  ])("keeps the %s route within a bounded retry envelope", (_name, route) => {
    expect(route.runtime).toBe("nodejs");
    expect(route.maxDuration).toBe(40);
  });
});
