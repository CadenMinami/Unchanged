import { describe, expect, it } from "vitest";

import { getCaseResumeRoute } from "@/lib/case-engine/navigation";
import type { CaseState } from "@/schemas/case-state";

describe("case resume navigation", () => {
  it.each<[CaseState["phase"], string]>([
    ["primer", "/play"],
    ["fracture", "/play"],
    ["investigation", "/play"],
    ["case_brief", "/play/caseboard"],
    ["repair", "/play/repair"],
    ["debrief", "/play/debrief"],
  ])("maps the %s phase to %s", (phase, expectedRoute) => {
    expect(getCaseResumeRoute({ phase })).toBe(expectedRoute);
  });
});
