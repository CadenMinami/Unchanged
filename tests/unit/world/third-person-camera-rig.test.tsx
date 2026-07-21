import { act, render } from "@testing-library/react";
import RAPIER from "@dimforge/rapier3d-compat";
import type {
  Collider as RapierCollider,
  RigidBody as RapierRigidBody,
  World as RapierWorld,
} from "@dimforge/rapier3d-compat";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RefObject } from "react";
import { PerspectiveCamera, Vector3 } from "three";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  CameraInputChannel,
  CameraInputSnapshot,
} from "@/components/world/camera/camera-input-boundary";
import {
  applyThirdPersonCameraInput,
  calculateCameraDampingAlpha,
  composeThirdPersonCamera,
  createThirdPersonCameraState,
  getCameraDampingSeconds,
  isWheelZoomEligible,
  ThirdPersonCameraRig,
} from "@/components/world/camera/third-person-camera-rig";
import { CAMERA_CONFIG } from "@/lib/world/camera-config";
import type { CameraPreferences } from "@/lib/world/camera-preferences";
import type { EcctrlHandle } from "ecctrl";

const frameHarness = vi.hoisted(() => ({
  callback: null as
    | ((state: {
        camera: PerspectiveCamera;
        frameloop: "always" | "demand" | "never";
        invalidate: () => void;
      }, deltaSeconds: number) => void)
    | null,
  invalidate: vi.fn(),
}));

const rapierHarness = vi.hoisted(() => ({
  rapier: null as typeof RAPIER | null,
  world: null as RapierWorld | null,
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: (
    callback: NonNullable<typeof frameHarness.callback>,
  ) => {
    frameHarness.callback = callback;
  },
  useThree: (
    selector: (state: { invalidate: () => void }) => unknown,
  ) => selector({ invalidate: frameHarness.invalidate }),
}));

vi.mock("@react-three/rapier", () => ({
  useRapier: () => {
    if (!rapierHarness.rapier || !rapierHarness.world) {
      throw new Error("Rapier test harness was used before initialization.");
    }
    return rapierHarness;
  },
}));

const ACTIVE_SNAPSHOT: CameraInputSnapshot = Object.freeze({
  pointerLockSupported: true,
  pointerLockActive: true,
  fallbackDragActive: false,
  releasePending: false,
  captureDenied: false,
});

const DEFAULT_PREFERENCES: CameraPreferences = Object.freeze({
  sensitivity: 1,
  invertY: false,
  pointerLockIntroduced: true,
});

function applyInput(
  state = createThirdPersonCameraState(),
  overrides: Partial<Parameters<typeof applyThirdPersonCameraInput>[1]> = {},
) {
  return applyThirdPersonCameraInput(state, {
    inputEnabled: true,
    lookDelta: { x: 0, y: 0 },
    preferences: DEFAULT_PREFERENCES,
    snapshot: ACTIVE_SNAPSHOT,
    wheelDelta: 0,
    ...overrides,
  });
}

function createControllerRef(
  position: Vector3,
): RefObject<EcctrlHandle | null> {
  return {
    current: {
      body: {
        translation: () => position,
      },
      currPos: position,
    } as unknown as EcctrlHandle,
  };
}

function createRapierControllerRef(
  position: Vector3,
  body: RapierRigidBody,
): RefObject<EcctrlHandle | null> {
  return {
    current: {
      body,
      currPos: position,
    } as unknown as EcctrlHandle,
  };
}

function createCameraInputChannel(
  firstLookDelta = { x: 0, y: 0 },
): CameraInputChannel {
  let pendingLookDelta = firstLookDelta;
  return {
    consumeLookDelta: () => {
      const next = pendingLookDelta;
      pendingLookDelta = { x: 0, y: 0 };
      return next;
    },
    consumeWheelDelta: () => 0,
    getSnapshot: () => ACTIVE_SNAPSHOT,
    subscribe: () => () => {},
  };
}

interface RapierCameraScene {
  evidenceTableCollider: RapierCollider | null;
  playerBody: RapierRigidBody;
  wallDistance: number;
  world: RapierWorld;
}

