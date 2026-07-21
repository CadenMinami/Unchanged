import { expect, test, type Locator, type Page } from "@playwright/test";

import { CAMERA_CONFIG } from "../../lib/world/camera-config";

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(90_000);
test.describe.configure({ mode: "serial" });

const YAW_NINETY_DEGREES = Math.PI / 2;
const STEADY_STATE_WARMUP_SECONDS = 0.8;
const MOVEMENT_SAMPLE_SECONDS = 0.7;
const CAMERA_ANGLE_TOLERANCE = 0.01;
const PLAYER_STOP_TOLERANCE = 0.04;

type PlayerPosition = [number, number, number];
type LifecycleVisibility = "hidden" | "visible";

interface MovementSample {
  baseline: PlayerPosition;
  distance: number;
  deltaX: number;
  deltaZ: number;
  initial: PlayerPosition;
  inputDirection: PlayerPosition;
  moveSpeed: number;
}

interface CameraTelemetry {
  appliedCollisionDistance: number;
  cameraTarget: PlayerPosition;
  sampleId: number;
  elapsedTime: number;
  yaw: number;
  pitch: number;
  distance: number;
  requestedDistance: number;
  collisionConstrained: boolean;
  playerPosition: PlayerPosition;
  inputDirection: PlayerPosition;
  moveSpeed: number;
  cameraPosition: PlayerPosition;
  cameraYaw: number;
  cameraPitch: number;
}

interface PointerLockHarnessSnapshot {
  autoAcknowledgeRelease: boolean;
  exitRequests: number;
  focused: boolean;
  lockRequests: number;
  locked: boolean;
  releaseRequested: boolean;
  visibilityState: LifecycleVisibility;
}

interface BrowserPointerLockHarness {
  acknowledgeRelease(): void;
  setAutoAcknowledgeRelease(enabled: boolean): void;
  setLifecycleState(state: {
    focused: boolean;
    visibilityState: LifecycleVisibility;
  }): void;
  snapshot(): PointerLockHarnessSnapshot;
}

type PointerLockHarnessWindow = Window & {
  __historyUnbrokenPointerLockHarness: BrowserPointerLockHarness;
};

async function installUnsupportedPointerLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "requestPointerLock", {
      configurable: true,
      value: undefined,
    });
  });
}

async function installDeterministicPointerLockHarness(
  page: Page,
  options: { autoAcknowledgeRelease?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ autoAcknowledgeRelease: initialAutoAcknowledgeRelease }) => {
      let pointerLockElement: Element | null = null;
      let autoAcknowledgeRelease = initialAutoAcknowledgeRelease;
      let exitRequests = 0;
      let focused = true;
      let lockRequests = 0;
      let releaseRequested = false;
      let visibilityState: LifecycleVisibility = "visible";

      const dispatchPointerLockChange = () => {
        document.dispatchEvent(new Event("pointerlockchange"));
      };
      const acknowledgeRelease = () => {
        if (pointerLockElement === null && !releaseRequested) return;
        pointerLockElement = null;
        releaseRequested = false;
        dispatchPointerLockChange();
      };
      const acknowledgeCapture = (canvas: HTMLCanvasElement) => {
        lockRequests += 1;
        pointerLockElement = canvas;
        releaseRequested = false;
        dispatchPointerLockChange();
        return Promise.resolve();
      };
      const harness: BrowserPointerLockHarness = {
        acknowledgeRelease,
        setAutoAcknowledgeRelease(enabled) {
          autoAcknowledgeRelease = enabled;
        },
        setLifecycleState(nextState) {
          const focusChanged = focused !== nextState.focused;
          const visibilityChanged =
            visibilityState !== nextState.visibilityState;
          focused = nextState.focused;
          visibilityState = nextState.visibilityState;
          if (visibilityChanged) {
            document.dispatchEvent(new Event("visibilitychange"));
          }
          if (focusChanged) {
            window.dispatchEvent(new Event(focused ? "focus" : "blur"));
          }
        },
        snapshot() {
          return {
            autoAcknowledgeRelease,
            exitRequests,
            focused,
            lockRequests,
            locked: pointerLockElement !== null,
            releaseRequested,
            visibilityState,
          };
        },
      };

      Object.defineProperty(document, "pointerLockElement", {
        configurable: true,
        get: () => pointerLockElement,
      });
      Object.defineProperty(document, "exitPointerLock", {
        configurable: true,
        value: () => {
          exitRequests += 1;
          if (pointerLockElement === null) return;
          releaseRequested = true;
          if (autoAcknowledgeRelease) queueMicrotask(acknowledgeRelease);
        },
      });
      Object.defineProperty(document, "hasFocus", {
        configurable: true,
        value: () => focused,
      });
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => visibilityState === "hidden",
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => visibilityState,
      });
      Object.defineProperty(HTMLCanvasElement.prototype, "requestPointerLock", {
        configurable: true,
        value: function requestPointerLock(this: HTMLCanvasElement) {
          return acknowledgeCapture(this);
        },
      });
      Object.defineProperty(window, "__historyUnbrokenPointerLockHarness", {
        configurable: true,
        value: harness,
      });
    },
    { autoAcknowledgeRelease: options.autoAcknowledgeRelease ?? false },
  );
}

