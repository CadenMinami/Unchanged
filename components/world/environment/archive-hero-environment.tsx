"use client";

import type { EnvironmentDensity } from "@/lib/world/graphics-profile";

export type ArchiveHeroClearance = Readonly<{
  id: string;
  position: readonly [number, number, number];
  radius: number;
}>;

export type ArchiveDressingSocket = Readonly<{
  id: string;
  kind: "bundle" | "crate" | "post";
  minimumDensity: EnvironmentDensity;
  position: readonly [number, number, number];
  rotationY: number;
  radius: number;
}>;

export const ARCHIVE_HERO_CLEARANCES: readonly ArchiveHeroClearance[] = [
  { id: "archive-entry", position: [0, 0, 0], radius: 2 },
  { id: "archive-account-table", position: [0, 0, -2.35], radius: 1.5 },
  { id: "archive-travel-dossier", position: [3, 0, -1], radius: 1.2 },
  { id: "archive-assembly-station", position: [-3, 0, 1.5], radius: 1.2 },
  { id: "archive-journal", position: [3, 0, 2.7], radius: 1.2 },
] as const;

export const ARCHIVE_HERO_DRESSING_SOCKETS: readonly ArchiveDressingSocket[] = [
  { id: "archive-dressing-west-south", kind: "bundle", minimumDensity: "low", position: [-7, 0, -4.8], rotationY: 0.3, radius: 0.65 },
  { id: "archive-dressing-east-north", kind: "crate", minimumDensity: "low", position: [7, 0, 4.8], rotationY: -0.35, radius: 0.68 },
  { id: "archive-dressing-west-north", kind: "post", minimumDensity: "medium", position: [-7, 0, 4.8], rotationY: 0, radius: 0.5 },
  { id: "archive-dressing-east-south", kind: "bundle", minimumDensity: "medium", position: [7, 0, -4.8], rotationY: -0.5, radius: 0.65 },
  { id: "archive-dressing-outer-west", kind: "crate", minimumDensity: "high", position: [-9, 0, 0], rotationY: 0.22, radius: 0.68 },
  { id: "archive-dressing-outer-east", kind: "post", minimumDensity: "high", position: [9, 0, 0], rotationY: 0, radius: 0.5 },
] as const;

const DENSITY_RANK: Readonly<Record<EnvironmentDensity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function selectArchiveDressingSockets(
  density: EnvironmentDensity,
): readonly ArchiveDressingSocket[] {
  return ARCHIVE_HERO_DRESSING_SOCKETS.filter(
    ({ minimumDensity }) =>
      DENSITY_RANK[minimumDensity] <= DENSITY_RANK[density],
  );
}

function DressingObject({
  castShadow,
  socket,
}: Readonly<{
  castShadow: boolean;
  socket: ArchiveDressingSocket;
}>) {
  if (socket.kind === "post") {
    return (
      <group position={socket.position} rotation={[0, socket.rotationY, 0]}>
        <mesh castShadow={castShadow} position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 1.5, 8]} />
          <meshStandardMaterial color="#4b3b2d" roughness={0.97} />
        </mesh>
        <mesh castShadow={castShadow} position={[0.18, 1.2, 0]}>
          <boxGeometry args={[0.55, 0.3, 0.08]} />
          <meshStandardMaterial color="#63503a" roughness={0.96} />
        </mesh>
      </group>
    );
  }

  if (socket.kind === "crate") {
    return (
      <group position={socket.position} rotation={[0, socket.rotationY, 0]}>
        <mesh castShadow={castShadow} position={[0, 0.42, 0]} receiveShadow>
          <boxGeometry args={[0.82, 0.82, 0.76]} />
          <meshStandardMaterial color="#67513a" roughness={0.94} />
        </mesh>
        {[-0.28, 0.28].map((y) => (
          <mesh key={y} position={[0, 0.42 + y, 0.39]}>
            <boxGeometry args={[0.92, 0.09, 0.08]} />
            <meshStandardMaterial color="#3f3429" roughness={0.97} />
          </mesh>
        ))}
      </group>
    );
  }

  return (
    <group position={socket.position} rotation={[0, socket.rotationY, 0]}>
      {[0, 0.34, -0.32].map((x, index) => (
        <mesh
          castShadow={castShadow}
          key={`${socket.id}-${index}`}
          position={[x, 0.24 + index * 0.04, index === 0 ? 0 : 0.18]}
          rotation={[0, 0, index % 2 === 0 ? 0.08 : -0.1]}
        >
          <cylinderGeometry args={[0.18, 0.22, 0.72, 9]} />
          <meshStandardMaterial color="#73634a" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

export function ArchiveHeroEnvironment({
  density,
  castShadow = true,
}: Readonly<{
  density: EnvironmentDensity;
  castShadow?: boolean;
}>) {
  return (
    <group name="archive-hero-environment">
      {[-6.1, 6.1].map((x, index) => (
        <group
          key={x}
          name="recessed-opening"
          position={[x, 1.85, index === 0 ? -5.85 : 6.05]}
          rotation={[0, index === 0 ? 0 : Math.PI, 0]}
        >
          <mesh position={[0, 0, -0.08]}>
            <boxGeometry args={[1.65, 2.4, 0.22]} />
            <meshStandardMaterial color="#232b2c" roughness={0.96} />
          </mesh>
          <mesh position={[0, 0, 0.06]}>
            <boxGeometry args={[1.36, 2.1, 0.08]} />
            <meshStandardMaterial color="#26383e" roughness={0.5} />
          </mesh>
          {[-0.75, 0.75].map((side) => (
            <mesh castShadow={castShadow} key={side} position={[side, 0, 0.1]}>
              <boxGeometry args={[0.18, 2.55, 0.18]} />
              <meshStandardMaterial color="#4b4134" roughness={0.95} />
            </mesh>
          ))}
        </group>
      ))}

      <group name="layered-signage" position={[-7.5, 0, -3.65]}>
        <mesh castShadow={castShadow} position={[0, 1.12, 0]}>
          <boxGeometry args={[0.13, 2.24, 0.13]} />
          <meshStandardMaterial color="#3c342b" roughness={0.96} />
        </mesh>
        <mesh castShadow={castShadow} position={[0.65, 1.78, 0]}>
          <boxGeometry args={[1.42, 0.58, 0.12]} />
          <meshStandardMaterial color="#6d5940" roughness={0.93} />
        </mesh>
        <mesh position={[0.65, 1.78, 0.075]}>
          <boxGeometry args={[1.14, 0.34, 0.04]} />
          <meshStandardMaterial color="#a58d61" roughness={0.9} />
        </mesh>
      </group>

      {[-1, 1].map((side) => (
        <group key={side} name="street-edge-detail" position={[0, 0, side * 3.45]}>
          <mesh receiveShadow position={[0, 0.14, 0]}>
            <boxGeometry args={[17.5, 0.24, 0.34]} />
            <meshStandardMaterial color="#6f706b" roughness={1} />
          </mesh>
          <mesh receiveShadow position={[0, 0.05, side * 0.32]}>
            <boxGeometry args={[17.5, 0.1, 0.72]} />
            <meshStandardMaterial color="#4a504b" roughness={1} />
          </mesh>
        </group>
      ))}

      {selectArchiveDressingSockets(density).map((socket) => (
        <DressingObject
          castShadow={castShadow}
          key={socket.id}
          socket={socket}
        />
      ))}
    </group>
  );
}
