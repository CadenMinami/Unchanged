export const FIGURE_MOTIONS = [
  "idle",
  "walk",
  "run",
  "talk",
  "interact",
] as const;

export type FigureMotion = (typeof FIGURE_MOTIONS)[number];

export const REQUIRED_FIGURE_CLIP_MOTIONS = ["idle", "walk", "run"] as const;

export type RequiredFigureClipMotion =
  (typeof REQUIRED_FIGURE_CLIP_MOTIONS)[number];

export const FIGURE_ROOT_MOTION_STATUSES = [
  "in_place",
  "root_motion",
  "unknown",
] as const;

export type FigureRootMotionStatus =
  (typeof FIGURE_ROOT_MOTION_STATUSES)[number];

export type FigureClipDescriptor = Readonly<{
  name: string;
  rootMotionStatus: FigureRootMotionStatus;
}>;

export type FigureClipCandidate = FigureClipDescriptor;

export type FigureClipMap = Readonly<
  Record<RequiredFigureClipMotion, string>
>;

export type FigureClipValidation =
  | Readonly<{
      valid: true;
      clips: FigureClipMap;
    }>
  | Readonly<{
      valid: false;
      missing: readonly RequiredFigureClipMotion[];
      rootMotionOnly: readonly RequiredFigureClipMotion[];
      unknownStatus: readonly RequiredFigureClipMotion[];
    }>;

const CLIP_ALIASES: Readonly<
  Record<RequiredFigureClipMotion, readonly string[]>
> = {
  idle: ["idle", "standing idle", "idle 01", "idle 1", "idle loop"],
  walk: ["walk", "walking", "walk in place", "walk loop"],
  run: [
    "run",
    "running",
    "jog",
    "jogging",
    "run in place",
    "jog in place",
    "jog fwd loop",
    "jog forward loop",
  ],
};

function clipName(candidate: unknown): string | undefined {
  if (typeof candidate === "string") return candidate;
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "name" in candidate &&
    typeof candidate.name === "string"
  ) {
    return candidate.name;
  }

  return undefined;
}

function normalizeClipName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function rootMotionStatus(candidate: unknown): FigureRootMotionStatus {
  if (
    typeof candidate === "object" &&
    candidate !== null &&
    "rootMotionStatus" in candidate &&
    FIGURE_ROOT_MOTION_STATUSES.includes(
      candidate.rootMotionStatus as FigureRootMotionStatus,
    )
  ) {
    return candidate.rootMotionStatus as FigureRootMotionStatus;
  }

  return "unknown";
}

function findClip(
  motion: RequiredFigureClipMotion,
  candidates: readonly FigureClipCandidate[],
  status: FigureRootMotionStatus,
): string | undefined {
  for (const alias of CLIP_ALIASES[motion]) {
    const candidate = candidates.find(
      (clip) => {
        const name = clipName(clip);
        return (
          name !== undefined &&
          rootMotionStatus(clip) === status &&
          normalizeClipName(name) === alias
        );
      },
    );
    if (candidate) return clipName(candidate);
  }

  return undefined;
}

export function validateFigureClips(
  candidates: readonly FigureClipCandidate[],
): FigureClipValidation {
  const resolved: Partial<Record<RequiredFigureClipMotion, string>> = {};
  const missing: RequiredFigureClipMotion[] = [];
  const rootMotionOnly: RequiredFigureClipMotion[] = [];
  const unknownStatus: RequiredFigureClipMotion[] = [];

  for (const motion of REQUIRED_FIGURE_CLIP_MOTIONS) {
    const inPlaceClip = findClip(motion, candidates, "in_place");
    if (inPlaceClip) {
      resolved[motion] = inPlaceClip;
      continue;
    }

    if (findClip(motion, candidates, "unknown")) {
      unknownStatus.push(motion);
    } else if (findClip(motion, candidates, "root_motion")) {
      rootMotionOnly.push(motion);
    } else {
      missing.push(motion);
    }
  }

  if (
    missing.length > 0 ||
    rootMotionOnly.length > 0 ||
    unknownStatus.length > 0
  ) {
    return { valid: false, missing, rootMotionOnly, unknownStatus };
  }

  return {
    valid: true,
    clips: {
      idle: resolved.idle!,
      walk: resolved.walk!,
      run: resolved.run!,
    },
  };
}

function invalidClipSetMessage(
  validation: Extract<FigureClipValidation, { valid: false }>,
): string {
  const reasons: string[] = [];
  if (validation.missing.length > 0) {
    reasons.push(`missing required clips: ${validation.missing.join(", ")}`);
  }
  if (validation.rootMotionOnly.length > 0) {
    reasons.push(
      `root-motion-only required clips: ${validation.rootMotionOnly.join(", ")}`,
    );
  }
  if (validation.unknownStatus.length > 0) {
    reasons.push(
      `unknown root-motion status for required clips: ${validation.unknownStatus.join(", ")}`,
    );
  }

  return `Invalid figure clip set (${reasons.join("; ")}).`;
}

export function resolveFigureClip(
  motion: FigureMotion,
  candidates: readonly FigureClipCandidate[],
): string {
  const validation = validateFigureClips(candidates);
  if (!validation.valid) {
    throw new Error(invalidClipSetMessage(validation));
  }

  const clipMotion =
    motion === "talk" || motion === "interact" ? "idle" : motion;
  return validation.clips[clipMotion];
}

export function shouldAnimateFigureMotion(
  motion: FigureMotion,
  reducedMotion: boolean,
): boolean {
  return !reducedMotion || motion === "walk" || motion === "run";
}
