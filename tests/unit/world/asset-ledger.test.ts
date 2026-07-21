import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize, relative, resolve } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  loadVarennesAssetLedger,
  validateAssetLedgerClosure,
  validateAssetLedgerReferences,
  VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS,
} from "@/lib/world/asset-ledger";
import { type AssetLedger, assetLedgerSchema } from "@/schemas/asset-ledger";

type ClosureFileSnapshot = {
  path: string;
  bytes: number;
  sha256: string;
};

type ClosureProofSnapshot = {
  path: string;
  sha256: string;
};

type AssetLedgerClosureSnapshot = {
  shippedOutputs: ClosureFileSnapshot[];
  localLicenseProofs: ClosureProofSnapshot[];
  repositorySourcePaths: string[];
};

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function visitFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = join(directory, entry);
    return statSync(absolutePath).isDirectory()
      ? visitFiles(absolutePath)
      : [absolutePath];
  });
}

const APPEARANCE_SOURCE_PREFIXES = [
  "components/world/ambient/",
  "components/world/character/",
  "components/world/environment/",
  "components/world/zones/",
] as const;

function resolveRelativeModule(
  sourcePath: string,
  moduleSpecifier: string,
): string | undefined {
  if (!moduleSpecifier.startsWith(".")) return undefined;
  const unresolved = resolve(process.cwd(), dirname(sourcePath), moduleSpecifier);
  const candidates = extname(unresolved)
    ? [unresolved]
    : [
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        join(unresolved, "index.ts"),
        join(unresolved, "index.tsx"),
      ];
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) return undefined;
  return normalize(relative(process.cwd(), match)).replaceAll("\\", "/");
}

function appearanceDefiningImports(sourcePath: string): string[] {
  const source = readFileSync(join(process.cwd(), sourcePath), "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  return sourceFile.statements.flatMap((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      statement.importClause?.isTypeOnly ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      return [];
    }
    const importedPath = resolveRelativeModule(
      sourcePath,
      statement.moduleSpecifier.text,
    );
    if (
      !importedPath ||
      !APPEARANCE_SOURCE_PREFIXES.some((prefix) => importedPath.startsWith(prefix))
    ) {
      return [];
    }
    return [importedPath];
  });
}

