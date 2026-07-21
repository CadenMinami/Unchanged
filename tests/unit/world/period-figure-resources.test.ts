import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  PERIOD_FIGURE_GEOMETRIES,
} from "@/components/world/character/period-figure-resources";

describe("period figure resources", () => {
  it("reuses one geometry registry across every figure", () => {
    expect(PERIOD_FIGURE_GEOMETRIES.upperLeg).toBe(
      PERIOD_FIGURE_GEOMETRIES.upperLeg,
    );
    expect(PERIOD_FIGURE_GEOMETRIES.head).toBe(
      PERIOD_FIGURE_GEOMETRIES.head,
    );
    expect(Object.values(PERIOD_FIGURE_GEOMETRIES).every((geometry) => geometry.isBufferGeometry)).toBe(
      true,
    );
  });

  it("keeps material attachment in the rendered component lifecycle", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/world/character/period-figure.tsx",
      ),
      "utf8",
    );

    expect(source.match(/<meshStandardMaterial\b/g) ?? []).not.toHaveLength(0);
    expect(source).not.toContain("material={materials.");
  });

  it("retains shared figure resources instead of allowing renderer disposal", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "components/world/character/period-figure.tsx",
      ),
      "utf8",
    );
    const meshes = source.match(/<mesh\b/g) ?? [];
    const nonDisposingMeshes = source.match(/<mesh\b[^>]*dispose=\{null\}/g) ?? [];

    expect(meshes.length).toBeGreaterThan(0);
    expect(nonDisposingMeshes).toHaveLength(meshes.length);
  });
});
