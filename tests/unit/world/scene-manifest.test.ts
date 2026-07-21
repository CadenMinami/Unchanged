import { describe, expect, it } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { loadVarennesModelPolicy } from "@/lib/openai/load-model-policy";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
  validateSceneManifestReferences,
} from "@/lib/world/scene-manifest";
import {
  ambientLinesSchema,
  sceneManifestSchema,
} from "@/schemas/world-manifest";

const casePackage = loadVarennesCase();
const modelPolicy = loadVarennesModelPolicy();
const reconstruction = loadVarennesReconstruction();

function validate(manifest = structuredClone(loadVarennesSceneManifest())): void {
  validateSceneManifestReferences(
    manifest,
    loadVarennesAmbientLines(),
    casePackage,
    modelPolicy,
    reconstruction,
  );
}

describe("scene manifest", () => {
  it("loads a version-bound manifest with exactly the four approved zones", () => {
    const manifest = loadVarennesSceneManifest();

    expect(manifest).toMatchObject({
      sceneManifestVersion: "1.3.0",
      caseId: casePackage.caseId,
      caseVersion: casePackage.caseVersion,
      modelPolicyVersion: modelPolicy.policyVersion,
    });
    expect(manifest.zones.map((zone) => zone.zoneId)).toEqual([
      "archive-antechamber",
      "post-road-square",
      "royal-lodging-civic-area",
      "bridge-approach",
    ]);
    expect(manifest.repairPath.checkpoints).toHaveLength(
      reconstruction.repairSteps.length,
    );
    expect(() => validate(manifest)).not.toThrow();
  });

  it("rejects unknown properties and unknown zone IDs", () => {
    const extraProperty = structuredClone(loadVarennesSceneManifest());
    Object.assign(extraProperty.zones[0]!, { undocumentedGeometry: true });
    expect(sceneManifestSchema.safeParse(extraProperty).success).toBe(false);

    const unknownZone = structuredClone(loadVarennesSceneManifest());
    Object.assign(unknownZone.zones[0]!, { zoneId: "palace-interior" });
    expect(sceneManifestSchema.safeParse(unknownZone).success).toBe(false);
  });

  it("requires placement status and explicit limitations", () => {
    const missingStatus = structuredClone(loadVarennesSceneManifest()) as Record<
      string,
      unknown
    >;
    const statusZones = missingStatus.zones as Array<Record<string, unknown>>;
    delete statusZones[0]!.placementStatus;
    expect(sceneManifestSchema.safeParse(missingStatus).success).toBe(false);

    const missingLimit = structuredClone(loadVarennesSceneManifest()) as Record<
      string,
      unknown
    >;
    const limitInteractables = missingLimit.interactables as Array<
      Record<string, unknown>
    >;
    const limitations = limitInteractables[0]!.limitations as Record<string, unknown>;
    delete limitations.location;
    expect(sceneManifestSchema.safeParse(missingLimit).success).toBe(false);
  });

  it("requires versioned asset references and an explicit dynamic-content allowlist", () => {
    const missingZoneAssets = structuredClone(loadVarennesSceneManifest()) as unknown as {
      zones: Array<Record<string, unknown>>;
    };
    delete missingZoneAssets.zones[0]!.assetReferences;
    expect(sceneManifestSchema.safeParse(missingZoneAssets).success).toBe(false);

    const missingInteractableAssets = structuredClone(
      loadVarennesSceneManifest(),
    ) as unknown as {
      interactables: Array<Record<string, unknown>>;
    };
    delete missingInteractableAssets.interactables[0]!.assetReferences;
    expect(sceneManifestSchema.safeParse(missingInteractableAssets).success).toBe(
      false,
    );

    const missingDynamicAllowlist = structuredClone(
      loadVarennesSceneManifest(),
    ) as unknown as {
      zones: Array<Record<string, unknown>>;
    };
    delete missingDynamicAllowlist.zones[0]!.dynamicContentAllowlist;
    expect(sceneManifestSchema.safeParse(missingDynamicAllowlist).success).toBe(
      false,
    );
  });

  it.each([
    ["evidence ID", "evidenceIds", "UNKNOWN-EVIDENCE"],
    ["fact ID", "factIds", "UNKNOWN-FACT"],
    ["source ID", "sourceIds", "UNKNOWN-SOURCE"],
  ] as const)("rejects an unknown canonical %s", (_label, key, unknownId) => {
    const manifest = structuredClone(loadVarennesSceneManifest());
    Object.assign(manifest.interactables[0]!, { [key]: [unknownId] });

    expect(() => validate(manifest)).toThrow(new RegExp(unknownId, "i"));
  });

  it("rejects unknown station IDs and repair checkpoints", () => {
    const stationManifest = structuredClone(loadVarennesSceneManifest());
    const station = stationManifest.interactables.find(
      (candidate) => candidate.canonicalTarget.targetType === "station",
    );
    if (!station || station.canonicalTarget.targetType !== "station") {
      throw new Error("Missing station fixture.");
    }
    station.canonicalTarget.stationId = "CHAR-UNREVIEWED";
    expect(() => validate(stationManifest)).toThrow(/CHAR-UNREVIEWED/i);

    const checkpointManifest = structuredClone(loadVarennesSceneManifest());
    const checkpoint = checkpointManifest.interactables.find(
      (candidate) => candidate.canonicalTarget.targetType === "repair_checkpoint",
    );
    if (!checkpoint || checkpoint.canonicalTarget.targetType !== "repair_checkpoint") {
      throw new Error("Missing repair checkpoint fixture.");
    }
    checkpoint.canonicalTarget.repairCheckpointId = "RS-UNKNOWN";
    expect(() => validate(checkpointManifest)).toThrow(/RS-UNKNOWN/i);

    const pursuitManifest = structuredClone(loadVarennesSceneManifest());
    Object.assign(pursuitManifest.repairPath.checkpoints[0]!, {
      repairStepId: "RS-UNKNOWN",
    });
    expect(sceneManifestSchema.safeParse(pursuitManifest).success).toBe(false);
  });

  it("rejects reordered or duplicate pursuit checkpoints and local actions", () => {
    const reordered = structuredClone(loadVarennesSceneManifest());
    const first = reordered.repairPath.checkpoints[0]!;
    reordered.repairPath.checkpoints[0] = reordered.repairPath.checkpoints[1]!;
    reordered.repairPath.checkpoints[1] = first;
    expect(sceneManifestSchema.safeParse(reordered).success).toBe(false);

    const duplicateAction = structuredClone(loadVarennesSceneManifest());
    duplicateAction.repairPath.localActions[1]!.repairActionId =
      duplicateAction.repairPath.localActions[0]!.repairActionId;
    expect(sceneManifestSchema.safeParse(duplicateAction).success).toBe(false);
  });

  it("rejects a valid evidence target paired with another record's provenance", () => {
    const manifest = structuredClone(loadVarennesSceneManifest());
    const evidenceTarget = manifest.interactables.find(
      (candidate) => candidate.canonicalTarget.targetType === "evidence",
    );
    if (!evidenceTarget || evidenceTarget.canonicalTarget.targetType !== "evidence") {
      throw new Error("Missing evidence target fixture.");
    }
    const targetEvidenceId = evidenceTarget.canonicalTarget.evidenceId;
    const otherEvidence = casePackage.evidence.find(
      (evidence) => evidence.id !== targetEvidenceId,
    );
    if (!otherEvidence) throw new Error("Missing alternate evidence fixture.");
    evidenceTarget.canonicalTarget.evidenceId = otherEvidence.id;

    expect(() => validate(manifest)).toThrow(/target.*declared evidence relationship/i);
  });

  it("rejects ambient lines that claim canonical facts or scored evidence", () => {
    const ambient = structuredClone(loadVarennesAmbientLines()) as Record<
      string,
      unknown
    >;
    const lines = ambient.lines as Array<Record<string, unknown>>;
    lines[0]!.factIds = [casePackage.facts[0]!.id];
    lines[0]!.evidenceIds = [casePackage.evidence[0]!.id];
    lines[0]!.countsAsHistoricalEvidence = true;

    expect(ambientLinesSchema.safeParse(ambient).success).toBe(false);
  });
});
