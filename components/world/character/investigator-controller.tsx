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

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

import type { FigureMotion } from "./figure-motion";
import { InvestigatorModel } from "./investigator-model";

type ControlName = "forward" | "backward" | "leftward" | "rightward" | "run";
type PhysicalControlKey =
  | "ArrowDown"
  | "ArrowLeft"
  | "ArrowRight"
  | "ArrowUp"
  | "KeyA"
  | "KeyD"
  | "KeyS"
  | "KeyW"
  | "ShiftLeft"
  | "ShiftRight";

export type InvestigatorControlState = Record<ControlName, boolean>;

const physicalControlNames: Readonly<Record<PhysicalControlKey, ControlName>> = {
  ArrowDown: "backward",
  ArrowLeft: "leftward",
  ArrowRight: "rightward",
  ArrowUp: "forward",
  KeyA: "leftward",
  KeyD: "rightward",
  KeyS: "backward",
  KeyW: "forward",
  ShiftLeft: "run",
  ShiftRight: "run",
};

const stoppedControls: InvestigatorControlState = {
  forward: false,
  backward: false,
  leftward: false,
  rightward: false,
  run: false,
};

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

export function shouldStopHorizontalVelocity(
  wasMoving: boolean,
  moving: boolean,
  enabled = true,
) {
  return !enabled || (wasMoving && !moving);
}

interface InvestigatorControllerProps {
  controllerRef: RefObject<EcctrlHandle | null>;
  enabled: boolean;
  graphicsProfile: GraphicsProfile;
  initialPosition: [number, number, number];
  movementResetGeneration?: number;
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

function getPhysicalControlKey(event: KeyboardEvent): PhysicalControlKey | null {
  if (event.code in physicalControlNames) {
    return event.code as PhysicalControlKey;
  }
  if (event.key in physicalControlNames) {
    return event.key as PhysicalControlKey;
  }

  const letterCode = `Key${event.key.toUpperCase()}`;
  return letterCode in physicalControlNames
    ? (letterCode as PhysicalControlKey)
    : null;
}

function resolveUnblockedPhysicalControls(
  pressedKeys: ReadonlySet<PhysicalControlKey>,
  blockedKeys: ReadonlySet<PhysicalControlKey>,
): InvestigatorControlState {
  const controls = { ...stoppedControls };
  for (const key of pressedKeys) {
    if (!blockedKeys.has(key)) controls[physicalControlNames[key]] = true;
  }
  return controls;
}

function InvestigatorControllerRuntime({
  controllerRef,
  enabled,
  graphicsProfile,
  initialPosition,
  movementResetGeneration = 0,
  onControllerReady,
  onPositionChange,
  reducedMotion = false,
}: InvestigatorControllerProps) {
  const [subscribeControls, getControls] = useKeyboardControls<ControlName>();
  const invalidate = useThree((state) => state.invalidate);
  const lastPositionSampleAt = useRef(Number.NEGATIVE_INFINITY);
  const controllerReadyRef = useRef(false);
  const movingRef = useRef(false);
  const pressedPhysicalKeysRef = useRef(new Set<PhysicalControlKey>());
  const blockedPhysicalKeysRef = useRef(new Set<PhysicalControlKey>());
  const lastMovementResetGenerationRef = useRef(movementResetGeneration);
  const hasMovementResetRef = useRef(movementResetGeneration !== 0);
  const [motion, setMotion] = useState<FigureMotion>("idle");

  const getAcceptedControls = useCallback(
    (state: InvestigatorControlState) =>
      hasMovementResetRef.current
        ? resolveUnblockedPhysicalControls(
            pressedPhysicalKeysRef.current,
            blockedPhysicalKeysRef.current,
          )
        : state,
    [],
  );

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
      if (shouldStopHorizontalVelocity(wasMoving, moving, active)) {
        stopHorizontalVelocity(controller);
      }
      if (moving || wasMoving !== moving) invalidate();
    },
    [invalidate],
  );

  useFrame(({ clock }) => {
    const controller = controllerRef.current;
    if (!controllerReadyRef.current && controller?.body) {
      applyControls(controller, getAcceptedControls(getControls()), enabled);
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
    if (movingRef.current) invalidate();

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
    if (controller) {
      applyControls(controller, getAcceptedControls(getControls()), enabled);
    }
  }, [applyControls, controllerRef, enabled, getAcceptedControls, getControls]);

  useLayoutEffect(() => {
    if (movementResetGeneration === lastMovementResetGenerationRef.current) return;

    lastMovementResetGenerationRef.current = movementResetGeneration;
    hasMovementResetRef.current = true;
    for (const key of pressedPhysicalKeysRef.current) {
      blockedPhysicalKeysRef.current.add(key);
    }
    pressedPhysicalKeysRef.current.clear();

    const controller = controllerRef.current;
    if (controller) applyControls(controller, stoppedControls, false);
  }, [applyControls, controllerRef, movementResetGeneration]);

  useEffect(
    () =>
      subscribeControls((state) => {
        const controller = controllerRef.current;
        if (controller) {
          applyControls(controller, getAcceptedControls(state), enabled);
        }
      }),
    [
      applyControls,
      controllerRef,
      enabled,
      getAcceptedControls,
      subscribeControls,
    ],
  );

  useEffect(() => {
    const applyPhysicalControls = () => {
      const controller = controllerRef.current;
      if (!controller || !hasMovementResetRef.current) return;
      applyControls(
        controller,
        resolveUnblockedPhysicalControls(
          pressedPhysicalKeysRef.current,
          blockedPhysicalKeysRef.current,
        ),
        enabled,
      );
    };
    const neutralizePhysicalControls = () => {
      for (const key of pressedPhysicalKeysRef.current) {
        blockedPhysicalKeysRef.current.add(key);
      }
      pressedPhysicalKeysRef.current.clear();
      hasMovementResetRef.current = true;

      const controller = controllerRef.current;
      if (controller) applyControls(controller, stoppedControls, false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = getPhysicalControlKey(event);
      if (event.repeat || !key || pressedPhysicalKeysRef.current.has(key)) return;
      pressedPhysicalKeysRef.current.add(key);
      applyPhysicalControls();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      const key = getPhysicalControlKey(event);
      if (!key) return;
      pressedPhysicalKeysRef.current.delete(key);
      blockedPhysicalKeysRef.current.delete(key);
      applyPhysicalControls();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") neutralizePhysicalControls();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", neutralizePhysicalControls);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", neutralizePhysicalControls);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [applyControls, controllerRef, enabled]);

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
        useCustomForward={false}
      >
        <InvestigatorModel
          motion={motion}
          profile={graphicsProfile}
          reducedMotion={reducedMotion}
        />
      </Ecctrl>
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
