"use client";

import { KeyboardControls, type KeyboardControlsEntry } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle, type MovementInput } from "ecctrl";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { FollowCamera } from "./follow-camera";
import { InvestigatorModel } from "./investigator-model";
import type { FigureMotion } from "./period-figure";

type ControlName = "forward" | "backward" | "leftward" | "rightward" | "run";

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

export function resolveInvestigatorMotion(
  moving: boolean,
  runActive: boolean,
  enabled: boolean,
): FigureMotion {
  if (!enabled || !moving) return "idle";
  return runActive ? "run" : "walk";
}

interface InvestigatorControllerProps {
  controllerRef: RefObject<EcctrlHandle | null>;
  enabled: boolean;
  initialPosition: [number, number, number];
  onPositionChange?: (position: [number, number, number]) => void;
  reducedMotion?: boolean;
}

export function InvestigatorController({
  controllerRef,
  enabled,
  initialPosition,
  onPositionChange,
  reducedMotion = false,
}: InvestigatorControllerProps) {
  const lastPositionSampleAt = useRef(Number.NEGATIVE_INFINITY);
  const movingRef = useRef(false);
  const [motion, setMotion] = useState<FigureMotion>("idle");

  useFrame(({ clock }) => {
    const nextMotion = resolveInvestigatorMotion(
      movingRef.current,
      controllerRef.current?.runActive ?? false,
      enabled,
    );
    if (nextMotion !== motion) setMotion(nextMotion);

    if (!onPositionChange || clock.elapsedTime - lastPositionSampleAt.current < 0.1) {
      return;
    }
    const body = controllerRef.current?.body;
    if (!body) return;
    const position = body.translation();
    lastPositionSampleAt.current = clock.elapsedTime;
    onPositionChange([position.x, position.y, position.z]);
  });

  useEffect(() => {
    if (enabled || !controllerRef.current) return;

    controllerRef.current.setMovement(stoppedMovement);
    const velocity = controllerRef.current.body.linvel();
    controllerRef.current.body.setLinvel(
      { x: 0, y: velocity.y, z: 0 },
      true,
    );
    setMotion("idle");
  }, [controllerRef, enabled]);

  return (
    <KeyboardControls
      map={keyboardMap}
      onChange={(_name, _pressed, state) => {
        const moving =
          state.forward || state.backward || state.leftward || state.rightward;
        movingRef.current = moving;
        const controller = controllerRef.current;
        controller?.setMovement(
          enabled
            ? {
                forward: state.forward,
                backward: state.backward,
                leftward: state.leftward,
                rightward: state.rightward,
                run: state.run,
                jump: false,
              }
            : stoppedMovement,
        );
        if (enabled && !moving && controller) {
          const velocity = controller.body.linvel();
          controller.body.setLinvel({ x: 0, y: velocity.y, z: 0 }, true);
        }
      }}
    >
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
    </KeyboardControls>
  );
}
