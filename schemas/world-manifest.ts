import { z } from "zod";

import {
  repairActionIdSchema,
  repairActionIds,
  repairStepIdSchema,
  repairStepIds,
} from "./reconstruction";

export const SCENE_MANIFEST_VERSION = "1.3.0" as const;
export const AMBIENT_LINES_VERSION = "1.0.0" as const;
export const WORLD_ASSET_LEDGER_VERSION = "1.0.0" as const;
export const SCHEMATIC_PLACEMENT_LABEL =
  "SCHEMATIC RECONSTRUCTION - NOT TO SCALE" as const;

export const worldZoneIdSchema = z.enum([
  "archive-antechamber",
  "post-road-square",
  "royal-lodging-civic-area",
  "bridge-approach",
]);

export const worldInteractionTypeSchema = z.enum([
  "inspect_evidence",
  "open_station",
  "open_context",
  "open_journal",
  "open_caseboard",
  "open_debrief",
  "enter_repair_checkpoint",
]);

export const placementStatusSchema = z.enum([
  "documented",
  "approximate_reconstruction",
  "schematic_temporal_reconstruction",
  "fictional_fracture",
]);

export const reconstructionConfidenceSchema = z.enum([
  "high",
  "moderate",
  "low",
  "fictional",
]);

export const canonicalCaseSurfaceSchema = z.enum([
  "context",
  "journal",
  "caseboard",
  "debrief",
]);

export const canonicalTargetTypeSchema = z.enum([
  "evidence",
  "station",
  "case_surface",
  "repair_checkpoint",
]);

const canonicalIdSchema = z.string().min(1).max(100);
const semverSchema = z.string().regex(/^\d+\.\d+\.\d+$/);
const assetReferenceSchema = z
  .object({
    assetId: z.string().regex(/^ASSET-[A-Z0-9]+(?:-[A-Z0-9]+)*$/),
    assetLedgerVersion: z.literal(WORLD_ASSET_LEDGER_VERSION),
    licenseReference: z.literal("asset_ledger"),
  })
  .strict();
const dynamicContentSchema = z.enum(["generic_ambient_resident"]);
const placementLimitationsSchema = z
  .object({
    location: z.string().min(1),
    ownership: z.string().min(1),
    scale: z.string().min(1),
    appearance: z.string().min(1),
  })
  .strict();

const schematicPlacementFields = {
  placementLabel: z.literal(SCHEMATIC_PLACEMENT_LABEL),
  placementStatus: placementStatusSchema,
  reconstructionConfidence: reconstructionConfidenceSchema,
  limitations: placementLimitationsSchema,
};

const safeSpawnSchema = z
  .object({
    spawnId: canonicalIdSchema,
    label: z.string().min(1),
    position: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]),
    yaw: z.number().finite(),
  })
  .strict();

const zoneSchema = z
  .object({
    zoneId: worldZoneIdSchema,
    label: z.string().min(1),
    ...schematicPlacementFields,
    assetReferences: z.array(assetReferenceSchema).min(1),
    dynamicContentAllowlist: z.array(dynamicContentSchema),
    safeSpawns: z.array(safeSpawnSchema).min(1),
    ambientLineIds: z.array(canonicalIdSchema),
    fastTravelUnlock: z.enum(["first_valid_visit", "never"]),
  })
  .strict();

export const canonicalTargetSchema = z.discriminatedUnion("targetType", [
  z.object({ targetType: z.literal("evidence"), evidenceId: canonicalIdSchema }).strict(),
  z.object({ targetType: z.literal("station"), stationId: canonicalIdSchema }).strict(),
  z
    .object({
      targetType: z.literal("case_surface"),
      surfaceId: canonicalCaseSurfaceSchema,
    })
    .strict(),
  z
    .object({
      targetType: z.literal("repair_checkpoint"),
      repairCheckpointId: canonicalIdSchema,
    })
    .strict(),
]);

