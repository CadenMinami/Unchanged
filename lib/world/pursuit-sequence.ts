import type { repairActionIds, repairStepIds } from "@/schemas/reconstruction";
import type { SceneManifest } from "@/schemas/world-manifest";

type RepairStepId = (typeof repairStepIds)[number];
type RepairActionId = (typeof repairActionIds)[number];
export type RepairPath = SceneManifest["repairPath"];

export interface PursuitSequenceState {
  availableActionIds: RepairActionId[];
  currentStepId: RepairStepId | null;
  currentStepReady: boolean;
  maximumDistance: number;
  minimumDistance: number;
  sequenceComplete: boolean;
}

export interface PursuitMotion {
  distance: number;
  lateralOffset: number;
}

export interface PursuitMotionControls {
  fast: boolean;
  forward: boolean;
  left: boolean;
  reverse: boolean;
  right: boolean;
}

const WALKING_PACE = 4;
const FAST_PACE = 7;
const STEERING_PACE = 3;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

/**
 * Advances the schematic trace only within the reducer-owned checkpoint and
 * manifest corridor. It deliberately has no timers, scoring, or progression
 * side effects; callers decide when a reached checkpoint may request a step.
 */
export function advancePursuitMotion(
  motion: PursuitMotion,
  controls: PursuitMotionControls,
  elapsedSeconds: number,
  sequence: PursuitSequenceState,
  path: RepairPath,
): PursuitMotion {
  const elapsed = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const longitudinalDirection = Number(controls.forward) - Number(controls.reverse);
  const lateralDirection = Number(controls.right) - Number(controls.left);
  const pace = controls.fast ? FAST_PACE : WALKING_PACE;

  return {
    distance: clamp(
      motion.distance + longitudinalDirection * pace * elapsed,
      sequence.minimumDistance,
      sequence.maximumDistance,
    ),
    lateralOffset: clamp(
      motion.lateralOffset + lateralDirection * STEERING_PACE * elapsed,
      -path.corridorHalfWidth,
      path.corridorHalfWidth,
    ),
  };
}

function isCanonicalPrefix(
  path: RepairPath,
  completedStepIds: readonly string[],
): boolean {
  return completedStepIds.every(
    (stepId, index) => path.checkpoints[index]?.repairStepId === stepId,
  );
}

export function getCheckpointStartDistance(
  path: RepairPath,
  completedStepCount: number,
): number {
  if (completedStepCount <= 0) return path.startDistance;
  return path.checkpoints[completedStepCount - 1]?.distance ?? path.startDistance;
}

export function derivePursuitSequenceState(
  path: RepairPath,
  completedStepIds: readonly string[],
  completedActionIds: readonly string[],
): PursuitSequenceState {
  if (!isCanonicalPrefix(path, completedStepIds)) {
    throw new Error("Completed repair steps are outside the canonical order.");
  }

  const knownActionIds = new Set(
    path.localActions.map((action) => action.repairActionId),
  );
  if (completedActionIds.some((actionId) => !knownActionIds.has(actionId as RepairActionId))) {
    throw new Error("Completed repair actions contain an unknown action ID.");
  }
  if (
    new Set(completedActionIds).size !== completedActionIds.length ||
    (completedActionIds.length > 0 && completedStepIds.length < 4)
  ) {
    throw new Error("Completed repair actions are outside the canonical order.");
  }

  const currentCheckpoint = path.checkpoints[completedStepIds.length] ?? null;
  const currentStepId = currentCheckpoint?.repairStepId ?? null;
  const requiredActionIds = currentStepId
    ? path.localActions
        .filter((action) => action.parentStepId === currentStepId)
        .map((action) => action.repairActionId)
    : [];
  const availableActionIds = requiredActionIds.filter(
    (actionId) => !completedActionIds.includes(actionId),
  );
  const minimumDistance = getCheckpointStartDistance(path, completedStepIds.length);

  return {
    availableActionIds,
    currentStepId,
    currentStepReady:
      requiredActionIds.length === 0 || availableActionIds.length === 0,
    maximumDistance:
      currentCheckpoint?.distance ?? path.checkpoints.at(-1)?.distance ?? path.startDistance,
    minimumDistance,
    sequenceComplete: currentCheckpoint === null,
  };
}
