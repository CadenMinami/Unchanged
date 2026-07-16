import { describe, expect, it } from "vitest";

import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";
import { SCHEMATIC_PLACEMENT_LABEL } from "@/schemas/world-manifest";

const manifest = loadVarennesSceneManifest();
const ambientLines = loadVarennesAmbientLines();

describe("world manifest historical integrity", () => {
  it("labels every zone and graybox interaction as a limited schematic reconstruction", () => {
    for (const placement of [
      ...manifest.zones,
      ...manifest.interactables,
      manifest.repairPath,
    ]) {
      expect(placement.placementLabel).toBe(SCHEMATIC_PLACEMENT_LABEL);
      expect(placement.placementStatus).toBe("schematic_temporal_reconstruction");
      expect(placement.reconstructionConfidence).toBe("low");
      expect(Object.values(placement.limitations).every((value) => value.length > 0)).toBe(
        true,
      );
    }

    for (const interactable of manifest.interactables) {
      expect(interactable.presentation).toBe("graybox");
      expect(interactable.countsAsHistoricalEvidence).toBe(false);
    }
  });

  it("keeps the playable pursuit spatially schematic and non-evidentiary", () => {
    expect(manifest.repairPath.countsAsHistoricalEvidence).toBe(false);
    expect(manifest.repairPath.provenance).toBe("reconstruction");
    expect(manifest.repairPath.limitations.location).toMatch(/not historical geography/i);
    expect(manifest.repairPath.limitations.scale).toMatch(/not historical distance|not to scale/i);
    expect(manifest.repairPath.limitations.appearance).toMatch(/not historical evidence/i);
    expect(manifest.repairPath.counterfactualBoundary.label).toBe("UNKNOWN");
    expect(manifest.repairPath.counterfactualBoundary.provenance).toBe(
      "fictional_counterfactual",
    );
  });

  it("contains only approved character and static station targets", () => {
    const stationIds = manifest.interactables.flatMap((interactable) =>
      interactable.canonicalTarget.targetType === "station"
        ? [interactable.canonicalTarget.stationId]
        : [],
    );

    expect([...new Set(stationIds)].sort()).toEqual([
      "CHAR-DROUET",
      "CHAR-LOUIS",
      "STATION-ASSEMBLY",
      "STATION-VARENNES-CIVIC",
    ]);
    expect(JSON.stringify(stationIds)).not.toMatch(/Barnave/i);
  });

  it("keeps the bridge approach schematic and rejects a literal bridge-arrest claim", () => {
    const bridge = manifest.zones.find((zone) => zone.zoneId === "bridge-approach");
    if (!bridge) throw new Error("Missing bridge approach.");

    const limitations = JSON.stringify(bridge.limitations).toLowerCase();
    expect(limitations).toContain("not to scale");
    expect(limitations).toContain("does not depict the bridge as physically arresting");
    expect(limitations).toContain("exact actor");
  });

  it("keeps ambient remarks dramatized, non-evidentiary, and progression-neutral", () => {
    for (const line of ambientLines.lines) {
      expect(line.epistemicClassification).toBe("dramatization");
      expect(line.countsAsHistoricalEvidence).toBe(false);
      expect(line.affectsProgression).toBe(false);
      expect(line.evidenceIds).toEqual([]);
      expect(line.factIds).toEqual([]);
      expect(line.sourceIds).toEqual([]);
    }
  });
});
