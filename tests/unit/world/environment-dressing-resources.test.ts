import { describe, expect, it } from "vitest";

import {
  ENVIRONMENT_DRESSING_GEOMETRIES,
  ENVIRONMENT_DRESSING_MATERIALS,
} from "@/components/world/environment/environment-dressing";

describe("environment dressing resources", () => {
  it("owns one immutable shared registry instead of allocating per item", () => {
    expect(Object.isFrozen(ENVIRONMENT_DRESSING_GEOMETRIES)).toBe(true);
    expect(Object.isFrozen(ENVIRONMENT_DRESSING_MATERIALS)).toBe(true);
    expect(Object.values(ENVIRONMENT_DRESSING_GEOMETRIES)).toHaveLength(9);
    expect(Object.values(ENVIRONMENT_DRESSING_MATERIALS)).toHaveLength(8);
    expect(
      Object.values(ENVIRONMENT_DRESSING_GEOMETRIES).every(
        (geometry) => geometry.isBufferGeometry,
      ),
    ).toBe(true);
    expect(
      Object.values(ENVIRONMENT_DRESSING_MATERIALS).every(
        (material) => material.isMaterial,
      ),
    ).toBe(true);
  });
});
