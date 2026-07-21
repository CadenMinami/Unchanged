import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DISTRICT_GROUND_PRESENTATION } from "@/components/world/environment/grounded-district";

describe("grounded district material profile", () => {
  it("passes the selected graphics texture tier to every modular facade", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/grounded-district.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(/textureTier=\{profile\.textureTier\}/);
    expect(source).toMatch(/profile\.textureTier === "low"/);
    expect(source).toMatch(
      /<OptionalAssetBoundary[\s\S]*?assetId="district-facades-pbr"[\s\S]*?fallback=\{facadeFallback\}/,
    );
    expect(source).toMatch(/<Suspense fallback=\{facadeFallback\}>/);
  });

  it("uses a broad muted-earth road apron instead of a flat saturated verge", () => {
    expect(DISTRICT_GROUND_PRESENTATION).toEqual({
      color: "#514c40",
      roadRepeatZ: 2.4,
      roadWidth: 8.4,
    });
    expect(Object.isFrozen(DISTRICT_GROUND_PRESENTATION)).toBe(true);
  });

  it("does not cover the continuous road with flat zone-colored slabs", () => {
    for (const fileName of [
      "archive-zone.tsx",
      "post-road-zone.tsx",
      "civic-zone.tsx",
    ]) {
      const source = readFileSync(
        join(process.cwd(), "components/world/zones", fileName),
        "utf8",
      );
      expect(source).not.toMatch(
        /receiveShadow[\s\S]{0,80}position=\{\[[^\n]*,\s*0\.0(?:35|8),/,
      );
    }
  });
});
