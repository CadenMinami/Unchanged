import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  DISTRICT_DRESSING_FINAL_ZONE_MIN_X,
  DISTRICT_DRESSING_MESH_BUDGET,
  DISTRICT_DRESSING_PLACEMENTS,
  DISTRICT_DRESSING_PRINCIPAL_PATH_HALF_WIDTH,
  DISTRICT_FACADE_FAMILIES,
  DISTRICT_FACADE_PLACEMENTS,
  DISTRICT_TRAVEL_CLEARANCE,
  getDistrictDressingFootprintRadius,
  getDistrictDressingMeshCount,
  selectDistrictDressingPlacements,
  selectDistrictFacadePlacements,
} from "@/components/world/environment/district-layout";
import { ARCHIVE_CANDIDATES } from "@/components/world/zones/archive-zone";
import { BRIDGE_CANDIDATES } from "@/components/world/zones/bridge-zone";
import { CIVIC_CANDIDATES } from "@/components/world/zones/civic-zone";
import { POST_ROAD_CANDIDATES } from "@/components/world/zones/post-road-zone";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";

describe("district presentation layout", () => {
  it("defines five reusable facade families with stable placement ids", () => {
    expect(DISTRICT_FACADE_FAMILIES).toEqual([
      "plaster-gable",
      "timber-front",
      "stone-civic",
      "narrow-row",
      "shopfront",
    ]);
    expect(new Set(DISTRICT_FACADE_PLACEMENTS.map(({ id }) => id)).size).toBe(
      DISTRICT_FACADE_PLACEMENTS.length,
    );
    expect(
      new Set(DISTRICT_FACADE_PLACEMENTS.map(({ family }) => family)),
    ).toEqual(new Set(DISTRICT_FACADE_FAMILIES));
  });

  it("keeps facade counts deterministic and bounded by visual density", () => {
    const high = selectDistrictFacadePlacements("high");
    const medium = selectDistrictFacadePlacements("medium");
    const low = selectDistrictFacadePlacements("low");

    expect(high).toHaveLength(11);
    expect(medium).toHaveLength(9);
    expect(low).toHaveLength(7);
    expect(medium.map(({ id }) => id)).toEqual(
      high.filter(({ minimumDensity }) => minimumDensity !== "high").map(({ id }) => id),
    );
    expect(low.map(({ id }) => id)).toEqual(
      high.filter(({ minimumDensity }) => minimumDensity === "low").map(({ id }) => id),
    );
  });

  it("preserves a clear continuous route around every facade extent", () => {
    for (const placement of DISTRICT_FACADE_PLACEMENTS) {
      const halfDepth = placement.size[2] / 2;
      const facadeNearEdge = Math.max(
        placement.position[2] - halfDepth,
        -(placement.position[2] + halfDepth),
      );
      expect(
        facadeNearEdge,
        `${placement.id} intrudes into the authored travel corridor`,
      ).toBeGreaterThanOrEqual(DISTRICT_TRAVEL_CLEARANCE.halfWidth);
    }
  });

  it("does not embed collision, evidence, interaction, or canonical state", () => {
    const serialized = JSON.stringify({
      families: DISTRICT_FACADE_FAMILIES,
      placements: DISTRICT_FACADE_PLACEMENTS,
      travelClearance: DISTRICT_TRAVEL_CLEARANCE,
    });

    expect(serialized).not.toMatch(
      /collider|canonicalTarget|evidenceId|interactionType|safeSpawn/i,
    );
  });

  it("leaves the four authored safe spawns at their canonical coordinates", () => {
    const manifest = loadVarennesSceneManifest();
    expect(
      manifest.zones.flatMap((zone) =>
        zone.safeSpawns.map(({ spawnId, position }) => ({ spawnId, position })),
      ),
    ).toEqual([
      { spawnId: "SPAWN-ARCHIVE-ENTRY", position: [0, 0, 0] },
      { spawnId: "SPAWN-POST-ROAD-ENTRY", position: [24, 0, 0] },
      { spawnId: "SPAWN-CIVIC-ENTRY", position: [48, 0, 0] },
      { spawnId: "SPAWN-BRIDGE-ENTRY", position: [72, 0, 0] },
    ]);
  });

  it("keeps the modular facade presentation-only while adding architectural depth", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/modular-facade.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("export function ModularFacade");
    expect(source).toMatch(/recessed-window/);
    expect(source).toMatch(/facade-door/);
    expect(source).toMatch(/timber-beam/);
    expect(source).toMatch(/stone-course/);
    expect(source).toMatch(/shop-canopy/);
    expect(source).not.toMatch(
      /RigidBody|Collider|useCaseSession|canonicalTarget|evidenceId|interactionType/,
    );
  });

  it("routes the live district through the profile-bounded facade assembly", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/grounded-district.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(
      /selectDistrictFacadePlacements\(\s*profile\.environmentDensity,?\s*\)/,
    );
    expect(source).toMatch(/<ModularFacade/);
    expect(source).not.toMatch(/function GabledBuilding/);
  });

  it("selects deterministic dressing with High > Balanced > Classroom density", () => {
    const high = selectDistrictDressingPlacements("high", false);
    const balanced = selectDistrictDressingPlacements("medium", false);
    const classroom = selectDistrictDressingPlacements("low", false);

    expect(high).toHaveLength(16);
    expect(balanced).toHaveLength(11);
    expect(classroom).toHaveLength(6);
    expect(selectDistrictDressingPlacements("high", false)).toEqual(high);
    expect(new Set(high.map(({ id }) => id)).size).toBe(high.length);
    expect(balanced.map(({ id }) => id)).toEqual(
      high
        .filter(({ minimumDensity }) => minimumDensity !== "high")
        .map(({ id }) => id),
    );
    expect(classroom.map(({ id }) => id)).toEqual(
      high
        .filter(({ minimumDensity }) => minimumDensity === "low")
        .map(({ id }) => id),
    );
  });

  it("keeps dressing outside spawn, interaction, walking, and final-zone clearances", () => {
    const manifest = loadVarennesSceneManifest();
    const safeSpawns = manifest.zones.flatMap((zone) => zone.safeSpawns);
    const interactions = [
      ...ARCHIVE_CANDIDATES,
      ...POST_ROAD_CANDIDATES,
      ...CIVIC_CANDIDATES,
      ...BRIDGE_CANDIDATES,
    ];

    for (const placement of DISTRICT_DRESSING_PLACEMENTS) {
      const [x, , z] = placement.position;
      expect(
        placement.clearanceRadius,
        `${placement.id} understates its transformed mesh footprint`,
      ).toBeGreaterThanOrEqual(getDistrictDressingFootprintRadius(placement));
      expect(
        Math.abs(z) - placement.clearanceRadius,
        `${placement.id} intrudes into the principal walking corridor`,
      ).toBeGreaterThanOrEqual(
        DISTRICT_DRESSING_PRINCIPAL_PATH_HALF_WIDTH,
      );
      expect(
        x + placement.clearanceRadius,
        `${placement.id} enters the source-safe final-zone exclusion`,
      ).toBeLessThan(DISTRICT_DRESSING_FINAL_ZONE_MIN_X);

      for (const spawn of safeSpawns) {
        const distance = Math.hypot(
          x - spawn.position[0],
          z - spawn.position[2],
        );
        expect(
          distance,
          `${placement.id} obstructs ${spawn.spawnId}`,
        ).toBeGreaterThanOrEqual(4 + placement.clearanceRadius);
      }

      for (const interaction of interactions) {
        const distance = Math.hypot(
          x - interaction.position[0],
          z - interaction.position[2],
        );
        expect(
          distance,
          `${placement.id} obstructs ${interaction.candidateId}`,
        ).toBeGreaterThanOrEqual(3.1 + placement.clearanceRadius);
      }
    }
  });

  it("attaches every extra window interior to a facade available at the same density", () => {
    const densityRank = { low: 0, medium: 1, high: 2 } as const;
    const windows = DISTRICT_DRESSING_PLACEMENTS.filter(
      ({ kind }) => kind === "window-interior",
    );

    expect(windows.length).toBeGreaterThan(0);
    for (const window of windows) {
      expect(window.hostFacadeId).toBeTruthy();
      const facade = DISTRICT_FACADE_PLACEMENTS.find(
        ({ id }) => id === window.hostFacadeId,
      );
      expect(facade, `${window.id} names a missing host facade`).toBeDefined();
      expect(densityRank[facade!.minimumDensity]).toBeLessThanOrEqual(
        densityRank[window.minimumDensity],
      );

      const roadFaceZ =
        facade!.position[2] > 0
          ? facade!.position[2] - facade!.size[2] / 2 - 0.09
          : facade!.position[2] + facade!.size[2] / 2 + 0.09;
      expect(Math.abs(window.position[2] - roadFaceZ)).toBeLessThanOrEqual(0.08);
      expect(Math.abs(window.position[0] - facade!.position[0])).toBeLessThan(
        facade!.size[0] / 2,
      );
      expect(window.position[1]).toBeGreaterThan(0.5);
      expect(window.position[1]).toBeLessThan(facade!.size[1] + 0.5);
    }
  });

  it("keeps profile draw counts inside the authored shared-resource budget", () => {
    for (const [density, budget] of Object.entries(
      DISTRICT_DRESSING_MESH_BUDGET,
    ) as Array<["high" | "medium" | "low", number]>) {
      const meshCount = selectDistrictDressingPlacements(density, false).reduce(
        (total, placement) => total + getDistrictDressingMeshCount(placement.kind),
        0,
      );
      expect(meshCount).toBeLessThanOrEqual(budget);
    }
  });

  it("removes motion-sensitive dressing before reduced-motion rendering", () => {
    const standard = selectDistrictDressingPlacements("high", false);
    const reduced = selectDistrictDressingPlacements("high", true);

    expect(standard.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "post-road-swaying-shrub",
        "post-road-chimney-smoke",
      ]),
    );
    expect(reduced.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining([
        "post-road-swaying-shrub",
        "post-road-chimney-smoke",
      ]),
    );

    expect(standard.some(({ motionSensitive }) => motionSensitive)).toBe(true);
    expect(reduced).toEqual(
      standard.filter(({ motionSensitive }) => !motionSensitive),
    );
    expect(reduced.every(({ motionSensitive }) => !motionSensitive)).toBe(true);
  });

  it("keeps environmental dressing presentation-only and noninteractive", () => {
    expect(
      DISTRICT_DRESSING_PLACEMENTS.every(
        ({ countsAsHistoricalEvidence, presentationOnly }) =>
          presentationOnly && !countsAsHistoricalEvidence,
      ),
    ).toBe(true);

    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/environment-dressing.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("export function EnvironmentDressing");
    expect(source).not.toMatch(
      /Interactable|useCaseSession|canonicalTarget|evidenceId|interactionType|onClick|onPointer/,
    );
  });

  it("keeps district lanterns and dressing out of the E5 final-zone exclusion", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/grounded-district.tsx",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/\[72,\s*0,\s*-?3\.25\]/);
    expect(
      DISTRICT_DRESSING_PLACEMENTS.every(
        ({ clearanceRadius, position }) =>
          position[0] + clearanceRadius < DISTRICT_DRESSING_FINAL_ZONE_MIN_X,
      ),
    ).toBe(true);
  });
});