async function readPointerLockHarness(
  page: Page,
): Promise<PointerLockHarnessSnapshot> {
  return page.evaluate(() =>
    (
      window as unknown as PointerLockHarnessWindow
    ).__historyUnbrokenPointerLockHarness.snapshot(),
  );
}

async function acknowledgePointerLockRelease(page: Page): Promise<void> {
  await page.evaluate(() => {
    (
      window as unknown as PointerLockHarnessWindow
    ).__historyUnbrokenPointerLockHarness.acknowledgeRelease();
  });
}

async function setHarnessLifecycleState(
  page: Page,
  state: { focused: boolean; visibilityState: LifecycleVisibility },
): Promise<void> {
  await page.evaluate((nextState) => {
    (
      window as unknown as PointerLockHarnessWindow
    ).__historyUnbrokenPointerLockHarness.setLifecycleState(nextState);
  }, state);
}

async function dispatchLockedMouseMove(
  page: Page,
  movementX: number,
  movementY: number,
): Promise<void> {
  await page.evaluate(
    ({ x, y }) => {
      const event = new MouseEvent("mousemove", { bubbles: true });
      Object.defineProperties(event, {
        movementX: { value: x },
        movementY: { value: y },
      });
      document.dispatchEvent(event);
    },
    { x: movementX, y: movementY },
  );
}

async function openTelemetryWorld(page: Page): Promise<{
  canvas: Locator;
  telemetry: Locator;
}>;
async function openTelemetryWorld(
  page: Page,
  pointerLockMode: "preinstalled_harness",
): Promise<{ canvas: Locator; telemetry: Locator }>;
async function openTelemetryWorld(
  page: Page,
  pointerLockMode: "preinstalled_harness" | "unsupported" = "unsupported",
): Promise<{ canvas: Locator; telemetry: Locator }> {
  if (pointerLockMode === "unsupported") {
    await installUnsupportedPointerLock(page);
  }
  await page.goto("/play/world");
  const status = page.getByRole("status");
  await expect(status).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  if (pointerLockMode === "unsupported") {
    await expect(status).toContainText(
      /right-drag to look.*keyboard remains available/i,
    );
  }

  const canvas = page.getByTestId("world-canvas").locator("canvas");
  const telemetry = page.getByTestId("world-player-position");
  await expect(canvas).toBeVisible();
  await expect(telemetry).toHaveAttribute("data-position", /^\[-?\d/, {
    timeout: 10_000,
  });
  return { canvas, telemetry };
}

async function readPlayerPosition(telemetry: Locator): Promise<PlayerPosition> {
  const serialized = await telemetry.getAttribute("data-position");
  const position = JSON.parse(serialized ?? "null") as unknown;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((coordinate) => Number.isFinite(coordinate))
  ) {
    throw new Error(`Invalid player position telemetry: ${serialized ?? "missing"}`);
  }
  return position as PlayerPosition;
}

function horizontalDistance(
  first: PlayerPosition,
  second: PlayerPosition,
): number {
  return Math.hypot(second[0] - first[0], second[2] - first[2]);
}

async function expectPlayerStopped(
  page: Page,
  telemetry: Locator,
): Promise<void> {
  await page.waitForTimeout(150);
  const stoppedAt = await readPlayerPosition(telemetry);
  await page.waitForTimeout(350);
  expect(
    horizontalDistance(stoppedAt, await readPlayerPosition(telemetry)),
  ).toBeLessThan(PLAYER_STOP_TOLERANCE);
}

async function capturePointerLock(
  page: Page,
  canvas: Locator,
): Promise<void> {
  await canvas.click({ position: { x: 600, y: 350 } });
  await expect(
    page.getByRole("button", { name: /open camera settings/i }),
  ).toHaveAttribute("data-pointer-lock-active", "true");
  await expect(page.getByRole("status")).toContainText(
    /camera captured.*escape to release/i,
  );
  await expect.poll(async () => (await readPointerLockHarness(page)).locked).toBe(
    true,
  );
}

