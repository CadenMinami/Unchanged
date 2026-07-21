import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  BRIDGE_CANDIDATES,
  BRIDGE_E5_CANDIDATE,
} from "@/components/world/zones/bridge-zone";
import { buildAmbientResidentPlacements } from "@/components/world/ambient/ambient-residents";
import {
  DISTRICT_DRESSING_FINAL_ZONE_MIN_X,
  DISTRICT_DRESSING_PLACEMENTS,
  DISTRICT_FACADE_PLACEMENTS,
} from "@/components/world/environment/district-layout";
import { DISTRICT_GROUND_PRESENTATION } from "@/components/world/environment/grounded-district";
import { selectWorldLightingConfig } from "@/components/world/environment/world-lighting";
import { GRAPHICS_PROFILES } from "@/lib/world/graphics-profile";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";

const EXPECTED_ZONE_LABEL = "Final reconstruction boundary";
const EXPECTED_AMBIENT_CAPTION =
  "The marked boundary closes this schematic teaching district.";
const EXPECTED_APPEARANCE_LIMITATION =
  "No span, deck, rail, arch, water, barrier form, vehicle position, or physical-arrest tableau is depicted.";

function readSource(relativePath: string): {
  sourceFile: ts.SourceFile;
  text: string;
} {
  const text = readFileSync(join(process.cwd(), relativePath), "utf8");
  return {
    sourceFile: ts.createSourceFile(
      relativePath,
      text,
      ts.ScriptTarget.Latest,
      true,
      relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
    text,
  };
}

function findFunction(
  sourceFile: ts.SourceFile,
  functionName: string,
): ts.FunctionDeclaration {
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === functionName,
  );
  if (!match) throw new Error(`Missing ${functionName}.`);
  return match;
}

type JsxOpening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function collectJsxOpenings(root: ts.Node): JsxOpening[] {
  const openings: JsxOpening[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      openings.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return openings;
}

function openingsByTag(
  root: ts.Node,
  sourceFile: ts.SourceFile,
  tagName: string,
): JsxOpening[] {
  return collectJsxOpenings(root).filter(
    (opening) => opening.tagName.getText(sourceFile) === tagName,
  );
}

function attributeText(
  opening: JsxOpening,
  sourceFile: ts.SourceFile,
  attributeName: string,
): string | undefined {
  const attribute = opening.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText(sourceFile) === attributeName,
  );
  return attribute?.initializer?.getText(sourceFile);
}

