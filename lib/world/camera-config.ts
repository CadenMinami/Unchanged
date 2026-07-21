interface BoundedCameraValue {
  readonly min: number;
  readonly max: number;
  readonly default: number;
}

export const CAMERA_CONFIG = Object.freeze({
  yaw: Object.freeze({
    default: Math.PI / 2,
    radiansPerPixel: 0.0025,
  }),
  pitch: Object.freeze({
    min: -Math.PI / 3,
    max: Math.PI / 4,
    default: -Math.PI / 18,
    radiansPerPixel: 0.002,
  }),
  distance: Object.freeze({
    min: 2.25,
    max: 6,
    default: 4,
  }),
  zoom: Object.freeze({
    distancePerWheelPixel: 0.004,
  }),
  damping: Object.freeze({
    standardSeconds: 0.12,
    reducedMotionSeconds: 0,
  }),
  target: Object.freeze({
    // The visible investigator rig is offset below Ecctrl's physics origin.
    // Aim at the model's torso rather than above its head so close third-person
    // views retain the player in frame.
    height: 0.45,
    shoulderOffset: 0.45,
    lookAhead: 0.25,
  }),
  sensitivity: Object.freeze({
    min: 0.5,
    max: 2,
    default: 1,
    step: 0.1,
  }),
  collision: Object.freeze({
    probeRadius: 0.25,
    padding: 0.15,
    minDistance: 1.25,
  }),
});

function clampBoundedCameraValue(
  value: number,
  bounds: BoundedCameraValue,
): number {
  if (!Number.isFinite(value)) {
    if (value === Number.POSITIVE_INFINITY) return bounds.max;
    if (value === Number.NEGATIVE_INFINITY) return bounds.min;
    return bounds.default;
  }

  return Math.min(bounds.max, Math.max(bounds.min, value));
}

export function clampCameraPitch(value: number): number {
  return clampBoundedCameraValue(value, CAMERA_CONFIG.pitch);
}

export function clampCameraDistance(value: number): number {
  return clampBoundedCameraValue(value, CAMERA_CONFIG.distance);
}

export function clampCameraSensitivity(value: number): number {
  return clampBoundedCameraValue(value, CAMERA_CONFIG.sensitivity);
}
