"use client";

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
import {
  FOLLOW_CAMERA_OFFSET,
  FOLLOW_CAMERA_TARGET_Y,
} from "./character/follow-camera";
import { AmbientResidents } from "./ambient/ambient-residents";
import {
  DISTRICT_BUILDINGS,
  GroundedDistrict,
} from "./environment/grounded-district";
import { ProximityRegistry } from "./interactions/proximity-registry";
import { ARCHIVE_CANDIDATES, ArchiveZone } from "./zones/archive-zone";
import { BRIDGE_CANDIDATES, BridgeZone } from "./zones/bridge-zone";
import { CIVIC_CANDIDATES, CivicZone } from "./zones/civic-zone";
import { POST_ROAD_CANDIDATES, PostRoadZone } from "./zones/post-road-zone";

const sceneManifest = loadVarennesSceneManifest();
const ambientLines = loadVarennesAmbientLines();
const worldCandidates = [
  ...ARCHIVE_CANDIDATES,
  ...POST_ROAD_CANDIDATES,
  ...CIVIC_CANDIDATES,
  ...BRIDGE_CANDIDATES,
] as const;

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
      camera={{
        fov: 46,
        position: [
          initialPosition[0] + FOLLOW_CAMERA_OFFSET[0],
          initialPosition[1] + FOLLOW_CAMERA_TARGET_Y + FOLLOW_CAMERA_OFFSET[1],
          initialPosition[2] + FOLLOW_CAMERA_OFFSET[2],
        ],
      }}
      dpr={graphicsProfile.dpr}
      frameloop={testMode ? "demand" : "always"}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      shadows={graphicsProfile.shadows.enabled ? "basic" : false}
    >
      <ContextLossMonitor onContextLost={onContextLost} />
      <ProximityRegistry
        candidates={worldCandidates}
        controllerRef={controllerRef}
        initialPosition={initialPosition}
        onChange={onNearbyInteractionChange}
        radius={3.1}
      />
      <Suspense fallback={null}>
        <GroundedDistrict profile={graphicsProfile} />
        <AmbientResidents
          ambientLines={ambientLines}
          count={reducedMotion ? 0 : graphicsProfile.ambientCount}
          manifest={sceneManifest}
        />
        <Physics colliders={false} gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <RigidBody colliders={false} type="fixed">
            <CuboidCollider args={[90, 0.1, 25]} position={[36, -0.1, 0]} />
            {DISTRICT_BUILDINGS.map((building) => (
              <CuboidCollider
                args={[
                  building.size[0] / 2,
                  building.size[1] / 2,
                  building.size[2] / 2,
                ]}
                key={building.id}
                position={[
                  building.position[0],
                  building.size[1] / 2 + 0.45,
                  building.position[2],
                ]}
              />
            ))}
            <CuboidCollider args={[0.75, 0.72, 0.5]} position={[0, 0.72, -2.35]} />
          </RigidBody>
          <ArchiveZone />
          <PostRoadZone reducedMotion={reducedMotion} />
          <CivicZone reducedMotion={reducedMotion} />
          <BridgeZone />
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