function createCurrentFilesystemSnapshot(
  ledger: AssetLedger,
): AssetLedgerClosureSnapshot {
  const publicRoot = join(process.cwd(), "public");
  const shippedOutputs = visitFiles(join(publicRoot, "world"))
    .map((absolutePath) => {
      const bytes = readFileSync(absolutePath);
      return {
        path: absolutePath.slice(publicRoot.length).replaceAll("\\", "/"),
        bytes: bytes.byteLength,
        sha256: sha256(bytes),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const downloadedAssets = ledger.assets.filter(
    (asset) => asset.originKind === "downloaded_cc0",
  );
  const localProofPaths = new Set(
    downloadedAssets.map((asset) => asset.license.localProof.path),
  );
  const localLicenseProofs = [...localProofPaths]
    .flatMap((path) => {
      const absolutePath = join(process.cwd(), path);
      if (!existsSync(absolutePath)) return [];

      return [{ path, sha256: sha256(readFileSync(absolutePath)) }];
    })
    .sort((left, right) => left.path.localeCompare(right.path));

  const declaredRepositorySourcePaths = new Set(
    ledger.assets.flatMap((asset) =>
      asset.originKind === "repository_authored_procedural"
        ? [...asset.origin.sourcePaths, ...asset.delivery.sourcePaths]
        : [],
    ),
  );
  const repositorySourcePaths = [...declaredRepositorySourcePaths]
    .filter((path) => existsSync(join(process.cwd(), path)))
    .sort();

  return { shippedOutputs, localLicenseProofs, repositorySourcePaths };
}

function closureFixture(): {
  ledger: AssetLedger;
  snapshot: AssetLedgerClosureSnapshot;
} {
  const ledger = structuredClone(loadVarennesAssetLedger());
  return { ledger, snapshot: createCurrentFilesystemSnapshot(ledger) };
}

function closureFailure(...issues: readonly string[]): string {
  return `Asset ledger closure failed:\n${issues.map((issue) => `- ${issue}`).join("\n")}`;
}

describe("world asset ledger", () => {
  it("loads a strict, version-bound ledger", () => {
    const ledger = loadVarennesAssetLedger();

    expect(ledger).toMatchObject({
      assetLedgerVersion: "1.0.0",
      sceneManifestVersion: "1.3.0",
      caseId: "varennes",
    });
    expect(() => validateAssetLedgerReferences(ledger)).not.toThrow();
  });

  it("rejects unknown properties and malformed hashes", () => {
    const unknownProperty = structuredClone(loadVarennesAssetLedger());
    Object.assign(unknownProperty.assets[0]!, { undocumentedSource: true });
    expect(assetLedgerSchema.safeParse(unknownProperty).success).toBe(false);

    const malformedHash = structuredClone(loadVarennesAssetLedger());
    const downloadedAsset = malformedHash.assets.find(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (!downloadedAsset) throw new Error("Missing downloaded asset fixture.");
    downloadedAsset.delivery.outputs[0]!.sha256 = "not-a-sha256";
    expect(assetLedgerSchema.safeParse(malformedHash).success).toBe(false);
  });

  it("rejects duplicate shipped paths and unknown placement owners", () => {
    const duplicatePath = structuredClone(loadVarennesAssetLedger());
    const downloadedAssets = duplicatePath.assets.filter(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (downloadedAssets.length < 2) {
      throw new Error("Missing downloaded asset fixtures.");
    }
    downloadedAssets[1]!.delivery.outputs[0]!.path =
      downloadedAssets[0]!.delivery.outputs[0]!.path;
    expect(assetLedgerSchema.safeParse(duplicatePath).success).toBe(false);

    const unknownOwner = structuredClone(loadVarennesAssetLedger());
    unknownOwner.assets[0]!.uses[0]!.ownerId = "unknown-scene";
    expect(() => validateAssetLedgerReferences(unknownOwner)).toThrow(
      /unknown scene unknown-scene/i,
    );
  });

  it("rejects an unledgered shipped output", () => {
    const { ledger, snapshot } = closureFixture();
    snapshot.shippedOutputs.push({
      path: "/world/models/unledgered.glb",
      bytes: 12,
      sha256: "a".repeat(64),
    });

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        "[UNLEDGERED_OUTPUT] /world/models/unledgered.glb is shipped but not declared by the asset ledger.",
      ),
    );
  });

  it("rejects a declared output that is absent from the snapshot", () => {
    const { ledger, snapshot } = closureFixture();
    const downloadedAsset = ledger.assets.find(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (!downloadedAsset) throw new Error("Missing downloaded asset fixture.");
    const output = downloadedAsset.delivery.outputs[0]!;
    snapshot.shippedOutputs = snapshot.shippedOutputs.filter(
      (candidate) => candidate.path !== output.path,
    );

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        `[DECLARED_OUTPUT_ABSENT] ${downloadedAsset.assetId} declares ${output.path}, but the shipped output is absent.`,
      ),
    );
  });

  it("rejects shipped output byte and hash drift in stable order", () => {
    const { ledger, snapshot } = closureFixture();
    const downloadedAsset = ledger.assets.find(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (!downloadedAsset) throw new Error("Missing downloaded asset fixture.");
    const output = downloadedAsset.delivery.outputs[0]!;
    const actualOutput = snapshot.shippedOutputs.find(
      (candidate) => candidate.path === output.path,
    );
    if (!actualOutput) throw new Error("Missing shipped output fixture.");
    actualOutput.bytes += 1;
    actualOutput.sha256 = "f".repeat(64);

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        `[OUTPUT_BYTES_DRIFT] ${downloadedAsset.assetId} declares ${output.path} as ${output.bytes} bytes, but the snapshot has ${actualOutput.bytes}.`,
        `[OUTPUT_HASH_DRIFT] ${downloadedAsset.assetId} declares ${output.path} with sha256 ${output.sha256}, but the snapshot has ${actualOutput.sha256}.`,
      ),
    );
  });

  it("rejects duplicate shipped output ownership", () => {
    const { ledger, snapshot } = closureFixture();
    const downloadedAssets = ledger.assets.filter(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (downloadedAssets.length < 2) {
      throw new Error("Missing downloaded asset fixtures.");
    }
    const firstAsset = downloadedAssets[0]!;
    const secondAsset = downloadedAssets[1]!;
    const firstOutput = firstAsset.delivery.outputs[0]!;
    const secondOutput = secondAsset.delivery.outputs[0]!;
    const secondOriginalPath = secondOutput.path;
    secondOutput.path = firstOutput.path;
    secondOutput.bytes = firstOutput.bytes;
    secondOutput.sha256 = firstOutput.sha256;
    snapshot.shippedOutputs = snapshot.shippedOutputs.filter(
      (candidate) => candidate.path !== secondOriginalPath,
    );

    const owners = [firstAsset.assetId, secondAsset.assetId].sort();
    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        `[DUPLICATE_OUTPUT_OWNERSHIP] ${firstOutput.path} is declared by ${owners.join(", ")}.`,
      ),
    );
  });

  it("rejects an absent local license proof", () => {
    const { ledger, snapshot } = closureFixture();
    const downloadedAsset = ledger.assets.find(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (!downloadedAsset) throw new Error("Missing downloaded asset fixture.");
    const proofPath = downloadedAsset.license.localProof.path;
    snapshot.localLicenseProofs = snapshot.localLicenseProofs.filter(
      (proof) => proof.path !== proofPath,
    );
    const proofOwners = ledger.assets
      .filter(
        (asset) =>
          asset.originKind === "downloaded_cc0" &&
          asset.license.localProof.path === proofPath,
      )
      .map((asset) => asset.assetId)
      .sort();

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        ...proofOwners.map(
          (assetId) =>
            `[LOCAL_LICENSE_PROOF_ABSENT] ${assetId} declares ${proofPath}, but the local proof is absent.`,
        ),
      ),
    );
  });

  it("rejects stale local license proof content", () => {
    const { ledger, snapshot } = closureFixture();
    const downloadedAsset = ledger.assets.find(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    if (!downloadedAsset) throw new Error("Missing downloaded asset fixture.");
    const localProof = downloadedAsset.license.localProof;
    const actualProof = snapshot.localLicenseProofs.find(
      (proof) => proof.path === localProof.path,
    );
    if (!actualProof) throw new Error("Missing local license proof fixture.");
    actualProof.sha256 = "f".repeat(64);
    const proofOwners = ledger.assets
      .filter(
        (asset) =>
          asset.originKind === "downloaded_cc0" &&
          asset.license.localProof.path === localProof.path,
      )
      .map((asset) => asset.assetId)
      .sort();

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        ...proofOwners.map(
          (assetId) =>
            `[LOCAL_LICENSE_PROOF_HASH_DRIFT] ${assetId} declares ${localProof.path} with sha256 ${localProof.sha256}, but the snapshot has ${actualProof.sha256}.`,
        ),
      ),
    );
  });

  it("rejects a missing repository-authored source module", () => {
    const { ledger, snapshot } = closureFixture();
    const proceduralAsset = ledger.assets.find(
      (asset) => asset.originKind === "repository_authored_procedural",
    );
    if (!proceduralAsset) throw new Error("Missing procedural asset fixture.");
    const sourcePath = proceduralAsset.origin.sourcePaths[0]!;
    snapshot.repositorySourcePaths = snapshot.repositorySourcePaths.filter(
      (candidate) => candidate !== sourcePath,
    );

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).toThrowError(
      closureFailure(
        `[REPOSITORY_SOURCE_ABSENT] ${proceduralAsset.assetId} declares ${sourcePath}, but the repository source is absent.`,
      ),
    );
  });

  it("closes the current asset ledger over the current filesystem snapshot", () => {
    const { ledger, snapshot } = closureFixture();

    expect(() => validateAssetLedgerClosure(ledger, snapshot)).not.toThrow();
  });

  it("ledgers only the five accepted PBR families as byte-identical source graphs", () => {
    const acceptedAssetIds = [
      "ASSET-MATERIAL-PBR-METAL-PH",
      "ASSET-MATERIAL-PBR-PLASTER-PH",
      "ASSET-MATERIAL-PBR-ROOF-PH",
      "ASSET-MATERIAL-PBR-STONE-PH",
      "ASSET-MATERIAL-PBR-TIMBER-PH",
    ];
    const ledger = loadVarennesAssetLedger();
    const downloadedAssets = ledger.assets.filter(
      (asset) => asset.originKind === "downloaded_cc0",
    );
    const acceptedAssets = downloadedAssets
      .filter((asset) => acceptedAssetIds.includes(asset.assetId))
      .sort((left, right) => left.assetId.localeCompare(right.assetId));

    expect(acceptedAssets.map((asset) => asset.assetId)).toEqual(
      acceptedAssetIds,
    );
    expect(
      downloadedAssets.map((asset) => asset.origin.sourceUrl),
    ).not.toContain("https://polyhaven.com/a/wine_barrel_01");
    expect(
      downloadedAssets.map((asset) => asset.origin.sourceUrl),
    ).not.toContain("https://polyhaven.com/a/wooden_crate_02");

    for (const asset of acceptedAssets) {
      expect(asset.origin.originalFiles).toHaveLength(3);
      expect(asset.delivery.outputs).toHaveLength(3);
      expect(asset.modifications.steps[0]).toBe(
        "Copied the three original 1K JPG files byte-for-byte to stable runtime paths without renaming, resizing, re-encoding, recompression, color-space conversion, channel packing, or any other content modification.",
      );
      expect(
        asset.delivery.outputs.map((output) => output.path.split("/").at(-1)),
      ).toEqual(asset.origin.originalFiles.map((original) => original.name));

      for (const original of asset.origin.originalFiles) {
        const output = asset.delivery.outputs.find(
          (candidate) => candidate.path.split("/").at(-1) === original.name,
        );
        expect(output).toMatchObject({
          bytes: original.bytes,
          sha256: original.sha256,
        });
      }
    }
  });

  it("closes authored character and environment modules before runtime import", () => {
    const figureMotionPath = "components/world/character/figure-motion.ts";
    const classroomPeriodFigurePath =
      "components/world/character/classroom-period-figure.tsx";
    const periodCharacterPath = "components/world/character/period-character.tsx";
    const periodFigureResourcesPath =
      "components/world/character/period-figure-resources.ts";
    const environmentPaths = [
      "components/world/environment/archive-hero-environment.tsx",
      "components/world/environment/district-layout.ts",
      "components/world/environment/environment-dressing.tsx",
      "components/world/environment/modular-facade.tsx",
      "components/world/environment/pbr-surface-material.tsx",
      "components/world/environment/world-lighting.tsx",
      "components/world/environment/world-post-processing.tsx",
      "components/world/environment/zone-readiness-registry.tsx",
    ] as const;
    const ledger = loadVarennesAssetLedger();
    const stationAsset = ledger.assets.find(
      (asset) => asset.assetId === "ASSET-PROP-PROCEDURAL-STATIONS",
    );
    const districtAsset = ledger.assets.find(
      (asset) => asset.assetId === "ASSET-ENV-GROUNDED-DISTRICT",
    );
    if (stationAsset?.originKind !== "repository_authored_procedural") {
      throw new Error("Missing procedural station asset fixture.");
    }
    if (districtAsset?.originKind !== "repository_authored_procedural") {
      throw new Error("Missing procedural district asset fixture.");
    }
    expect(districtAsset.countsAsHistoricalEvidence).toBe(false);
    expect(districtAsset.evidenceAccess).toEqual({
      opensCountableEvidence: false,
      evidenceIds: [],
    });
    expect(districtAsset.epistemicClassification).toBe("reconstruction");
    expect(districtAsset.uses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          placementStatus: "schematic_temporal_reconstruction",
          reconstructionConfidence: "low",
        }),
      ]),
    );

    expect(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS).toContain(figureMotionPath);
    expect(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS).toContain(
      classroomPeriodFigurePath,
    );
    expect(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS).toContain(
      periodCharacterPath,
    );

    expect(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS).toContain(
      periodFigureResourcesPath,
    );
    expect(stationAsset.origin.sourcePaths).not.toContain(
      periodFigureResourcesPath,
    );
    expect(stationAsset.delivery.sourcePaths).not.toContain(
      periodFigureResourcesPath,
    );

    const castAsset = ledger.assets.find(
      (asset) => asset.assetId === "ASSET-CHAR-PROCEDURAL-CAST",
    );
    if (castAsset?.originKind !== "repository_authored_procedural") {
      throw new Error("Missing procedural cast asset fixture.");
    }
    expect(castAsset.epistemicClassification).toBe("dramatization");
    expect(castAsset.origin.sourcePaths).toContain(figureMotionPath);
    expect(castAsset.delivery.sourcePaths).toContain(figureMotionPath);
    expect(castAsset.origin.sourcePaths).toContain(classroomPeriodFigurePath);
    expect(castAsset.delivery.sourcePaths).toContain(
      classroomPeriodFigurePath,
    );
    expect(castAsset.origin.sourcePaths).toContain(periodCharacterPath);
    expect(castAsset.delivery.sourcePaths).toContain(periodCharacterPath);
    expect(castAsset.origin.sourcePaths).toContain(periodFigureResourcesPath);
    expect(castAsset.delivery.sourcePaths).toContain(periodFigureResourcesPath);

    for (const sourcePath of environmentPaths) {
      expect(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS).toContain(sourcePath);
      expect(districtAsset.origin.sourcePaths).toContain(sourcePath);
      expect(districtAsset.delivery.sourcePaths).toContain(sourcePath);
    }
  });

  it("closes appearance-defining relative imports over the authoritative source list", () => {
    const declaredPaths = new Set(VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS);
    const missingImports = VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS.flatMap(
      (sourcePath) =>
        appearanceDefiningImports(sourcePath)
          .filter((importedPath) => !declaredPaths.has(importedPath as never))
          .map((importedPath) => `${sourcePath} -> ${importedPath}`),
    );

    expect(missingImports).toEqual([]);
  });

  it("records the active PBR runtime transformations and unused metal boundary", () => {
    const ledger = loadVarennesAssetLedger();
    const activeAssetIds = [
      "ASSET-MATERIAL-PBR-PLASTER-PH",
      "ASSET-MATERIAL-PBR-STONE-PH",
      "ASSET-MATERIAL-PBR-TIMBER-PH",
      "ASSET-MATERIAL-PBR-ROOF-PH",
    ] as const;

    for (const assetId of activeAssetIds) {
      const asset = ledger.assets.find((candidate) => candidate.assetId === assetId);
      if (asset?.originKind !== "downloaded_cc0") {
        throw new Error(`Missing active PBR asset ${assetId}.`);
      }
      const runtimeRecord = [
        ...asset.uses.map((use) => `${use.purpose} ${Object.values(use.limitations).join(" ")}`),
        ...asset.modifications.steps,
      ].join(" ");
      expect(runtimeRecord).not.toMatch(/any future|future application|future use/i);
      expect(runtimeRecord).toMatch(/runtime/i);
      expect(runtimeRecord).toMatch(/tint/i);
      expect(runtimeRecord).toMatch(/repeat/i);
      expect(runtimeRecord).toMatch(/normal scale/i);
      expect(runtimeRecord).toMatch(/roughness/i);
      expect(runtimeRecord).toMatch(/historical fit.*inference/i);
    }

    const metal = ledger.assets.find(
      (candidate) => candidate.assetId === "ASSET-MATERIAL-PBR-METAL-PH",
    );
    if (metal?.originKind !== "downloaded_cc0") {
      throw new Error("Missing metal PBR asset fixture.");
    }
    expect(
      [
        ...metal.uses.map((use) => use.purpose),
        ...metal.modifications.steps,
      ].join(" "),
    ).toMatch(/not (?:imported|applied).*current runtime/i);
  });

  it("bounds the Qwantani dusk HDRI to reconstruction-only rich-profile lighting", () => {
    const ledger = loadVarennesAssetLedger();
    const hdri = ledger.assets.find(
      (asset) => asset.assetId === "ASSET-LIGHTING-QWANTANI-DUSK-2-PURESKY-PH",
    );
    if (hdri?.originKind !== "downloaded_cc0") {
      throw new Error("Missing Qwantani dusk HDRI fixture.");
    }

    expect(hdri).toMatchObject({
      category: "lighting",
      epistemicClassification: "reconstruction",
      historicalBasis: { basisType: "none" },
      countsAsHistoricalEvidence: false,
      license: { spdxId: "CC0-1.0" },
    });
    expect(hdri.delivery.outputs).toEqual([
      expect.objectContaining({
        path: "/world/hdris/qwantani-dusk-2-puresky/qwantani_dusk_2_puresky_1k.hdr",
        bytes: 1_166_018,
        sha256: "56dc9cb681f2641c08377e20e83fa5e4865fd900bcce26a15a1883580139b5e2",
      }),
    ]);
    expect(hdri.uses.map((use) => use.ownerId).sort()).toEqual([
      "archive-antechamber",
      "post-road-square",
      "royal-lodging-civic-area",
    ]);
    expect(JSON.stringify(hdri)).toMatch(/High and Balanced/);
    expect(JSON.stringify(hdri)).toMatch(/Classroom does not load/);
    expect(JSON.stringify(hdri)).toMatch(/editorial inference/i);

    const selectionRecord = readFileSync(
      join(process.cwd(), "docs/WORLD_ASSET_SELECTION.md"),
      "utf8",
    );
    expect(selectionRecord).toMatch(/Qwantani Dusk 2 Pure Sky/i);
    expect(selectionRecord).toMatch(/High and Balanced.*Classroom/s);
    expect(selectionRecord).toMatch(/historical fit.*editorial inference/is);
  });
});
