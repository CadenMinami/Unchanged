import { describe, expect, it } from "vitest";

import factsJson from "@/data/cases/varennes/facts.json";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";

const forbiddenAuthorityKeys = new Set([
  "evidenceIds",
  "requiredEvidenceIds",
  "requiredCausalNodeIds",
  "requiredCausalEdgeIds",
  "repairRequirements",
  "score",
  "winCondition",
]);

function collectKeys(value: unknown, keys: Set<string>): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeys(entry, keys));
    return;
  }
  if (!value || typeof value !== "object") return;

  Object.entries(value).forEach(([key, entry]) => {
    keys.add(key);
    collectKeys(entry, keys);
  });
}

describe("course material authority boundary", () => {
  it("links reviewed concepts only to existing atomic facts", () => {
    const catalog = loadVarennesAlignmentCatalog();
    const factIds = new Set(factsJson.map((fact) => fact.id));

    expect(
      catalog.concepts.every((concept) =>
        concept.caseFactIds.every((factId) => factIds.has(factId)),
      ),
    ).toBe(true);
  });

  it("cannot encode evidence, scoring, repair, or win-condition authority", () => {
    const catalog = loadVarennesAlignmentCatalog();
    const keys = new Set<string>();
    collectKeys(catalog.sampleProfile, keys);

    expect([...forbiddenAuthorityKeys].filter((key) => keys.has(key))).toEqual([]);
    expect(catalog.sampleProfile.mutatesCaseState).toBe(false);
  });

  it("copies sample terms and excerpts exactly from authored packet segments", () => {
    const catalog = loadVarennesAlignmentCatalog();
    const segments = new Map(
      catalog.samplePacket.sections.map((section) => [section.segmentId, section]),
    );

    expect(
      catalog.sampleProfile.conceptMappings.every((mapping) => {
        const segment = segments.get(mapping.segmentId);
        return Boolean(
          segment &&
            segment.referenceLabel === mapping.referenceLabel &&
            segment.text.includes(mapping.packetTerm) &&
            segment.text.includes(mapping.excerpt),
        );
      }),
    ).toBe(true);
  });
});