describe("source-safe final-zone visual contract", () => {
  it("limits BridgeZone to the grouped two-mesh E5 dossier stand", () => {
    const { sourceFile } = readSource("components/world/zones/bridge-zone.tsx");
    const bridgeZone = findFunction(sourceFile, "BridgeZone");
    const bridgeSource = bridgeZone.getText(sourceFile);

    expect(openingsByTag(bridgeZone, sourceFile, "group")).toHaveLength(2);
    expect(openingsByTag(bridgeZone, sourceFile, "mesh")).toHaveLength(2);
    expect(openingsByTag(bridgeZone, sourceFile, "boxGeometry")).toHaveLength(2);
    expect(bridgeSource).not.toContain("bridgeSpawn");
    expect(bridgeSource).not.toMatch(/\.map\s*\(/);
    expect(bridgeSource).not.toMatch(/deck|rail|post/i);
    expect(bridgeSource).not.toMatch(/PeriodCharacter|PeriodFigure|Drouet|Louis/);
  });

  it("keeps only the continuous main road and non-final barrel set in GroundedDistrict", () => {
    const { sourceFile, text } = readSource(
      "components/world/environment/grounded-district.tsx",
    );
    const district = findFunction(sourceFile, "GroundedDistrict");
    const districtSource = district.getText(sourceFile);
    const cobblestone = openingsByTag(district, sourceFile, "CobblestoneSurface");
    const cobblestoneFallbacks = openingsByTag(
      district,
      sourceFile,
      "CobblestoneFallbackSurface",
    );
    const licensedBarrels = openingsByTag(district, sourceFile, "LicensedBarrelSet");
    const proceduralBarrels = openingsByTag(
      district,
      sourceFile,
      "ProceduralBarrelSet",
    );

    expect(text).not.toMatch(/\b(?:BridgeWater|water|river)\b/i);
    expect(cobblestone).toHaveLength(1);
    expect(cobblestoneFallbacks).toHaveLength(2);
    expect(
      cobblestone.map((opening) => attributeText(opening, sourceFile, "position")),
    ).toEqual(["{[36, 0.115, 0]}"]);
    expect(
      cobblestone.map((opening) => attributeText(opening, sourceFile, "size")),
    ).toEqual(["{[176, DISTRICT_GROUND_PRESENTATION.roadWidth]}"]);
    expect(DISTRICT_GROUND_PRESENTATION.roadWidth).toBe(8.4);
    expect(
      cobblestoneFallbacks.map((opening) =>
        attributeText(opening, sourceFile, "position"),
      ),
    ).toEqual(["{[36, 0.115, 0]}", "{[36, 0.115, 0]}"]);
    expect(
      cobblestoneFallbacks.map((opening) =>
        attributeText(opening, sourceFile, "rotationY"),
      ),
    ).toEqual([undefined, undefined]);
    expect(licensedBarrels).toHaveLength(1);
    expect(proceduralBarrels).toHaveLength(2);
    expect(
      licensedBarrels.map((opening) => attributeText(opening, sourceFile, "position")),
    ).toEqual(["{[16.2, 0, 4.7]}"]);
    expect(
      proceduralBarrels.map((opening) =>
        attributeText(opening, sourceFile, "position"),
      ),
    ).toEqual(["{[16.2, 0, 4.7]}", "{[16.2, 0, 4.7]}"]);
    expect(districtSource).not.toContain("[72, 0.2, 4.45]");
    expect(districtSource).not.toContain("[65.5, 0, -4.9]");
  });

  it("keeps district facades and presentation lights before the topology-only final zone", () => {
    for (const placement of DISTRICT_FACADE_PLACEMENTS) {
      expect(
        placement.position[0] + placement.size[0] / 2,
        `${placement.id} extends into the final-zone exclusion`,
      ).toBeLessThan(DISTRICT_DRESSING_FINAL_ZONE_MIN_X);
    }

    for (const profile of Object.values(GRAPHICS_PROFILES)) {
      const lighting = selectWorldLightingConfig(profile);
      expect(
        lighting.lanternKeys.every(
          ({ position }) =>
            position[0] < DISTRICT_DRESSING_FINAL_ZONE_MIN_X,
        ),
        `${profile.tier} places a light inside the final-zone exclusion`,
      ).toBe(true);
    }

    expect(
      DISTRICT_DRESSING_PLACEMENTS.every(
        ({ clearanceRadius, position }) =>
          position[0] + clearanceRadius < DISTRICT_DRESSING_FINAL_ZONE_MIN_X,
      ),
      "Presentation dressing enters the topology-only final zone",
    ).toBe(true);
  });

  it("reconciles the final-zone manifest, caption, and non-evidentiary ledger", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/cases/varennes/world/scene-manifest.json"),
        "utf8",
      ),
    ) as {
      caseVersion: string;
      sceneManifestVersion: string;
      zones: Array<{
        assetReferences: Array<{ assetId: string }>;
        ambientLineIds: string[];
        dynamicContentAllowlist: string[];
        label: string;
        limitations: { appearance: string };
        safeSpawns: Array<{ position: number[]; spawnId: string }>;
        zoneId: string;
      }>;
    };
    const ambient = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/cases/varennes/world/ambient-lines.json"),
        "utf8",
      ),
    ) as {
      caseVersion: string;
      lines: Array<{ ambientLineId: string; text: string; zoneId: string }>;
      sceneManifestVersion: string;
    };
    const ledger = JSON.parse(
      readFileSync(
        join(process.cwd(), "data/cases/varennes/world/asset-ledger.json"),
        "utf8",
      ),
    ) as {
      caseVersion: string;
      sceneManifestVersion: string;
      assets: Array<{
        assetId: string;
        countsAsHistoricalEvidence: boolean;
        epistemicClassification: string;
        historicalBasis: { basisType: string };
      }>;
    };

    const zone = manifest.zones.find(({ zoneId }) => zoneId === "bridge-approach");
    const caption = ambient.lines.find(
      ({ ambientLineId }) => ambientLineId === "AMBIENT-BRIDGE-01",
    );
    const districtAsset = ledger.assets.find(
      ({ assetId }) => assetId === "ASSET-ENV-GROUNDED-DISTRICT",
    );

    expect({
      ambientCaseVersion: ambient.caseVersion,
      ambientSceneVersion: ambient.sceneManifestVersion,
      ledgerCaseVersion: ledger.caseVersion,
      ledgerSceneVersion: ledger.sceneManifestVersion,
      manifestCaseVersion: manifest.caseVersion,
      manifestSceneVersion: manifest.sceneManifestVersion,
    }).toEqual({
      ambientCaseVersion: "1.0.3",
      ambientSceneVersion: "1.3.0",
      ledgerCaseVersion: "1.0.3",
      ledgerSceneVersion: "1.3.0",
      manifestCaseVersion: "1.0.3",
      manifestSceneVersion: "1.3.0",
    });
    expect(zone).toMatchObject({
      ambientLineIds: ["AMBIENT-BRIDGE-01"],
      assetReferences: expect.arrayContaining([
        expect.objectContaining({ assetId: "ASSET-CHAR-PROCEDURAL-CAST" }),
      ]),
      dynamicContentAllowlist: ["generic_ambient_resident"],
      label: EXPECTED_ZONE_LABEL,
      limitations: { appearance: EXPECTED_APPEARANCE_LIMITATION },
      safeSpawns: [{ position: [72, 0, 0], spawnId: "SPAWN-BRIDGE-ENTRY" }],
    });
    expect(caption).toMatchObject({
      text: EXPECTED_AMBIENT_CAPTION,
      zoneId: "bridge-approach",
    });
    expect(JSON.stringify(ledger)).not.toMatch(/\b(?:water|river)\b/i);
    expect(districtAsset).toMatchObject({
      countsAsHistoricalEvidence: false,
      epistemicClassification: "reconstruction",
      historicalBasis: { basisType: "none" },
    });
  });

  it("allows only generic moving residents as dynamic final-zone content", () => {
    const runtimeManifest = loadVarennesSceneManifest();
    const placements = buildAmbientResidentPlacements(
      runtimeManifest,
      loadVarennesAmbientLines(),
      GRAPHICS_PROFILES.high.ambientCount,
    ).filter((placement) => placement.zoneId === "bridge-approach");

    expect(placements.length).toBeGreaterThan(0);
    for (const placement of placements) {
      expect(placement.residentId).toMatch(/^AMBIENT-RESIDENT-/);
      expect(placement.caption).toBe(EXPECTED_AMBIENT_CAPTION);
      expect(placement.pathRadius).toBeLessThanOrEqual(1.2);
    }
  });

  it("preserves the bridge IDs, E5 offset, and authored corridor navigation bounds", () => {
    const sceneRuntime = readSource("components/world/scene-runtime.tsx").text;

    expect(BRIDGE_E5_CANDIDATE).toEqual({
      candidateId: "INTERACTABLE-E5-BRIDGE-DOSSIER",
      eligible: true,
      position: [72, 0, -2.4],
      request: {
        canonicalTarget: { evidenceId: "E5", targetType: "evidence" },
        interactableId: "INTERACTABLE-E5-BRIDGE-DOSSIER",
        interactionType: "inspect_evidence",
        zoneId: "bridge-approach",
      },
    });
    expect(BRIDGE_CANDIDATES).toEqual([BRIDGE_E5_CANDIDATE]);
    expect(sceneRuntime).toContain(
      '<CuboidCollider args={[120, 0.1, 80]} position={[36, -0.1, 0]} />',
    );
  });

  it("records the source boundary without upgrading the underlying claims", () => {
    const sources = readFileSync(
      join(process.cwd(), "docs/HISTORICAL_SOURCES.md"),
      "utf8",
    );
    const buildLog = readFileSync(join(process.cwd(), "docs/BUILD_LOG.md"), "utf8");

    expect(sources).toContain("### Source-Safe Final-Zone Visual Boundary");
    expect(sources).toMatch(/F-S4-005 supports only broad topology/i);
    expect(sources).toMatch(/S2 and S3 are not fully independent/i);
    expect(sources).toMatch(/disagree about (?:the )?actors|actor attribution remains contested/i);
    expect(buildLog).toContain("## 2026-07-19 / Source-Safe Final-Zone Correction");
  });
});
