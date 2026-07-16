import { describe, expect, it } from "vitest";

import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";

describe("Varennes course alignment catalog", () => {
  it("loads the complete reviewed objective and concept catalog", () => {
    const catalog = loadVarennesAlignmentCatalog();

    expect(catalog.objectives).toHaveLength(3);
    expect(catalog.concepts).toHaveLength(7);
    expect(catalog.sampleProfile.packet.processor).toBe("reviewed_sample");
    expect(catalog.sampleProfile.authority).toBe("alignment_only");
  });

  it("maps every sample profile entry to the closed catalog", () => {
    const catalog = loadVarennesAlignmentCatalog();
    const conceptIds = new Set(catalog.concepts.map((concept) => concept.id));
    const objectiveIds = new Set(catalog.objectives.map((objective) => objective.id));

    expect(
      catalog.sampleProfile.conceptMappings.every((mapping) =>
        conceptIds.has(mapping.conceptId),
      ),
    ).toBe(true);
    expect(
      catalog.sampleProfile.selectedObjectiveIds.every((id) => objectiveIds.has(id)),
    ).toBe(true);
  });
});
