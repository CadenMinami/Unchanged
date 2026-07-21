"use client";

import type { TextureTier } from "@/lib/world/graphics-profile";

import type { DistrictFacadePlacement } from "./district-layout";
import {
  FacadeSurfaceMaterial,
  getScaleAwareFacadeRepeat,
  selectFacadePbrFamily,
} from "./pbr-surface-material";

type ModularFacadeProps = Readonly<{
  placement: DistrictFacadePlacement;
  castShadow?: boolean;
  textureTier?: TextureTier;
}>;

type FacadeWindowProps = Readonly<{
  id: string;
  lit: boolean;
  position: readonly [number, number, number];
  trim: string;
  windowColor: string;
  narrow?: boolean;
}>;

function FacadeWindow({
  id,
  lit,
  position,
  trim,
  windowColor,
  narrow = false,
}: FacadeWindowProps) {
  const width = narrow ? 0.58 : 0.82;
  return (
    <group name="recessed-window" position={position}>
      <mesh position={[0, 0, -0.055]}>
        <boxGeometry args={[width + 0.18, 1.22, 0.16]} />
        <meshStandardMaterial color="#252a2a" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0, 0.045]}>
        <boxGeometry args={[width, 1.04, 0.075]} />
        <meshStandardMaterial
          color={lit ? windowColor : "#26343b"}
          emissive={lit ? "#bc6f2c" : "#0c1418"}
          emissiveIntensity={lit ? 0.72 : 0.08}
          metalness={0.03}
          roughness={0.42}
        />
      </mesh>
      <mesh name={`${id}-window-vertical`} position={[0, 0, 0.095]}>
        <boxGeometry args={[0.055, 1.07, 0.055]} />
        <meshStandardMaterial color={trim} roughness={0.88} />
      </mesh>
      <mesh name={`${id}-window-horizontal`} position={[0, 0, 0.095]}>
        <boxGeometry args={[width + 0.02, 0.055, 0.055]} />
        <meshStandardMaterial color={trim} roughness={0.88} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          castShadow
          key={side}
          position={[side * (width / 2 + 0.16), 0, 0.035]}
        >
          <boxGeometry args={[0.2, 1.2, 0.12]} />
          <meshStandardMaterial color={trim} roughness={0.94} />
        </mesh>
      ))}
      <mesh position={[0, -0.66, 0.04]}>
        <boxGeometry args={[width + 0.32, 0.12, 0.26]} />
        <meshStandardMaterial color="#777269" roughness={0.98} />
      </mesh>
    </group>
  );
}

function PitchedRoof({
  castShadow,
  depth,
  height,
  roof,
  textureTier,
  width,
}: Readonly<{
  castShadow: boolean;
  depth: number;
  height: number;
  roof: string;
  textureTier: TextureTier;
  width: number;
}>) {
  const pitch = 0.58;
  const panelWidth = width * 0.62;
  const roofRepeat = getScaleAwareFacadeRepeat("roof", [
    panelWidth,
    depth + 0.55,
  ]);
  return (
    <group position={[0, height + 0.64, 0]}>
      {[-1, 1].map((side) => (
        <mesh
          castShadow={castShadow}
          key={side}
          position={[side * width * 0.25, 0.34, 0]}
          receiveShadow
          rotation={[0, 0, -side * pitch]}
        >
          <boxGeometry args={[panelWidth, 0.16, depth + 0.55]} />
          <FacadeSurfaceMaterial
            color={roof}
            family="roof"
            repeat={roofRepeat}
            textureTier={textureTier}
          />
        </mesh>
      ))}
      <mesh castShadow={castShadow} position={[0, 0.95, 0]}>
        <boxGeometry args={[0.18, 0.16, depth + 0.64]} />
        <meshStandardMaterial color="#494039" roughness={0.95} />
      </mesh>
    </group>
  );
}

