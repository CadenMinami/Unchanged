import { expect, test, type Locator, type Page } from "@playwright/test";

import { CAMERA_CONFIG } from "../../lib/world/camera-config";

test.use({ viewport: { width: 1280, height: 720 } });

const LOUIS_TRAVERSAL_YAW = Math.PI / 2;
const CAMERA_YAW_TOLERANCE = 0.02;

interface CameraOrientationTelemetry {
  cameraYaw: number;
  sampleId: number;
  yaw: number;
}

async function installUnsupportedPointerLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "requestPointerLock", {
      configurable: true,
      value: undefined,
    });
  });
}

async function readCameraOrientation(
  canvas: Locator,
): Promise<CameraOrientationTelemetry> {
  const serialized = await canvas.getAttribute("data-camera-telemetry");
  const telemetry = JSON.parse(serialized ?? "null") as unknown;
  if (
    typeof telemetry !== "object" ||
    telemetry === null ||
    !("cameraYaw" in telemetry) ||
    !("sampleId" in telemetry) ||
    !("yaw" in telemetry) ||
    typeof telemetry.cameraYaw !== "number" ||
    typeof telemetry.sampleId !== "number" ||
    typeof telemetry.yaw !== "number"
  ) {
    throw new Error(`Invalid camera telemetry: ${serialized ?? "missing"}`);
  }
  return telemetry as CameraOrientationTelemetry;
}

function angularDistance(first: number, second: number): number {
  return Math.abs(
    Math.atan2(Math.sin(first - second), Math.cos(first - second)),
  );
}

async function setUnsupportedCameraYaw(
  canvas: Locator,
  targetYaw: number,
): Promise<void> {
  await expect(canvas).toHaveAttribute("data-camera-telemetry", /"cameraYaw":/);
  const before = await readCameraOrientation(canvas);
  const movementX =
    (targetYaw - before.yaw) / CAMERA_CONFIG.yaw.radiansPerPixel;

  await canvas.dispatchEvent("pointerdown", {
    button: 2,
    buttons: 2,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });
  await canvas.evaluate((element, deltaX) => {
    const event = new PointerEvent("pointermove", {
      bubbles: true,
      buttons: 2,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    });
    Object.defineProperty(event, "movementX", { value: deltaX });
    element.dispatchEvent(event);
  }, movementX);
  await canvas.dispatchEvent("pointerup", {
    button: 2,
    buttons: 0,
    isPrimary: true,
    pointerId: 1,
    pointerType: "mouse",
  });

  await expect
    .poll(async () => {
      const current = await readCameraOrientation(canvas);
      if (current.sampleId <= before.sampleId) return Number.POSITIVE_INFINITY;
      return Math.max(
        angularDistance(current.yaw, targetYaw),
        angularDistance(current.cameraYaw, targetYaw),
      );
    })
    .toBeLessThanOrEqual(CAMERA_YAW_TOLERANCE);
}

