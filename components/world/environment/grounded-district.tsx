"use client";

import { Suspense } from "react";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

import {
  CobblestoneFallbackSurface,
  CobblestoneSurface,
} from "./cobblestone-surface";
import {
  DISTRICT_FACADE_PLACEMENTS,
  selectDistrictFacadePlacements,
  type DistrictFacadePlacement,
} from "./district-layout";
import { EnvironmentDressing } from "./environment-dressing";
import { LicensedBarrelSet, ProceduralBarrelSet } from "./licensed-props";
import { ModularFacade } from "./modular-facade";
import { OptionalAssetBoundary } from "./optional-asset-boundary";

export const DISTRICT_BUILDINGS = DISTRICT_FACADE_PLACEMENTS;

export const DISTRICT_GROUND_PRESENTATION = Object.freeze({
  color: "#514c40",
  roadWidth: 8.4,
  roadRepeatZ: 2.4,
});

function DistrictFacades({
  castShadow,
  placements,
  textureTier,
}: Readonly<{
  castShadow: boolean;
  placements: readonly DistrictFacadePlacement[];
  textureTier: GraphicsProfile["textureTier"];
}>) {
  return placements.map((placement) => (
    <ModularFacade
      castShadow={castShadow}
      key={placement.id}
      placement={placement}
      textureTier={textureTier}
    />
  ));
}

function StreetLantern({
  position,
}: {
  position: [number, number, number];
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
    </group>
  );
}

export function GroundedDistrict({
  profile,
  reducedMotion = false,
}: Readonly<{
  profile: GraphicsProfile;
  reducedMotion?: boolean;
}>) {
  const facadePlacements = selectDistrictFacadePlacements(
    profile.environmentDensity,
  );
  const facadeFallback = (
    <DistrictFacades
      castShadow={profile.shadows.enabled}
      placements={facadePlacements}
      textureTier="low"
    />
  );
  const lanterns: Array<[number, number, number]> = [
    [2, 0, 3.25],
    [18, 0, -3.25],
    [32, 0, 3.25],
    [47, 0, -3.25],
    [61, 0, 3.25],
  ];

  return (
    <>
      <mesh receiveShadow position={[36, -0.12, 0]}>
        <boxGeometry args={[180, 0.2, 50]} />
        <meshStandardMaterial
          color={DISTRICT_GROUND_PRESENTATION.color}
          roughness={1}
        />
      </mesh>
      <OptionalAssetBoundary
        assetId="district-cobblestone-surface"
        fallback={<CobblestoneFallbackSurface position={[36, 0.115, 0]} repeat={[34, DISTRICT_GROUND_PRESENTATION.roadRepeatZ]} size={[176, DISTRICT_GROUND_PRESENTATION.roadWidth]} />}
      >
        <Suspense fallback={<CobblestoneFallbackSurface position={[36, 0.115, 0]} repeat={[34, DISTRICT_GROUND_PRESENTATION.roadRepeatZ]} size={[176, DISTRICT_GROUND_PRESENTATION.roadWidth]} />}>
          <CobblestoneSurface position={[36, 0.115, 0]} repeat={[34, DISTRICT_GROUND_PRESENTATION.roadRepeatZ]} size={[176, DISTRICT_GROUND_PRESENTATION.roadWidth]} />
        </Suspense>
      </OptionalAssetBoundary>

      {profile.textureTier === "low" ? (
        facadeFallback
      ) : (
        <OptionalAssetBoundary
          assetId="district-facades-pbr"
          fallback={facadeFallback}
        >
          <Suspense fallback={facadeFallback}>
            <DistrictFacades
              castShadow={profile.shadows.enabled}
              placements={facadePlacements}
              textureTier={profile.textureTier}
            />
          </Suspense>
        </OptionalAssetBoundary>
      )}
      {lanterns.map((position, index) => (
        <StreetLantern
          key={`${position.join("-")}-${index}`}
          position={position}
        />
      ))}
      <EnvironmentDressing
        profile={profile}
        reducedMotion={reducedMotion}
      />

      <OptionalAssetBoundary
        assetId="post-road-barrel-set"
        fallback={<ProceduralBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />}
      >
        <Suspense fallback={<ProceduralBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />}>
          <LicensedBarrelSet position={[16.2, 0, 4.7]} rotation={[0, -0.45, 0]} />
        </Suspense>
      </OptionalAssetBoundary>
    </>
  );
}
