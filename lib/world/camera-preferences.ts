import {
  CAMERA_CONFIG,
  clampCameraSensitivity,
} from "@/lib/world/camera-config";

export const CAMERA_PREFERENCES_STORAGE_KEY =
  "history-unbroken:world-camera-preferences";
export const CAMERA_PREFERENCES_VERSION = "1.0.0" as const;

export interface CameraPreferences {
  sensitivity: number;
  invertY: boolean;
  pointerLockIntroduced: boolean;
}

export const DEFAULT_CAMERA_PREFERENCES: Readonly<CameraPreferences> =
  Object.freeze({
    sensitivity: CAMERA_CONFIG.sensitivity.default,
    invertY: false,
    pointerLockIntroduced: false,
  });

function defaultCameraPreferences(): CameraPreferences {
  return { ...DEFAULT_CAMERA_PREFERENCES };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isValidSensitivity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= CAMERA_CONFIG.sensitivity.min &&
    value <= CAMERA_CONFIG.sensitivity.max
  );
}

export function parseCameraPreferences(raw: string | null): CameraPreferences {
  if (raw === null) return defaultCameraPreferences();

  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    return defaultCameraPreferences();
  }

  if (
    !isRecord(candidate) ||
    !hasExactKeys(candidate, ["version", "preferences"]) ||
    candidate.version !== CAMERA_PREFERENCES_VERSION ||
    !isRecord(candidate.preferences) ||
    !hasExactKeys(candidate.preferences, [
      "sensitivity",
      "invertY",
      "pointerLockIntroduced",
    ]) ||
    !isValidSensitivity(candidate.preferences.sensitivity) ||
    typeof candidate.preferences.invertY !== "boolean" ||
    typeof candidate.preferences.pointerLockIntroduced !== "boolean"
  ) {
    return defaultCameraPreferences();
  }

  return {
    sensitivity: candidate.preferences.sensitivity,
    invertY: candidate.preferences.invertY,
    pointerLockIntroduced: candidate.preferences.pointerLockIntroduced,
  };
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage;
}

export function loadCameraPreferences(
  storage?: Pick<Storage, "getItem">,
): CameraPreferences {
  try {
    const source = storage ?? browserStorage();
    if (!source) return defaultCameraPreferences();
    return parseCameraPreferences(source.getItem(CAMERA_PREFERENCES_STORAGE_KEY));
  } catch {
    return defaultCameraPreferences();
  }
}

function normalizeCameraPreferences(
  preferences: CameraPreferences,
): CameraPreferences {
  if (
    typeof preferences.invertY !== "boolean" ||
    typeof preferences.pointerLockIntroduced !== "boolean"
  ) {
    return defaultCameraPreferences();
  }

  return {
    sensitivity: clampCameraSensitivity(preferences.sensitivity),
    invertY: preferences.invertY,
    pointerLockIntroduced: preferences.pointerLockIntroduced,
  };
}

export function saveCameraPreferences(
  preferences: CameraPreferences,
  storage?: Pick<Storage, "setItem">,
): void {
  try {
    const target = storage ?? browserStorage();
    if (!target) return;
    target.setItem(
      CAMERA_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: normalizeCameraPreferences(preferences),
      }),
    );
  } catch {
    // Camera preferences are optional and must never block the world experience.
  }
}
