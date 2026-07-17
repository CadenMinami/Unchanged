import { z } from "zod";

import {
  placementStatusSchema,
  reconstructionConfidenceSchema,
} from "./world-manifest";

export const ASSET_LEDGER_VERSION = "1.0.0" as const;

const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
const httpsUrlSchema = z.string().url().refine((value) => value.startsWith("https://"), {
  message: "Asset URLs must use HTTPS.",
});
const repositoryPathSchema = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith("/") && !value.includes(".."), {
    message: "Repository paths must be relative and remain inside the repository.",
  });

const placementLimitationsSchema = z
  .object({
    location: z.string().min(1),
    ownership: z.string().min(1),
    scale: z.string().min(1),
    appearance: z.string().min(1),
  })
  .strict();

const assetUseSchema = z
  .object({
    ownerType: z.enum(["scene", "zone", "interactable", "repair_path"]),
    ownerId: z.string().min(1),
    purpose: z.string().min(1),
    placementStatus: placementStatusSchema,
    reconstructionConfidence: reconstructionConfidenceSchema,
    limitations: placementLimitationsSchema,
  })
  .strict();

const historicalBasisSchema = z.discriminatedUnion("basisType", [
  z
    .object({
      basisType: z.literal("none"),
      rationale: z.string().min(1),
      evidenceIds: z.tuple([]),
      factIds: z.tuple([]),
      sourceIds: z.tuple([]),
    })
    .strict(),
  z
    .object({
      basisType: z.literal("source_bounded"),
      rationale: z.string().min(1),
      evidenceIds: z.array(z.string().min(1)).min(1),
      factIds: z.array(z.string().min(1)).min(1),
      sourceIds: z.array(z.string().min(1)).min(1),
    })
    .strict(),
  z
    .object({
      basisType: z.literal("fictional"),
      rationale: z.string().min(1),
      evidenceIds: z.tuple([]),
      factIds: z.tuple([]),
      sourceIds: z.tuple([]),
    })
    .strict(),
]);

const evidenceAccessSchema = z
  .object({
    opensCountableEvidence: z.literal(false),
    evidenceIds: z.tuple([]),
  })
  .strict();

const repositoryAuthoredAssetSchema = z
  .object({
    assetId: z.string().regex(/^ASSET-[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
    title: z.string().min(1),
    category: z.enum([
      "environment",
      "prop",
      "character",
      "clothing",
      "animation",
      "material",
      "texture",
      "audio",
      "lighting",
      "supporting_bitmap",
    ]),
    epistemicClassification: z.enum([
      "reconstruction",
      "dramatization",
      "fictional_counterfactual",
    ]),
    historicalBasis: historicalBasisSchema,
    uses: z.array(assetUseSchema).min(1),
    evidenceAccess: evidenceAccessSchema,
    countsAsHistoricalEvidence: z.literal(false),
    originKind: z.literal("repository_authored_procedural"),
    origin: z
      .object({
        creator: z.string().min(1),
        rightsHolder: z.string().min(1),
        sourcePaths: z.array(repositoryPathSchema).min(1),
      })
      .strict(),
    license: z
      .object({
        rightsBasis: z.literal("repository_owned"),
        commercialUseAllowed: z.literal(true),
        modificationAllowed: z.literal(true),
        redistributionAllowed: z.literal(true),
        proof: z.literal("repository_history"),
      })
      .strict(),
    modifications: z
      .object({
        status: z.literal("original"),
        steps: z.tuple([]),
      })
      .strict(),
    delivery: z
      .object({
        kind: z.literal("runtime_procedural"),
        sourcePaths: z.array(repositoryPathSchema).min(1),
        compression: z.literal("not_applicable"),
      })
      .strict(),
  })
  .strict();

const downloadedAssetSchema = z
  .object({
    assetId: z.string().regex(/^ASSET-[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
    title: z.string().min(1),
    category: z.enum([
      "environment",
      "prop",
      "character",
      "clothing",
      "animation",
      "material",
      "texture",
      "audio",
      "lighting",
      "supporting_bitmap",
    ]),
    epistemicClassification: z.enum([
      "reconstruction",
      "dramatization",
      "fictional_counterfactual",
    ]),
    historicalBasis: historicalBasisSchema,
    uses: z.array(assetUseSchema).min(1),
    evidenceAccess: evidenceAccessSchema,
    countsAsHistoricalEvidence: z.literal(false),
    originKind: z.literal("downloaded_cc0"),
    origin: z
      .object({
        creator: z.string().min(1),
        sourceUrl: httpsUrlSchema,
        downloadUrl: httpsUrlSchema,
        retrievedAt: z.string().date(),
        originalFiles: z
          .array(
            z
              .object({
                name: z.string().min(1),
                bytes: z.number().int().positive(),
                sha256: sha256Schema,
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
    license: z
      .object({
        spdxId: z.literal("CC0-1.0"),
        proofUrl: httpsUrlSchema,
        localProof: z
          .object({
            path: repositoryPathSchema,
            sha256: sha256Schema,
          })
          .strict(),
        commercialUseAllowed: z.literal(true),
        modificationAllowed: z.literal(true),
        redistributionAllowed: z.literal(true),
        attributionRequired: z.literal(false),
        optionalCredit: z.string().min(1),
      })
      .strict(),
    modifications: z
      .object({
        status: z.literal("modified"),
        steps: z.array(z.string().min(1)).min(1),
      })
      .strict(),
    delivery: z
      .object({
        kind: z.literal("static_outputs"),
        outputs: z
          .array(
            z
              .object({
                path: z.string().regex(/^\/world\/.+[^/]$/),
                bytes: z.number().int().positive(),
                sha256: sha256Schema,
              })
              .strict(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

export const assetEntrySchema = z.discriminatedUnion("originKind", [
  repositoryAuthoredAssetSchema,
  downloadedAssetSchema,
]);

export const assetLedgerSchema = z
  .object({
    assetLedgerVersion: z.literal(ASSET_LEDGER_VERSION),
    sceneManifestVersion: semverSchema,
    caseId: z.literal("varennes"),
    caseVersion: semverSchema,
    disclosure: z.string().min(1),
    assets: z.array(assetEntrySchema).min(1),
  })
  .strict()
  .superRefine((ledger, context) => {
    const assetIds = ledger.assets.map((asset) => asset.assetId);
    if (new Set(assetIds).size !== assetIds.length) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Asset ledger IDs must be unique.",
      });
    }

    const outputPaths = ledger.assets.flatMap((asset) =>
      asset.originKind === "downloaded_cc0"
        ? asset.delivery.outputs.map((output) => output.path)
        : [],
    );
    if (new Set(outputPaths).size !== outputPaths.length) {
      context.addIssue({
        code: "custom",
        path: ["assets"],
        message: "Static asset output paths must be unique.",
      });
    }
  });

export type AssetLedger = z.infer<typeof assetLedgerSchema>;
export type AssetLedgerEntry = AssetLedger["assets"][number];
