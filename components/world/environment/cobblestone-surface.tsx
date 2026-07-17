"use client";

import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  Color,
  LinearSRGBColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  Vector2,
} from "three";

const TEXTURE_URLS = {
  map: "/world/textures/cobblestone-floor-08/cobblestone-floor-08-diff-1k.jpg",
  normalMap:
    "/world/textures/cobblestone-floor-08/cobblestone-floor-08-normal-1k.jpg",
  roughnessMap:
    "/world/textures/cobblestone-floor-08/cobblestone-floor-08-roughness-1k.jpg",
};

const COBBLE_COLOR = new Color("#aea99f");
const COBBLE_NORMAL_SCALE = new Vector2(0.38, 0.38);

interface CobblestoneSurfaceProps {
  position: [number, number, number];
  size: [number, number];
  repeat: [number, number];
  rotationY?: number;
}

export function CobblestoneFallbackSurface({
  position,
  size,
  rotationY = 0,
}: CobblestoneSurfaceProps) {
  return (
    <mesh
      receiveShadow
      position={position}
      rotation={[-Math.PI / 2, rotationY, 0]}
    >
      <planeGeometry args={size} />
      <meshStandardMaterial color="#77756f" roughness={1} />
    </mesh>
  );
}

export function CobblestoneSurface({
  position,
  size,
  repeat,
  rotationY = 0,
}: CobblestoneSurfaceProps) {
  const sourceTextures = useTexture(TEXTURE_URLS);
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
    <mesh
      receiveShadow
      position={position}
      rotation={[-Math.PI / 2, rotationY, 0]}
    >
      <planeGeometry args={size} />
      <meshStandardMaterial
        color={COBBLE_COLOR}
        map={textures.map}
        normalMap={textures.normalMap}
        normalScale={COBBLE_NORMAL_SCALE}
        roughness={0.94}
        roughnessMap={textures.roughnessMap}
      />
    </mesh>
  );
}

useTexture.preload(Object.values(TEXTURE_URLS));
