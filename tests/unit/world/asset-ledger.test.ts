import { describe, expect, it } from "vitest";

import {
  loadVarennesAssetLedger,
  validateAssetLedgerReferences,
} from "@/lib/world/asset-ledger";
import { assetLedgerSchema } from "@/schemas/asset-ledger";

describe("world asset ledger", () => {
  it("loads a strict, version-bound ledger", () => {
    const ledger = loadVarennesAssetLedger();

    expect(ledger).toMatchObject({
      assetLedgerVersion: "1.0.0",
      sceneManifestVersion: "1.2.0",
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
});
