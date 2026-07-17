"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import type {
  AmbientLines,
  SceneManifest,
  WorldZoneId,
} from "@/schemas/world-manifest";

import { PeriodFigure } from "../character/period-figure";

export type AmbientResidentPlacement = Readonly<{
  residentId: string;
  zoneId: WorldZoneId;
  ambientLineId: string;
  caption: string;
  basePosition: readonly [number, number, number];
  pathRadius: number;
  phase: number;
  speed: number;
}>;

export function buildAmbientResidentPlacements(
  manifest: SceneManifest,
  ambientLines: AmbientLines,
  requestedCount: number,
): AmbientResidentPlacement[] {
  if (!Number.isFinite(requestedCount) || requestedCount <= 0) return [];
  const count = Math.min(64, Math.floor(requestedCount));
  const linesById = new Map(
    ambientLines.lines.map((line) => [line.ambientLineId, line]),
  );
  const zoneEntries = manifest.zones.flatMap((zone, zoneIndex) => {
    const ambientLineId = zone.ambientLineIds[0];
    const line = linesById.get(ambientLineId);
    const safeSpawn = zone.safeSpawns[0];
    return line && safeSpawn ? [{ line, safeSpawn, zone, zoneIndex }] : [];
  });
  if (zoneEntries.length === 0) return [];

  return Array.from({ length: count }, (_, index) => {
    const entry = zoneEntries[index % zoneEntries.length];
    const cycle = Math.floor(index / zoneEntries.length);
    const side = (entry.zoneIndex + cycle) % 2 === 0 ? -1 : 1;
    return {
      residentId: `AMBIENT-RESIDENT-${String(index + 1).padStart(2, "0")}`,
      zoneId: entry.zone.zoneId,
      ambientLineId: entry.line.ambientLineId,
      caption: entry.line.text,
      basePosition: [
        entry.safeSpawn.position[0] + side * (2 + (cycle % 2) * 0.65),
        entry.safeSpawn.position[1],
        entry.safeSpawn.position[2] + (entry.zoneIndex % 2 === 0 ? 1.5 : -1.5),
      ],
      pathRadius: 0.75 + (cycle % 3) * 0.18,
      phase: entry.zoneIndex * 1.31 + cycle * 0.83,
      speed: 0.16 + (index % 4) * 0.018,
    };
  });
}

interface AmbientResidentsProps {
  ambientLines: AmbientLines;
  count: number;
  manifest: SceneManifest;
}

export function AmbientResidents({
  ambientLines,
  count,
  manifest,
}: AmbientResidentsProps) {
  const placements = buildAmbientResidentPlacements(
    manifest,
    ambientLines,
    count,
  );
  const residentRefs = useRef<Array<Group | null>>([]);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    placements.forEach((placement, index) => {
      const resident = residentRefs.current[index];
      if (!resident) return;
      const angle = elapsed * placement.speed + placement.phase;
      resident.position.set(
        placement.basePosition[0] + Math.cos(angle) * placement.pathRadius,
        placement.basePosition[1],
        placement.basePosition[2] + Math.sin(angle) * placement.pathRadius,
      );
      resident.rotation.y = -angle + Math.PI / 2;
    });
  });

  return (
    <>
      {placements.map((placement, index) => (
        <group
          key={placement.residentId}
          position={placement.basePosition}
          ref={(resident) => {
            residentRefs.current[index] = resident;
          }}
        >
          <PeriodFigure
            motion="walk"
            palette={{
              skin: index % 3 === 0 ? "#8d6852" : "#ae8569",
              coat: index % 2 === 0 ? "#4d5f58" : "#62564c",
              waistcoat: index % 2 === 0 ? "#93805e" : "#6d776c",
              breeches: "#4e4841",
              stockings: "#aaa393",
              shoes: "#292622",
              hair: index % 2 === 0 ? "#40342c" : "#594539",
              hat: "#34312c",
            }}
            scale={0.78 + (index % 3) * 0.04}
          />
        </group>
      ))}
    </>
  );
}