function createRapierCameraScene({
  evidenceTable = false,
  playerOnPath = false,
  sensor = false,
  wall = true,
}: {
  evidenceTable?: boolean;
  playerOnPath?: boolean;
  sensor?: boolean;
  wall?: boolean;
} = {}): RapierCameraScene {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const playerPosition = playerOnPath
    ? { x: 0.45, y: 1.35, z: 0.45 }
    : { x: 10, y: 0, z: 0 };
  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(
      playerPosition.x,
      playerPosition.y,
      playerPosition.z,
    ),
  );
  world.createCollider(RAPIER.ColliderDesc.ball(0.3), playerBody);

  if (sensor) {
    const sensorBody = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(0.45, 1.35, 0.95),
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(1, 1, 0.1).setSensor(true),
      sensorBody,
    );
  }

  const fixedWorldBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const evidenceTableCollider = evidenceTable
    ? world.createCollider(
        RAPIER.ColliderDesc.cuboid(1, 1, 0.1).setTranslation(
          0.45,
          1.35,
          1.55,
        ),
        fixedWorldBody,
      )
    : null;
  if (wall) {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(2, 2, 0.1).setTranslation(
        0.45,
        1.35,
        2.75,
      ),
      fixedWorldBody,
    );
  }
  world.step();

  return {
    evidenceTableCollider,
    playerBody,
    wallDistance:
      3 -
      0.1 -
      CAMERA_CONFIG.collision.probeRadius -
      CAMERA_CONFIG.collision.padding,
    world,
  };
}

function renderRapierCollisionFrame(
  scene: RapierCameraScene,
): { camera: PerspectiveCamera; target: Vector3 } {
  rapierHarness.world = scene.world;
  const playerPosition = new Vector3(0, 0, 0);
  const camera = new PerspectiveCamera();
  const levelPitchLookDelta = {
    x:
      -CAMERA_CONFIG.yaw.default / CAMERA_CONFIG.yaw.radiansPerPixel,
    y: CAMERA_CONFIG.pitch.default / CAMERA_CONFIG.pitch.radiansPerPixel,
  };
  const target = composeThirdPersonCamera(playerPosition, {
    ...createThirdPersonCameraState(),
    pitch: 0,
    yaw: 0,
  }).target;
  const evidenceTableColliderRef: RefObject<RapierCollider | null> = {
    current: scene.evidenceTableCollider,
  };

  render(
    <ThirdPersonCameraRig
      cameraInputChannel={createCameraInputChannel(levelPitchLookDelta)}
      cameraNonBlockingColliderRef={evidenceTableColliderRef}
      controllerRef={createRapierControllerRef(
        playerPosition,
        scene.playerBody,
      )}
      inputEnabled
      preferences={DEFAULT_PREFERENCES}
    />,
  );
  runFrame(camera, vi.fn());

  return { camera, target: new Vector3(target.x, target.y, target.z) };
}

let emptyRapierWorld: RapierWorld;

beforeAll(async () => {
  const originalWarn = console.warn;
  const warn = vi.spyOn(console, "warn").mockImplementation((message) => {
    if (
      message !==
      "using deprecated parameters for the initialization function; pass a single object instead"
    ) {
      originalWarn(message);
    }
  });
  try {
    await RAPIER.init();
  } finally {
    warn.mockRestore();
  }
  emptyRapierWorld = new RAPIER.World({ x: 0, y: 0, z: 0 });
  rapierHarness.rapier = RAPIER;
  rapierHarness.world = emptyRapierWorld;
});

function runFrame(
  camera: PerspectiveCamera,
  invalidate: () => void,
  deltaSeconds = 1 / 60,
  frameloop: "always" | "demand" | "never" = "demand",
): void {
  expect(frameHarness.callback).not.toBeNull();
  frameHarness.callback?.({ camera, frameloop, invalidate }, deltaSeconds);
}

afterEach(() => {
  frameHarness.callback = null;
  frameHarness.invalidate.mockReset();
  rapierHarness.world = emptyRapierWorld;
});

