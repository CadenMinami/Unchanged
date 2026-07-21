"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { type RapierCollider, useRapier } from "@react-three/rapier";
import type { Ball as RapierBall, Rotation } from "@dimforge/rapier3d-compat";
import type { EcctrlHandle } from "ecctrl";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";

import {
  CAMERA_CONFIG,
  clampCameraDistance,
  clampCameraPitch,
  clampCameraSensitivity,
} from "@/lib/world/camera-config";
import type { CameraPreferences } from "@/lib/world/camera-preferences";

import type {
  CameraInputChannel,
  CameraInputSnapshot,
} from "./camera-input-boundary";

const POSITION_EPSILON_SQUARED = 1e-10;
const POSITION_EPSILON = Math.sqrt(POSITION_EPSILON_SQUARED);
const DEMAND_FRAME_RECOVERY_DELTA_SECONDS = 1 / 60;

export interface ThirdPersonCameraState {
  yaw: number;
  pitch: number;
  distance: number;
}

export interface CameraPoint {
  x: number;
  y: number;
  z: number;
}

export interface ThirdPersonCameraComposition {
  target: CameraPoint;
  position: CameraPoint;
}

export interface ThirdPersonCameraFrameInput {
  inputEnabled: boolean;
  lookDelta: { x: number; y: number };
  preferences: CameraPreferences;
  snapshot: CameraInputSnapshot;
  wheelDelta: number;
}

export type CameraCollisionDistanceResolver = (
  requestedDistance: number,
  target: Readonly<CameraPoint>,
  requestedPosition: Readonly<CameraPoint>,
) => number;

export interface ThirdPersonCameraRigProps {
  cameraInputChannel: CameraInputChannel;
  cameraNonBlockingColliderRef?: RefObject<RapierCollider | null>;
  controllerRef: RefObject<EcctrlHandle | null>;
  inputEnabled: boolean;
  preferences: CameraPreferences;
  reducedMotion?: boolean;
  resolveCollisionDistance?: CameraCollisionDistanceResolver;
  telemetryEnabled?: boolean;
}

export function createThirdPersonCameraState(): ThirdPersonCameraState {
  return {
    yaw: CAMERA_CONFIG.yaw.default,
    pitch: CAMERA_CONFIG.pitch.default,
    distance: CAMERA_CONFIG.distance.default,
  };
}

function isAcknowledgedCameraInput(
  snapshot: CameraInputSnapshot,
  inputEnabled: boolean,
): boolean {
  return (
    inputEnabled &&
    !snapshot.releasePending &&
    (snapshot.pointerLockActive || snapshot.fallbackDragActive)
  );
}

export function isWheelZoomEligible(
  snapshot: CameraInputSnapshot,
  inputEnabled: boolean,
): boolean {
  return isAcknowledgedCameraInput(snapshot, inputEnabled);
}

