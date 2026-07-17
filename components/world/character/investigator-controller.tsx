"use client";

import {
  KeyboardControls,
  type KeyboardControlsEntry,
  useKeyboardControls,
} from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle, type MovementInput } from "ecctrl";
import type { RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { FollowCamera } from "./follow-camera";
import { InvestigatorModel } from "./investigator-model";
import type { FigureMotion } from "./period-figure";

type ControlName = "forward" | "backward" | "leftward" | "rightward" | "run";

export type InvestigatorControlState = Record<ControlName, boolean>;

const keyboardMap: KeyboardControlsEntry<ControlName>[] = [
  { name: "forward", keys: ["ArrowUp", "KeyW"] },
  { name: "backward", keys: ["ArrowDown", "KeyS"] },
  { name: "leftward", keys: ["ArrowLeft", "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "run", keys: ["ShiftLeft", "ShiftRight"] },
];

const stoppedMovement: MovementInput = {
  forward: false,
  backward: false,
  leftward: false,
  rightward: false,
  run: false,
  jump: false,
};

export function resolveInvestigatorMovement(
  state: InvestigatorControlState,
  enabled: boolean,
): MovementInput {
  if (!enabled) return stoppedMovement;

  return {
    forward: state.forward,
    backward: state.backward,
    leftward: state.leftward,
    rightward: state.rightward,
    run: state.run,
    jump: false,
  };
}

export function resolveInvestigatorMotion(
  moving: boolean,
  runActive: boolean,
  enabled: boolean,
): FigureMotion {
  if (!enabled || !moving) return "idle";
  return runActive ? "run" : "walk";
}

export function shouldStopHorizontalVelocity(wasMoving: boolean, moving: boolean) {
  return wasMoving && !moving;
}

interface InvestigatorControllerProps {
  controllerRef: RefObject<EcctrlHandle | null>;
  enabled: boolean;
  initialPosition: [number, number, number];
  onControllerReady: () => void;
  onPositionChange?: (position: [number, number, number]) => void;
  reducedMotion?: boolean;
}

function stopHorizontalVelocity(controller: EcctrlHandle) {
  const body = controller.body;
  if (!body) return;

  const velocity = body.linvel();
  body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
}

function InvestigatorControllerRuntime({
  controllerRef,
  enabled,
  initialPosition,
  onControllerReady,
  onPositionChange,
  reducedMotion = false,
}: InvestigatorControllerProps) {
  const [subscribeControls, getControls] = useKeyboardControls<ControlName>();
  const invalidate = useThree((state) => state.invalidate);
  const lastPositionSampleAt = useRef(Number.NEGATIVE_INFINITY);
  const controllerReadyRef = useRef(false);
  const movingRef = useRef(false);
  const [motion, setMotion] = useState<FigureMotion>("idle");

  const applyControls = useCallback(
    (controller: EcctrlHandle, state: InvestigatorControlState, active: boolean) => {
      const movement = resolveInvestigatorMovement(state, active);
      const moving = Boolean(
        active &&
          (movement.forward ||
            movement.backward ||
            movement.leftward ||
            movement.rightward),
      );
      const wasMoving = movingRef.current;
      movingRef.current = moving;
      controller.setMovement(movement);
      if (shouldStopHorizontalVelocity(wasMoving, moving)) {
        stopHorizontalVelocity(controller);
      }
    },
    [],
  );

  useFrame(({ clock }) => {
    const controller = controllerRef.current;
    if (!controllerReadyRef.current && controller?.body) {
      applyControls(controller, getControls(), enabled);
      controllerReadyRef.current = true;
      onControllerReady();
    } else if (!controllerReadyRef.current) {
      invalidate();
    }

    const nextMotion = resolveInvestigatorMotion(
      movingRef.current,
      controller?.runActive ?? false,
      enabled,
    );
    if (nextMotion !== motion) setMotion(nextMotion);

    if (!onPositionChange || clock.elapsedTime - lastPositionSampleAt.current < 0.1) {
      return;
    }
    const body = controller?.body;
    if (!body) return;
    const position = body.translation();
    lastPositionSampleAt.current = clock.elapsedTime;
    onPositionChange([position.x, position.y, position.z]);
  });

  useLayoutEffect(() => {
    const controller = controllerRef.current;
    if (controller) applyControls(controller, getControls(), enabled);
  }, [applyControls, controllerRef, enabled, getControls]);

  useEffect(
    () =>
      subscribeControls((state) => {
        const controller = controllerRef.current;
        if (controller) applyControls(controller, state, enabled);
      }),
    [applyControls, controllerRef, enabled, subscribeControls],
  );

  return (
    <>
      <Ecctrl
        applyCounterJumpImp={false}
        applyCounterMass={false}
        applyCounterMoveImp={false}
        enable={enabled}
        enableToggleRun
        followPlatform={false}
        groundDetection="rayCast"
        jumpVel={0}
        capsuleHalfHeight={0.55}
        capsuleRadius={0.35}
        ccd
        maxRunVel={4}
        maxWalkVel={2.2}
        position={initialPosition}
        ref={controllerRef}
      >
        <InvestigatorModel motion={motion} reducedMotion={reducedMotion} />
      </Ecctrl>
      <FollowCamera controllerRef={controllerRef} enabled={enabled} reducedMotion={reducedMotion} />
    </>
  );
}

export function InvestigatorController(props: InvestigatorControllerProps) {
  return (
    <KeyboardControls map={keyboardMap}>
      <InvestigatorControllerRuntime {...props} />
    </KeyboardControls>
  );
}
