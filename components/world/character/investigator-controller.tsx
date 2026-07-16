"use client";

import { KeyboardControls, type KeyboardControlsEntry } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { Ecctrl, type EcctrlHandle, type MovementInput } from "ecctrl";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { FollowCamera } from "./follow-camera";
import { InvestigatorModel } from "./investigator-model";

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

  useFrame(({ clock }) => {
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
  }, [controllerRef, enabled]);

  return (
    <KeyboardControls
      map={keyboardMap}
      onChange={(_name, _pressed, state) => {
        controllerRef.current?.setMovement(
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
        <InvestigatorModel />
      </Ecctrl>
      <FollowCamera controllerRef={controllerRef} enabled={enabled} reducedMotion={reducedMotion} />
    </KeyboardControls>
  );
}
