import { describe, expect, it } from "vitest";

import {
  resolveInvestigatorMotion,
  resolveInvestigatorMovement,
  shouldStopHorizontalVelocity,
} from "@/components/world/character/investigator-controller";

describe("investigator figure motion", () => {
  it("follows the controller's toggled run state instead of the raw Shift key", () => {
    expect(resolveInvestigatorMotion(true, true, true)).toBe("run");
    expect(resolveInvestigatorMotion(true, false, true)).toBe("walk");
    expect(resolveInvestigatorMotion(false, true, true)).toBe("idle");
    expect(resolveInvestigatorMotion(true, true, false)).toBe("idle");
  });

  it("reconciles movement keys that were already held when the controller mounted", () => {
    const heldControls = {
      forward: true,
      backward: false,
      leftward: false,
      rightward: true,
      run: true,
    };

    expect(resolveInvestigatorMovement(heldControls, true)).toEqual({
      ...heldControls,
      jump: false,
    });
    expect(resolveInvestigatorMovement(heldControls, false)).toEqual({
      forward: false,
      backward: false,
      leftward: false,
      rightward: false,
      run: false,
      jump: false,
    });
  });

  it("only cancels residual velocity after movement actually stops", () => {
    expect(shouldStopHorizontalVelocity(false, false)).toBe(false);
    expect(shouldStopHorizontalVelocity(false, true)).toBe(false);
    expect(shouldStopHorizontalVelocity(true, true)).toBe(false);
    expect(shouldStopHorizontalVelocity(true, false)).toBe(true);
  });
});
