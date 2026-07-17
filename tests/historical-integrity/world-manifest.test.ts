import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  loadVarennesAssetLedger,
  VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS,
} from "@/lib/world/asset-ledger";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";
import { SCHEMATIC_PLACEMENT_LABEL } from "@/schemas/world-manifest";

const manifest = loadVarennesSceneManifest();
const ambientLines = loadVarennesAmbientLines();
const assetLedger = loadVarennesAssetLedger();

describe("world manifest historical integrity", () => {
  it("tracks every visual or audio asset in a strict non-evidentiary ledger", () => {
    const ledgerPath = join(
      process.cwd(),
      "data/cases/varennes/world/asset-ledger.json",
    );

    expect(existsSync(ledgerPath)).toBe(true);

    const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
      assets: Array<{ assetId: string }>;
    };

    expect(ledger.assets.length).toBeGreaterThan(0);
    for (const asset of ledger.assets) {
      expect(asset.assetId).toMatch(/^ASSET-/);
    }

    expect(assetLedger.caseId).toBe(manifest.caseId);
    expect(assetLedger.caseVersion).toBe(manifest.caseVersion);
    expect(assetLedger.assets.map((asset) => asset.assetId)).toEqual(
      ledger.assets.map((asset) => asset.assetId),
    );
  });

  it("closes the asset ledger over every shipped world file with exact hashes", () => {
    expect(assetLedger.sceneManifestVersion).toBe(manifest.sceneManifestVersion);

    const publicWorldRoot = join(process.cwd(), "public/world");
    const visit = (directory: string): string[] =>
      readdirSync(directory).flatMap((entry) => {
        const absolutePath = join(directory, entry);
        return statSync(absolutePath).isDirectory()
          ? visit(absolutePath)
          : [absolutePath];
      });
    const shippedPaths = visit(publicWorldRoot)
      .map((absolutePath) =>
        absolutePath.slice(join(process.cwd(), "public").length).replaceAll("\\", "/"),
      )
      .sort();
    const downloadedAssets = assetLedger.assets.filter(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    const declaredPaths = downloadedAssets
      .flatMap((asset) => asset.delivery.outputs.map((output) => output.path))
      .sort();

    expect(declaredPaths).toEqual(shippedPaths);

    for (const asset of downloadedAssets) {
      expect(asset.license.spdxId).toBe("CC0-1.0");
      expect(asset.license.commercialUseAllowed).toBe(true);
      expect(asset.license.modificationAllowed).toBe(true);
      expect(asset.license.redistributionAllowed).toBe(true);
      expect(asset.origin.originalFiles.length).toBeGreaterThan(0);
      expect(asset.modifications.steps.length).toBeGreaterThan(0);

      const localProof = readFileSync(join(process.cwd(), asset.license.localProof.path));
      expect(createHash("sha256").update(localProof).digest("hex")).toBe(
        asset.license.localProof.sha256,
      );

      for (const output of asset.delivery.outputs) {
        const bytes = readFileSync(join(process.cwd(), "public", output.path));
        expect(bytes.byteLength).toBe(output.bytes);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(output.sha256);
      }
    }

    for (const asset of assetLedger.assets) {
      expect(asset.countsAsHistoricalEvidence).toBe(false);
      expect(asset.uses.length).toBeGreaterThan(0);
      expect(asset.evidenceAccess.opensCountableEvidence).toBe(false);
      expect(asset.evidenceAccess.evidenceIds).toEqual([]);
      for (const use of asset.uses) {
        expect(use.limitations.location.length).toBeGreaterThan(0);
        expect(use.limitations.ownership.length).toBeGreaterThan(0);
        expect(use.limitations.scale.length).toBeGreaterThan(0);
        expect(use.limitations.appearance.length).toBeGreaterThan(0);
      }

      if (asset.originKind === "repository_authored_procedural") {
        const declaredSourcePaths = new Set([
          ...asset.origin.sourcePaths,
          ...asset.delivery.sourcePaths,
        ]);
        for (const sourcePath of declaredSourcePaths) {
          expect(existsSync(join(process.cwd(), sourcePath))).toBe(true);
        }
      }
    }

    const declaredProceduralPaths = new Set(
      assetLedger.assets.flatMap((asset) =>
        asset.originKind === "repository_authored_procedural"
          ? [...asset.origin.sourcePaths, ...asset.delivery.sourcePaths]
          : [],
      ),
    );
    expect([...declaredProceduralPaths].sort()).toEqual(
      [...VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS].sort(),
    );
  });

  it("labels every zone and grounded interaction as a limited schematic reconstruction", () => {
    expect(JSON.stringify(manifest.zones)).not.toMatch(/graybox/i);

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
      expect(interactable.presentation).toBe("grounded_reconstruction");
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
