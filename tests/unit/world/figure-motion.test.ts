import { describe, expect, it, vi } from "vitest";

const periodFigureFrameMocks = vi.hoisted(() => ({
  refs: [] as Array<{ current: unknown }>,
  useFrame: vi.fn(),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: periodFigureFrameMocks.useFrame,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();

  return {
    ...actual,
    useMemo: <Value,>(factory: () => Value) => factory(),
    useRef: () => {
      const ref = periodFigureFrameMocks.refs.shift();
      if (!ref) throw new Error("PeriodFigure requested an unexpected ref");
      return ref;
    },
  };
});

import {
  type FigureMotion,
  resolveFigureClip,
  shouldAnimateFigureMotion,
  validateFigureClips,
} from "@/components/world/character/figure-motion";
import { PeriodFigure } from "@/components/world/character/period-figure";

type FigureTransform = {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
};

type FigureGroups = {
  root: FigureTransform;
  leftArm: FigureTransform;
  rightArm: FigureTransform;
  leftLeg: FigureTransform;
  rightLeg: FigureTransform;
};

type FigureFrameCallback = (state: {
  clock: { readonly elapsedTime: number };
}) => void;

function figureTransform(staleValue = 0): FigureTransform {
  return {
    position: { x: 0, y: staleValue, z: 0 },
    rotation: { x: staleValue, y: 0, z: staleValue },
  };
}

function capturePeriodFigureFrame(
  motion: FigureMotion,
  reducedMotion: boolean,
  staleValue = 0,
): { callback: FigureFrameCallback; groups: FigureGroups } {
  const groups = {
    root: figureTransform(staleValue),
    leftArm: figureTransform(staleValue),
    rightArm: figureTransform(staleValue),
    leftLeg: figureTransform(staleValue),
    rightLeg: figureTransform(staleValue),
  };
  periodFigureFrameMocks.refs = [
    { current: groups.root },
    { current: groups.leftArm },
    { current: groups.rightArm },
    { current: groups.leftLeg },
    { current: groups.rightLeg },
  ];
  periodFigureFrameMocks.useFrame.mockClear();

  PeriodFigure({ motion, reducedMotion });

  const callback = periodFigureFrameMocks.useFrame.mock.calls[0]?.[0] as
    | FigureFrameCallback
    | undefined;
  expect(callback).toBeTypeOf("function");
  return { callback: callback!, groups };
}

function inPlaceClip(name: string) {
  return { name, rootMotionStatus: "in_place" } as const;
}

describe("figure motion clips", () => {
  it("resolves the required motion vocabulary and idle compatibility motions", () => {
    const clips = [
      inPlaceClip("Idle"),
      inPlaceClip("Walk"),
      inPlaceClip("Run"),
    ];

    expect(resolveFigureClip("idle", clips)).toBe("Idle");
    expect(resolveFigureClip("walk", clips)).toBe("Walk");
    expect(resolveFigureClip("run", clips)).toBe("Run");
    expect(resolveFigureClip("talk", clips)).toBe("Idle");
    expect(resolveFigureClip("interact", clips)).toBe("Idle");
  });

  it("matches clip aliases case-insensitively and returns the source clip name", () => {
    const clips = [
      inPlaceClip("STANDING_IDLE"),
      inPlaceClip("Walking"),
      inPlaceClip("jOg"),
    ];

    expect(validateFigureClips(clips)).toEqual({
      valid: true,
      clips: {
        idle: "STANDING_IDLE",
        walk: "Walking",
        run: "jOg",
      },
    });
    expect(resolveFigureClip("walk", clips)).toBe("Walking");
    expect(resolveFigureClip("run", clips)).toBe("jOg");
  });

  it("resolves the documented procurement-spike loop names", () => {
    const clips = [
      inPlaceClip("Idle_Loop"),
      inPlaceClip("Walk_Loop"),
      inPlaceClip("Jog_Fwd_Loop"),
    ];

    expect(validateFigureClips(clips)).toEqual({
      valid: true,
      clips: {
        idle: "Idle_Loop",
        walk: "Walk_Loop",
        run: "Jog_Fwd_Loop",
      },
    });
  });

  it("rejects a character set with a missing required in-place clip", () => {
    const clips = [inPlaceClip("Idle"), inPlaceClip("Walk")];

    expect(validateFigureClips(clips)).toEqual({
      valid: false,
      missing: ["run"],
      rootMotionOnly: [],
      unknownStatus: [],
    });
    expect(() => resolveFigureClip("idle", clips)).toThrow(/missing.*run/i);
  });

  it("rejects root-motion-only locomotion even when the clip name is plain", () => {
    const clips = [
      inPlaceClip("Idle"),
      inPlaceClip("Walk"),
      { name: "Run", rootMotionStatus: "root_motion" },
    ] as const;

    expect(validateFigureClips(clips)).toEqual({
      valid: false,
      missing: [],
      rootMotionOnly: ["run"],
      unknownStatus: [],
    });
    expect(() => resolveFigureClip("run", clips)).toThrow(
      /root-motion-only.*run/i,
    );
  });

  it("rejects required clips whose root-motion status is unknown", () => {
    const clips = [
      inPlaceClip("Idle"),
      { name: "Walk", rootMotionStatus: "unknown" },
      inPlaceClip("Run"),
    ] as const;

    expect(validateFigureClips(clips)).toEqual({
      valid: false,
      missing: [],
      rootMotionOnly: [],
      unknownStatus: ["walk"],
    });
    expect(() => resolveFigureClip("walk", clips)).toThrow(
      /unknown root-motion status.*walk/i,
    );
  });

  it("rejects bare clip names without inspection metadata", () => {
    const clips = ["Idle", "Walk", "Run"];

    // @ts-expect-error Bare strings intentionally violate the inspected candidate contract.
    expect(validateFigureClips(clips)).toEqual({
      valid: false,
      missing: [],
      rootMotionOnly: [],
      unknownStatus: ["idle", "walk", "run"],
    });
  });

  it("suppresses only nonessential motion when reduced motion is active", () => {
    expect(shouldAnimateFigureMotion("idle", true)).toBe(false);
    expect(shouldAnimateFigureMotion("talk", true)).toBe(false);
    expect(shouldAnimateFigureMotion("interact", true)).toBe(false);
    expect(shouldAnimateFigureMotion("walk", true)).toBe(true);
    expect(shouldAnimateFigureMotion("run", true)).toBe(true);
    expect(shouldAnimateFigureMotion("idle", false)).toBe(true);
  });
});

describe("PeriodFigure reduced motion", () => {
  it.each(["idle", "talk", "interact"] as const)(
    "neutralizes stale %s transforms without evaluating time",
    (motion) => {
      const { callback, groups } = capturePeriodFigureFrame(motion, true, 0.5);
      let elapsedTimeReads = 0;

      callback({
        clock: {
          get elapsedTime() {
            elapsedTimeReads += 1;
            return 1.25;
          },
        },
      });

      expect(elapsedTimeReads).toBe(0);
      expect(groups.root.position.y).toBe(0);
      expect(groups.root.rotation.z).toBe(0);
      expect(groups.leftArm.rotation.x).toBe(0);
      expect(groups.rightArm.rotation.x).toBe(0);
      expect(groups.rightArm.rotation.z).toBe(0);
      expect(groups.leftLeg.rotation.x).toBe(0);
      expect(groups.rightLeg.rotation.x).toBe(0);
    },
  );

  it("keeps reduced-motion locomotion while suppressing root bob", () => {
    const { callback, groups } = capturePeriodFigureFrame("walk", true);

    callback({ clock: { elapsedTime: 0.25 } });

    expect(groups.leftLeg.rotation.x).not.toBe(0);
    expect(groups.rightLeg.rotation.x).not.toBe(0);
    expect(groups.leftArm.rotation.x).not.toBe(0);
    expect(groups.rightArm.rotation.x).not.toBe(0);
    expect(groups.root.position.y).toBe(0);
    expect(groups.root.rotation.z).toBe(0);
  });
});