test("questions Louis from E1 without changing case authority", async ({ page }) => {
  await installUnsupportedPointerLock(page);
  const caseState = {
    persistenceVersion: "1.2.0",
    savedAt: "2026-07-15T12:00:00.000Z",
    state: {
      stateVersion: "1.2.0",
      caseId: "varennes",
      caseSchemaVersion: "1.0.0",
      caseVersion: "1.0.3",
      revision: 3,
      phase: "investigation",
      completedCommandIds: ["setup-briefing", "setup-fracture", "setup-e1"],
      inspectedItemIds: ["E1"],
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
  };
  const spatialState = {
    spatialSessionVersion: "1.0.0",
    caseId: "varennes",
    caseVersion: "1.0.3",
    sceneManifestVersion: "1.3.0",
    mode: "spatial",
    lastSafeSpawn: {
      zoneId: "royal-lodging-civic-area",
      spawnId: "SPAWN-CIVIC-ENTRY",
    },
    discoveredZoneIds: [
      "archive-antechamber",
      "post-road-square",
      "royal-lodging-civic-area",
    ],
    guidanceSetting: "subtle",
    graphicsTier: "balanced",
  };

  await page.addInitScript(
    ({ caseState, spatialState }) => {
      window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
      window.localStorage.setItem(
        "history-unbroken:varennes:state",
        JSON.stringify(caseState),
      );
      window.localStorage.setItem(
        "history-unbroken:varennes:spatial-session",
        JSON.stringify(spatialState),
      );
    },
    { caseState, spatialState },
  );
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expect(
    page.getByRole("complementary", {
      name: /current reconstruction location/i,
    }),
  ).toContainText(/royal lodging and civic area/i);
  const playerPosition = page.getByTestId("world-player-position");
  await expect(playerPosition).toHaveAttribute(
    "data-position",
    /^\[48(?:\.0*)?,/,
  );

  const louisPrompt = page.getByRole("button", {
    name: /inspect louis station/i,
  });
  await expect(louisPrompt).toBeHidden();
  const initialPosition = JSON.parse(
    (await playerPosition.getAttribute("data-position")) ?? "null",
  ) as [number, number, number] | null;
  if (!initialPosition) throw new Error("Missing initial player position telemetry.");
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await setUnsupportedCameraYaw(canvas, LOUIS_TRAVERSAL_YAW);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  try {
    try {
      await expect(louisPrompt).toBeVisible({ timeout: 12_000 });
    } catch (error) {
      const finalPosition = await playerPosition.getAttribute("data-position");
      throw new Error(`Louis traversal ended at ${finalPosition}.`, {
        cause: error,
      });
    }
  } finally {
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
  }
  const finalPosition = JSON.parse(
    (await playerPosition.getAttribute("data-position")) ?? "null",
  ) as [number, number, number] | null;
  if (!finalPosition) throw new Error("Missing final player position telemetry.");
  expect(Math.hypot(
    finalPosition[0] - initialPosition[0],
    finalPosition[1] - initialPosition[1],
    finalPosition[2] - initialPosition[2],
  )).toBeGreaterThan(0.5);
  await expect(louisPrompt).toBeVisible();
  await louisPrompt.click();

  const conversation = page.getByRole("dialog", {
    name: /conversation with louis xvi station/i,
  });
  await expect(conversation).toBeVisible();
  await expect(
    conversation.getByText(
      /this station voices louis's stated declaration.*cannot establish.*private motive/i,
    ),
  ).toBeVisible();

  const evidenceSelect = page.getByLabel(/present inspected evidence/i);
  await expect(evidenceSelect.locator('option[value="E1"]')).toHaveCount(1);
  await expect(evidenceSelect.locator('option[value="E2"]')).toHaveCount(0);
  await evidenceSelect.selectOption("E1");
  await page.getByLabel(/question for the source station/i).fill(
    "What does your declaration state, and what can it not prove about your motive?",
  );
  await page.getByRole("button", { name: /ask source/i }).click();

  await expect(page.getByRole("article", { name: /source response/i })).toBeVisible();
  await expect(page.getByText(/cannot be pinned or scored as evidence/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /hear response/i })).toBeVisible();

  const persistedAfter = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("history-unbroken:varennes:state") ?? "null",
    ),
  );
  expect(persistedAfter.state.revision).toBe(3);
  expect(persistedAfter.state.inspectedItemIds).toEqual(["E1"]);
  expect(persistedAfter.state.pinnedEvidenceIds).toEqual([]);

  await page.getByRole("button", { name: /close conversation/i }).click();
  await expect(
    page.locator('section[role="status"]').filter({ hasText: /spatial archive/i }),
  ).toContainText(/exploring/i);
  const focusedButton = page.locator("button:focus");
  await expect(focusedButton).toHaveCount(1);
  await expect(focusedButton).toHaveAccessibleName(
    /inspect louis station|open route journal/i,
  );
});
