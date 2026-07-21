import { describe, expect, it } from "vitest";

import {
  CAMERA_CONFIG,
  clampCameraDistance,
  clampCameraPitch,
  clampCameraSensitivity,
} from "@/lib/world/camera-config";

describe("camera configuration", () => {
  it("keeps every tuning group immutable", () => {
    expect(Object.isFrozen(CAMERA_CONFIG)).toBe(true);

    for (const tuningGroup of Object.values(CAMERA_CONFIG)) {
      expect(Object.isFrozen(tuningGroup)).toBe(true);
    }
  });

  it("authors unrestricted yaw input and a comfortable pitch range", () => {
    expect(CAMERA_CONFIG.yaw.radiansPerPixel).toBeGreaterThan(0);
    expect(Number.isFinite(CAMERA_CONFIG.yaw.default)).toBe(true);
    expect(CAMERA_CONFIG.yaw.default).toBe(Math.PI / 2);
    expect(CAMERA_CONFIG.pitch.min).toBeGreaterThan(-Math.PI / 2);
    expect(CAMERA_CONFIG.pitch.max).toBeLessThan(Math.PI / 2);
    expect(CAMERA_CONFIG.pitch.min).toBeLessThan(CAMERA_CONFIG.pitch.max);
    expect(CAMERA_CONFIG.pitch.default).toBeGreaterThanOrEqual(
      CAMERA_CONFIG.pitch.min,
    );
    expect(CAMERA_CONFIG.pitch.default).toBeLessThanOrEqual(
      CAMERA_CONFIG.pitch.max,
    );
    expect(CAMERA_CONFIG.pitch.radiansPerPixel).toBeGreaterThan(0);
  });

  it("authors bounded distance and wheel zoom tuning", () => {
    expect(CAMERA_CONFIG.distance.min).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.distance.min).toBeLessThan(
      CAMERA_CONFIG.distance.max,
    );
    expect(CAMERA_CONFIG.distance.default).toBeGreaterThanOrEqual(
      CAMERA_CONFIG.distance.min,
    );
    expect(CAMERA_CONFIG.distance.default).toBeLessThanOrEqual(
      CAMERA_CONFIG.distance.max,
    );
    expect(CAMERA_CONFIG.zoom.distancePerWheelPixel).toBeGreaterThan(0);
  });

  it("authors damping, shoulder composition, and collision tuning", () => {
    expect(CAMERA_CONFIG.damping.standardSeconds).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.damping.reducedMotionSeconds).toBeGreaterThanOrEqual(0);
    expect(CAMERA_CONFIG.damping.reducedMotionSeconds).toBeLessThan(
      CAMERA_CONFIG.damping.standardSeconds,
    );
    expect(CAMERA_CONFIG.target.height).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.target.shoulderOffset).not.toBe(0);
    expect(CAMERA_CONFIG.target.lookAhead).toBeGreaterThanOrEqual(0);
    expect(CAMERA_CONFIG.collision.probeRadius).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.collision.padding).toBeGreaterThanOrEqual(0);
    expect(CAMERA_CONFIG.collision.minDistance).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.collision.minDistance).toBeLessThanOrEqual(
      CAMERA_CONFIG.distance.min,
    );
  });

  it("authors a bounded sensitivity range containing its default", () => {
    expect(CAMERA_CONFIG.sensitivity.min).toBeGreaterThan(0);
    expect(CAMERA_CONFIG.sensitivity.min).toBeLessThan(
      CAMERA_CONFIG.sensitivity.max,
    );
    expect(CAMERA_CONFIG.sensitivity.default).toBeGreaterThanOrEqual(
      CAMERA_CONFIG.sensitivity.min,
    );
    expect(CAMERA_CONFIG.sensitivity.default).toBeLessThanOrEqual(
      CAMERA_CONFIG.sensitivity.max,
    );
    expect(CAMERA_CONFIG.sensitivity.step).toBeGreaterThan(0);
  });
});

describe("camera configuration clamps", () => {
  it("clamps pitch and uses the authored default for NaN", () => {
    expect(clampCameraPitch(Number.NEGATIVE_INFINITY)).toBe(
      CAMERA_CONFIG.pitch.min,
    );
    expect(clampCameraPitch(Number.POSITIVE_INFINITY)).toBe(
      CAMERA_CONFIG.pitch.max,
    );
    expect(clampCameraPitch(Number.NaN)).toBe(CAMERA_CONFIG.pitch.default);
    expect(clampCameraPitch(0)).toBe(0);
  });

  it("clamps distance and uses the authored default for NaN", () => {
    expect(clampCameraDistance(Number.NEGATIVE_INFINITY)).toBe(
      CAMERA_CONFIG.distance.min,
    );
    expect(clampCameraDistance(Number.POSITIVE_INFINITY)).toBe(
      CAMERA_CONFIG.distance.max,
    );
    expect(clampCameraDistance(Number.NaN)).toBe(CAMERA_CONFIG.distance.default);
    expect(clampCameraDistance(CAMERA_CONFIG.distance.default)).toBe(
      CAMERA_CONFIG.distance.default,
    );
  });

  it("clamps sensitivity and uses the authored default for NaN", () => {
    expect(clampCameraSensitivity(Number.NEGATIVE_INFINITY)).toBe(
      CAMERA_CONFIG.sensitivity.min,
    );
    expect(clampCameraSensitivity(Number.POSITIVE_INFINITY)).toBe(
      CAMERA_CONFIG.sensitivity.max,
    );
    expect(clampCameraSensitivity(Number.NaN)).toBe(
      CAMERA_CONFIG.sensitivity.default,
    );
    expect(clampCameraSensitivity(CAMERA_CONFIG.sensitivity.default)).toBe(
      CAMERA_CONFIG.sensitivity.default,
    );
  });
});
