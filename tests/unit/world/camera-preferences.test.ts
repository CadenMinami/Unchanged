import { describe, expect, it, vi } from "vitest";

import { CAMERA_CONFIG } from "@/lib/world/camera-config";
import {
  CAMERA_PREFERENCES_STORAGE_KEY,
  CAMERA_PREFERENCES_VERSION,
  DEFAULT_CAMERA_PREFERENCES,
  loadCameraPreferences,
  parseCameraPreferences,
  saveCameraPreferences,
  type CameraPreferences,
} from "@/lib/world/camera-preferences";

const VALID_PREFERENCES: CameraPreferences = {
  sensitivity: 1.4,
  invertY: true,
  pointerLockIntroduced: true,
};

function serializePreferences(
  preferences: CameraPreferences = VALID_PREFERENCES,
): string {
  return JSON.stringify({
    version: CAMERA_PREFERENCES_VERSION,
    preferences,
  });
}

describe("camera preference parsing", () => {
  it("exports immutable authored defaults", () => {
    expect(CAMERA_PREFERENCES_STORAGE_KEY).toBe(
      "history-unbroken:world-camera-preferences",
    );
    expect(CAMERA_PREFERENCES_VERSION).toBe("1.0.0");
    expect(DEFAULT_CAMERA_PREFERENCES).toEqual({
      sensitivity: 1,
      invertY: false,
      pointerLockIntroduced: false,
    });
    expect(DEFAULT_CAMERA_PREFERENCES.sensitivity).toBe(
      CAMERA_CONFIG.sensitivity.default,
    );
    expect(Object.isFrozen(DEFAULT_CAMERA_PREFERENCES)).toBe(true);
  });

  it("accepts the exact version 1.0.0 envelope", () => {
    expect(parseCameraPreferences(serializePreferences())).toEqual(
      VALID_PREFERENCES,
    );
  });

  it.each([
    ["missing storage", null],
    ["malformed JSON", "{"],
    ["a non-object envelope", "[]"],
    [
      "an unsupported version",
      JSON.stringify({ version: "2.0.0", preferences: VALID_PREFERENCES }),
    ],
    [
      "an unknown envelope property",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: VALID_PREFERENCES,
        caseState: { revision: 7 },
      }),
    ],
    [
      "an unknown preference property",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: { ...VALID_PREFERENCES, yaw: 1 },
      }),
    ],
    [
      "a string sensitivity",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: { ...VALID_PREFERENCES, sensitivity: "1.4" },
      }),
    ],
    [
      "a non-boolean invert-Y value",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: { ...VALID_PREFERENCES, invertY: 1 },
      }),
    ],
    [
      "a non-boolean pointer-lock value",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: { ...VALID_PREFERENCES, pointerLockIntroduced: "yes" },
      }),
    ],
    [
      "sensitivity below the authored range",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: {
          ...VALID_PREFERENCES,
          sensitivity: CAMERA_CONFIG.sensitivity.min - 0.01,
        },
      }),
    ],
    [
      "sensitivity above the authored range",
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: {
          ...VALID_PREFERENCES,
          sensitivity: CAMERA_CONFIG.sensitivity.max + 0.01,
        },
      }),
    ],
    [
      "a non-finite sensitivity",
      `{"version":"${CAMERA_PREFERENCES_VERSION}","preferences":{"sensitivity":1e309,"invertY":false,"pointerLockIntroduced":false}}`,
    ],
  ] as const)("resets to defaults for %s", (_label, raw) => {
    expect(parseCameraPreferences(raw)).toEqual(DEFAULT_CAMERA_PREFERENCES);
  });
});

