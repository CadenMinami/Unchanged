import rawAssetLedger from "@/data/cases/varennes/world/asset-ledger.json";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  type AssetLedger,
  assetLedgerSchema,
} from "@/schemas/asset-ledger";

export const VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS = [
  "components/world/ambient/ambient-residents.tsx",
  "components/world/character/investigator-model.tsx",
  "components/world/character/period-figure.tsx",
  "components/world/environment/cobblestone-surface.tsx",
  "components/world/environment/grounded-district.tsx",
  "components/world/environment/licensed-props.tsx",
  "components/world/environment/optional-asset-boundary.tsx",
  "components/world/interactions/interactable.tsx",
  "components/world/repair/pursuit-repair.module.css",
  "components/world/repair/pursuit-runtime.tsx",
  "components/world/repair/reduced-motion-repair.tsx",
  "components/world/scene-runtime.tsx",
  "components/world/zones/archive-zone.tsx",
  "components/world/zones/bridge-zone.tsx",
  "components/world/zones/civic-zone.tsx",
  "components/world/zones/post-road-zone.tsx",
  "lib/audio/ambient-soundscape.ts",
] as const;

export function validateAssetLedgerReferences(ledger: AssetLedger): void {
  const manifest = loadVarennesSceneManifest();
  const casePackage = loadVarennesCase();

  if (
    ledger.caseId !== manifest.caseId ||
    ledger.caseVersion !== manifest.caseVersion ||
    ledger.sceneManifestVersion !== manifest.sceneManifestVersion
  ) {
    throw new Error("The asset ledger does not match the active scene manifest.");
  }

  const zoneIds = new Set<string>(manifest.zones.map((zone) => zone.zoneId));
  const interactableIds = new Set(
    manifest.interactables.map((interactable) => interactable.interactableId),
  );
  const evidenceIds = new Set(casePackage.evidence.map((evidence) => evidence.id));
  const factIds = new Set(casePackage.facts.map((fact) => fact.id));
  const sourceIds = new Set(casePackage.sources.map((source) => source.id));

  for (const asset of ledger.assets) {
    for (const use of asset.uses) {
      const validOwner =
        (use.ownerType === "scene" && use.ownerId === "varennes-scene") ||
        (use.ownerType === "zone" && zoneIds.has(use.ownerId)) ||
        (use.ownerType === "interactable" && interactableIds.has(use.ownerId)) ||
        (use.ownerType === "repair_path" && use.ownerId === "varennes-repair-path");
      if (!validOwner) {
        throw new Error(`${asset.assetId} references unknown ${use.ownerType} ${use.ownerId}.`);
      }
    }

    if (asset.historicalBasis.basisType === "source_bounded") {
      for (const evidenceId of asset.historicalBasis.evidenceIds) {
        if (!evidenceIds.has(evidenceId)) {
          throw new Error(`${asset.assetId} references unknown evidence ${evidenceId}.`);
        }
      }
      for (const factId of asset.historicalBasis.factIds) {
        if (!factIds.has(factId)) {
          throw new Error(`${asset.assetId} references unknown fact ${factId}.`);
        }
      }
      for (const sourceId of asset.historicalBasis.sourceIds) {
        if (!sourceIds.has(sourceId)) {
          throw new Error(`${asset.assetId} references unknown source ${sourceId}.`);
        }
      }
    }
  }
}

export function loadVarennesAssetLedger(): AssetLedger {
  const ledger = assetLedgerSchema.parse(rawAssetLedger);
  validateAssetLedgerReferences(ledger);
  return ledger;
}
