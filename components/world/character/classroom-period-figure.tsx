"use client";

import type { PeriodFigureProps } from "./period-figure";

const CLASSROOM_DEFAULT_PALETTE = {
  skin: "#b88f70",
  coat: "#294953",
  waistcoat: "#a88b56",
  breeches: "#4a4038",
  stockings: "#b8b1a2",
  shoes: "#282420",
  hair: "#49352b",
  hat: "#302b27",
} as const;

// Classroom figures preserve legible period silhouettes with far fewer draw calls.
export function ClassroomPeriodFigure({
  palette = CLASSROOM_DEFAULT_PALETTE,
  scale = 1,
}: PeriodFigureProps) {
  return (
    <group name="classroom-period-figure" scale={scale}>
      <mesh position={[0, 0.37, 0]}>
        <boxGeometry args={[0.36, 0.74, 0.28]} />
        <meshStandardMaterial color={palette.breeches} roughness={0.94} />
      </mesh>
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.24, 0.3, 0.8, 8]} />
        <meshStandardMaterial color={palette.coat} roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.1, 0.23]}>
        <boxGeometry args={[0.22, 0.5, 0.04]} />
        <meshStandardMaterial color={palette.waistcoat} roughness={0.9} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]}>
          <cylinderGeometry args={[0.07, 0.09, 0.62, 7]} />
          <meshStandardMaterial color={palette.coat} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, 1.67, 0.01]} scale={[0.86, 1.08, 0.9]}>
        <sphereGeometry args={[0.18, 12, 10]} />
        <meshStandardMaterial color={palette.skin} roughness={0.92} />
      </mesh>
      <mesh position={[0, 1.72, -0.1]} scale={[0.9, 1.05, 0.8]}>
        <sphereGeometry
          args={[0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.58]}
        />
        <meshStandardMaterial color={palette.hair} roughness={0.96} />
      </mesh>
      <mesh position={[0, 1.92, 0]} scale={[1, 1, 0.76]}>
        <cylinderGeometry args={[0.22, 0.24, 0.16, 10]} />
        <meshStandardMaterial color={palette.hat} roughness={0.94} />
      </mesh>
    </group>
  );
}
