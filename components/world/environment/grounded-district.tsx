"use client";

import { ContactShadows } from "@react-three/drei";
import { useMemo, Suspense } from "react";
import { Shape } from "three";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

import {
  CobblestoneFallbackSurface,
  CobblestoneSurface,
} from "./cobblestone-surface";
import { LicensedBarrelSet, ProceduralBarrelSet } from "./licensed-props";
import { OptionalAssetBoundary } from "./optional-asset-boundary";

type BuildingConfig = Readonly<{
  id: string;
  position: [number, number, number];
  size: [number, number, number];
  wall: string;
  roof: string;
  trim: string;
  litWindows: readonly number[];
}>;

export const DISTRICT_BUILDINGS: readonly BuildingConfig[] = [
  { id: "archive-west", position: [-5.5, 0, -7.8], size: [5.2, 3.6, 3.7], wall: "#b9aa90", roof: "#5c3431", trim: "#263f3b", litWindows: [1] },
  { id: "archive-east", position: [5.8, 0, -8.1], size: [5.8, 4.1, 3.9], wall: "#9fa69b", roof: "#474c51", trim: "#3d352e", litWindows: [0, 2] },
  { id: "archive-north", position: [-4.7, 0, 8.2], size: [4.7, 3.2, 3.5], wall: "#b8b6a8", roof: "#613d36", trim: "#34494a", litWindows: [] },
  { id: "post-south-1", position: [15, 0, -8], size: [5.4, 3.5, 3.8], wall: "#a9a18f", roof: "#513b37", trim: "#27413a", litWindows: [0] },
  { id: "post-north-1", position: [20.5, 0, 8.2], size: [5.8, 4.2, 4], wall: "#b7a98e", roof: "#4d5155", trim: "#3a322d", litWindows: [1, 2] },
  { id: "post-south-2", position: [28, 0, -8.2], size: [6.1, 4.5, 4.1], wall: "#9ca99f", roof: "#623b34", trim: "#293d42", litWindows: [1] },
  { id: "mid-north", position: [34.5, 0, 8], size: [6.4, 3.8, 3.8], wall: "#b2ad9f", roof: "#44484c", trim: "#39462f", litWindows: [0, 2] },
  { id: "civic-south", position: [43, 0, -8.1], size: [7.2, 4.8, 4.2], wall: "#b5a17f", roof: "#523430", trim: "#284144", litWindows: [1, 2] },
  { id: "civic-north", position: [49.5, 0, 8.2], size: [6.6, 4.4, 4], wall: "#9ca4a0", roof: "#3f474e", trim: "#46382f", litWindows: [0] },
  { id: "east-south", position: [56.5, 0, -8], size: [5.5, 3.6, 3.7], wall: "#b9b2a0", roof: "#663d36", trim: "#31453a", litWindows: [1] },
  { id: "east-north", position: [61.5, 0, 8.1], size: [5.8, 4, 3.9], wall: "#a8a18e", roof: "#414951", trim: "#3e352f", litWindows: [] },
  { id: "bridge-south", position: [68.5, 0, -8.2], size: [5.7, 3.9, 3.8], wall: "#9ea99f", roof: "#593732", trim: "#2b4143", litWindows: [0, 2] },
] as const;

