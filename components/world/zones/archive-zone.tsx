"use client";

import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import type { SceneManifest } from "@/schemas/world-manifest";

import { Interactable } from "../interactions/interactable";
import type { ProximityCandidate } from "../interactions/proximity-registry";

const manifest = loadVarennesSceneManifest();
type ManifestInteractable = SceneManifest["interactables"][number];

const e3Interactable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "evidence" &&
    item.canonicalTarget.evidenceId === "E3",
);
const e2Interactable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "evidence" &&
    item.canonicalTarget.evidenceId === "E2",
);
const assemblyInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "station" &&
    item.canonicalTarget.stationId === "STATION-ASSEMBLY",
);
const journalInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "case_surface" &&
    item.canonicalTarget.surfaceId === "journal",
);

if (!e3Interactable) throw new Error("The archive zone requires the reviewed account table.");
if (!e2Interactable) throw new Error("The archive zone requires the travel dossier.");
if (!assemblyInteractable) {
  throw new Error("The archive zone requires the Assembly reaction station.");
}
if (!journalInteractable) throw new Error("The archive zone requires the case journal.");

const archiveManifestZone = manifest.zones.find(
  (zone) => zone.zoneId === e3Interactable.zoneId,
);
if (!archiveManifestZone) throw new Error("The archive interactables require an authored zone.");

const archiveSpawn = archiveManifestZone.safeSpawns[0].position;
const e3Position: [number, number, number] = [
  archiveSpawn[0],
  archiveSpawn[1],
  archiveSpawn[2] - 2.35,
];
const e2Position: [number, number, number] = [
  archiveSpawn[0] + 3,
  archiveSpawn[1],
  archiveSpawn[2] - 1,
];
const assemblyPosition: [number, number, number] = [
  archiveSpawn[0] - 3,
  archiveSpawn[1],
  archiveSpawn[2] + 1.5,
];
const journalPosition: [number, number, number] = [
  archiveSpawn[0] + 3,
  archiveSpawn[1],
  archiveSpawn[2] + 2.7,
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

export const ARCHIVE_E3_CANDIDATE = candidateFromManifest(e3Interactable, e3Position);
export const ARCHIVE_E2_CANDIDATE = candidateFromManifest(e2Interactable, e2Position);
export const ARCHIVE_ASSEMBLY_CANDIDATE = candidateFromManifest(
  assemblyInteractable,
  assemblyPosition,
);
export const ARCHIVE_JOURNAL_CANDIDATE = candidateFromManifest(
  journalInteractable,
  journalPosition,
);
export const ARCHIVE_CANDIDATES = [
  ARCHIVE_E3_CANDIDATE,
  ARCHIVE_E2_CANDIDATE,
  ARCHIVE_ASSEMBLY_CANDIDATE,
  ARCHIVE_JOURNAL_CANDIDATE,
] as const satisfies readonly ProximityCandidate[];

export function ArchiveZone() {
  return (
    <group>
      <mesh
        receiveShadow
        position={[archiveSpawn[0] + 1.4, 0.035, archiveSpawn[2] - 1.2]}
        scale={[5.6, 0.07, 4.8]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#747a79" roughness={0.98} />
      </mesh>
      <Interactable position={e3Position} />
      <Interactable position={e2Position} />
      <Interactable position={assemblyPosition} />
      <group position={journalPosition}>
        <mesh castShadow position={[0, 0.58, 0]} scale={[0.85, 0.58, 0.62]}>
          <boxGeometry />
          <meshStandardMaterial color="#3d4c46" roughness={0.94} />
        </mesh>
        <mesh
          castShadow
          position={[0, 1.16, 0]}
          rotation={[-0.08, 0, 0]}
          scale={[0.62, 0.06, 0.46]}
        >
          <boxGeometry />
          <meshStandardMaterial color="#d3b86f" roughness={0.86} />
        </mesh>
      </group>
    </group>
  );
}