async function readInspectedEvidenceIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem(
      "history-unbroken:varennes:state",
    );
    const saved = JSON.parse(raw ?? "null") as {
      state?: { inspectedItemIds?: unknown };
    } | null;
    return Array.isArray(saved?.state?.inspectedItemIds)
      ? (saved.state.inspectedItemIds as string[])
      : [];
  });
}

async function installReducedMotionLearningSession(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      "history-unbroken:varennes:learning-session",
      JSON.stringify({
        persistenceVersion: "1.0.0",
        savedAt: "2026-07-19T12:00:00.000Z",
        session: {
          sessionVersion: "1.0.0",
          catalogVersion: "1.1.0",
          caseId: "varennes",
          caseVersion: "1.0.3",
          preferences: {
            readingMode: "standard",
            motionMode: "reduced",
            guidanceMode: "guided",
          },
          approvedAlignment: null,
          observableEvents: [],
        },
      }),
    );
  });
}

function cameraTargetTrackingError(sample: CameraTelemetry): number {
  const expectedTarget: PlayerPosition = [
    sample.playerPosition[0] +
      Math.cos(sample.yaw) * CAMERA_CONFIG.target.shoulderOffset +
      Math.sin(sample.yaw) * CAMERA_CONFIG.target.lookAhead,
    sample.playerPosition[1] + CAMERA_CONFIG.target.height,
    sample.playerPosition[2] +
      Math.sin(sample.yaw) * CAMERA_CONFIG.target.shoulderOffset -
      Math.cos(sample.yaw) * CAMERA_CONFIG.target.lookAhead,
  ];
  return Math.hypot(
    sample.cameraTarget[0] - expectedTarget[0],
    sample.cameraTarget[1] - expectedTarget[1],
    sample.cameraTarget[2] - expectedTarget[2],
  );
}

function isFinitePosition(value: unknown): value is PlayerPosition {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((coordinate) => Number.isFinite(coordinate))
  );
}

async function readCameraTelemetry(canvas: Locator): Promise<CameraTelemetry> {
  const serialized = await canvas.getAttribute("data-camera-telemetry");
  const sample = JSON.parse(serialized ?? "null") as unknown;
  if (
    typeof sample !== "object" ||
    sample === null ||
    !("appliedCollisionDistance" in sample) ||
    !("cameraTarget" in sample) ||
    !("sampleId" in sample) ||
    !("elapsedTime" in sample) ||
    !("yaw" in sample) ||
    !("pitch" in sample) ||
    !("distance" in sample) ||
    !("requestedDistance" in sample) ||
    !("collisionConstrained" in sample) ||
    !("playerPosition" in sample) ||
    !("inputDirection" in sample) ||
    !("moveSpeed" in sample) ||
    !("cameraPosition" in sample) ||
    !("cameraYaw" in sample) ||
    !("cameraPitch" in sample)
  ) {
    throw new Error(`Invalid camera telemetry: ${serialized ?? "missing"}`);
  }
  return sample as CameraTelemetry;
}

async function waitForCameraTelemetry(
  canvas: Locator,
  requirements: {
    minimumSampleId?: number;
    minimumElapsedTime?: number;
    cameraYaw?: number;
    cameraPitch?: number;
    angleTolerance?: number;
    collisionConstrained?: boolean;
    maximumAppliedCollisionDistance?: number;
    minimumAppliedCollisionDistance?: number;
    playerXAtMost?: number;
    playerZAtMost?: number;
  },
): Promise<CameraTelemetry> {
  const serialized = await canvas.evaluate(
    (element, target) =>
      new Promise<string>((resolve, reject) => {
        let timeoutId = 0;
        const read = () => {
          const raw = element.getAttribute("data-camera-telemetry");
          if (!raw) return null;
          const value = JSON.parse(raw) as CameraTelemetry;
          const sampleReady =
            target.minimumSampleId === undefined ||
            value.sampleId >= target.minimumSampleId;
          const timeReady =
            target.minimumElapsedTime === undefined ||
            value.elapsedTime >= target.minimumElapsedTime;
          const yawReady =
            target.cameraYaw === undefined ||
            Math.abs(
              Math.atan2(
                Math.sin(value.cameraYaw - target.cameraYaw),
                Math.cos(value.cameraYaw - target.cameraYaw),
              ),
            ) <=
              (target.angleTolerance ?? 0.01);
          const pitchReady =
            target.cameraPitch === undefined ||
            Math.abs(value.cameraPitch - target.cameraPitch) <=
              (target.angleTolerance ?? 0.01);
          const collisionReady =
            target.collisionConstrained === undefined ||
            value.collisionConstrained === target.collisionConstrained;
          const maximumAppliedReady =
            target.maximumAppliedCollisionDistance === undefined ||
            value.appliedCollisionDistance <=
              target.maximumAppliedCollisionDistance;
          const minimumAppliedReady =
            target.minimumAppliedCollisionDistance === undefined ||
            value.appliedCollisionDistance >=
              target.minimumAppliedCollisionDistance;
          const playerXReady =
            target.playerXAtMost === undefined ||
            value.playerPosition[0] <= target.playerXAtMost;
          const playerZReady =
            target.playerZAtMost === undefined ||
            value.playerPosition[2] <= target.playerZAtMost;
          return sampleReady &&
            timeReady &&
            yawReady &&
            pitchReady &&
            collisionReady &&
            maximumAppliedReady &&
            minimumAppliedReady &&
            playerXReady &&
            playerZReady
            ? raw
            : null;
        };
        const finish = (raw: string, observer?: MutationObserver) => {
          observer?.disconnect();
          window.clearTimeout(timeoutId);
          resolve(raw);
        };
        const current = read();
        if (current) {
          finish(current);
          return;
        }
        const observer = new MutationObserver(() => {
          const next = read();
          if (next) finish(next, observer);
        });
        observer.observe(element, {
          attributes: true,
          attributeFilter: ["data-camera-telemetry"],
        });
        timeoutId = window.setTimeout(() => {
          observer.disconnect();
          reject(
            new Error(
              `Camera telemetry did not satisfy ${JSON.stringify(target)}.`,
            ),
          );
        }, 10_000);
      }),
    requirements,
  );
  return JSON.parse(serialized) as CameraTelemetry;
}

