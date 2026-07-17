import { describe, expect, it } from "vitest";

import { resolveInvestigatorMotion } from "@/components/world/character/investigator-controller";

describe("investigator figure motion", () => {
  it("follows the controller's toggled run state instead of the raw Shift key", () => {
    expect(resolveInvestigatorMotion(true, true, true)).toBe("run");
    expect(resolveInvestigatorMotion(true, false, true)).toBe("walk");
    expect(resolveInvestigatorMotion(false, true, true)).toBe("idle");
    expect(resolveInvestigatorMotion(true, true, false)).toBe("idle");
  });
});
