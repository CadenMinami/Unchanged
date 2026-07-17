"use client";

import { useFrame, useThree } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import type { RefObject } from "react";
import { useRef } from "react";
import { Vector3 } from "three";

interface FollowCameraProps {
  controllerRef: RefObject<EcctrlHandle | null>;
  enabled: boolean;
  reducedMotion?: boolean;
}

export const FOLLOW_CAMERA_OFFSET = [4.15, 2.35, 5.3] as const;
export const FOLLOW_CAMERA_TARGET_Y = 0.92;

export function FollowCamera({ controllerRef, enabled, reducedMotion = false }: FollowCameraProps) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3(...FOLLOW_CAMERA_OFFSET));

  useFrame((_state, deltaSeconds) => {
    if (!enabled || !controllerRef.current) return;

    target.current.copy(controllerRef.current.currPos);
    target.current.y += FOLLOW_CAMERA_TARGET_Y;
    desiredPosition.current.copy(target.current).add(cameraOffset.current);

    if (reducedMotion) {
      camera.position.copy(desiredPosition.current);
    } else {
      const damping = 1 - Math.exp(-deltaSeconds * 5.2);
      camera.position.lerp(desiredPosition.current, damping);
    }
    camera.lookAt(target.current);
  });

  return null;
}