afterAll(() => {
  emptyRapierWorld.free();
});

describe("third-person orbit input", () => {
  it("accumulates yaw without wrapping it", () => {
    const first = applyInput(undefined, { lookDelta: { x: 800, y: 0 } });
    const second = applyInput(first, { lookDelta: { x: 800, y: 0 } });

    expect(first.yaw).toBe(
      CAMERA_CONFIG.yaw.default + 800 * CAMERA_CONFIG.yaw.radiansPerPixel,
    );
    expect(second.yaw).toBe(
      CAMERA_CONFIG.yaw.default + 1_600 * CAMERA_CONFIG.yaw.radiansPerPixel,
    );

    const manyTurns = applyInput(second, {
      lookDelta: { x: 10_000, y: 0 },
    });
    expect(manyTurns.yaw).toBeGreaterThan(Math.PI * 2);
  });

  it("applies the validated sensitivity to both look axes", () => {
    const normal = applyInput(undefined, {
      lookDelta: { x: 40, y: 40 },
    });
    const sensitive = applyInput(undefined, {
      lookDelta: { x: 40, y: 40 },
      preferences: { ...DEFAULT_PREFERENCES, sensitivity: 2 },
    });

    expect(sensitive.yaw - CAMERA_CONFIG.yaw.default).toBeCloseTo(
      2 * (normal.yaw - CAMERA_CONFIG.yaw.default),
    );
    expect(sensitive.pitch - CAMERA_CONFIG.pitch.default).toBeCloseTo(
      2 * (normal.pitch - CAMERA_CONFIG.pitch.default),
    );
  });

  it("reverses only vertical look when invert Y is enabled", () => {
    const standard = applyInput(undefined, {
      lookDelta: { x: 25, y: 25 },
    });
    const inverted = applyInput(undefined, {
      lookDelta: { x: 25, y: 25 },
      preferences: { ...DEFAULT_PREFERENCES, invertY: true },
    });

    expect(standard.yaw).toBe(inverted.yaw);
    expect(standard.pitch).toBeLessThan(CAMERA_CONFIG.pitch.default);
    expect(inverted.pitch).toBeGreaterThan(CAMERA_CONFIG.pitch.default);
    expect(
      standard.pitch + inverted.pitch,
    ).toBeCloseTo(2 * CAMERA_CONFIG.pitch.default);
  });

  it("clamps pitch and distance under extreme deltas", () => {
    expect(
      applyInput(undefined, {
        lookDelta: { x: 0, y: Number.MAX_VALUE },
      }).pitch,
    ).toBe(CAMERA_CONFIG.pitch.min);
    expect(
      applyInput(undefined, {
        lookDelta: { x: 0, y: -Number.MAX_VALUE },
      }).pitch,
    ).toBe(CAMERA_CONFIG.pitch.max);
    expect(
      applyInput(undefined, { wheelDelta: Number.MAX_VALUE }).distance,
    ).toBe(CAMERA_CONFIG.distance.max);
    expect(
      applyInput(undefined, { wheelDelta: -Number.MAX_VALUE }).distance,
    ).toBe(CAMERA_CONFIG.distance.min);
  });

  it("allows wheel zoom only for acknowledged active input", () => {
    const fallbackSnapshot = {
      ...ACTIVE_SNAPSHOT,
      fallbackDragActive: true,
      pointerLockActive: false,
    };
    const idleSnapshot = {
      ...ACTIVE_SNAPSHOT,
      pointerLockActive: false,
    };

    expect(isWheelZoomEligible(ACTIVE_SNAPSHOT, true)).toBe(true);
    expect(isWheelZoomEligible(fallbackSnapshot, true)).toBe(true);
    expect(isWheelZoomEligible(idleSnapshot, true)).toBe(false);
    expect(isWheelZoomEligible(ACTIVE_SNAPSHOT, false)).toBe(false);
    expect(
      isWheelZoomEligible(
        { ...ACTIVE_SNAPSHOT, releasePending: true },
        true,
      ),
    ).toBe(false);

    expect(
      applyInput(undefined, {
        inputEnabled: false,
        wheelDelta: 200,
      }).distance,
    ).toBe(CAMERA_CONFIG.distance.default);
    expect(
      applyInput(undefined, {
        snapshot: fallbackSnapshot,
        wheelDelta: 200,
      }).distance,
    ).toBeGreaterThan(CAMERA_CONFIG.distance.default);
  });
});