function finiteDelta(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function applyThirdPersonCameraInput(
  state: Readonly<ThirdPersonCameraState>,
  input: ThirdPersonCameraFrameInput,
): ThirdPersonCameraState {
  if (!isAcknowledgedCameraInput(input.snapshot, input.inputEnabled)) {
    return state;
  }

  const sensitivity = clampCameraSensitivity(input.preferences.sensitivity);
  const horizontalLook = finiteDelta(input.lookDelta.x);
  const verticalLook = finiteDelta(input.lookDelta.y);
  const wheelDelta = finiteDelta(input.wheelDelta);
  const yaw =
    state.yaw +
    horizontalLook * CAMERA_CONFIG.yaw.radiansPerPixel * sensitivity;
  const verticalDirection = input.preferences.invertY ? 1 : -1;
  const pitch = clampCameraPitch(
    state.pitch +
      verticalLook *
        CAMERA_CONFIG.pitch.radiansPerPixel *
        sensitivity *
        verticalDirection,
  );
  const distance = isWheelZoomEligible(input.snapshot, input.inputEnabled)
    ? clampCameraDistance(
        state.distance +
          wheelDelta * CAMERA_CONFIG.zoom.distancePerWheelPixel,
      )
    : state.distance;

  if (
    yaw === state.yaw &&
    pitch === state.pitch &&
    distance === state.distance
  ) {
    return state;
  }

  return { yaw, pitch, distance };
}

function writeThirdPersonCameraComposition(
  player: Readonly<CameraPoint>,
  state: Readonly<ThirdPersonCameraState>,
  resolvedDistance: number,
  target: CameraPoint,
  position: CameraPoint,
): void {
  const sinYaw = Math.sin(state.yaw);
  const cosYaw = Math.cos(state.yaw);
  const forwardX = sinYaw;
  const forwardZ = -cosYaw;
  const rightX = cosYaw;
  const rightZ = sinYaw;

  target.x =
    player.x +
    rightX * CAMERA_CONFIG.target.shoulderOffset +
    forwardX * CAMERA_CONFIG.target.lookAhead;
  target.y = player.y + CAMERA_CONFIG.target.height;
  target.z =
    player.z +
    rightZ * CAMERA_CONFIG.target.shoulderOffset +
    forwardZ * CAMERA_CONFIG.target.lookAhead;

  const horizontalDistance = Math.cos(state.pitch) * resolvedDistance;
  position.x = target.x - forwardX * horizontalDistance;
  position.y = target.y - Math.sin(state.pitch) * resolvedDistance;
  position.z = target.z - forwardZ * horizontalDistance;
}

export function composeThirdPersonCamera(
  player: Readonly<CameraPoint>,
  state: Readonly<ThirdPersonCameraState>,
  resolvedDistance = state.distance,
): ThirdPersonCameraComposition {
  const composition: ThirdPersonCameraComposition = {
    target: { x: 0, y: 0, z: 0 },
    position: { x: 0, y: 0, z: 0 },
  };
  writeThirdPersonCameraComposition(
    player,
    state,
    resolvedDistance,
    composition.target,
    composition.position,
  );
  return composition;
}

export function getCameraDampingSeconds(reducedMotion: boolean): number {
  return reducedMotion
    ? CAMERA_CONFIG.damping.reducedMotionSeconds
    : CAMERA_CONFIG.damping.standardSeconds;
}

export function calculateCameraDampingAlpha(
  deltaSeconds: number,
  dampingSeconds: number,
): number {
  if (dampingSeconds <= 0) return 1;
  if (Number.isNaN(deltaSeconds) || deltaSeconds <= 0) return 0;
  if (deltaSeconds === Number.POSITIVE_INFINITY) return 1;
  return -Math.expm1(-deltaSeconds / dampingSeconds);
}

function readControllerPosition(
  controller: EcctrlHandle,
  output: Vector3,
): boolean {
  const current = controller.currPos;
  if (
    current &&
    Number.isFinite(current.x) &&
    Number.isFinite(current.y) &&
    Number.isFinite(current.z)
  ) {
    output.copy(current);
    return true;
  }

  const translation = controller.body.translation();
  if (
    !Number.isFinite(translation.x) ||
    !Number.isFinite(translation.y) ||
    !Number.isFinite(translation.z)
  ) {
    return false;
  }
  output.set(translation.x, translation.y, translation.z);
  return true;
}

function constrainResolvedDistance(
  requestedDistance: number,
  resolvedDistance: number,
): number {
  if (!Number.isFinite(resolvedDistance)) return requestedDistance;
  return Math.min(
    requestedDistance,
    Math.max(CAMERA_CONFIG.collision.minDistance, resolvedDistance),
  );
}

function copyPoint(source: Readonly<CameraPoint>, target: CameraPoint): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function pointsDiffer(
  first: Readonly<CameraPoint>,
  second: Readonly<CameraPoint>,
): boolean {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;
  const deltaZ = first.z - second.z;
  return (
    deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ >
    POSITION_EPSILON_SQUARED
  );
}

function dampVector(
  current: Vector3,
  desired: Vector3,
  alpha: number,
): boolean {
  const distanceSquared = current.distanceToSquared(desired);
  if (distanceSquared <= POSITION_EPSILON_SQUARED) {
    current.copy(desired);
    return false;
  }
  if (alpha <= 0) return false;
  if (alpha >= 1) {
    current.copy(desired);
    return true;
  }
  current.lerp(desired, alpha);
  return true;
}

export function ThirdPersonCameraRig({
  cameraInputChannel,
  cameraNonBlockingColliderRef,
  controllerRef,
  inputEnabled,
  preferences,
  reducedMotion = false,
  resolveCollisionDistance,
  telemetryEnabled = false,
}: ThirdPersonCameraRigProps) {
  const { rapier, world } = useRapier();
  const invalidate = useThree((state) => state.invalidate);
  const orbitStateRef = useRef<ThirdPersonCameraState | null>(null);
  const playerPositionRef = useRef(new Vector3());
  const requestedTargetRef = useRef(new Vector3());
  const requestedPositionRef = useRef(new Vector3());
  const smoothedTargetRef = useRef(new Vector3());
  const smoothedPositionRef = useRef(new Vector3());
  const cameraForwardRef = useRef(new Vector3());
  const collisionDirectionRef = useRef(new Vector3());
  const collisionRotationRef = useRef<Rotation>({ x: 0, y: 0, z: 0, w: 1 });
  const collisionProbeRef = useRef<RapierBall | null>(null);
  const cameraNonBlockingColliderRefRef = useRef(
    cameraNonBlockingColliderRef,
  );
  const cameraCollisionFilterRef = useRef(
    (collider: RapierCollider) =>
      collider !== cameraNonBlockingColliderRefRef.current?.current,
  );
  const collisionTargetSnapshotRef = useRef<CameraPoint>({ x: 0, y: 0, z: 0 });
  const collisionPositionSnapshotRef = useRef<CameraPoint>({
    x: 0,
    y: 0,
    z: 0,
  });
  const appliedCollisionDistanceRef = useRef<number>(
    CAMERA_CONFIG.distance.default,
  );
  const collisionRecoveryActiveRef = useRef(false);
  const initializedRef = useRef(false);
  const telemetrySampleIdRef = useRef(0);

  if (collisionProbeRef.current === null) {
    collisionProbeRef.current = new rapier.Ball(
      CAMERA_CONFIG.collision.probeRadius,
    );
  }

  if (orbitStateRef.current === null) {
    orbitStateRef.current = createThirdPersonCameraState();
  }

  useEffect(
    () => cameraInputChannel.subscribe(invalidate),
    [cameraInputChannel, invalidate],
  );
  useEffect(() => {
    cameraNonBlockingColliderRefRef.current = cameraNonBlockingColliderRef;
  }, [cameraNonBlockingColliderRef]);

  useFrame((frameState, deltaSeconds) => {
    const lookDelta = cameraInputChannel.consumeLookDelta();
    const wheelDelta = cameraInputChannel.consumeWheelDelta();
    const snapshot = cameraInputChannel.getSnapshot();
    const currentOrbit = orbitStateRef.current;
    if (currentOrbit === null) return;
    const nextOrbit = applyThirdPersonCameraInput(currentOrbit, {
      inputEnabled,
      lookDelta,
      preferences,
      snapshot,
      wheelDelta,
    });
    const orbitChanged = nextOrbit !== currentOrbit;
    orbitStateRef.current = nextOrbit;

    const controller = controllerRef.current;
    if (
      !controller ||
      !readControllerPosition(controller, playerPositionRef.current)
    ) {
      if (orbitChanged && frameState.frameloop === "demand") {
        frameState.invalidate();
      }
      return;
    }

    writeThirdPersonCameraComposition(
      playerPositionRef.current,
      nextOrbit,
      nextOrbit.distance,
      requestedTargetRef.current,
      requestedPositionRef.current,
    );

    let resolvedDistance = nextOrbit.distance;
    if (resolveCollisionDistance) {
      copyPoint(
        requestedTargetRef.current,
        collisionTargetSnapshotRef.current,
      );
      copyPoint(
        requestedPositionRef.current,
        collisionPositionSnapshotRef.current,
      );
      resolvedDistance = constrainResolvedDistance(
        nextOrbit.distance,
        resolveCollisionDistance(
          nextOrbit.distance,
          collisionTargetSnapshotRef.current,
          collisionPositionSnapshotRef.current,
        ),
      );
    } else {
      const controllerBody = controller.body;
      const collisionDirection = collisionDirectionRef.current;
      const collisionProbe = collisionProbeRef.current;
      collisionDirection.subVectors(
        requestedPositionRef.current,
        requestedTargetRef.current,
      );
      const directionLength = collisionDirection.length();
      if (
        controllerBody &&
        collisionProbe &&
        Number.isFinite(directionLength) &&
        directionLength > POSITION_EPSILON
      ) {
        collisionDirection.multiplyScalar(1 / directionLength);
        const collisionHit = world.castShape(
          requestedTargetRef.current,
          collisionRotationRef.current,
          collisionDirection,
          collisionProbe,
          CAMERA_CONFIG.collision.padding,
          nextOrbit.distance,
          true,
          rapier.QueryFilterFlags.EXCLUDE_SENSORS,
          undefined,
          undefined,
          controllerBody,
          cameraCollisionFilterRef.current,
        );
        resolvedDistance = constrainResolvedDistance(
          nextOrbit.distance,
          collisionHit?.time_of_impact ?? nextOrbit.distance,
        );
      }
    }

    const recoveryDeltaSeconds =
      frameState.frameloop === "demand"
        ? Math.min(deltaSeconds, DEMAND_FRAME_RECOVERY_DELTA_SECONDS)
        : deltaSeconds;
    const dampingAlpha = calculateCameraDampingAlpha(
      recoveryDeltaSeconds,
      getCameraDampingSeconds(reducedMotion),
    );
    const collisionConstrained = resolvedDistance < nextOrbit.distance;
    let cameraChanged = false;
    if (!initializedRef.current) {
      initializedRef.current = true;
      appliedCollisionDistanceRef.current = resolvedDistance;
      collisionRecoveryActiveRef.current = collisionConstrained;
      if (collisionConstrained) {
        writeThirdPersonCameraComposition(
          playerPositionRef.current,
          nextOrbit,
          resolvedDistance,
          requestedTargetRef.current,
          requestedPositionRef.current,
        );
      }
      smoothedTargetRef.current.copy(requestedTargetRef.current);
      smoothedPositionRef.current.copy(requestedPositionRef.current);
      cameraChanged = true;
    } else if (
      collisionConstrained ||
      collisionRecoveryActiveRef.current
    ) {
      let appliedDistance = appliedCollisionDistanceRef.current;
      if (resolvedDistance < appliedDistance) {
        appliedDistance = resolvedDistance;
      } else if (resolvedDistance > appliedDistance) {
        const outwardStep =
          (resolvedDistance - appliedDistance) * dampingAlpha;
        if (outwardStep <= POSITION_EPSILON) {
          appliedDistance = resolvedDistance;
        } else {
          appliedDistance += outwardStep;
        }
      }

      writeThirdPersonCameraComposition(
        playerPositionRef.current,
        nextOrbit,
        appliedDistance,
        requestedTargetRef.current,
        requestedPositionRef.current,
      );
      cameraChanged =
        pointsDiffer(smoothedTargetRef.current, requestedTargetRef.current) ||
        pointsDiffer(smoothedPositionRef.current, requestedPositionRef.current);
      smoothedTargetRef.current.copy(requestedTargetRef.current);
      smoothedPositionRef.current.copy(requestedPositionRef.current);
      appliedCollisionDistanceRef.current = appliedDistance;
      collisionRecoveryActiveRef.current =
        collisionConstrained || appliedDistance < nextOrbit.distance;
    } else {
      appliedCollisionDistanceRef.current = nextOrbit.distance;
      if (orbitChanged) {
        cameraChanged =
          pointsDiffer(smoothedTargetRef.current, requestedTargetRef.current) ||
          pointsDiffer(
            smoothedPositionRef.current,
            requestedPositionRef.current,
          );
        smoothedTargetRef.current.copy(requestedTargetRef.current);
        smoothedPositionRef.current.copy(requestedPositionRef.current);
      } else {
        const targetChanged = dampVector(
          smoothedTargetRef.current,
          requestedTargetRef.current,
          dampingAlpha,
        );
        const positionChanged = dampVector(
          smoothedPositionRef.current,
          requestedPositionRef.current,
          dampingAlpha,
        );
        cameraChanged = targetChanged || positionChanged;
      }
    }

    frameState.camera.position.copy(smoothedPositionRef.current);
    frameState.camera.lookAt(smoothedTargetRef.current);

    if (telemetryEnabled) {
      frameState.camera.getWorldDirection(cameraForwardRef.current);
      telemetrySampleIdRef.current += 1;
      frameState.gl.domElement.dataset.cameraTelemetry = JSON.stringify({
        sampleId: telemetrySampleIdRef.current,
        elapsedTime: frameState.clock.elapsedTime,
        yaw: nextOrbit.yaw,
        pitch: nextOrbit.pitch,
        distance: nextOrbit.distance,
        requestedDistance: nextOrbit.distance,
        appliedCollisionDistance: appliedCollisionDistanceRef.current,
        collisionConstrained,
        playerPosition: playerPositionRef.current.toArray(),
        inputDirection: controller.inputDir.toArray(),
        moveSpeed: controller.moveSpeed,
        cameraPosition: smoothedPositionRef.current.toArray(),
        cameraTarget: smoothedTargetRef.current.toArray(),
        cameraYaw: Math.atan2(
          cameraForwardRef.current.x,
          -cameraForwardRef.current.z,
        ),
        cameraPitch: Math.asin(cameraForwardRef.current.y),
      });
    }

    if (
      frameState.frameloop === "demand" &&
      (orbitChanged || cameraChanged)
    ) {
      frameState.invalidate();
    }
  });

  return null;
}
