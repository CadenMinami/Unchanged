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

export function FollowCamera({ controllerRef, enabled, reducedMotion = false }: FollowCameraProps) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const desiredPosition = useRef(new Vector3());
  const cameraOffset = useRef(new Vector3(5.5, 3.4, 7));

  useFrame((_state, deltaSeconds) => {
    if (!enabled || !controllerRef.current) return;

    target.current.copy(controllerRef.current.currPos);
    target.current.y += 1.05;
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
