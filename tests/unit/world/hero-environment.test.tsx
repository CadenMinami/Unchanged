import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ARCHIVE_HERO_CLEARANCES,
  ARCHIVE_HERO_DRESSING_SOCKETS,
  selectArchiveDressingSockets,
} from "@/components/world/environment/archive-hero-environment";

describe("archive hero environment", () => {
  it("bounds decorative density without changing socket order", () => {
    const high = selectArchiveDressingSockets("high");
    const medium = selectArchiveDressingSockets("medium");
    const low = selectArchiveDressingSockets("low");

    expect(high).toHaveLength(6);
    expect(medium).toHaveLength(4);
    expect(low).toHaveLength(2);
    expect(medium.map(({ id }) => id)).toEqual(
      high.filter(({ minimumDensity }) => minimumDensity !== "high").map(({ id }) => id),
    );
    expect(low.map(({ id }) => id)).toEqual(
      high.filter(({ minimumDensity }) => minimumDensity === "low").map(({ id }) => id),
    );
  });

  it("keeps every decorative socket outside authored interaction clearances", () => {
    for (const socket of ARCHIVE_HERO_DRESSING_SOCKETS) {
      for (const clearance of ARCHIVE_HERO_CLEARANCES) {
        const distance = Math.hypot(
          socket.position[0] - clearance.position[0],
          socket.position[2] - clearance.position[2],
        );
        expect(
          distance,
          `${socket.id} intrudes into ${clearance.id}`,
        ).toBeGreaterThanOrEqual(socket.radius + clearance.radius);
      }
    }
  });

  it("adds depth cues but imports no gameplay or historical authority", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/archive-hero-environment.tsx",
      ),
      "utf8",
    );

    expect(source).toContain("export function ArchiveHeroEnvironment");
    expect(source).toMatch(/recessed-opening/);
    expect(source).toMatch(/layered-signage/);
    expect(source).toMatch(/street-edge-detail/);
    expect(source).not.toMatch(
      /useCaseSession|issue\(|canonicalTarget|evidenceId|interactionType|RigidBody|Collider/,
    );
  });

  it("mounts the ledgered hero assembly from the archive zone", () => {
    const source = readFileSync(
      join(process.cwd(), "components/world/zones/archive-zone.tsx"),
      "utf8",
    );

    expect(source).toMatch(/<ArchiveHeroEnvironment/);
    expect(source).toMatch(/density=\{profile\.environmentDensity\}/);
  });
});
