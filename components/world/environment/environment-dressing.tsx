"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

import {
  selectDistrictDressingPlacements,
  type DistrictDressingPlacement,
} from "./district-layout";

export const ENVIRONMENT_DRESSING_GEOMETRIES = Object.freeze({
  box: new BoxGeometry(1, 1, 1),
  barrel: new CylinderGeometry(0.42, 0.46, 0.92, 10),
  bundle: new CylinderGeometry(0.3, 0.34, 1.05, 8),
  post: new CylinderGeometry(0.12, 0.16, 1.65, 8),
  wheel: new CylinderGeometry(0.38, 0.38, 0.12, 12),
  shrub: new ConeGeometry(0.5, 0.95, 8),
  trunk: new CylinderGeometry(0.08, 0.11, 0.55, 7),
  puddle: new CircleGeometry(0.9, 20),
  smoke: new SphereGeometry(0.32, 8, 6),
});

export const ENVIRONMENT_DRESSING_MATERIALS = Object.freeze({
  wood: new MeshStandardMaterial({ color: "#5f4631", roughness: 0.93 }),
  woodDark: new MeshStandardMaterial({ color: "#3a2e24", roughness: 0.96 }),
  iron: new MeshStandardMaterial({
    color: "#302f2c",
    metalness: 0.28,
    roughness: 0.82,
  }),
  cloth: new MeshStandardMaterial({ color: "#81755f", roughness: 1 }),
  foliage: new MeshStandardMaterial({ color: "#435239", roughness: 1 }),
  puddle: new MeshStandardMaterial({
    color: "#718082",
    metalness: 0.05,
    opacity: 0.42,
    roughness: 0.3,
    transparent: true,
    depthWrite: false,
  }),
  smoke: new MeshBasicMaterial({
    color: "#b9bebc",
    opacity: 0.18,
    transparent: true,
    depthWrite: false,
  }),
  window: new MeshStandardMaterial({
    color: "#b78243",
    emissive: "#a85c25",
    emissiveIntensity: 1.25,
    roughness: 0.6,
  }),
});

function CrateStack({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.box}
        material={ENVIRONMENT_DRESSING_MATERIALS.wood}
        position={[-0.16, 0.38, 0]}
        scale={[0.72, 0.72, 0.72]}
      />
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.box}
        material={ENVIRONMENT_DRESSING_MATERIALS.woodDark}
        position={[0.25, 0.94, 0.04]}
        rotation={[0, 0.18, 0]}
        scale={[0.55, 0.55, 0.55]}
      />
    </group>
  );
}

function Barrel({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.barrel}
        material={ENVIRONMENT_DRESSING_MATERIALS.wood}
        position={[0, 0.46, 0]}
      />
      {[-0.3, 0.3].map((y) => (
        <mesh
          castShadow={castShadow}
          geometry={ENVIRONMENT_DRESSING_GEOMETRIES.barrel}
          key={y}
          material={ENVIRONMENT_DRESSING_MATERIALS.iron}
          position={[0, 0.46 + y, 0]}
          scale={[1.018, 0.055, 1.018]}
        />
      ))}
    </group>
  );
}

function Bundle({ castShadow }: { castShadow: boolean }) {
  return (
    <mesh
      castShadow={castShadow}
      geometry={ENVIRONMENT_DRESSING_GEOMETRIES.bundle}
      material={ENVIRONMENT_DRESSING_MATERIALS.cloth}
      position={[0, 0.34, 0]}
      rotation={[0, 0, Math.PI / 2]}
    />
  );
}

function RoadPost({ castShadow }: { castShadow: boolean }) {
  return (
    <mesh
      castShadow={castShadow}
      geometry={ENVIRONMENT_DRESSING_GEOMETRIES.post}
      material={ENVIRONMENT_DRESSING_MATERIALS.woodDark}
      position={[0, 0.82, 0]}
    />
  );
}

function Handcart({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.box}
        material={ENVIRONMENT_DRESSING_MATERIALS.wood}
        position={[0, 0.72, 0]}
        scale={[1.35, 0.38, 0.78]}
      />
      {[-0.55, 0.55].map((z) => (
        <mesh
          castShadow={castShadow}
          geometry={ENVIRONMENT_DRESSING_GEOMETRIES.wheel}
          key={z}
          material={ENVIRONMENT_DRESSING_MATERIALS.woodDark}
          position={[0, 0.42, z]}
          rotation={[Math.PI / 2, 0, 0]}
        />
      ))}
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.box}
        material={ENVIRONMENT_DRESSING_MATERIALS.woodDark}
        position={[1.25, 0.52, 0]}
        rotation={[0, 0, -0.12]}
        scale={[1.3, 0.1, 0.12]}
      />
    </group>
  );
}