function FamilyDetails({
  castShadow,
  placement,
}: Readonly<{
  castShadow: boolean;
  placement: DistrictFacadePlacement;
}>) {
  const [width, height, depth] = placement.size;
  const frontZ = depth / 2 + 0.1;
  const trimMaterial = (
    <meshStandardMaterial color={placement.palette.trim} roughness={0.95} />
  );

  if (placement.family === "timber-front") {
    return (
      <group name="timber-frame-detail">
        {[-0.34, 0.34].map((xRatio) => (
          <mesh
            castShadow={castShadow}
            key={xRatio}
            name="timber-beam"
            position={[width * xRatio, height * 0.55 + 0.45, frontZ]}
          >
            <boxGeometry args={[0.2, height * 0.88, 0.14]} />
            {trimMaterial}
          </mesh>
        ))}
        {[height * 0.32, height * 0.68].map((yRatio) => (
          <mesh
            castShadow={castShadow}
            key={yRatio}
            name="timber-beam"
            position={[0, yRatio + 0.45, frontZ]}
          >
            <boxGeometry args={[width * 0.94, 0.18, 0.14]} />
            {trimMaterial}
          </mesh>
        ))}
      </group>
    );
  }

  if (placement.family === "stone-civic") {
    return (
      <group name="civic-masonry-detail">
        {Array.from({ length: 4 }, (_, index) => (
          <mesh
            key={index}
            name="stone-course"
            position={[0, 0.78 + index * 0.74, frontZ]}
          >
            <boxGeometry args={[width * 0.96, 0.08, 0.12]} />
            <meshStandardMaterial
              color={placement.palette.stone}
              roughness={0.99}
            />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <mesh
            castShadow={castShadow}
            key={side}
            position={[side * (width / 2 - 0.18), height * 0.5 + 0.45, frontZ]}
          >
            <boxGeometry args={[0.34, height * 0.92, 0.2]} />
            <meshStandardMaterial
              color={placement.palette.stone}
              roughness={0.98}
            />
          </mesh>
        ))}
      </group>
    );
  }

  if (placement.family === "shopfront") {
    return (
      <group name="shopfront-detail">
        <mesh
          castShadow={castShadow}
          name="shop-canopy"
          position={[0, 2.12, frontZ + 0.42]}
          rotation={[0.16, 0, 0]}
        >
          <boxGeometry args={[width * 0.74, 0.14, 0.92]} />
          <meshStandardMaterial color={placement.palette.trim} roughness={0.9} />
        </mesh>
        {[-0.31, 0.31].map((xRatio) => (
          <mesh key={xRatio} position={[width * xRatio, 1.35, frontZ + 0.03]}>
            <boxGeometry args={[width * 0.22, 1.25, 0.12]} />
            <meshStandardMaterial color="#29363b" roughness={0.5} />
          </mesh>
        ))}
      </group>
    );
  }

  return null;
}

export function ModularFacade({
  placement,
  castShadow = true,
  textureTier,
}: ModularFacadeProps) {
  const [width, height, depth] = placement.size;
  const frontZ = depth / 2 + 0.09;
  const windowCount =
    placement.family === "narrow-row"
      ? 2
      : Math.max(2, Math.min(3, Math.floor(width / 2)));
  const windowXs = Array.from(
    { length: windowCount },
    (_, index) => ((index + 1) * width) / (windowCount + 1) - width / 2,
  );
  const facesRoadFromNorth = placement.position[2] > 0;
  const resolvedTextureTier = textureTier ?? "low";
  const wallFamily = selectFacadePbrFamily(placement.family);

  return (
    <group
      name={`facade-${placement.id}`}
      position={placement.position}
      rotation={[0, facesRoadFromNorth ? Math.PI : 0, 0]}
    >
      <mesh castShadow={castShadow} position={[0, 0.22, 0]} receiveShadow>
        <boxGeometry args={[width + 0.2, 0.44, depth + 0.18]} />
        <FacadeSurfaceMaterial
          color={placement.palette.stone}
          family="stone"
          repeat={getScaleAwareFacadeRepeat("stone", [width + 0.2, 0.44])}
          textureTier={resolvedTextureTier}
        />
      </mesh>
      <mesh
        castShadow={castShadow}
        position={[0, height / 2 + 0.42, 0]}
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <FacadeSurfaceMaterial
          color={placement.palette.wall}
          family={wallFamily}
          repeat={getScaleAwareFacadeRepeat(wallFamily, [width, height])}
          textureTier={resolvedTextureTier}
        />
      </mesh>
      <PitchedRoof
        castShadow={castShadow}
        depth={depth}
        height={height}
        roof={placement.palette.roof}
        textureTier={resolvedTextureTier}
        width={width}
      />
      <mesh
        castShadow={castShadow}
        name="facade-door"
        position={[0, 1.42, frontZ]}
      >
        <boxGeometry args={[0.94, 2, 0.15]} />
        <meshStandardMaterial color={placement.palette.trim} roughness={0.94} />
      </mesh>
      <mesh position={[0.3, 1.42, frontZ + 0.1]}>
        <sphereGeometry args={[0.055, 10, 8]} />
        <meshStandardMaterial color="#ad8a51" metalness={0.45} roughness={0.5} />
      </mesh>
      {windowXs.map((x, index) => (
        <FacadeWindow
          id={`${placement.id}-${index}`}
          key={`${placement.id}-window-${index}`}
          lit={placement.litWindowIndices.includes(index)}
          narrow={placement.family === "narrow-row"}
          position={[x, height * 0.65 + 0.42, frontZ]}
          trim={placement.palette.trim}
          windowColor={placement.palette.window}
        />
      ))}
      <FamilyDetails castShadow={castShadow} placement={placement} />
      <mesh
        castShadow={castShadow}
        position={[width * 0.28, height + 1.2, 0]}
      >
        <boxGeometry args={[0.42, 1.34, 0.58]} />
        <meshStandardMaterial color="#55514c" roughness={0.98} />
      </mesh>
    </group>
  );
}
