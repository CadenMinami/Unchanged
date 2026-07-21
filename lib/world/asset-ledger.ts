import rawAssetLedger from "@/data/cases/varennes/world/asset-ledger.json";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  type AssetLedger,
  assetLedgerSchema,
} from "@/schemas/asset-ledger";
import type { SceneManifest } from "@/schemas/world-manifest";

export const VARRENNES_PROCEDURAL_ASSET_SOURCE_PATHS = [
  "components/world/ambient/ambient-residents.tsx",
  "components/world/character/classroom-period-figure.tsx",
  "components/world/character/figure-motion.ts",
  "components/world/character/investigator-controller.tsx",
  "components/world/character/investigator-model.tsx",
  "components/world/character/period-character.tsx",
  "components/world/character/period-figure.tsx",
  "components/world/character/period-figure-resources.ts",
  "components/world/environment/archive-hero-environment.tsx",
  "components/world/environment/cobblestone-surface.tsx",
  "components/world/environment/district-layout.ts",
  "components/world/environment/environment-dressing.tsx",
  "components/world/environment/grounded-district.tsx",
  "components/world/environment/licensed-props.tsx",
  "components/world/environment/modular-facade.tsx",
  "components/world/environment/optional-asset-boundary.tsx",
  "components/world/environment/pbr-surface-material.tsx",
  "components/world/environment/world-lighting.tsx",
  "components/world/environment/world-post-processing.tsx",
  "components/world/environment/zone-readiness-registry.tsx",
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

export type AssetLedgerClosureOutputSnapshot = Readonly<{
  path: string;
  bytes: number;
  sha256: string;
}>;

export type AssetLedgerClosureProofSnapshot = Readonly<{
  path: string;
  sha256: string;
}>;

export type AssetLedgerClosureSnapshot = Readonly<{
  shippedOutputs: readonly AssetLedgerClosureOutputSnapshot[];
  localLicenseProofs: readonly AssetLedgerClosureProofSnapshot[];
  repositorySourcePaths: readonly string[];
}>;

const ASSET_LEDGER_CLOSURE_ISSUE_ORDER = [
  "DUPLICATE_OUTPUT_OWNERSHIP",
  "UNLEDGERED_OUTPUT",
  "DECLARED_OUTPUT_ABSENT",
  "OUTPUT_BYTES_DRIFT",
  "OUTPUT_HASH_DRIFT",
  "LOCAL_LICENSE_PROOF_ABSENT",
  "LOCAL_LICENSE_PROOF_HASH_DRIFT",
  "REPOSITORY_SOURCE_ABSENT",
] as const;

type AssetLedgerClosureIssueCode =
  (typeof ASSET_LEDGER_CLOSURE_ISSUE_ORDER)[number];

type AssetLedgerClosureIssue = Readonly<{
  code: AssetLedgerClosureIssueCode;
  path: string;
  assetId: string;
  message: string;
}>;

function compareClosureText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function compareClosureIssues(
  left: AssetLedgerClosureIssue,
  right: AssetLedgerClosureIssue,
): number {
  const codeDifference =
    ASSET_LEDGER_CLOSURE_ISSUE_ORDER.indexOf(left.code) -
    ASSET_LEDGER_CLOSURE_ISSUE_ORDER.indexOf(right.code);
  if (codeDifference !== 0) return codeDifference;

  const pathDifference = compareClosureText(left.path, right.path);
  if (pathDifference !== 0) return pathDifference;

  return compareClosureText(left.assetId, right.assetId);
}

export function validateAssetLedgerClosure(
  ledger: AssetLedger,
  snapshot: AssetLedgerClosureSnapshot,
): void {
  const issues: AssetLedgerClosureIssue[] = [];
  const outputDeclarations = ledger.assets.flatMap((asset) =>
    asset.originKind === "downloaded_cc0"
      ? asset.delivery.outputs.map((output) => ({ assetId: asset.assetId, output }))
      : [],
  );
  const outputDeclarationsByPath = new Map<
    string,
    typeof outputDeclarations
  >();
  for (const declaration of outputDeclarations) {
    const declarations = outputDeclarationsByPath.get(declaration.output.path) ?? [];
    declarations.push(declaration);
    outputDeclarationsByPath.set(declaration.output.path, declarations);
  }

  for (const [path, declarations] of outputDeclarationsByPath) {
    if (declarations.length < 2) continue;
    const owners = declarations.map(({ assetId }) => assetId).sort();
    issues.push({
      code: "DUPLICATE_OUTPUT_OWNERSHIP",
      path,
      assetId: owners.join(","),
      message: `[DUPLICATE_OUTPUT_OWNERSHIP] ${path} is declared by ${owners.join(", ")}.`,
    });
  }

  const shippedOutputsByPath = new Map(
    snapshot.shippedOutputs.map((output) => [output.path, output]),
  );
  for (const output of snapshot.shippedOutputs) {
    if (outputDeclarationsByPath.has(output.path)) continue;
    issues.push({
      code: "UNLEDGERED_OUTPUT",
      path: output.path,
      assetId: "",
      message: `[UNLEDGERED_OUTPUT] ${output.path} is shipped but not declared by the asset ledger.`,
    });
  }

  for (const { assetId, output } of outputDeclarations) {
    const shippedOutput = shippedOutputsByPath.get(output.path);
    if (!shippedOutput) {
      issues.push({
        code: "DECLARED_OUTPUT_ABSENT",
        path: output.path,
        assetId,
        message: `[DECLARED_OUTPUT_ABSENT] ${assetId} declares ${output.path}, but the shipped output is absent.`,
      });
      continue;
    }
    if (shippedOutput.bytes !== output.bytes) {
      issues.push({
        code: "OUTPUT_BYTES_DRIFT",
        path: output.path,
        assetId,
        message: `[OUTPUT_BYTES_DRIFT] ${assetId} declares ${output.path} as ${output.bytes} bytes, but the snapshot has ${shippedOutput.bytes}.`,
      });
    }
    if (shippedOutput.sha256 !== output.sha256) {
      issues.push({
        code: "OUTPUT_HASH_DRIFT",
        path: output.path,
        assetId,
        message: `[OUTPUT_HASH_DRIFT] ${assetId} declares ${output.path} with sha256 ${output.sha256}, but the snapshot has ${shippedOutput.sha256}.`,
      });
    }
  }

  const localProofsByPath = new Map(
    snapshot.localLicenseProofs.map((proof) => [proof.path, proof]),
  );
  for (const asset of ledger.assets) {
    if (asset.originKind !== "downloaded_cc0") continue;
    const localProof = asset.license.localProof;
    const proofSnapshot = localProofsByPath.get(localProof.path);
    if (!proofSnapshot) {
      issues.push({
        code: "LOCAL_LICENSE_PROOF_ABSENT",
        path: localProof.path,
        assetId: asset.assetId,
        message: `[LOCAL_LICENSE_PROOF_ABSENT] ${asset.assetId} declares ${localProof.path}, but the local proof is absent.`,
      });
      continue;
    }
    if (proofSnapshot.sha256 !== localProof.sha256) {
      issues.push({
        code: "LOCAL_LICENSE_PROOF_HASH_DRIFT",
        path: localProof.path,
        assetId: asset.assetId,
        message: `[LOCAL_LICENSE_PROOF_HASH_DRIFT] ${asset.assetId} declares ${localProof.path} with sha256 ${localProof.sha256}, but the snapshot has ${proofSnapshot.sha256}.`,
      });
    }
  }

  const repositorySourcePaths = new Set(snapshot.repositorySourcePaths);
  for (const asset of ledger.assets) {
    if (asset.originKind !== "repository_authored_procedural") continue;
    const sourcePaths = new Set([
      ...asset.origin.sourcePaths,
      ...asset.delivery.sourcePaths,
    ]);
    for (const sourcePath of sourcePaths) {
      if (repositorySourcePaths.has(sourcePath)) continue;
      issues.push({
        code: "REPOSITORY_SOURCE_ABSENT",
        path: sourcePath,
        assetId: asset.assetId,
        message: `[REPOSITORY_SOURCE_ABSENT] ${asset.assetId} declares ${sourcePath}, but the repository source is absent.`,
      });
    }
  }

  if (issues.length > 0) {
    const issueList = issues
      .sort(compareClosureIssues)
      .map(({ message }) => `- ${message}`)
      .join("\n");
    throw new Error(`Asset ledger closure failed:\n${issueList}`);
  }
}

export function validateAssetLedgerReferences(
  ledger: AssetLedger,
  manifest: SceneManifest = loadVarennesSceneManifest(),
): void {
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
  const assetsById = new Map(ledger.assets.map((asset) => [asset.assetId, asset]));

  for (const owner of [...manifest.zones, ...manifest.interactables]) {
    for (const reference of owner.assetReferences) {
      if (reference.assetLedgerVersion !== ledger.assetLedgerVersion) {
        throw new Error(
          `${reference.assetId} references asset ledger ${reference.assetLedgerVersion}, not ${ledger.assetLedgerVersion}.`,
        );
      }
      const asset = assetsById.get(reference.assetId);
      if (!asset) {
        throw new Error(`${reference.assetId} is not present in the active asset ledger.`);
      }
      if (!asset.license) {
        throw new Error(`${reference.assetId} has no license record in the active asset ledger.`);
      }
    }
  }

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
