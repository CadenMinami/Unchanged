"use client";

import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import type { SceneManifest } from "@/schemas/world-manifest";

import { PeriodFigure } from "../character/period-figure";
import type { ProximityCandidate } from "../interactions/proximity-registry";

const manifest = loadVarennesSceneManifest();
type ManifestInteractable = SceneManifest["interactables"][number];

const e1Interactable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "evidence" &&
    item.canonicalTarget.evidenceId === "E1",
);
const civicStationInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "station" &&
    item.canonicalTarget.stationId === "STATION-VARENNES-CIVIC",
);
const louisInteractable = manifest.interactables.find(
  (item) =>
    item.canonicalTarget.targetType === "station" &&
    item.canonicalTarget.stationId === "CHAR-LOUIS",
);

if (!e1Interactable) throw new Error("The civic zone requires the reviewed declaration.");
if (!louisInteractable) throw new Error("The civic zone requires the Louis station.");
if (!civicStationInteractable) {
  throw new Error("The civic zone requires the static Varennes civic station.");
}

const civicManifestZone = manifest.zones.find(
  (zone) => zone.zoneId === e1Interactable.zoneId,
);
if (!civicManifestZone) throw new Error("The civic interactables require an authored zone.");

const civicSpawn = civicManifestZone.safeSpawns[0].position;
const e1Position: [number, number, number] = [
  civicSpawn[0] - 2,
  civicSpawn[1],
  civicSpawn[2] - 1.75,
];
const civicStationPosition: [number, number, number] = [
  civicSpawn[0] + 2.5,
  civicSpawn[1],
  civicSpawn[2] + 1.5,
];
const louisPosition: [number, number, number] = [
  civicSpawn[0] + 4.5,
  civicSpawn[1],
  civicSpawn[2] - 1.5,
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

export const CIVIC_E1_CANDIDATE = candidateFromManifest(e1Interactable, e1Position);
export const CIVIC_LOUIS_CANDIDATE = candidateFromManifest(
  louisInteractable,
  louisPosition,
);
export const CIVIC_STATION_CANDIDATE = candidateFromManifest(
  civicStationInteractable,
  civicStationPosition,
);
export const CIVIC_CANDIDATES = [
  CIVIC_E1_CANDIDATE,
  CIVIC_LOUIS_CANDIDATE,
  CIVIC_STATION_CANDIDATE,
] as const satisfies readonly ProximityCandidate[];

export function CivicZone({ reducedMotion = false }: { reducedMotion?: boolean }) {
  return (
    <group>
      <mesh
        receiveShadow
        position={[civicSpawn[0], 0.035, civicSpawn[2]]}
        scale={[10, 0.07, 6.5]}
      >
        <boxGeometry />
        <meshStandardMaterial color="#767b7a" roughness={1} />
      </mesh>

      <group position={[civicSpawn[0], 0, civicSpawn[2] - 3.6]}>
        <mesh castShadow receiveShadow position={[0, 1.45, 0]} scale={[5.2, 2.9, 1.35]}>
          <boxGeometry />
          <meshStandardMaterial color="#9a9d98" roughness={0.97} />
        </mesh>
        {[-3.3, 0, 3.3].map((x) => (
          <mesh
            castShadow
            key={x}
            position={[x, 3.22, 0]}
            rotation={[0, 0, Math.PI / 4]}
            scale={[1.75, 1.75, 1.2]}
          >
            <boxGeometry />
            <meshStandardMaterial color="#51585b" roughness={0.95} />
          </mesh>
        ))}
      </group>

      <group position={e1Position}>
        <mesh castShadow position={[0, 0.72, 0]} scale={[0.92, 1.44, 0.72]}>
          <boxGeometry />
          <meshStandardMaterial color="#4b5357" roughness={0.94} />
        </mesh>
        <mesh position={[0, 1.47, -0.08]} rotation={[-0.3, 0, 0]} scale={[0.72, 0.04, 0.5]}>
          <boxGeometry />
          <meshStandardMaterial color="#d9d7cf" roughness={0.9} />
        </mesh>
      </group>

      <group position={louisPosition}>
        <PeriodFigure
          palette={{
            skin: "#c0a087",
            coat: "#3c4c5a",
            waistcoat: "#c2ab74",
            breeches: "#45413e",
            stockings: "#d0c8b6",
            shoes: "#242321",
            hair: "#665347",
            hat: "#5c4b32",
          }}
          reducedMotion={reducedMotion}
        />
      </group>

      <group position={civicStationPosition}>
        <mesh castShadow position={[0, 1.15, 0]} scale={[2.25, 1.45, 0.16]}>
          <boxGeometry />
          <meshStandardMaterial color="#464f53" roughness={0.95} />
        </mesh>
        {[-1.25, 0, 1.25].map((x) => (
          <group key={x} position={[x, 0, -0.4]}>
            <PeriodFigure
              palette={{
                skin: "#85817b",
                coat: x === 0 ? "#515e5e" : "#5f5d55",
                waistcoat: "#777162",
                breeches: "#4f4d48",
                stockings: "#8e8a80",
                shoes: "#30302d",
                hair: "#4c4944",
                hat: "#3e403d",
              }}
              reducedMotion={reducedMotion}
              scale={0.76}
            />
          </group>
        ))}
      </group>

    </group>
  );
}