function GabledBuilding({ config }: { config: BuildingConfig }) {
  const [width, height, depth] = config.size;
  const roofProfile = useMemo(() => {
    const profile = new Shape();
    profile.moveTo(-width / 2 - 0.22, 0);
    profile.lineTo(width / 2 + 0.22, 0);
    profile.lineTo(0, Math.min(1.6, width * 0.26));
    profile.closePath();
    return profile;
  }, [width]);
  const windowCount = Math.max(2, Math.floor(width / 2));
  const windowXs = Array.from(
    { length: windowCount },
    (_, index) => ((index + 1) * width) / (windowCount + 1) - width / 2,
  );

  return (
    <group position={config.position}>
      <mesh castShadow receiveShadow position={[0, 0.24, 0]}>
        <boxGeometry args={[width + 0.16, 0.48, depth + 0.14]} />
        <meshStandardMaterial color="#77736c" roughness={0.98} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, height / 2 + 0.45, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={config.wall} roughness={0.96} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, height + 0.45, -(depth + 0.46) / 2]}>
        <extrudeGeometry
          args={[
            roofProfile,
            { bevelEnabled: false, depth: depth + 0.46, steps: 1 },
          ]}
        />
        <meshStandardMaterial color={config.roof} roughness={0.93} />
      </mesh>
      <mesh castShadow position={[width * 0.3, height + 1.15, 0]}>
        <boxGeometry args={[0.46, 1.3, 0.62]} />
        <meshStandardMaterial color="#5e5b56" roughness={0.98} />
      </mesh>
      <mesh castShadow position={[0, 1.45, depth / 2 + 0.03]}>
        <boxGeometry args={[0.92, 2, 0.16]} />
        <meshStandardMaterial color={config.trim} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.48, depth / 2 + 0.13]}>
        <boxGeometry args={[0.14, 0.06, 0.05]} />
        <meshStandardMaterial color="#b08a4f" metalness={0.45} roughness={0.5} />
      </mesh>
      {windowXs.map((x, index) => {
        const lit = config.litWindows.includes(index);
        return (
          <group key={`${config.id}-window-${index}`} position={[x, height * 0.62 + 0.45, depth / 2 + 0.04]}>
            <mesh>
              <boxGeometry args={[0.75, 1.02, 0.1]} />
              <meshStandardMaterial
                color={lit ? "#dba85b" : "#31414a"}
                emissive={lit ? "#d88935" : "#101a20"}
                emissiveIntensity={lit ? 1.25 : 0.14}
                roughness={0.55}
              />
            </mesh>
            {[-0.48, 0.48].map((offset) => (
              <mesh castShadow key={offset} position={[offset, 0, 0.01]}>
                <boxGeometry args={[0.16, 1.15, 0.14]} />
                <meshStandardMaterial color={config.trim} roughness={0.92} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.06, 1.05, 0.05]} />
              <meshStandardMaterial color="#2f302d" roughness={0.8} />
            </mesh>
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[0.74, 0.06, 0.05]} />
              <meshStandardMaterial color="#2f302d" roughness={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function StreetLantern({
  position,
  light = false,
}: {
  position: [number, number, number];
  light?: boolean;
}) {
  return (
    <group position={position} scale={0.86}>
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.055, 0.09, 2.4, 10]} />
        <meshStandardMaterial color="#272b2a" metalness={0.45} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0, 2.52, 0]}>
        <cylinderGeometry args={[0.2, 0.28, 0.5, 6]} />
        <meshStandardMaterial
          color="#e9bd6f"
          emissive="#dc7e2e"
          emissiveIntensity={2.5}
          roughness={0.36}
        />
      </mesh>
      <mesh castShadow position={[0, 2.82, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.34, 0.18, 4]} />
        <meshStandardMaterial color="#252927" metalness={0.4} roughness={0.74} />
      </mesh>
      {light ? (
        <pointLight color="#f2a655" decay={2} distance={11} intensity={15} position={[0, 2.5, 0]} />
      ) : null}
    </group>
  );
}

function BridgeWater() {
  return (
    <mesh position={[72, -0.08, 5.2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[31, 7]} />
      <meshStandardMaterial
        color="#273f47"
        metalness={0.08}
        opacity={0.88}
        roughness={0.34}
        transparent
      />
    </mesh>
  );
}

export function GroundedDistrict({ profile }: { profile: GraphicsProfile }) {
  const lanterns: Array<{
    position: [number, number, number];
    light: boolean;
  }> = [
    { position: [2, 0, 3.25], light: profile.tier !== "classroom" },
    { position: [18, 0, -3.25], light: false },
    { position: [32, 0, 3.25], light: profile.tier === "high" },
    { position: [47, 0, -3.25], light: profile.tier !== "classroom" },
    { position: [61, 0, 3.25], light: false },
    { position: [72, 0, -3.25], light: profile.tier === "high" },
  ];

  return (
    <>
      <color attach="background" args={["#151c24"]} />
      <fog attach="fog" args={["#202932", profile.fog.near, profile.fog.far]} />
      <hemisphereLight color="#8ba0b4" groundColor="#2e2c27" intensity={1.15} />
      <directionalLight
        castShadow={profile.shadows.enabled}
        color="#b8cae1"
        intensity={2.05}
        position={[18, 26, 12]}
        shadow-bias={-0.0004}
        shadow-camera-bottom={-20}
        shadow-camera-far={90}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={20}
        shadow-mapSize-height={profile.shadows.mapSize}
        shadow-mapSize-width={profile.shadows.mapSize}
      />

      <mesh receiveShadow position={[36, -0.12, 0]}>
        <boxGeometry args={[180, 0.2, 50]} />
        <meshStandardMaterial color="#354033" roughness={1} />
      </mesh>
      <OptionalAssetBoundary
        fallback={<CobblestoneFallbackSurface position={[36, 0.115, 0]} repeat={[34, 1.5]} size={[176, 5.2]} />}
      >
        <Suspense fallback={<CobblestoneFallbackSurface position={[36, 0.115, 0]} repeat={[34, 1.5]} size={[176, 5.2]} />}>
          <CobblestoneSurface position={[36, 0.115, 0]} repeat={[34, 1.5]} size={[176, 5.2]} />
        </Suspense>
      </OptionalAssetBoundary>
      <OptionalAssetBoundary
        fallback={<CobblestoneFallbackSurface position={[72, 0.2, 4.45]} repeat={[1.5, 4]} rotationY={Math.PI / 2} size={[13.2, 4.7]} />}
      >
        <Suspense fallback={<CobblestoneFallbackSurface position={[72, 0.2, 4.45]} repeat={[1.5, 4]} rotationY={Math.PI / 2} size={[13.2, 4.7]} />}>
          <CobblestoneSurface position={[72, 0.2, 4.45]} repeat={[1.5, 4]} rotationY={Math.PI / 2} size={[13.2, 4.7]} />
        </Suspense>
      </OptionalAssetBoundary>
      <BridgeWater />

      {DISTRICT_BUILDINGS.map((building) => (
        <GabledBuilding config={building} key={building.id} />
      ))}
      {lanterns.map((lantern, index) => (
        <StreetLantern
          key={`${lantern.position.join("-")}-${index}`}
          light={lantern.light}
          position={lantern.position}
        />
      ))}

      <OptionalAssetBoundary fallback={<ProceduralBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />}>
        <Suspense fallback={<ProceduralBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />}>
          <LicensedBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />
        </Suspense>
      </OptionalAssetBoundary>
      <OptionalAssetBoundary fallback={<ProceduralBarrelSet position={[65.5, 0, -4.9]} rotation={[0, 0.62, 0]} scale={0.33} />}>
        <Suspense fallback={<ProceduralBarrelSet position={[65.5, 0, -4.9]} rotation={[0, 0.62, 0]} scale={0.33} />}>
          <LicensedBarrelSet position={[65.5, 0, -4.9]} rotation={[0, 0.62, 0]} scale={0.33} />
        </Suspense>
      </OptionalAssetBoundary>

      {profile.shadows.enabled ? (
        <ContactShadows
          far={36}
          opacity={0.27}
          position={[36, 0.035, 0]}
          scale={100}
        />
      ) : null}
    </>
  );
}