describe("third-person composition and damping", () => {
  it("builds a stable shoulder-height target with look-ahead", () => {
    const player = { x: 10, y: 2, z: -3 };
    const state = {
      yaw: 0,
      pitch: 0,
      distance: CAMERA_CONFIG.distance.default,
    };

    const first = composeThirdPersonCamera(player, state);
    const second = composeThirdPersonCamera(player, state);

    expect(second).toEqual(first);
    expect(first.target).toEqual({
      x: player.x + CAMERA_CONFIG.target.shoulderOffset,
      y: player.y + CAMERA_CONFIG.target.height,
      z: player.z - CAMERA_CONFIG.target.lookAhead,
    });
    expect(first.position.x).toBeCloseTo(first.target.x);
    expect(first.position.y).toBeCloseTo(first.target.y);
    expect(first.position.z).toBeCloseTo(
      first.target.z + CAMERA_CONFIG.distance.default,
    );
  });

  it("uses time-based standard damping and immediate reduced-motion updates", () => {
    const standardSeconds = getCameraDampingSeconds(false);
    const reducedSeconds = getCameraDampingSeconds(true);
    const fullStep = calculateCameraDampingAlpha(1 / 30, standardSeconds);
    const halfStep = calculateCameraDampingAlpha(1 / 60, standardSeconds);

    expect(standardSeconds).toBe(CAMERA_CONFIG.damping.standardSeconds);
    expect(reducedSeconds).toBe(CAMERA_CONFIG.damping.reducedMotionSeconds);
    expect(fullStep).toBeGreaterThan(0);
    expect(fullStep).toBeLessThan(1);
    expect(calculateCameraDampingAlpha(1 / 60, reducedSeconds)).toBe(1);
    expect(1 - (1 - halfStep) ** 2).toBeCloseTo(fullStep, 12);
    expect(calculateCameraDampingAlpha(0, standardSeconds)).toBe(0);
  });
});

