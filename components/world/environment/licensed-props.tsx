"use client";

import { Clone, useGLTF } from "@react-three/drei";

const TABLE_MODEL_URL = "/world/models/wooden-table-01/wooden-table-01.glb";
const BARREL_MODEL_URL = "/world/models/wooden-barrels-01/wooden-barrels-01.glb";

export function LicensedWoodenTable({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(TABLE_MODEL_URL);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Clone castShadow receiveShadow object={scene} />
    </group>
  );
}

export function LicensedBarrelSet({
  position,
  rotation = [0, 0, 0],
  scale = 0.42,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const { scene } = useGLTF(BARREL_MODEL_URL);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <Clone castShadow receiveShadow object={scene} />
    </group>
  );
}

export function ProceduralBarrelSet({
  position,
  rotation = [0, 0, 0],
  scale = 0.42,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {[-0.46, 0.46].map((x) => (
        <group key={x} position={[x, 0.72, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[0.44, 0.48, 1.25, 14]} />
            <meshStandardMaterial color="#6f4d31" roughness={0.95} />
          </mesh>
          {[-0.42, 0.42].map((offset) => (
            <mesh castShadow key={offset} position={[0, offset, 0]}>
              <torusGeometry args={[0.46, 0.035, 6, 16]} />
              <meshStandardMaterial color="#343433" metalness={0.45} roughness={0.7} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(TABLE_MODEL_URL);
