import { describe, expect, it } from "vitest";

import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  advancePursuitMotion,
  derivePursuitSequenceState,
  getCheckpointStartDistance,
} from "@/lib/world/pursuit-sequence";

const reconstruction = loadVarennesReconstruction();
const manifest = loadVarennesSceneManifest();

describe("guided pursuit sequence", () => {
  it("uses the canonical ordered steps with two order-independent local actions", () => {
    expect(manifest.repairPath.checkpoints.map((checkpoint) => checkpoint.repairStepId)).toEqual(
      reconstruction.repairSteps.map((step) => step.id),
    );
    expect(manifest.repairPath.localActions.map((action) => action.repairActionId).sort()).toEqual([
      "RA-05-OBSTRUCTION",
      "RA-05-PASSPORT",
    ]);
    expect(
      new Set(manifest.repairPath.localActions.map((action) => action.parentStepId)),
    ).toEqual(new Set(["RS-05-OBSTRUCTION"]));
  });

  it("bounds travel at the next reducer-owned checkpoint", () => {
    const state = derivePursuitSequenceState(manifest.repairPath, [], []);

    expect(state.currentStepId).toBe("RS-01-ROUTE");
    expect(state.maximumDistance).toBe(manifest.repairPath.checkpoints[0]?.distance);
    expect(state.minimumDistance).toBe(manifest.repairPath.startDistance);
    expect(state.availableActionIds).toEqual([]);
  });

  it("resumes from the last completed checkpoint after refresh", () => {
    const completedStepIds = ["RS-01-ROUTE", "RS-02-PURSUIT"] as const;
    const state = derivePursuitSequenceState(
      manifest.repairPath,
      [...completedStepIds],
      [],
    );

    expect(state.currentStepId).toBe("RS-03-WARNING");
    expect(state.minimumDistance).toBe(
      getCheckpointStartDistance(manifest.repairPath, completedStepIds.length),
    );
    expect(state.maximumDistance).toBe(manifest.repairPath.checkpoints[2]?.distance);
  });

  it("exposes both local actions until each is independently completed", () => {
    const completedSteps = reconstruction.repairSteps.slice(0, 4).map((step) => step.id);
    const initial = derivePursuitSequenceState(manifest.repairPath, completedSteps, []);
    const passportFirst = derivePursuitSequenceState(manifest.repairPath, completedSteps, [
      "RA-05-PASSPORT",
    ]);
    const both = derivePursuitSequenceState(manifest.repairPath, completedSteps, [
      "RA-05-PASSPORT",
      "RA-05-OBSTRUCTION",
    ]);

    expect(initial.availableActionIds).toEqual([
      "RA-05-OBSTRUCTION",
      "RA-05-PASSPORT",
    ]);
    expect(passportFirst.availableActionIds).toEqual(["RA-05-OBSTRUCTION"]);
    expect(passportFirst.currentStepReady).toBe(false);
    expect(both.availableActionIds).toEqual([]);
    expect(both.currentStepReady).toBe(true);
  });

  it("fails closed when completed steps are out of canonical order", () => {
    expect(() =>
      derivePursuitSequenceState(manifest.repairPath, ["RS-02-PURSUIT"], []),
    ).toThrow(/canonical order/i);
  });

  it("lets the player control pace and steering inside the authored bounds", () => {
    const sequence = derivePursuitSequenceState(manifest.repairPath, [], []);
    const walking = advancePursuitMotion(
      { distance: sequence.minimumDistance, lateralOffset: 0 },
      { forward: true, reverse: false, left: false, right: true, fast: false },
      0.5,
      sequence,
      manifest.repairPath,
    );
    const faster = advancePursuitMotion(
      { distance: sequence.minimumDistance, lateralOffset: 0 },
      { forward: true, reverse: false, left: false, right: false, fast: true },
      0.5,
      sequence,
      manifest.repairPath,
    );

    expect(walking.distance).toBeGreaterThan(sequence.minimumDistance);
    expect(walking.lateralOffset).toBeGreaterThan(0);
    expect(faster.distance).toBeGreaterThan(walking.distance);
  });

  it("clamps travel at the current checkpoint and inside the schematic corridor", () => {
    const sequence = derivePursuitSequenceState(manifest.repairPath, [], []);
    const result = advancePursuitMotion(
      {
        distance: sequence.maximumDistance - 0.05,
        lateralOffset: manifest.repairPath.corridorHalfWidth - 0.05,
      },
      { forward: true, reverse: false, left: false, right: true, fast: true },
      1,
      sequence,
      manifest.repairPath,
    );

    expect(result.distance).toBe(sequence.maximumDistance);
    expect(result.lateralOffset).toBe(manifest.repairPath.corridorHalfWidth);
  });
});
