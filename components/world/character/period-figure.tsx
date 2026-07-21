"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group } from "three";

import {
  shouldAnimateFigureMotion,
  type FigureMotion,
} from "./figure-motion";
import { PERIOD_FIGURE_GEOMETRIES, type FigurePalette } from "./period-figure-resources";

export type { FigureMotion } from "./figure-motion";
export type { FigurePalette } from "./period-figure-resources";

export type PeriodFigureProps = Readonly<{
  foreground?: boolean;
  motion?: FigureMotion;
  palette?: FigurePalette;
  reducedMotion?: boolean;
  scale?: number;
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
  foreground = false,
  motion = "idle",
  palette = DEFAULT_PALETTE,
  reducedMotion = false,
  scale = 1,
}: PeriodFigureProps) {
  const rootRef = useRef<Group>(null);
  const leftArmRef = useRef<Group>(null);
  const rightArmRef = useRef<Group>(null);
  const leftLegRef = useRef<Group>(null);
  const rightLegRef = useRef<Group>(null);
  const foregroundMaterialProps = foreground
    ? { depthTest: false, depthWrite: false }
    : undefined;

  useFrame(({ clock }) => {
    const root = rootRef.current;
    const leftArm = leftArmRef.current;
    const rightArm = rightArmRef.current;
    const leftLeg = leftLegRef.current;
    const rightLeg = rightLegRef.current;
    if (!root || !leftArm || !rightArm || !leftLeg || !rightLeg) return;

    const locomotion = motion === "walk" || motion === "run";
    if (!shouldAnimateFigureMotion(motion, reducedMotion)) {
      leftArm.rotation.x = 0;
      rightArm.rotation.x = 0;
      rightArm.rotation.z = 0;
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      root.position.y = 0;
      root.rotation.z = 0;
      return;
    }

    const time = clock.elapsedTime;
    const speed = motion === "run" ? 10 : motion === "walk" ? 6.5 : 1.8;
    const amplitude = motion === "run" ? 0.7 : locomotion ? 0.42 : 0.025;
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
    <group
      dispose={null}
      renderOrder={foreground ? 100 : 0}
      ref={rootRef}
      scale={scale}
      userData={{
        cameraVisibilityTarget: true,
        cameraVisibilityTargetHeight: 0.96,
      }}
    >
      <group ref={leftLegRef} position={[-0.14, 0.72, 0]}>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.upperLeg} position={[0, -0.35, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.breeches} roughness={0.92} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.lowerLeg} position={[0, -0.77, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.stockings} roughness={0.9} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.shoe} position={[0, -1.01, 0.06]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.shoes} roughness={0.86} />
        </mesh>
      </group>
      <group ref={rightLegRef} position={[0.14, 0.72, 0]}>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.upperLeg} position={[0, -0.35, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.breeches} roughness={0.92} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.lowerLeg} position={[0, -0.77, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.stockings} roughness={0.9} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.shoe} position={[0, -1.01, 0.06]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.shoes} roughness={0.86} />
        </mesh>
      </group>

      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.torso} position={[0, 1.05, 0]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.coat} roughness={0.94} />
      </mesh>
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.waistcoat} position={[0, 1.06, 0.25]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.waistcoat} roughness={0.88} />
      </mesh>
      {[-0.22, 0.22].map((x) => (
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.coatTail} key={x} position={[x * 0.58, 0.58, -0.12]} rotation={[0, 0, x > 0 ? -0.09 : 0.09]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.coat} roughness={0.95} />
        </mesh>
      ))}
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.shoulders} position={[0, 1.42, 0.01]} scale={[1.05, 0.42, 0.9]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.coat} roughness={0.94} />
      </mesh>
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.cravat} position={[0, 1.48, 0.22]} scale={[1, 0.55, 0.5]}>
        <meshStandardMaterial {...foregroundMaterialProps} color="#ded5c2" roughness={0.9} />
      </mesh>

      <group ref={leftArmRef} position={[-0.31, 1.33, 0]}>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.arm} position={[0, -0.34, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.coat} roughness={0.94} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.hand} position={[0, -0.72, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.skin} roughness={0.9} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.31, 1.33, 0]}>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.arm} position={[0, -0.34, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.coat} roughness={0.94} />
        </mesh>
        <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.hand} position={[0, -0.72, 0]}>
          <meshStandardMaterial {...foregroundMaterialProps} color={palette.skin} roughness={0.9} />
        </mesh>
      </group>

      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.head} position={[0, 1.69, 0.01]} scale={[0.86, 1.12, 0.9]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.skin} roughness={0.92} />
      </mesh>
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.hair} position={[0, 1.73, -0.12]} scale={[0.88, 1.08, 0.78]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.hair} roughness={0.96} />
      </mesh>
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.hatBrim} position={[0, 1.91, 0]} scale={[1, 1, 0.72]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.hat} roughness={0.93} />
      </mesh>
      <mesh castShadow dispose={null} geometry={PERIOD_FIGURE_GEOMETRIES.hatCrown} position={[0, 1.975, 0]} scale={[1, 1, 0.86]}>
        <meshStandardMaterial {...foregroundMaterialProps} color={palette.hat} roughness={0.93} />
      </mesh>
    </group>
  );
}
