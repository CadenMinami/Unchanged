"use client";

import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
  Vector2,
} from "three";

import type { DistrictFacadeFamily } from "./district-layout";
import type { TextureTier } from "@/lib/world/graphics-profile";

export const FACADE_PBR_USED_FAMILIES = [
  "plaster",
  "stone",
  "timber",
  "roof",
] as const;

export type FacadePbrFamily = (typeof FACADE_PBR_USED_FAMILIES)[number];

type FacadeTextureSet = Readonly<{
  map: string;
  normalMap: string;
  roughnessMap: string;
}>;

export const FACADE_PBR_TEXTURE_URLS = {
  plaster: {
    map: "/world/textures/painted-plaster-wall/painted_plaster_wall_diff_1k.jpg",
    normalMap:
      "/world/textures/painted-plaster-wall/painted_plaster_wall_nor_gl_1k.jpg",
    roughnessMap:
      "/world/textures/painted-plaster-wall/painted_plaster_wall_rough_1k.jpg",
  },
  stone: {
    map: "/world/textures/stone-wall/stone_wall_diff_1k.jpg",
    normalMap: "/world/textures/stone-wall/stone_wall_nor_gl_1k.jpg",
    roughnessMap: "/world/textures/stone-wall/stone_wall_rough_1k.jpg",
  },
  timber: {
    map: "/world/textures/wood-planks/wood_planks_diff_1k.jpg",
    normalMap: "/world/textures/wood-planks/wood_planks_nor_gl_1k.jpg",
    roughnessMap: "/world/textures/wood-planks/wood_planks_rough_1k.jpg",
  },
  roof: {
    map: "/world/textures/clay-roof-tiles/clay_roof_tiles_diff_1k.jpg",
    normalMap:
      "/world/textures/clay-roof-tiles/clay_roof_tiles_nor_gl_1k.jpg",
    roughnessMap:
      "/world/textures/clay-roof-tiles/clay_roof_tiles_rough_1k.jpg",
  },
} as const satisfies Record<FacadePbrFamily, FacadeTextureSet>;

const SOURCE_SCALE_METERS: Readonly<Record<FacadePbrFamily, number>> = {
  plaster: 2,
  stone: 2,
  timber: 1.5,
  roof: 4,
};

const NORMAL_SCALE: Readonly<Record<FacadePbrFamily, Vector2>> = {
  plaster: new Vector2(0.32, 0.32),
  stone: new Vector2(0.46, 0.46),
  timber: new Vector2(0.38, 0.38),
  roof: new Vector2(0.42, 0.42),
};

const ROUGHNESS: Readonly<Record<FacadePbrFamily, number>> = {
  plaster: 0.94,
  stone: 0.98,
  timber: 0.9,
  roof: 0.92,
};

type LoadedFacadeTextureSet = Readonly<{
  map: Texture;
  normalMap: Texture;
  roughnessMap: Texture;
}>;

type FacadeSurfaceMaterialProps = Readonly<{
  color: string;
  family: FacadePbrFamily;
  repeat: readonly [number, number];
  textureTier: TextureTier;
}>;

function boundedQuarterRepeat(dimension: number, sourceScale: number): number {
  const unbounded = dimension / sourceScale;
  return Math.min(8, Math.max(1, Math.round(unbounded * 4) / 4));
}

export function getScaleAwareFacadeRepeat(
  family: FacadePbrFamily,
  dimensions: readonly [number, number],
): readonly [number, number] {
  const sourceScale = SOURCE_SCALE_METERS[family];
  return [
    boundedQuarterRepeat(dimensions[0], sourceScale),
    boundedQuarterRepeat(dimensions[1], sourceScale),
  ];
}

export function selectFacadePbrFamily(
  facadeFamily: DistrictFacadeFamily,
): Exclude<FacadePbrFamily, "roof"> {
  if (facadeFamily === "stone-civic") return "stone";
  if (facadeFamily === "timber-front") return "timber";
  return "plaster";
}

function RichFacadeSurfaceMaterial({
  color,
  family,
  repeat,
}: Omit<FacadeSurfaceMaterialProps, "textureTier">) {
  const sourceTextures = useTexture(
    FACADE_PBR_TEXTURE_URLS[family],
  ) as LoadedFacadeTextureSet;
  const [repeatX, repeatY] = repeat;
  const textures = useMemo(() => {
    const map = sourceTextures.map.clone();
    const normalMap = sourceTextures.normalMap.clone();
    const roughnessMap = sourceTextures.roughnessMap.clone();

    for (const texture of [map, normalMap, roughnessMap]) {
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(repeatX, repeatY);
      texture.needsUpdate = true;
    }
    map.colorSpace = SRGBColorSpace;
    normalMap.colorSpace = LinearSRGBColorSpace;
    roughnessMap.colorSpace = LinearSRGBColorSpace;

    return { map, normalMap, roughnessMap };
  }, [repeatX, repeatY, sourceTextures]);

  useEffect(
    () => () => {
      textures.map.dispose();
      textures.normalMap.dispose();
      textures.roughnessMap.dispose();
    },
    [textures],
  );

  return (
    <meshStandardMaterial
      color={color}
      map={textures.map}
      name="facade-material-pbr"
      normalMap={textures.normalMap}
      normalScale={NORMAL_SCALE[family]}
      roughness={ROUGHNESS[family]}
      roughnessMap={textures.roughnessMap}
    />
  );
}

export function FacadeSurfaceMaterial({
  color,
  family,
  repeat,
  textureTier,
}: FacadeSurfaceMaterialProps) {
  if (textureTier === "low") {
    return (
      <meshStandardMaterial
        color={color}
        name="facade-material-fallback"
        roughness={ROUGHNESS[family]}
      />
    );
  }

  return (
    <RichFacadeSurfaceMaterial
      color={color}
      family={family}
      repeat={repeat}
    />
  );
}