const focusOverlaySchema = z.enum([
  "context",
  "journal",
  "evidence_inspector",
  "station",
  "caseboard",
  "repair_checkpoint",
  "debrief",
]);

const interactableSchema = z
  .object({
    interactableId: canonicalIdSchema,
    zoneId: worldZoneIdSchema,
    label: z.string().min(1),
    presentation: z.literal("grounded_reconstruction"),
    interactionType: worldInteractionTypeSchema,
    canonicalTarget: canonicalTargetSchema,
    focusOverlay: focusOverlaySchema,
    prerequisites: z
      .object({
        evidenceIds: z.array(canonicalIdSchema),
        discoveredZoneIds: z.array(worldZoneIdSchema),
      })
      .strict(),
    evidenceIds: z.array(canonicalIdSchema),
    factIds: z.array(canonicalIdSchema),
    sourceIds: z.array(canonicalIdSchema),
    provenance: z.enum([
      "verified_record",
      "reconstruction",
      "dramatization",
      "fictional_counterfactual",
    ]),
    countsAsHistoricalEvidence: z.literal(false),
    assetReferences: z.array(assetReferenceSchema).min(1),
    ...schematicPlacementFields,
  })
  .strict();

const repairPathCheckpointSchema = z
  .object({
    repairStepId: repairStepIdSchema,
    distance: z.number().finite().positive(),
  })
  .strict();

const repairPathActionSchema = z
  .object({
    repairActionId: repairActionIdSchema,
    parentStepId: z.literal("RS-05-OBSTRUCTION"),
    lateralOffset: z.number().finite(),
  })
  .strict();

const repairPathSchema = z
  .object({
    ...schematicPlacementFields,
    provenance: z.literal("reconstruction"),
    countsAsHistoricalEvidence: z.literal(false),
    startDistance: z.number().finite().min(0),
    corridorHalfWidth: z.number().finite().positive(),
    checkpointRadius: z.number().finite().positive(),
    checkpoints: z.array(repairPathCheckpointSchema).length(repairStepIds.length),
    localActions: z.array(repairPathActionSchema).length(repairActionIds.length),
    counterfactualBoundary: z
      .object({
        label: z.literal("UNKNOWN"),
        statement: z.string().min(1),
        distance: z.number().finite().positive(),
        lateralOffset: z.number().finite(),
        provenance: z.literal("fictional_counterfactual"),
      })
      .strict(),
  })
  .strict()
  .superRefine((repairPath, context) => {
    const checkpointIds = repairPath.checkpoints.map(
      (checkpoint) => checkpoint.repairStepId,
    );
    if (!repairStepIds.every((stepId, index) => checkpointIds[index] === stepId)) {
      context.addIssue({
        code: "custom",
        path: ["checkpoints"],
        message: "Repair path checkpoints must follow the canonical reconstruction order.",
      });
    }

    const checkpointDistances = repairPath.checkpoints.map(
      (checkpoint) => checkpoint.distance,
    );
    if (
      checkpointDistances.some(
        (distance, index) =>
          distance <=
          (index === 0
            ? repairPath.startDistance
            : checkpointDistances[index - 1]!),
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["checkpoints"],
        message: "Repair path checkpoint distances must increase from the authored start.",
      });
    }

    const actionIds = repairPath.localActions.map((action) => action.repairActionId);
    if (
      new Set(actionIds).size !== repairActionIds.length ||
      !repairActionIds.every((actionId) => actionIds.includes(actionId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["localActions"],
        message: "Repair path actions must contain each approved local action exactly once.",
      });
    }

    if (
      repairPath.localActions.some(
        (action) => Math.abs(action.lateralOffset) > repairPath.corridorHalfWidth,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["localActions"],
        message: "Repair path actions must stay inside the schematic travel corridor.",
      });
    }
  });

