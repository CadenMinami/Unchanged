"use client";

import { Suspense } from "react";

import { LicensedWoodenTable } from "../environment/licensed-props";
import { OptionalAssetBoundary } from "../environment/optional-asset-boundary";

interface InteractableProps {
  assetId: string;
  position: [number, number, number];
}

function TableFallback() {
  return (
    <group>
      <mesh castShadow position={[0, 0.68, 0]} scale={[1.35, 0.11, 0.78]}>
        <boxGeometry />
        <meshStandardMaterial color="#775d3e" roughness={0.94} />
      </mesh>
      {[-0.53, 0.53].flatMap((x) =>
        [-0.27, 0.27].map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.32, z]} scale={[0.1, 0.64, 0.1]}>
            <boxGeometry />
            <meshStandardMaterial color="#382f27" roughness={0.98} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Interactable({ assetId, position }: InteractableProps) {
  return (
    <group position={position}>
      <OptionalAssetBoundary assetId={assetId} fallback={<TableFallback />}>
        <Suspense fallback={<TableFallback />}>
          <LicensedWoodenTable position={[0, 0.02, 0]} rotation={[0, Math.PI / 2, 0]} />
        </Suspense>
      </OptionalAssetBoundary>
      <mesh
        position={[0, 0.74, 0]}
        rotation={[-0.06, 0.18, 0]}
        scale={[0.64, 0.025, 0.42]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#e8d6aa" emissive="#6b481b" emissiveIntensity={0.16} />
      </mesh>
    </group>
  );
}
