import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import {
  loadVarennesAssetLedger,
  validateAssetLedgerReferences,
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
const casePackage = loadVarennesCase();

const AMBIENT_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "before",
  "beyond",
  "for",
  "in",
  "is",
  "not",
  "of",
  "or",
  "the",
  "to",
  "with",
]);

function historicalTerms(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((term) => term.length > 3 && !AMBIENT_STOP_WORDS.has(term)),
  );
}

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

  it("keeps the final-zone topology schematic without depicting a physical site plan", () => {
    const bridge = manifest.zones.find((zone) => zone.zoneId === "bridge-approach");
    if (!bridge) throw new Error("Missing bridge approach.");

    const limitations = JSON.stringify(bridge.limitations).toLowerCase();
    expect(bridge.label).toBe("Final reconstruction boundary");
    expect(limitations).toContain("not to scale");
    expect(bridge.limitations.appearance).toBe(
      "No span, deck, rail, arch, water, barrier form, vehicle position, or physical-arrest tableau is depicted.",
    );
    expect(limitations).toContain("contested attribution");
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

  it("keeps unsourced ambient prose semantically separate from sourced facts", () => {
    for (const line of ambientLines.lines) {
      const ambientTerms = historicalTerms(line.text);
      for (const fact of casePackage.facts) {
        if (fact.sourceIds.length === 0) continue;
        const overlap = [...historicalTerms(fact.claim)].filter((term) =>
          ambientTerms.has(term),
        );
        expect(
          overlap.length,
          `${line.ambientLineId} duplicates sourced terms from ${fact.id}: ${overlap.join(", ")}`,
        ).toBeLessThan(4);
      }
    }
  });

  it("separates dramatized cast figures from reconstructed station props", () => {
    const cast = assetLedger.assets.find(
      (asset) => asset.assetId === "ASSET-CHAR-PROCEDURAL-CAST",
    );
    const stations = assetLedger.assets.find(
      (asset) => asset.assetId === "ASSET-PROP-PROCEDURAL-STATIONS",
    );

    expect(cast).toMatchObject({
      category: "character",
      epistemicClassification: "dramatization",
      countsAsHistoricalEvidence: false,
    });
    expect(stations).toMatchObject({
      category: "prop",
      epistemicClassification: "reconstruction",
      countsAsHistoricalEvidence: false,
    });

    for (const characterId of ["CHAR-DROUET", "CHAR-LOUIS"]) {
      const interactable = manifest.interactables.find(
        (candidate) =>
          candidate.canonicalTarget.targetType === "station" &&
          candidate.canonicalTarget.stationId === characterId,
      ) as (typeof manifest.interactables)[number] & {
        assetReferences?: Array<{ assetId: string }>;
      };
      expect(interactable?.assetReferences?.map(({ assetId }) => assetId)).toContain(
        "ASSET-CHAR-PROCEDURAL-CAST",
      );
    }
  });

  it("resolves every versioned manifest asset reference through its ledger license", () => {
    const references = [...manifest.zones, ...manifest.interactables].flatMap(
      (owner) =>
        (
          owner as typeof owner & {
            assetReferences?: Array<{
              assetId: string;
              assetLedgerVersion: string;
              licenseReference: string;
            }>;
          }
        ).assetReferences ?? [],
    );
    const ledgerById = new Map(
      assetLedger.assets.map((asset) => [asset.assetId, asset]),
    );

    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.assetLedgerVersion).toBe(assetLedger.assetLedgerVersion);
      expect(reference.licenseReference).toBe("asset_ledger");
      expect(ledgerById.get(reference.assetId)?.license).toBeDefined();
    }

    const invalidManifest = structuredClone(manifest) as typeof manifest & {
      zones: Array<
        (typeof manifest.zones)[number] & {
          assetReferences: Array<{
            assetId: string;
            assetLedgerVersion: string;
            licenseReference: "asset_ledger";
          }>;
        }
      >;
    };
    invalidManifest.zones[0]!.assetReferences[0]!.assetId = "ASSET-UNKNOWN";
    const validateWithManifest = validateAssetLedgerReferences as unknown as (
      ledger: typeof assetLedger,
      candidateManifest: typeof manifest,
    ) => void;
    expect(() => validateWithManifest(assetLedger, invalidManifest)).toThrow(
      /ASSET-UNKNOWN/i,
    );
  });
});