export const sceneManifestSchema = z
  .object({
    sceneManifestVersion: z.literal(SCENE_MANIFEST_VERSION),
    caseId: canonicalIdSchema,
    caseVersion: semverSchema,
    modelPolicyVersion: semverSchema,
    initialSpawn: z
      .object({
        zoneId: worldZoneIdSchema,
        spawnId: canonicalIdSchema,
      })
      .strict(),
    repairPath: repairPathSchema,
    zones: z.array(zoneSchema).length(worldZoneIdSchema.options.length),
    interactables: z.array(interactableSchema).min(1),
  })
  .strict()
  .superRefine((manifest, context) => {
    const expectedZoneIds = new Set(worldZoneIdSchema.options);
    const zoneIds = manifest.zones.map((zone) => zone.zoneId);
    if (
      new Set(zoneIds).size !== expectedZoneIds.size ||
      zoneIds.some((zoneId) => !expectedZoneIds.has(zoneId))
    ) {
      context.addIssue({
        code: "custom",
        path: ["zones"],
        message: "The scene manifest must contain each approved zone exactly once.",
      });
    }

    const spawnIds = manifest.zones.flatMap((zone) =>
      zone.safeSpawns.map((spawn) => spawn.spawnId),
    );
    if (new Set(spawnIds).size !== spawnIds.length) {
      context.addIssue({
        code: "custom",
        path: ["zones"],
        message: "Safe spawn IDs must be globally unique.",
      });
    }

    const interactableIds = manifest.interactables.map(
      (interactable) => interactable.interactableId,
    );
    if (new Set(interactableIds).size !== interactableIds.length) {
      context.addIssue({
        code: "custom",
        path: ["interactables"],
        message: "Interactable IDs must be unique.",
      });
    }

    for (const [collectionName, owners] of [
      ["zones", manifest.zones],
      ["interactables", manifest.interactables],
    ] as const) {
      owners.forEach((owner, ownerIndex) => {
        const assetIds = owner.assetReferences.map((reference) => reference.assetId);
        if (new Set(assetIds).size !== assetIds.length) {
          context.addIssue({
            code: "custom",
            path: [collectionName, ownerIndex, "assetReferences"],
            message: "Asset references must be unique for each manifest owner.",
          });
        }
      });
    }
  });

const ambientLineSchema = z
  .object({
    ambientLineId: canonicalIdSchema,
    zoneId: worldZoneIdSchema,
    text: z.string().min(1),
    epistemicClassification: z.literal("dramatization"),
    limitations: z.string().min(1),
    countsAsHistoricalEvidence: z.literal(false),
    affectsProgression: z.literal(false),
    evidenceIds: z.tuple([]),
    factIds: z.tuple([]),
    sourceIds: z.tuple([]),
  })
  .strict();

export const ambientLinesSchema = z
  .object({
    ambientLinesVersion: z.literal(AMBIENT_LINES_VERSION),
    sceneManifestVersion: z.literal(SCENE_MANIFEST_VERSION),
    caseId: canonicalIdSchema,
    caseVersion: semverSchema,
    lines: z.array(ambientLineSchema),
  })
  .strict()
  .superRefine((ambientLines, context) => {
    const ids = ambientLines.lines.map((line) => line.ambientLineId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["lines"],
        message: "Ambient line IDs must be unique.",
      });
    }
  });

export const worldInteractionRequestSchema = z
  .object({
    interactableId: canonicalIdSchema,
    zoneId: worldZoneIdSchema,
    interactionType: worldInteractionTypeSchema,
    canonicalTarget: canonicalTargetSchema,
  })
  .strict();

export type WorldZoneId = z.infer<typeof worldZoneIdSchema>;
export type CanonicalTarget = z.infer<typeof canonicalTargetSchema>;
export type SceneManifest = z.infer<typeof sceneManifestSchema>;
export type AmbientLines = z.infer<typeof ambientLinesSchema>;
export type WorldInteractionRequest = z.infer<typeof worldInteractionRequestSchema>;
