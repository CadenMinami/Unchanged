import { describe, expect, it } from "vitest";

import { caseCommandSchema } from "@/lib/case-engine/commands";

describe("case commands", () => {
  it("keeps repair completion as the only transition into debrief", () => {
    expect(
      caseCommandSchema.safeParse({
        type: "advance_phase",
        phase: "debrief",
        commandId: "dead-path",
        expectedRevision: 0,
      }).success,
    ).toBe(false);
  });

  it("accepts only the two authored parallel local repair actions", () => {
    for (const actionId of ["RA-05-OBSTRUCTION", "RA-05-PASSPORT"]) {
      expect(
        caseCommandSchema.safeParse({
          type: "complete_repair_action",
          actionId,
          commandId: `complete-${actionId}`,
          expectedRevision: 12,
        }).success,
      ).toBe(true);
    }

    expect(
      caseCommandSchema.safeParse({
        type: "complete_repair_action",
        actionId: "RA-05-LONE-ARREST",
        commandId: "invalid-repair-action",
        expectedRevision: 12,
      }).success,
    ).toBe(false);
  });

  it("rejects an atomic repair-sequence shortcut", () => {
    expect(
      caseCommandSchema.safeParse({
        type: "review_repair_sequence",
        commandId: "bypass-repair-sequence",
        expectedRevision: 12,
      }).success,
    ).toBe(false);
  });
});