async function rightDragLook(
  page: Page,
  canvas: Locator,
  movementX: number,
  movementY: number,
): Promise<CameraTelemetry> {
  const before = await readCameraTelemetry(canvas);
  const expectedYaw =
    before.yaw + movementX * CAMERA_CONFIG.yaw.radiansPerPixel;
  const expectedPitch = Math.min(
    CAMERA_CONFIG.pitch.max,
    Math.max(
      CAMERA_CONFIG.pitch.min,
      before.pitch - movementY * CAMERA_CONFIG.pitch.radiansPerPixel,
    ),
  );
  await canvas.dispatchEvent("pointerdown", {
    button: 2,
    buttons: 2,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  await canvas.evaluate(
    (element, movement) => {
      const event = new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 2,
        isPrimary: true,
        pointerId: 1,
        pointerType: "mouse",
      });
      Object.defineProperties(event, {
        movementX: { value: movement.x },
        movementY: { value: movement.y },
      });
      element.dispatchEvent(event);
    },
    { x: movementX, y: movementY },
  );
  await waitForCameraTelemetry(canvas, { minimumSampleId: before.sampleId + 1 });
  const settled = await waitForCameraTelemetry(canvas, {
    cameraYaw: expectedYaw,
    cameraPitch: expectedPitch,
    angleTolerance: CAMERA_ANGLE_TOLERANCE,
  });
  await canvas.dispatchEvent("pointerup", {
    button: 2,
    buttons: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  return settled;
}

async function rightDragToYaw(
  page: Page,
  canvas: Locator,
  targetYaw: number,
  targetPitch?: number,
): Promise<CameraTelemetry> {
  const before = await readCameraTelemetry(canvas);
  return rightDragLook(
    page,
    canvas,
    (targetYaw - before.yaw) / CAMERA_CONFIG.yaw.radiansPerPixel,
    targetPitch === undefined
      ? 0
      : (before.pitch - targetPitch) /
          CAMERA_CONFIG.pitch.radiansPerPixel,
  );
}

async function rightDragWheel(
  page: Page,
  canvas: Locator,
  deltaY: number,
): Promise<CameraTelemetry> {
  const before = await readCameraTelemetry(canvas);
  await canvas.dispatchEvent("pointerdown", {
    button: 2,
    buttons: 2,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  await canvas.dispatchEvent("wheel", { deltaY });
  const next = await waitForCameraTelemetry(canvas, {
    minimumSampleId: before.sampleId + 1,
  });
  await canvas.dispatchEvent("pointerup", {
    button: 2,
    buttons: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  return next;
}

async function holdKeysUntil(
  page: Page,
  canvas: Locator,
  keys: readonly string[],
  requirements: Parameters<typeof waitForCameraTelemetry>[1],
): Promise<CameraTelemetry> {
  const before = await readCameraTelemetry(canvas);
  for (const key of keys) await page.keyboard.down(key);
  try {
    return await waitForCameraTelemetry(canvas, {
      ...requirements,
      minimumSampleId: before.sampleId + 1,
    });
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

function expectFiniteCameraTelemetry(sample: CameraTelemetry): void {
  expect(
    [
      sample.sampleId,
      sample.elapsedTime,
      sample.yaw,
      sample.pitch,
      sample.distance,
      sample.requestedDistance,
      sample.appliedCollisionDistance,
      sample.moveSpeed,
      sample.cameraYaw,
      sample.cameraPitch,
    ].every(Number.isFinite),
  ).toBe(true);
  expect(isFinitePosition(sample.playerPosition)).toBe(true);
  expect(isFinitePosition(sample.cameraPosition)).toBe(true);
  expect(isFinitePosition(sample.cameraTarget)).toBe(true);
}

async function sampleMovement(
  page: Page,
  keys: readonly string[],
  pitch = CAMERA_CONFIG.pitch.default,
): Promise<MovementSample> {
  const { canvas, telemetry } = await openTelemetryWorld(page);
  const initial = await readPlayerPosition(telemetry);
  const cameraAfterLook = await rightDragToYaw(
    page,
    canvas,
    YAW_NINETY_DEGREES,
    pitch,
  );

  expect(cameraAfterLook.yaw).toBeCloseTo(YAW_NINETY_DEGREES, 4);
  expect(cameraAfterLook.pitch).toBeCloseTo(pitch, 4);
  expect(
    Math.abs(cameraAfterLook.cameraYaw - YAW_NINETY_DEGREES),
  ).toBeLessThanOrEqual(CAMERA_ANGLE_TOLERANCE);
  expect(
    Math.abs(cameraAfterLook.cameraPitch - pitch),
  ).toBeLessThanOrEqual(CAMERA_ANGLE_TOLERANCE);

  for (const key of keys) await page.keyboard.down(key);
  try {
    const warm = await waitForCameraTelemetry(canvas, {
      minimumElapsedTime:
        cameraAfterLook.elapsedTime + STEADY_STATE_WARMUP_SECONDS,
    });
    const baseline = warm.playerPosition;
    const finalSample = await waitForCameraTelemetry(canvas, {
      minimumElapsedTime: warm.elapsedTime + MOVEMENT_SAMPLE_SECONDS,
    });
    const finalPosition = finalSample.playerPosition;
    const deltaX = finalPosition[0] - baseline[0];
    const deltaZ = finalPosition[2] - baseline[2];
    return {
      baseline,
      deltaX,
      deltaZ,
      distance: Math.hypot(deltaX, deltaZ),
      initial,
      inputDirection: finalSample.inputDirection,
      moveSpeed: finalSample.moveSpeed,
    };
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((investigationState) => {
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
    window.localStorage.setItem(
      "history-unbroken:varennes:state",
      JSON.stringify(investigationState),
    );
  }, {
    persistenceVersion: "1.2.0",
    savedAt: "2026-07-19T12:00:00.000Z",
    state: {
      stateVersion: "1.2.0",
      caseId: "varennes",
      caseSchemaVersion: "1.0.0",
      caseVersion: "1.0.3",
      revision: 2,
      phase: "investigation",
      completedCommandIds: ["to-fracture", "to-investigation"],
      inspectedItemIds: [],
      completedComparisonIds: [],
      rejectedAnomalyIds: [],
      activeAnomalyId: null,
      pinnedEvidenceIds: [],
      selectedConditionIds: [],
      placedCausalNodeIds: [],
      connectedCausalEdgeIds: [],
      completedRepairActionIds: [],
      completedRepairStepIds: [],
      caseBrief: {
        argument: "",
        selectedConsequenceId: null,
        selectedUncertaintyIds: [],
        submitted: false,
      },
      repairCompleted: false,
    },
  });
});

test("locks and looks deterministically before opening a stopped E3 overlay", async ({
  page,
}) => {
  await installDeterministicPointerLockHarness(page, {
    autoAcknowledgeRelease: true,
  });
  const { canvas, telemetry } = await openTelemetryWorld(
    page,
    "preinstalled_harness",
  );
  const cameraBeforeLook = await readCameraTelemetry(canvas);

  await capturePointerLock(page, canvas);
  const movementX = 180;
  await dispatchLockedMouseMove(page, movementX, -25);
  const expectedYaw =
    cameraBeforeLook.yaw + movementX * CAMERA_CONFIG.yaw.radiansPerPixel;
  const cameraAfterLook = await waitForCameraTelemetry(canvas, {
    cameraYaw: expectedYaw,
    minimumSampleId: cameraBeforeLook.sampleId + 1,
  });
  expect(cameraAfterLook.yaw).toBeCloseTo(expectedYaw, 4);
  await expect
    .poll(async () => {
      const raw = await page.evaluate(() =>
        window.localStorage.getItem(
          "history-unbroken:world-camera-preferences",
        ),
      );
      const saved = JSON.parse(raw ?? "null") as {
        preferences?: { pointerLockIntroduced?: unknown };
      } | null;
      return saved?.preferences?.pointerLockIntroduced;
    })
    .toBe(true);

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  // Pointer lock has no cursor target. Dispatching the button's activation models
  // its keyboard-accessible command while preserving the captured-camera state.
  await prompt.dispatchEvent("click");
  const hud = page.getByTestId("world-hud");
  const evidenceDialog = page.getByRole("dialog", {
    name: /drouet's report to the national assembly/i,
  });
  await expect(evidenceDialog).toBeVisible();
  const stoppedAt = await readPlayerPosition(telemetry);
  await page.keyboard.down("KeyW");
  await expectPlayerStopped(page, telemetry);
  await expect
    .poll(async () => {
      const current = await readPlayerPosition(telemetry);
      return Math.hypot(
        current[0] - stoppedAt[0],
        current[2] - stoppedAt[2],
      );
    })
    .toBeLessThan(0.03);
  await page.keyboard.up("KeyW");
  expect(await readPointerLockHarness(page)).toMatchObject({
    exitRequests: 1,
    locked: false,
    releaseRequested: false,
  });
  await expect(hud).not.toHaveAttribute("data-pending-action", "interaction");
  await expect.poll(() => readInspectedEvidenceIds(page)).toContain("E3");

  await page.getByRole("button", { name: /close evidence/i }).click();
  await expect(evidenceDialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText(/exploring/i);
  await expect(prompt).toBeFocused();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  expect(await readPointerLockHarness(page)).toMatchObject({
    lockRequests: 1,
    locked: false,
    releaseRequested: false,
  });
});

for (const lifecycleEdge of ["blur", "hidden"] as const) {
  test(`requires fresh keyboard and pointer input after ${lifecycleEdge}`, async ({
    page,
  }) => {
    await installDeterministicPointerLockHarness(page, {
      autoAcknowledgeRelease: true,
    });
    const { canvas, telemetry } = await openTelemetryWorld(
      page,
      "preinstalled_harness",
    );
    await capturePointerLock(page, canvas);

    const movementStart = await readPlayerPosition(telemetry);
    await page.keyboard.down("KeyW");
    await expect
      .poll(async () =>
        horizontalDistance(movementStart, await readPlayerPosition(telemetry)),
      )
      .toBeGreaterThan(0.08);

    await setHarnessLifecycleState(
      page,
      lifecycleEdge === "blur"
        ? { focused: false, visibilityState: "visible" }
        : { focused: true, visibilityState: "hidden" },
    );
    await expect(page.getByRole("status")).toContainText(/suspended/i);
    await expect(
      page.getByRole("button", { name: /open camera settings/i }),
    ).toHaveAttribute("data-pointer-lock-active", "false");
    await expectPlayerStopped(page, telemetry);

    await setHarnessLifecycleState(page, {
      focused: true,
      visibilityState: "visible",
    });
    await expect(page.getByRole("status")).toContainText(/exploring/i);
    const resumedAt = await readPlayerPosition(telemetry);
    await page.waitForTimeout(450);
    expect(
      horizontalDistance(resumedAt, await readPlayerPosition(telemetry)),
    ).toBeLessThan(PLAYER_STOP_TOLERANCE);
    expect(await readPointerLockHarness(page)).toMatchObject({
      lockRequests: 1,
      locked: false,
    });

    await page.keyboard.up("KeyW");
    const freshInputStart = await readPlayerPosition(telemetry);
    await page.keyboard.down("KeyW");
    await expect
      .poll(async () =>
        horizontalDistance(
          freshInputStart,
          await readPlayerPosition(telemetry),
        ),
      )
      .toBeGreaterThan(0.08);
    await page.keyboard.up("KeyW");

    await capturePointerLock(page, canvas);
    expect(await readPointerLockHarness(page)).toMatchObject({
      lockRequests: 2,
      locked: true,
    });
  });
}

test("uses immediate camera follow damping for reduced motion", async ({ page }) => {
  await installReducedMotionLearningSession(page);
  const { canvas } = await openTelemetryWorld(page);
  await expect(page.locator("html")).toHaveAttribute("data-motion-mode", "reduced");
  const cameraBeforeMovement = await rightDragToYaw(
    page,
    canvas,
    YAW_NINETY_DEGREES,
  );

  await page.keyboard.down("KeyW");
  try {
    await expect
      .poll(async () => {
        const current = await readCameraTelemetry(canvas);
        return current.playerPosition[0] - cameraBeforeMovement.playerPosition[0];
      })
      .toBeGreaterThan(0.15);
    const movingCamera = await readCameraTelemetry(canvas);
    expect(movingCamera.moveSpeed).toBeGreaterThan(0);
    expect(cameraTargetTrackingError(movingCamera)).toBeLessThan(0.005);
  } finally {
    await page.keyboard.up("KeyW");
  }
});

test("acknowledges pointer release before route teardown unmounts the world", async ({
  page,
}) => {
  await installDeterministicPointerLockHarness(page);
  const { canvas } = await openTelemetryWorld(page, "preinstalled_harness");
  await capturePointerLock(page, canvas);

  const nonSpatialLink = page.getByRole("link", {
    name: /use non-spatial investigation/i,
  });
  // Pointer lock has no cursor target. Dispatch the link activation to exercise
  // the route coordinator while preserving the captured-camera state.
  await nonSpatialLink.dispatchEvent("click", { button: 0 });
  const pendingSnapshot = await page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>(
      '[data-testid="world-hud"]',
    );
    return {
      cameraReleasePending: hud?.dataset.cameraReleasePending,
      pendingAction: hud?.dataset.pendingAction,
      pointerLock: (
        window as unknown as PointerLockHarnessWindow
      ).__historyUnbrokenPointerLockHarness.snapshot(),
      pathname: window.location.pathname,
    };
  });
  expect(pendingSnapshot).toMatchObject({
    cameraReleasePending: "true",
    pendingAction: "route_teardown",
    pathname: "/play/world",
  });
  expect(pendingSnapshot.pointerLock).toMatchObject({
    exitRequests: 1,
    locked: true,
    releaseRequested: true,
  });

  await acknowledgePointerLockRelease(page);
  await expect(page).toHaveURL(/\/play\/investigate$/);
  await expect(page.getByTestId("world-canvas-shell")).toHaveCount(0);
});

test("contracts near the archive facade and recovers smoothly after leaving", async ({
  page,
}) => {
  const { canvas } = await openTelemetryWorld(page);
  await rightDragToYaw(page, canvas, -Math.PI / 4);
  await holdKeysUntil(page, canvas, ["KeyW"], {
    playerXAtMost: -3.8,
    playerZAtMost: -3.8,
  });

  const facadeView = await rightDragToYaw(page, canvas, Math.PI);
  expect(facadeView.collisionConstrained).toBe(true);
  expect(facadeView.appliedCollisionDistance).toBeLessThan(
    facadeView.requestedDistance - 0.25,
  );

  await page.keyboard.down("KeyW");
  let firstClear: CameraTelemetry;
  try {
    firstClear = await waitForCameraTelemetry(canvas, {
      collisionConstrained: false,
      maximumAppliedCollisionDistance:
        facadeView.requestedDistance - 0.05,
      minimumSampleId: facadeView.sampleId + 1,
    });
  } finally {
    await page.keyboard.up("KeyW");
  }

  const recoveryDistances = [firstClear.appliedCollisionDistance];
  let recovery = firstClear;
  for (let sample = 0; sample < 6; sample += 1) {
    recovery = await waitForCameraTelemetry(canvas, {
      collisionConstrained: false,
      minimumSampleId: recovery.sampleId + 1,
    });
    recoveryDistances.push(recovery.appliedCollisionDistance);
  }

  for (let index = 1; index < recoveryDistances.length; index += 1) {
    expect(recoveryDistances[index]).toBeGreaterThanOrEqual(
      recoveryDistances[index - 1],
    );
    expect(recoveryDistances[index]).toBeLessThanOrEqual(
      facadeView.requestedDistance,
    );
  }
  expect(recoveryDistances.at(-1)).toBeGreaterThan(recoveryDistances[0]);

  const recovered =
    recovery.appliedCollisionDistance >= facadeView.requestedDistance - 0.01
      ? recovery
      : await waitForCameraTelemetry(canvas, {
          collisionConstrained: false,
          minimumAppliedCollisionDistance: facadeView.requestedDistance - 0.01,
          minimumSampleId: recovery.sampleId + 1,
        });
  expect(
    Math.abs(
      recovered.appliedCollisionDistance - recovered.requestedDistance,
    ),
  ).toBeLessThanOrEqual(0.01);
});

test("keeps the archive evidence table camera-nonblocking with stable shoulder composition", async ({
  page,
}) => {
  const { canvas } = await openTelemetryWorld(page);
  let tableView = await rightDragLook(
    page,
    canvas,
    Math.PI / CAMERA_CONFIG.yaw.radiansPerPixel,
    0,
  );
  await expect
    .poll(async () =>
      cameraTargetTrackingError(await readCameraTelemetry(canvas)),
    )
    .toBeLessThan(0.005);
  tableView = await readCameraTelemetry(canvas);

  expect(tableView.collisionConstrained).toBe(false);
  expect(tableView.appliedCollisionDistance).toBeCloseTo(
    tableView.requestedDistance,
    5,
  );
  expect(cameraTargetTrackingError(tableView)).toBeLessThan(0.005);
});

test("keeps authored camera limits and finite composition through portrait resize", async ({
  page,
}) => {
  const { canvas } = await openTelemetryWorld(page);
  const minimumPitch = await rightDragLook(page, canvas, 0, 1_000_000);
  expect(minimumPitch.pitch).toBe(CAMERA_CONFIG.pitch.min);

  const maximumPitch = await rightDragLook(page, canvas, 0, -1_000_000);
  expect(maximumPitch.pitch).toBe(CAMERA_CONFIG.pitch.max);
  expect(maximumPitch.cameraPosition[1]).toBeGreaterThanOrEqual(
    CAMERA_CONFIG.collision.probeRadius,
  );

  const maximumZoom = await rightDragWheel(page, canvas, 1_000_000);
  expect(maximumZoom.distance).toBe(CAMERA_CONFIG.distance.max);
  const minimumZoom = await rightDragWheel(page, canvas, -1_000_000);
  expect(minimumZoom.distance).toBe(CAMERA_CONFIG.distance.min);

  const beforeResize = await readCameraTelemetry(canvas);
  await page.setViewportSize({ width: 390, height: 844 });
  const afterResize = await waitForCameraTelemetry(canvas, {
    minimumSampleId: beforeResize.sampleId + 1,
  });
  expectFiniteCameraTelemetry(afterResize);
  expect(afterResize.pitch).toBeGreaterThanOrEqual(CAMERA_CONFIG.pitch.min);
  expect(afterResize.pitch).toBeLessThanOrEqual(CAMERA_CONFIG.pitch.max);
  expect(afterResize.distance).toBeGreaterThanOrEqual(
    CAMERA_CONFIG.distance.min,
  );
  expect(afterResize.distance).toBeLessThanOrEqual(CAMERA_CONFIG.distance.max);
});

test("explicitly unsupported right-drag makes W follow camera-forward after a 90 degree yaw", async ({
  page,
}) => {
  const movement = await sampleMovement(page, ["KeyW"]);

  expect(movement.initial.every(Number.isFinite)).toBe(true);
  expect(movement.deltaX).toBeGreaterThan(0.4);
  expect(Math.abs(movement.deltaZ) / movement.distance).toBeLessThan(0.08);
});

test("W keeps a normalized horizontal basis at low and high camera pitches", async ({
  page,
}) => {
  const highPitch = await sampleMovement(page, ["KeyW"], Math.PI / 6);
  const lowPitch = await sampleMovement(page, ["KeyW"], -Math.PI / 6);
  expect(lowPitch.distance).toBeGreaterThan(0.4);
  expect(highPitch.distance).toBeGreaterThan(0.4);
  for (const movement of [lowPitch, highPitch]) {
    expect(movement.inputDirection[0]).toBeGreaterThan(0.99);
    expect(Math.abs(movement.inputDirection[1])).toBeLessThan(0.01);
    expect(Math.abs(movement.inputDirection[2])).toBeLessThan(0.01);
    expect(Math.hypot(...movement.inputDirection)).toBeCloseTo(1, 4);
  }
});

test("W+D diagonal travel does not exceed W-only travel speed", async ({ page }) => {
  const forward = await sampleMovement(page, ["KeyW"]);
  const diagonal = await sampleMovement(page, ["KeyW", "KeyD"]);
  const tolerance = Math.max(0.12, forward.distance * 0.12);

  expect(forward.distance).toBeGreaterThan(0.4);
  expect(diagonal.distance).toBeGreaterThan(0.4);
  expect(Math.hypot(...diagonal.inputDirection)).toBeCloseTo(1, 4);
  expect(Math.abs(diagonal.inputDirection[0])).toBeGreaterThan(0.6);
  expect(Math.abs(diagonal.inputDirection[2])).toBeGreaterThan(0.6);
  expect(Math.abs(diagonal.deltaX)).toBeGreaterThan(0.3);
  expect(Math.abs(diagonal.deltaZ)).toBeGreaterThan(0.3);
  expect(diagonal.distance).toBeLessThanOrEqual(forward.distance + tolerance);
});
