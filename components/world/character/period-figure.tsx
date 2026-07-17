"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

export type FigureMotion = "idle" | "walk" | "run" | "talk" | "interact";

type FigurePalette = Readonly<{
  skin: string;
  coat: string;
  waistcoat: string;
  breeches: string;
  stockings: string;
  shoes: string;
  hair: string;
  hat: string;
}>;

const DEFAULT_PALETTE: FigurePalette = {
  skin: "#b88f70",
  coat: "#294953",
  waistcoat: "#a88b56",
  breeches: "#4a4038",
  stockings: "#b8b1a2",
  shoes: "#282420",
  hair: "#49352b",
  hat: "#302b27",
};

export function PeriodFigure({
  motion = "idle",
  palette = DEFAULT_PALETTE,
  reducedMotion = false,
  scale = 1,
}: {
  motion?: FigureMotion;
  palette?: FigurePalette;
  reducedMotion?: boolean;
  scale?: number;
}) {
  const rootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    const root = rootRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;
    if (!root || !leftArm || !rightArm || !leftLeg || !rightLeg) return;

    const time = clock.elapsedTime;
    const locomotion = motion === "walk" || motion === "run";
    const speed = motion === "run" ? 10 : motion === "walk" ? 6.5 : 1.8;
    const amplitude = reducedMotion ? 0 : motion === "run" ? 0.7 : locomotion ? 0.42 : 0.025;
    const stride = Math.sin(time * speed) * amplitude;

    leftArm.rotation.x = locomotion ? -stride * 0.8 : 0;
    rightArm.rotation.x = locomotion ? stride * 0.8 : 0;
    leftLeg.rotation.x = locomotion ? stride : 0;
    rightLeg.rotation.x = locomotion ? -stride : 0;
    root.position.y = reducedMotion ? 0 : Math.abs(Math.sin(time * speed)) * (locomotion ? 0.025 : 0.008);
    root.rotation.z = reducedMotion ? 0 : Math.sin(time * 1.4) * 0.008;

    if (motion === "talk" && !reducedMotion) {
      rightArm.rotation.x = -0.5 + Math.sin(time * 2.6) * 0.18;
      rightArm.rotation.z = -0.34;
      leftArm.rotation.x = -0.12 + Math.sin(time * 1.9) * 0.08;
    } else {
      rightArm.rotation.z = 0;
    }

    if (motion === "interact" && !reducedMotion) {
      rightArm.rotation.x = -0.92;
      rightArm.rotation.z = -0.18;
    }
  });

  return (
    <group ref={rootRef} scale={scale}>
      <group ref={leftLegRef} position={[-0.16, 0.72, 0]}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.085, 0.105, 0.66, 12]} />
          <meshStandardMaterial color={palette.breeches} roughness={0.92} />
        </mesh>
        <mesh castShadow position={[0, -0.77, 0]}>
          <cylinderGeometry args={[0.06, 0.075, 0.48, 12]} />
          <meshStandardMaterial color={palette.stockings} roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, -1.01, 0.06]}>
          <boxGeometry args={[0.16, 0.1, 0.3]} />
          <meshStandardMaterial color={palette.shoes} roughness={0.86} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.16, 0.72, 0]}>
        <mesh castShadow position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.085, 0.105, 0.66, 12]} />
          <meshStandardMaterial color={palette.breeches} roughness={0.92} />
        </mesh>
        <mesh castShadow position={[0, -0.77, 0]}>
          <cylinderGeometry args={[0.06, 0.075, 0.48, 12]} />
          <meshStandardMaterial color={palette.stockings} roughness={0.9} />
        </mesh>
        <mesh castShadow position={[0, -1.01, 0.06]}>
          <boxGeometry args={[0.16, 0.1, 0.3]} />
          <meshStandardMaterial color={palette.shoes} roughness={0.86} />
        </mesh>
      </group>

      <mesh castShadow position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.245, 0.32, 0.82, 12]} />
        <meshStandardMaterial color={palette.coat} roughness={0.94} />
      </mesh>
      <mesh castShadow position={[0, 1.06, 0.25]}>
        <boxGeometry args={[0.25, 0.56, 0.045]} />
        <meshStandardMaterial color={palette.waistcoat} roughness={0.88} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh castShadow key={x} position={[x * 0.58, 0.58, -0.12]} rotation={[0, 0, x > 0 ? -0.09 : 0.09]}>
          <coneGeometry args={[0.2, 0.58, 5]} />
          <meshStandardMaterial color={palette.coat} roughness={0.95} />
        </mesh>
      ))}
      <mesh castShadow position={[0, 1.42, 0.01]} scale={[1.05, 0.42, 0.9]}>
        <sphereGeometry args={[0.29, 16, 10]} />
        <meshStandardMaterial color={palette.coat} roughness={0.94} />
      </mesh>
      <mesh castShadow position={[0, 1.48, 0.22]} scale={[1, 0.55, 0.5]}>
        <boxGeometry args={[0.31, 0.14, 0.07]} />
        <meshStandardMaterial color="#ded5c2" roughness={0.9} />
      </mesh>

      <group ref={leftArmRef} position={[-0.34, 1.33, 0]}>
        <mesh castShadow position={[0, -0.34, 0]}>
          <cylinderGeometry args={[0.075, 0.1, 0.7, 12]} />
          <meshStandardMaterial color={palette.coat} roughness={0.94} />
        </mesh>
        <mesh castShadow position={[0, -0.72, 0]}>
          <sphereGeometry args={[0.078, 14, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.34, 1.33, 0]}>
        <mesh castShadow position={[0, -0.34, 0]}>
          <cylinderGeometry args={[0.075, 0.1, 0.7, 12]} />
          <meshStandardMaterial color={palette.coat} roughness={0.94} />
        </mesh>
        <mesh castShadow position={[0, -0.72, 0]}>
          <sphereGeometry args={[0.078, 14, 12]} />
          <meshStandardMaterial color={palette.skin} roughness={0.9} />
        </mesh>
      </group>

      <mesh castShadow position={[0, 1.69, 0.01]} scale={[0.86, 1.12, 0.9]}>
        <sphereGeometry args={[0.18, 20, 18]} />
        <meshStandardMaterial color={palette.skin} roughness={0.92} />
      </mesh>
      <mesh castShadow position={[0, 1.73, -0.12]} scale={[0.88, 1.08, 0.78]}>
        <sphereGeometry args={[0.18, 18, 16, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshStandardMaterial color={palette.hair} roughness={0.96} />
      </mesh>
      <mesh castShadow position={[0, 1.91, 0]} scale={[1, 1, 0.72]}>
        <cylinderGeometry args={[0.235, 0.255, 0.045, 16]} />
        <meshStandardMaterial color={palette.hat} roughness={0.93} />
      </mesh>
      <mesh castShadow position={[0, 1.975, 0]} scale={[1, 1, 0.86]}>
        <cylinderGeometry args={[0.135, 0.17, 0.13, 14]} />
        <meshStandardMaterial color={palette.hat} roughness={0.93} />
      </mesh>
    </group>
  );
}
