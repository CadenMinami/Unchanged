import { describe, expect, it } from "vitest";

import {
  type ProximityCandidate,
  selectNearestEligibleInteraction,
  selectProximityInteraction,
} from "@/components/world/interactions/proximity-registry";

const request = {
  interactableId: "INTERACTABLE-E3-ARCHIVE-TABLE",
  zoneId: "archive-antechamber" as const,
  interactionType: "inspect_evidence" as const,
  canonicalTarget: { targetType: "evidence" as const, evidenceId: "E3" },
};

describe("proximity registry", () => {
  it("selects the nearest eligible interaction inside the radius", () => {
    expect(
      selectNearestEligibleInteraction(
        [0, 0, 0],
        [
          { candidateId: "far", eligible: true, position: [2.8, 0, 0], request },
          { candidateId: "near", eligible: true, position: [1.2, 0, 0], request },
        ],
        3,
      )?.candidateId,
    ).toBe("near");
  });

  it("fails closed when candidates are ineligible or outside the radius", () => {
    expect(
      selectNearestEligibleInteraction(
        [0, 0, 0],
        [
          { candidateId: "locked", eligible: false, position: [1, 0, 0], request },
          { candidateId: "far", eligible: true, position: [4, 0, 0], request },
        ],
        3,
      ),
    ).toBeNull();
  });

  it("uses stable candidate IDs to break equal-distance ties", () => {
    const selected = selectNearestEligibleInteraction(
      [0, 0, 0],
      [
        { candidateId: "B", eligible: true, position: [1, 0, 0], request },
        { candidateId: "A", eligible: true, position: [-1, 0, 0], request },
      ],
      3,
    );

    expect(selected?.candidateId).toBe("A");
  });

  it("does not use allocation-prone array transforms in the frame selector", () => {
    const candidates: readonly ProximityCandidate[] = [
      { candidateId: "B", eligible: true, position: [1, 0, 0], request },
      { candidateId: "A", eligible: true, position: [-1, 0, 0], request },
    ];
    const guardedCandidates = new Proxy(candidates, {
      get(target, property, receiver) {
        if (property === "filter" || property === "sort") {
          throw new Error(`Unexpected ${String(property)} call`);
        }
        return Reflect.get(target, property, receiver);
      },
    });

    expect(
      selectNearestEligibleInteraction([0, 0, 0], guardedCandidates, 3)
        ?.candidateId,
    ).toBe("A");
  });

  it("retains the current interaction inside a larger exit radius", () => {
    const candidates: readonly ProximityCandidate[] = [
      { candidateId: "current", eligible: true, position: [3.8, 0, 0], request },
    ];

    expect(
      selectProximityInteraction([0, 0, 0], candidates, 3, "current", 4.5)
        ?.candidateId,
    ).toBe("current");
    expect(
      selectProximityInteraction([0, 0, 0], candidates, 3, "current", 3.5),
    ).toBeNull();
  });

  it("uses a forgiving default exit band for stop-and-interact momentum", () => {
    const candidates: readonly ProximityCandidate[] = [
      { candidateId: "current", eligible: true, position: [5.2, 0, 0], request },
    ];

    expect(
      selectProximityInteraction([0, 0, 0], candidates, 3, "current")?.candidateId,
    ).toBe("current");
  });

  it("prefers a newly entered nearer interaction over exit hysteresis", () => {
    const candidates: readonly ProximityCandidate[] = [
      { candidateId: "current", eligible: true, position: [3.8, 0, 0], request },
      { candidateId: "near", eligible: true, position: [1.2, 0, 0], request },
    ];

    expect(
      selectProximityInteraction([0, 0, 0], candidates, 3, "current", 4.5)
        ?.candidateId,
    ).toBe("near");
  });
});
