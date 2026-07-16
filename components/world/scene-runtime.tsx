"use client";

import { ContactShadows } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import type { EcctrlHandle } from "ecctrl";
import { Suspense, useEffect } from "react";
import { useRef } from "react";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";
import { subscribeToWebGLContextLoss } from "@/lib/world/webgl-context-loss";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";
import type { WorldInteractionRequest } from "@/schemas/world-manifest";

import { InvestigatorController } from "./character/investigator-controller";
import { AmbientResidents } from "./ambient/ambient-residents";
import { ProximityRegistry } from "./interactions/proximity-registry";
import { ARCHIVE_CANDIDATES, ArchiveZone } from "./zones/archive-zone";
import { BRIDGE_CANDIDATES, BridgeZone } from "./zones/bridge-zone";
import { CIVIC_CANDIDATES, CivicZone } from "./zones/civic-zone";
import { POST_ROAD_CANDIDATES, PostRoadZone } from "./zones/post-road-zone";

const sceneManifest = loadVarennesSceneManifest();
const ambientLines = loadVarennesAmbientLines();

function Building({
  position,
  scale,
  wall,
}: {
  position: [number, number];
  scale: [number, number, number];
  wall: string;
}) {
  return (
    <group position={[position[0], scale[1] / 2, position[1]]}>
      <mesh castShadow receiveShadow scale={scale}>
        <boxGeometry />
        <meshStandardMaterial color={wall} roughness={0.92} />
      </mesh>
      <mesh
        castShadow
        position={[0, scale[1] / 2 + 0.32, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={[scale[0] * 0.82, 0.56, scale[2] * 0.82]}
      >
        <coneGeometry args={[1.35, 1.15, 4]} />
        <meshStandardMaterial color="#7e4032" roughness={0.88} />
      </mesh>
    </group>
  );
}

function PerformanceSampler({
  onSample,
}: {
  onSample: (timestampMs: number, fps: number) => void;
}) {
  useFrame((_state, deltaSeconds) => {
    if (deltaSeconds > 0) {
      onSample(performance.now(), 1 / deltaSeconds);
    }
  });

  return null;
}

function ContextLossMonitor({ onContextLost }: { onContextLost: () => void }) {
  const renderer = useThree((state) => state.gl);

  useEffect(
    () => subscribeToWebGLContextLoss(renderer.domElement, onContextLost),
    [onContextLost, renderer],
  );

  return null;
}

function GrayboxDistrict({ profile }: { profile: GraphicsProfile }) {
  return (
    <>
      <color attach="background" args={["#aeb8ad"]} />
      <fog attach="fog" args={["#aeb8ad", profile.fog.near, profile.fog.far]} />
      <ambientLight intensity={0.78} />
      <directionalLight
        castShadow={profile.shadows.enabled}
        intensity={2.4}
        position={[8, 14, 7]}
        shadow-mapSize-height={profile.shadows.mapSize}
        shadow-mapSize-width={profile.shadows.mapSize}
      />

      <mesh receiveShadow position={[36, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[180, 50]} />
        <meshStandardMaterial color="#66745d" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[36, 0.035, 0]} scale={[80, 0.07, 2.5]}>
        <boxGeometry />
        <meshStandardMaterial color="#8c8170" roughness={1} />
      </mesh>
      <mesh receiveShadow position={[0, 0.025, 1]} rotation={[-Math.PI / 2, 0, -0.17]}>
        <planeGeometry args={[6, 52]} />
        <meshStandardMaterial color="#8c8170" roughness={1} />
      </mesh>
      <mesh castShadow receiveShadow position={[0.8, 0.22, -3.7]} scale={[3.9, 0.22, 1.5]}>
        <boxGeometry />
        <meshStandardMaterial color="#858983" roughness={0.96} />
      </mesh>
      {[-2.2, -0.7, 0.8, 2.3, 3.8].map((x) => (
        <mesh castShadow key={x} position={[x, 0.53, -3.7]} scale={[0.12, 0.48, 1.25]}>
          <boxGeometry />
          <meshStandardMaterial color="#b6aea0" />
        </mesh>
      ))}
      <Building position={[-5.1, -7]} scale={[2.4, 1.5, 2.1]} wall="#d6c5a8" />
      <Building position={[5.6, -8]} scale={[2.7, 1.8, 2.2]} wall="#c4b9a3" />
      <Building position={[-5.5, 1.6]} scale={[2.1, 1.25, 1.8]} wall="#d1d0bd" />
      <Building position={[5.4, 2.8]} scale={[2.2, 1.4, 1.9]} wall="#bfc6bc" />
      <Building position={[-3.9, 8.5]} scale={[1.8, 1.1, 1.7]} wall="#d6c9b2" />
      <Building position={[4.4, 9.2]} scale={[2, 1.2, 1.6]} wall="#c8bea8" />
      <mesh castShadow position={[0.5, 0.9, 6.8]}>
        <cylinderGeometry args={[0.75, 0.95, 1.8, 10]} />
        <meshStandardMaterial color="#b7b2a8" roughness={0.9} />
      </mesh>
      {profile.shadows.enabled ? (
        <ContactShadows far={22} opacity={0.34} position={[0, 0.035, 0]} scale={32} />
      ) : null}
    </>
  );
}

interface SceneRuntimeProps {
  graphicsProfile: GraphicsProfile;
  initialPosition: [number, number, number];
  locomotionEnabled: boolean;
  onNearbyInteractionChange: (request: WorldInteractionRequest | null) => void;
  onPlayerPositionChange?: (position: [number, number, number]) => void;
  onContextLost: () => void;
  onPerformanceSample: (timestampMs: number, fps: number) => void;
  testMode?: boolean;
  reducedMotion?: boolean;
}

export function SceneRuntime({
  graphicsProfile,
  initialPosition,
  locomotionEnabled,
  onNearbyInteractionChange,
  onPlayerPositionChange,
  onContextLost,
  onPerformanceSample,
  testMode = false,
  reducedMotion = false,
}: SceneRuntimeProps) {
  const controllerRef = useRef<EcctrlHandle>(null);

  return (
    <Canvas
      camera={{ fov: 46, position: [13, 10, 18] }}
      dpr={graphicsProfile.dpr}
      frameloop={testMode ? "demand" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={graphicsProfile.shadows.enabled ? "basic" : false}
    >
      <ContextLossMonitor onContextLost={onContextLost} />
      <GrayboxDistrict profile={graphicsProfile} />
      <Suspense fallback={null}>
        <AmbientResidents
          ambientLines={ambientLines}
          count={reducedMotion ? 0 : graphicsProfile.ambientCount}
          manifest={sceneManifest}
        />
        <Physics colliders={false} gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <RigidBody colliders={false} type="fixed">
            <CuboidCollider args={[90, 0.1, 25]} position={[36, -0.1, 0]} />
            <CuboidCollider args={[2.5, 0.9, 2]} position={[-5.1, 0.9, -7]} />
            <CuboidCollider args={[2.8, 1.1, 2.2]} position={[5.6, 1.1, -8]} />
            <CuboidCollider args={[2.3, 0.8, 2]} position={[5.4, 0.8, 2.8]} />
            <CuboidCollider args={[2.1, 0.7, 1.9]} position={[-5.5, 0.7, 1.6]} />
            <CuboidCollider args={[4, 0.35, 1.6]} position={[0.8, 0.35, -3.7]} />
            <CuboidCollider args={[0.75, 0.72, 0.5]} position={[0, 0.72, -2.35]} />
          </RigidBody>
          <ArchiveZone />
          <PostRoadZone />
          <CivicZone />
          <BridgeZone />
          <ProximityRegistry
            candidates={[
              ...ARCHIVE_CANDIDATES,
              ...POST_ROAD_CANDIDATES,
              ...CIVIC_CANDIDATES,
              ...BRIDGE_CANDIDATES,
            ]}
            controllerRef={controllerRef}
            onChange={onNearbyInteractionChange}
            radius={3.1}
          />
          <InvestigatorController
            controllerRef={controllerRef}
            enabled={locomotionEnabled}
            initialPosition={initialPosition}
            onPositionChange={onPlayerPositionChange}
            reducedMotion={reducedMotion}
          />
        </Physics>
      </Suspense>
      {testMode ? null : <PerformanceSampler onSample={onPerformanceSample} />}
    </Canvas>
  );
}