describe("ThirdPersonCameraRig frame behavior", () => {
  it("excludes the player body from the Rapier camera cast", () => {
    const scene = createRapierCameraScene({ playerOnPath: true });
    try {
      const { camera, target } = renderRapierCollisionFrame(scene);

      expect(camera.position.distanceTo(target)).toBeCloseTo(
        scene.wallDistance,
        3,
      );
    } finally {
      scene.world.free();
    }
  });

  it("excludes sensor colliders from the Rapier camera cast", () => {
    const scene = createRapierCameraScene({ sensor: true });
    try {
      const { camera, target } = renderRapierCollisionFrame(scene);

      expect(camera.position.distanceTo(target)).toBeCloseTo(
        scene.wallDistance,
        3,
      );
    } finally {
      scene.world.free();
    }
  });

  it("excludes only the evidence table while retaining its fixed wall body", () => {
    const scene = createRapierCameraScene({ evidenceTable: true });
    try {
      const { camera, target } = renderRapierCollisionFrame(scene);

      expect(camera.position.distanceTo(target)).toBeCloseTo(
        scene.wallDistance,
        3,
      );
    } finally {
      scene.world.free();
    }
  });

  it("pulls inward to the fixed wall time of impact on the first frame", () => {
    const scene = createRapierCameraScene();
    try {
      const { camera, target } = renderRapierCollisionFrame(scene);

      expect(camera.position.distanceTo(target)).toBeCloseTo(
        scene.wallDistance,
        3,
      );
    } finally {
      scene.world.free();
    }
  });

  it("returns the requested distance after a clear Rapier cast", () => {
    const scene = createRapierCameraScene({ wall: false });
    const castShape = vi.spyOn(scene.world, "castShape");
    try {
      const { camera, target } = renderRapierCollisionFrame(scene);

      expect(castShape).toHaveBeenCalledTimes(1);
      expect(camera.position.distanceTo(target)).toBeCloseTo(
        CAMERA_CONFIG.distance.default,
        5,
      );
    } finally {
      scene.world.free();
    }
  });

  it("wakes an idle demand loop on channel input and cleans up its subscription", () => {
    const listeners = new Set<() => void>();
    const subscribe = vi.fn<CameraInputChannel["subscribe"]>((listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    });
    const consumeLookDelta = vi.fn(() => ({ x: 0, y: 0 }));
    const channel: CameraInputChannel = {
      consumeLookDelta,
      consumeWheelDelta: () => 0,
      getSnapshot: () => ({
        ...ACTIVE_SNAPSHOT,
        pointerLockActive: false,
      }),
      subscribe,
    };
    const controllerRef = createControllerRef(new Vector3(0, 0, 0));
    const view = render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
      />,
    );

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);
    expect(consumeLookDelta).not.toHaveBeenCalled();

    act(() => listeners.forEach((listener) => listener()));

    expect(frameHarness.invalidate).toHaveBeenCalledTimes(1);
    expect(consumeLookDelta).not.toHaveBeenCalled();

    view.rerender(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
      />,
    );
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(listeners.size).toBe(1);

    view.unmount();
    expect(listeners.size).toBe(0);

    act(() => listeners.forEach((listener) => listener()));
    expect(frameHarness.invalidate).toHaveBeenCalledTimes(1);
  });

  it("consumes each delta once per frame without publishing snapshots", () => {
    const consumeLookDelta = vi
      .fn<CameraInputChannel["consumeLookDelta"]>()
      .mockReturnValueOnce({ x: 40, y: 0 })
      .mockReturnValue({ x: 0, y: 0 });
    const consumeWheelDelta = vi
      .fn<CameraInputChannel["consumeWheelDelta"]>()
      .mockReturnValueOnce(100)
      .mockReturnValue(0);
    const subscribe = vi.fn<CameraInputChannel["subscribe"]>(() => () => {});
    const getSnapshot = vi.fn(() => ACTIVE_SNAPSHOT);
    const channel: CameraInputChannel = {
      consumeLookDelta,
      consumeWheelDelta,
      getSnapshot,
      subscribe,
    };
    const camera = new PerspectiveCamera();
    const invalidate = vi.fn();
    const controllerRef = createControllerRef(new Vector3(0, 0, 0));

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
      />,
    );

    runFrame(camera, invalidate);

    expect(consumeLookDelta).toHaveBeenCalledTimes(1);
    expect(consumeWheelDelta).toHaveBeenCalledTimes(1);
    expect(getSnapshot).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(camera.position.toArray().every(Number.isFinite)).toBe(true);

    invalidate.mockClear();
    runFrame(camera, invalidate);

    expect(consumeLookDelta).toHaveBeenCalledTimes(2);
    expect(consumeWheelDelta).toHaveBeenCalledTimes(2);
    expect(getSnapshot).toHaveBeenCalledTimes(2);
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(invalidate).not.toHaveBeenCalled();
  });

  it("applies direct orbit input without shoulder-composition lag", () => {
    let lookDelta = { x: 0, y: 0 };
    const channel: CameraInputChannel = {
      consumeLookDelta: () => {
        const next = lookDelta;
        lookDelta = { x: 0, y: 0 };
        return next;
      },
      consumeWheelDelta: () => 0,
      getSnapshot: () => ACTIVE_SNAPSHOT,
      subscribe: () => () => {},
    };
    const playerPosition = new Vector3(2, 0, -1);
    const camera = new PerspectiveCamera();
    const invalidate = vi.fn();

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={createControllerRef(playerPosition)}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
      />,
    );

    runFrame(camera, invalidate);
    lookDelta = { x: 160, y: 0 };
    runFrame(camera, invalidate);

    const expected = composeThirdPersonCamera(playerPosition, {
      ...createThirdPersonCameraState(),
      yaw:
        CAMERA_CONFIG.yaw.default +
        160 * CAMERA_CONFIG.yaw.radiansPerPixel,
    });
    expect(camera.position.x).toBeCloseTo(expected.position.x, 8);
    expect(camera.position.y).toBeCloseTo(expected.position.y, 8);
    expect(camera.position.z).toBeCloseTo(expected.position.z, 8);
  });

  it("applies inward collision distance immediately and damps only recovery", () => {
    const channel: CameraInputChannel = {
      consumeLookDelta: () => ({ x: 0, y: 0 }),
      consumeWheelDelta: () => 0,
      getSnapshot: () => ACTIVE_SNAPSHOT,
      subscribe: () => () => {},
    };
    const playerPosition = new Vector3(0, 0, 0);
    const controllerRef = createControllerRef(playerPosition);
    const camera = new PerspectiveCamera();
    const invalidate = vi.fn();
    let safeDistance: number = CAMERA_CONFIG.distance.default;

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
        resolveCollisionDistance={() => safeDistance}
      />,
    );

    const target = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    ).target;
    const targetVector = new Vector3(target.x, target.y, target.z);

    runFrame(camera, invalidate);
    expect(camera.position.distanceTo(targetVector)).toBeCloseTo(
      CAMERA_CONFIG.distance.default,
    );

    safeDistance = 2;
    runFrame(camera, invalidate);
    expect(camera.position.distanceTo(targetVector)).toBeCloseTo(safeDistance);

    safeDistance = CAMERA_CONFIG.distance.default;
    runFrame(camera, invalidate);
    const recoveringDistance = camera.position.distanceTo(targetVector);
    expect(recoveringDistance).toBeGreaterThan(2);
    expect(recoveringDistance).toBeLessThan(CAMERA_CONFIG.distance.default);

    let previousRecoveryDistance = recoveringDistance;
    let recoveryStopped = false;
    for (let frame = 0; frame < 240; frame += 1) {
      invalidate.mockClear();
      runFrame(camera, invalidate);
      const nextRecoveryDistance = camera.position.distanceTo(targetVector);
      expect(nextRecoveryDistance).toBeGreaterThanOrEqual(
        previousRecoveryDistance,
      );
      expect(nextRecoveryDistance).toBeLessThanOrEqual(
        CAMERA_CONFIG.distance.default,
      );
      previousRecoveryDistance = nextRecoveryDistance;
      if (invalidate.mock.calls.length === 0) {
        recoveryStopped = true;
        break;
      }
    }

    expect(recoveryStopped).toBe(true);
    expect(camera.position.distanceTo(targetVector)).toBeCloseTo(
      CAMERA_CONFIG.distance.default,
      12,
    );

    const settledX = camera.position.x;
    playerPosition.x = 6;
    invalidate.mockClear();
    runFrame(camera, invalidate);

    const movedTarget = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    );
    expect(camera.position.x).toBeGreaterThan(settledX);
    expect(camera.position.x).toBeLessThan(movedTarget.position.x);
    expect(invalidate).toHaveBeenCalledTimes(1);
  });

  it("recovers collision distance immediately for reduced motion", () => {
    const playerPosition = new Vector3(0, 0, 0);
    const camera = new PerspectiveCamera();
    const target = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    ).target;
    const targetVector = new Vector3(target.x, target.y, target.z);
    let safeDistance = 2;

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={createCameraInputChannel()}
        controllerRef={createControllerRef(playerPosition)}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
        reducedMotion
        resolveCollisionDistance={() => safeDistance}
      />,
    );

    runFrame(camera, vi.fn());
    expect(camera.position.distanceTo(targetVector)).toBeCloseTo(2);

    safeDistance = CAMERA_CONFIG.distance.default;
    runFrame(camera, vi.fn());
    expect(camera.position.distanceTo(targetVector)).toBeCloseTo(
      CAMERA_CONFIG.distance.default,
    );
  });

  it("does not spend idle demand-loop time on standard collision recovery", () => {
    const playerPosition = new Vector3(0, 0, 0);
    const camera = new PerspectiveCamera();
    const target = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    ).target;
    const targetVector = new Vector3(target.x, target.y, target.z);
    let safeDistance = 2;

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={createCameraInputChannel()}
        controllerRef={createControllerRef(playerPosition)}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
        resolveCollisionDistance={() => safeDistance}
      />,
    );

    runFrame(camera, vi.fn());
    safeDistance = CAMERA_CONFIG.distance.default;
    runFrame(camera, vi.fn(), 1);

    const firstRecoveryDistance = camera.position.distanceTo(targetVector);
    expect(firstRecoveryDistance).toBeGreaterThan(2);
    expect(firstRecoveryDistance).toBeLessThan(3);
  });

  it("isolates composed vectors from resolver snapshot mutation", () => {
    const channel: CameraInputChannel = {
      consumeLookDelta: () => ({ x: 0, y: 0 }),
      consumeWheelDelta: () => 0,
      getSnapshot: () => ACTIVE_SNAPSHOT,
      subscribe: () => () => {},
    };
    const playerPosition = new Vector3(3, 1, -2);
    const controllerRef = createControllerRef(playerPosition);
    const camera = new PerspectiveCamera();
    const invalidate = vi.fn();
    const expected = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    );

    render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
        resolveCollisionDistance={(
          requestedDistance,
          targetSnapshot,
          positionSnapshot,
        ) => {
          expect("set" in targetSnapshot).toBe(false);
          expect("lerp" in positionSnapshot).toBe(false);
          (targetSnapshot as { x: number }).x = 999;
          (positionSnapshot as { z: number }).z = -999;
          return requestedDistance;
        }}
      />,
    );

    runFrame(camera, invalidate);

    expect(camera.position.x).toBeCloseTo(expected.position.x);
    expect(camera.position.y).toBeCloseTo(expected.position.y);
    expect(camera.position.z).toBeCloseTo(expected.position.z);
  });

  it("switches from standard follow damping to immediate reduced motion", () => {
    const channel: CameraInputChannel = {
      consumeLookDelta: () => ({ x: 0, y: 0 }),
      consumeWheelDelta: () => 0,
      getSnapshot: () => ACTIVE_SNAPSHOT,
      subscribe: () => () => {},
    };
    const playerPosition = new Vector3(0, 0, 0);
    const controllerRef = createControllerRef(playerPosition);
    const camera = new PerspectiveCamera();
    const invalidate = vi.fn();
    const view = render(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
      />,
    );

    runFrame(camera, invalidate);
    const beforeFollowX = camera.position.x;
    playerPosition.x = 6;
    runFrame(camera, invalidate);

    const desired = composeThirdPersonCamera(
      playerPosition,
      createThirdPersonCameraState(),
    );
    expect(camera.position.x).toBeGreaterThan(beforeFollowX);
    expect(camera.position.x).toBeLessThan(desired.position.x);

    view.rerender(
      <ThirdPersonCameraRig
        cameraInputChannel={channel}
        controllerRef={controllerRef}
        inputEnabled
        preferences={DEFAULT_PREFERENCES}
        reducedMotion
      />,
    );
    runFrame(camera, invalidate);

    expect(camera.position.x).toBeCloseTo(desired.position.x);
    expect(camera.position.y).toBeCloseTo(desired.position.y);
    expect(camera.position.z).toBeCloseTo(desired.position.z);
  });

  it("does not own browser pointer-lock lifecycle APIs", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/camera/third-person-camera-rig.tsx",
      ),
      "utf8",
    );

    expect(source).not.toMatch(/\.requestPointerLock\s*\(/);
    expect(source).not.toMatch(/document\.exitPointerLock/);
    expect(source).not.toMatch(/document\.pointerLockElement/);
    expect(source).not.toMatch(/["']pointerlock(?:change|error)["']/);
    expect(source).not.toMatch(/useState|useSyncExternalStore/);
  });
});
