"use client";

import { useFrame } from "@react-three/fiber";
import type { EcctrlHandle } from "ecctrl";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import type { WorldInteractionRequest } from "@/schemas/world-manifest";

export interface ProximityCandidate {
  candidateId: string;
  eligible: boolean;
  position: readonly [number, number, number];
  request: WorldInteractionRequest;
}

export function selectNearestEligibleInteraction(
  playerPosition: readonly [number, number, number],
  candidates: readonly ProximityCandidate[],
  radius: number,
): ProximityCandidate | null {
  const radiusSquared = radius * radius;
  let nearest: ProximityCandidate | null = null;
  let nearestDistanceSquared = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.eligible) continue;
    const dx = candidate.position[0] - playerPosition[0];
    const dy = candidate.position[1] - playerPosition[1];
    const dz = candidate.position[2] - playerPosition[2];
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    if (distanceSquared > radiusSquared) continue;
    if (
      distanceSquared < nearestDistanceSquared ||
      (distanceSquared === nearestDistanceSquared &&
        nearest !== null &&
        candidate.candidateId.localeCompare(nearest.candidateId) < 0)
    ) {
      nearest = candidate;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

export function selectProximityInteraction(
  playerPosition: readonly [number, number, number],
  candidates: readonly ProximityCandidate[],
  entryRadius: number,
  currentCandidateId: string | null,
  exitRadius = entryRadius * 1.75,
): ProximityCandidate | null {
  const nearest = selectNearestEligibleInteraction(
    playerPosition,
    candidates,
    entryRadius,
  );
  if (nearest || currentCandidateId === null) return nearest;

  const exitRadiusSquared = exitRadius * exitRadius;
  for (const candidate of candidates) {
    if (!candidate.eligible || candidate.candidateId !== currentCandidateId) {
      continue;
    }
    const dx = candidate.position[0] - playerPosition[0];
    const dy = candidate.position[1] - playerPosition[1];
    const dz = candidate.position[2] - playerPosition[2];
    return dx * dx + dy * dy + dz * dz <= exitRadiusSquared
      ? candidate
      : null;
  }

  return null;
}

interface ProximityRegistryProps {
  candidates: readonly ProximityCandidate[];
  controllerRef: RefObject<EcctrlHandle | null>;
  initialPosition: readonly [number, number, number];
  onChange: (request: WorldInteractionRequest | null) => void;
  radius?: number;
}

export function ProximityRegistry({
  candidates,
  controllerRef,
  initialPosition,
  onChange,
  radius = 3,
}: ProximityRegistryProps) {
  const currentCandidateId = useRef<string | null>(null);
  const playerPosition = useRef<[number, number, number]>([0, 0, 0]);

  useEffect(() => {
    const nearest = selectNearestEligibleInteraction(
      initialPosition,
      candidates,
      radius,
    );
    currentCandidateId.current = nearest?.candidateId ?? null;
    onChange(nearest?.request ?? null);
    return () => onChange(null);
  }, [candidates, initialPosition, onChange, radius]);

  useFrame(() => {
    if (!controllerRef.current) return;
    const position = controllerRef.current.currPos;
    playerPosition.current[0] = position.x;
    playerPosition.current[1] = position.y;
    playerPosition.current[2] = position.z;
    const nearest = selectProximityInteraction(
      playerPosition.current,
      candidates,
      radius,
      currentCandidateId.current,
    );
    const nextId = nearest?.candidateId ?? null;
    if (nextId === currentCandidateId.current) return;

    currentCandidateId.current = nextId;
    onChange(nearest?.request ?? null);
  });

  return null;
}
