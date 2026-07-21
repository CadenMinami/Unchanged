"use client";

import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import type { SceneManifest } from "@/schemas/world-manifest";

import type { ProximityCandidate } from "../interactions/proximity-registry";

const manifest = loadVarennesSceneManifest();
type ManifestInteractable = SceneManifest["interactables"][number];

const e5Interactable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "evidence" &&
    item.canonicalTarget.evidenceId === "E5",
);

if (!e5Interactable) throw new Error("The bridge zone requires the passage dossier.");

const bridgeManifestZone = manifest.zones.find(
  (zone) => zone.zoneId === e5Interactable.zoneId,
);
if (!bridgeManifestZone) throw new Error("The bridge interactable requires an authored zone.");

const bridgeSpawn = bridgeManifestZone.safeSpawns[0].position;
const e5Position: [number, number, number] = [
  bridgeSpawn[0],
  bridgeSpawn[1],
  bridgeSpawn[2] - 2.4,
];

function candidateFromManifest(
  interactable: ManifestInteractable,
  position: [number, number, number],
): ProximityCandidate {
  return {
    candidateId: interactable.interactableId,
    eligible: true,
    position,
    request: {
      interactableId: interactable.interactableId,
      zoneId: interactable.zoneId,
      interactionType: interactable.interactionType,
      canonicalTarget: interactable.canonicalTarget,
    },
  };
}

export const BRIDGE_E5_CANDIDATE = candidateFromManifest(e5Interactable, e5Position);
export const BRIDGE_CANDIDATES = [
  BRIDGE_E5_CANDIDATE,
] as const satisfies readonly ProximityCandidate[];

export function BridgeZone() {
  return (
    <group>
      <group position={e5Position}>
        <mesh castShadow position={[0, 0.68, 0]} scale={[1.1, 1.36, 0.8]}>
          <boxGeometry />
          <meshStandardMaterial color="#465055" roughness={0.95} />
        </mesh>
        <mesh position={[0, 1.4, -0.06]} rotation={[-0.28, 0, 0]} scale={[0.88, 0.04, 0.58]}>
          <boxGeometry />
          <meshStandardMaterial color="#d8d6ce" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