function StaticVegetation({ castShadow }: { castShadow: boolean }) {
  return (
    <group>
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.trunk}
        material={ENVIRONMENT_DRESSING_MATERIALS.woodDark}
        position={[0, 0.28, 0]}
      />
      <mesh
        castShadow={castShadow}
        geometry={ENVIRONMENT_DRESSING_GEOMETRIES.shrub}
        material={ENVIRONMENT_DRESSING_MATERIALS.foliage}
        position={[0, 0.86, 0]}
      />
    </group>
  );
}

function SwayingVegetation({ castShadow }: { castShadow: boolean }) {
  const rootRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!rootRef.current) return;
    rootRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.72) * 0.025;
  });

  return (
    <group ref={rootRef}>
      <StaticVegetation castShadow={castShadow} />
    </group>
  );
}

function Puddle() {
  return (
    <mesh
      geometry={ENVIRONMENT_DRESSING_GEOMETRIES.puddle}
      material={ENVIRONMENT_DRESSING_MATERIALS.puddle}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={[1.35, 0.62, 1]}
    />
  );
}

function ChimneySmoke() {
  const rootRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (!rootRef.current) return;
    rootRef.current.position.y = Math.sin(clock.elapsedTime * 0.42) * 0.12;
    rootRef.current.rotation.y = clock.elapsedTime * 0.08;
  });

  return (
    <group ref={rootRef}>
      {[
        [0, 0, 0, 0.72],
        [0.2, 0.55, 0.08, 0.92],
        [-0.14, 1.18, -0.06, 1.12],
      ].map(([x, y, z, scale], index) => (
        <mesh
          geometry={ENVIRONMENT_DRESSING_GEOMETRIES.smoke}
          key={index}
          material={ENVIRONMENT_DRESSING_MATERIALS.smoke}
          position={[x, y, z]}
          scale={scale}
        />
      ))}
    </group>
  );
}

function WindowInterior() {
  return (
    <mesh
      geometry={ENVIRONMENT_DRESSING_GEOMETRIES.box}
      material={ENVIRONMENT_DRESSING_MATERIALS.window}
      scale={[0.66, 0.78, 0.05]}
    />
  );
}

function DressingItem({
  castShadow,
  placement,
}: Readonly<{
  castShadow: boolean;
  placement: DistrictDressingPlacement;
}>) {
  let item = null;

  switch (placement.kind) {
    case "barrel":
      item = <Barrel castShadow={castShadow} />;
      break;
    case "bundle":
      item = <Bundle castShadow={castShadow} />;
      break;
    case "cart":
      item = <Handcart castShadow={castShadow} />;
      break;
    case "crate":
      item = <CrateStack castShadow={castShadow} />;
      break;
    case "post":
      item = <RoadPost castShadow={castShadow} />;
      break;
    case "puddle":
      item = <Puddle />;
      break;
    case "smoke":
      item = <ChimneySmoke />;
      break;
    case "vegetation":
      item = placement.motionSensitive ? (
        <SwayingVegetation castShadow={castShadow} />
      ) : (
        <StaticVegetation castShadow={castShadow} />
      );
      break;
    case "window-interior":
      item = <WindowInterior />;
      break;
  }

  return (
    <group
      name={`dressing-${placement.id}`}
      position={[...placement.position]}
      rotation={[0, placement.rotationY, 0]}
      scale={placement.scale}
    >
      {item}
    </group>
  );
}

export function EnvironmentDressing({
  profile,
  reducedMotion = false,
}: Readonly<{
  profile: GraphicsProfile;
  reducedMotion?: boolean;
}>) {
  const placements = selectDistrictDressingPlacements(
    profile.environmentDensity,
    reducedMotion,
  );

  return (
    <group dispose={null} name="environment-dressing">
      {placements.map((placement) => (
        <DressingItem
          castShadow={profile.shadows.enabled}
          key={placement.id}
          placement={placement}
        />
      ))}
    </group>
  );
}
