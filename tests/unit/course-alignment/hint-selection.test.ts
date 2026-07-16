import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import {
  renderAlignedHint,
  selectInvestigationHint,
} from "@/lib/course-alignment/hint-selection";
import { loadVarennesHints } from "@/lib/course-alignment/load-hints";

const casePackage = loadVarennesCase();

describe("authored hint selection", () => {
  it("starts with a Socratic prompt and escalates from validated case state", () => {
    const hints = loadVarennesHints();
    const initial = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    expect(selectInvestigationHint(initial, hints)?.tier).toBe(1);
    expect(
      selectInvestigationHint(
        { ...initial, inspectedItemIds: ["E3", "E6B"] },
        hints,
      )?.tier,
    ).toBe(3);
  });

  it("returns no hint after the route finding is complete", () => {
    const state = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      completedComparisonIds: ["CMP-SUPPORT-E6B"],
    };

    expect(selectInvestigationHint(state, loadVarennesHints())).toBeNull();
  });

  it("uses only authored wording when adding a class-packet term", () => {
    const hint = loadVarennesHints()[1];

    expect(renderAlignedHint(hint, "reduced", "compare sources")).toContain(
      "compare sources",
    );
    expect(renderAlignedHint(hint, "reduced", "compare sources")).toContain(
      hint.reducedText,
    );
  });
});