describe("camera preference storage", () => {
  it("loads from the camera preference key", () => {
    const getItem = vi.fn(() => serializePreferences());

    expect(loadCameraPreferences({ getItem })).toEqual(VALID_PREFERENCES);
    expect(getItem).toHaveBeenCalledOnce();
    expect(getItem).toHaveBeenCalledWith(CAMERA_PREFERENCES_STORAGE_KEY);
  });

  it("returns defaults when reading storage throws", () => {
    const storage = {
      getItem(): string | null {
        throw new Error("Storage unavailable");
      },
    };

    expect(() => loadCameraPreferences(storage)).not.toThrow();
    expect(loadCameraPreferences(storage)).toEqual(DEFAULT_CAMERA_PREFERENCES);
  });

  it("saves a strict envelope and round-trips it", () => {
    let serialized: string | null = null;
    const storage = {
      getItem: vi.fn(() => serialized),
      setItem: vi.fn((_key: string, value: string) => {
        serialized = value;
      }),
    };

    saveCameraPreferences(VALID_PREFERENCES, storage);

    expect(storage.setItem).toHaveBeenCalledWith(
      CAMERA_PREFERENCES_STORAGE_KEY,
      serializePreferences(),
    );
    expect(loadCameraPreferences(storage)).toEqual(VALID_PREFERENCES);
    expect(Object.keys(JSON.parse(serialized ?? "null"))).toEqual([
      "version",
      "preferences",
    ]);
  });

  it("round-trips through browser storage when no adapter is supplied", () => {
    window.localStorage.removeItem(CAMERA_PREFERENCES_STORAGE_KEY);

    try {
      saveCameraPreferences(VALID_PREFERENCES);

      expect(loadCameraPreferences()).toEqual(VALID_PREFERENCES);
    } finally {
      window.localStorage.removeItem(CAMERA_PREFERENCES_STORAGE_KEY);
    }
  });

  it("clamps sensitivity before writing a persisted envelope", () => {
    const setItem = vi.fn();

    saveCameraPreferences(
      {
        ...VALID_PREFERENCES,
        sensitivity: Number.POSITIVE_INFINITY,
      },
      { setItem },
    );

    const serialized = setItem.mock.calls[0]?.[1] as string;
    expect(JSON.parse(serialized)).toEqual({
      version: CAMERA_PREFERENCES_VERSION,
      preferences: {
        ...VALID_PREFERENCES,
        sensitivity: CAMERA_CONFIG.sensitivity.max,
      },
    });
  });

  it("fails silently when writing storage throws", () => {
    const storage = {
      setItem(): void {
        throw new Error("Storage unavailable");
      },
    };

    expect(() => saveCameraPreferences(VALID_PREFERENCES, storage)).not.toThrow();
  });

  it("persists pointer-lock onboarding only when the caller changes the field", () => {
    const setItem = vi.fn();

    saveCameraPreferences(DEFAULT_CAMERA_PREFERENCES, { setItem });
    expect(
      JSON.parse(setItem.mock.calls[0]?.[1] as string).preferences
        .pointerLockIntroduced,
    ).toBe(false);

    saveCameraPreferences(
      { ...DEFAULT_CAMERA_PREFERENCES, pointerLockIntroduced: true },
      { setItem },
    );
    expect(
      JSON.parse(setItem.mock.calls[1]?.[1] as string).preferences
        .pointerLockIntroduced,
    ).toBe(true);
  });

  it("does not change case or spatial-session storage", () => {
    const values = new Map<string, string>([
      ["history-unbroken:varennes:learning-session", "case-state"],
      ["history-unbroken:varennes:spatial-session", "spatial-state"],
    ]);
    const storage = {
      setItem(key: string, value: string): void {
        values.set(key, value);
      },
    };

    saveCameraPreferences(VALID_PREFERENCES, storage);

    expect(values.get("history-unbroken:varennes:learning-session")).toBe(
      "case-state",
    );
    expect(values.get("history-unbroken:varennes:spatial-session")).toBe(
      "spatial-state",
    );
    expect(values.get(CAMERA_PREFERENCES_STORAGE_KEY)).toBe(
      serializePreferences(),
    );
  });
});
