import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

import { CAMERA_CONFIG } from "../../lib/world/camera-config";

test.use({ viewport: { width: 1280, height: 720 } });

const CAMERA_FORWARD_POSITIVE_X_YAW = Math.PI / 2;
const CAMERA_YAW_TOLERANCE = 0.02;

interface CameraOrientationTelemetry {
  cameraYaw: number;
  sampleId: number;
  yaw: number;
}

async function expectAllZoneDiagnostics(page: Page): Promise<void> {
  const shell = page.getByTestId("world-canvas-shell");
  await expect(shell).toHaveAttribute("data-world-zones-ready", "true");
  const serialized = await shell.getAttribute("data-world-zone-readiness");
  const zones = JSON.parse(serialized ?? "null") as Record<
    string,
    { assetStatus: string; interactableReady: boolean }
  >;

  expect(Object.keys(zones)).toEqual([
    "archive-antechamber",
    "post-road-square",
    "royal-lodging-civic-area",
    "bridge-approach",
  ]);
  expect(
    Object.values(zones).every(
      ({ assetStatus, interactableReady }) =>
        assetStatus !== "pending" && interactableReady,
    ),
  ).toBe(true);
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

test("renders a nonblank grounded Varennes reconstruction inside the client-only world route", async ({ page }, testInfo) => {
  // This is the only test that waits for the renderer, captures a full canvas,
  // and decodes it while the full suite runs four browser workers in parallel.
  test.setTimeout(60_000);
  const sceneConsoleErrors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /content security policy|couldn't load texture|refused to connect|blob:/i.test(
        message.text(),
      )
    ) {
      sceneConsoleErrors.push(message.text());
    }
  });
  await page.addInitScript(() => {
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
  });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expectAllZoneDiagnostics(page);
  await expect(
    page.getByRole("complementary", {
      name: /ambient reconstruction caption/i,
    }),
  ).toHaveCount(1);
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();

  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(900);
  expect(bounds?.height).toBeGreaterThan(500);

  const screenshot = await canvas.screenshot();
  await testInfo.attach("grounded-varennes-reconstruction", {
    body: screenshot,
    contentType: "image/png",
  });
  expect(screenshot.byteLength).toBeGreaterThan(10_000);
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const pixelStride = Math.max(1, Math.floor((info.width * info.height) / 3_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += pixelStride) {
    const index = pixel * info.channels;
    colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
  }
  expect(colors.size).toBeGreaterThan(20);
  expect(sceneConsoleErrors).toEqual([]);

  await expect(
    page.getByRole("link", { name: /use non-spatial investigation/i }),
  ).toHaveAttribute("href", "/play/investigate");
});

test("keeps the authored world usable when optional downloaded assets fail", async ({
  page,
}) => {
  await page.route("**/world/**", (route) => route.abort("failed"));
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expectAllZoneDiagnostics(page);
  await expect(page.getByTestId("world-canvas").locator("canvas")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /inspect drouet account table/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /3d reconstruction unavailable/i }),
  ).toHaveCount(0);
});

test("keeps Classroom facades and characters off optional rich asset requests", async ({
  page,
}) => {
  const optionalRichRequests: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      /\/world\/textures\/(?:painted-plaster-wall|stone-wall|wood-planks|clay-roof-tiles|rust-coarse-01)\//i.test(
        url,
      ) ||
      /\/world\/models\/(?:characters?|people|drouet|louis|sauce|barnave|investigator)[^/]*\/.*\.(?:glb|gltf)(?:\?|$)/i.test(
        url,
      )
    ) {
      optionalRichRequests.push(url);
    }
  });
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 4,
    });
  });

  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expectAllZoneDiagnostics(page);
  await expect(
    page.getByLabel(/graphics quality: classroom/i),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(optionalRichRequests).toEqual([]);
});

test("keyboard movement changes the rendered world frame", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();

  await page.waitForTimeout(1_200);
  const before = await canvas.screenshot();
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(700);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(100);
  const after = await canvas.screenshot();

  const [beforePixels, afterPixels] = await Promise.all([
    sharp(before).removeAlpha().raw().toBuffer(),
    sharp(after).removeAlpha().raw().toBuffer(),
  ]);
  let changedChannels = 0;
  for (let index = 0; index < beforePixels.length; index += 1) {
    if (Math.abs(beforePixels[index] - afterPixels[index]) > 4) changedChannels += 1;
  }

  expect(changedChannels).toBeGreaterThan(5_000);
});

test("keeps the portrait world visible without overlapping top controls", async ({
  page,
}) => {
  await installUnsupportedPointerLock(page);
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 4,
    });
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/world");

  const status = page.getByRole("status");
  await expect(status).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expect(status).toContainText(
    /right-drag to look.*keyboard remains available/i,
  );
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  const quality = page.locator('[aria-label^="Graphics quality:"]');
  const sound = page.getByRole("button", { name: /enable ambient sound/i });
  const settings = page.getByRole("button", {
    name: /open camera settings/i,
  });
  const journal = page.getByRole("button", { name: /open route journal/i });
  const route = page.getByRole("navigation", {
    name: /reconstruction route/i,
  });
  await expect(prompt).toBeVisible();
  await expect(quality).toBeVisible();
  await expect(sound).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(journal).toBeVisible();
  await expect(route).toBeVisible();
  await expect(
    page.getByRole("complementary", {
      name: /ambient reconstruction caption/i,
    }),
  ).toHaveCount(0);
  await setUnsupportedCameraYaw(canvas, CAMERA_FORWARD_POSITIVE_X_YAW);

  const controls = [
    ["capture status", status],
    ["sound", sound],
    ["settings", settings],
    ["graphics", quality],
    ["journal", journal],
    ["route", route],
    ["interaction", prompt],
  ] as const;
  const controlBounds = await Promise.all(
    controls.map(async ([name, locator]) => {
      const bounds = await locator.boundingBox();
      expect(bounds, `${name} must have layout bounds`).not.toBeNull();
      return [name, bounds!] as const;
    }),
  );
  for (let left = 0; left < controlBounds.length; left += 1) {
    for (let right = left + 1; right < controlBounds.length; right += 1) {
      const [leftName, leftBounds] = controlBounds[left]!;
      const [rightName, rightBounds] = controlBounds[right]!;
      const overlap =
        leftBounds.x < rightBounds.x + rightBounds.width &&
        leftBounds.x + leftBounds.width > rightBounds.x &&
        leftBounds.y < rightBounds.y + rightBounds.height &&
        leftBounds.y + leftBounds.height > rightBounds.y;
      expect(overlap, `${leftName} overlaps ${rightName}`).toBe(false);
    }
  }

  await settings.click();
  const cameraSettings = page.getByRole("dialog", {
    name: /camera settings/i,
  });
  const closeSettings = page.getByRole("button", {
    name: /close camera settings/i,
  });
  const sensitivity = page.getByRole("slider", { name: /look sensitivity/i });
  const invertY = page.getByRole("checkbox", {
    name: /invert vertical look/i,
  });
  await expect(cameraSettings).toBeVisible();
  await expect(prompt).toBeVisible();
  await expect(closeSettings).toBeFocused();
  const settingsBounds = await cameraSettings.boundingBox();
  const promptBounds = await prompt.boundingBox();
  expect(settingsBounds).not.toBeNull();
  expect(promptBounds).not.toBeNull();
  expect(settingsBounds!.y).toBeGreaterThanOrEqual(
    promptBounds!.y + promptBounds!.height,
  );

  await page.keyboard.press("Tab");
  await expect(sensitivity).toBeFocused();
  const sensitivityBefore = await sensitivity.inputValue();
  await page.keyboard.press("ArrowRight");
  expect(await sensitivity.inputValue()).not.toBe(sensitivityBefore);
  await page.keyboard.press("Tab");
  await expect(invertY).toBeFocused();
  await page.keyboard.press("Space");
  await expect(invertY).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(cameraSettings).toHaveCount(0);
  await expect(settings).toBeFocused();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();

  const telemetry = page.getByTestId("world-player-position");
  await expect(telemetry).toHaveAttribute("data-position", /^\[-?\d/);
  const positionBefore = JSON.parse(
    (await telemetry.getAttribute("data-position")) ?? "[]",
  ) as number[];
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  await expect.poll(async () => {
    const positionAfter = JSON.parse(
      (await telemetry.getAttribute("data-position")) ?? "[]",
    ) as number[];
    return Math.hypot(
      positionAfter[0] - positionBefore[0],
      positionAfter[2] - positionBefore[2],
    );
  }).toBeGreaterThan(0.1);

  await page.waitForTimeout(1_200);
  const screenshot = await canvas.screenshot();
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const pixelStride = Math.max(1, Math.floor((info.width * info.height) / 3_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += pixelStride) {
    const index = pixel * info.channels;
    colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
  }
  expect(colors.size).toBeGreaterThan(20);
});

test("opens the canonical E3 record from the nearby archive table", async ({ page }) => {
  await installUnsupportedPointerLock(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
  });
  await page.goto("/play");

  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
  await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const prompt = page.getByRole("button", { name: /inspect drouet account table/i });
  await expect(prompt).toBeVisible();
  await prompt.click();

  await expect(
    page.getByRole("dialog", { name: /drouet's report to the national assembly/i }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText(/focused/i);
  await expect(page.getByText(/only this reviewed DOM record counts as evidence/i)).toBeVisible();

  const telemetry = page.getByTestId("world-player-position");
  await expect(telemetry).toHaveAttribute("data-position", /^\[/);
  const focusedBefore = JSON.parse(
    (await telemetry.getAttribute("data-position")) ?? "[]",
  ) as number[];
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(600);
  await page.keyboard.up("KeyW");
  await page.waitForTimeout(150);
  const focusedAfter = JSON.parse(
    (await telemetry.getAttribute("data-position")) ?? "[]",
  ) as number[];
  expect(Math.hypot(focusedAfter[0] - focusedBefore[0], focusedAfter[2] - focusedBefore[2])).toBeLessThan(
    0.03,
  );

  const persisted = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem("history-unbroken:varennes:state") ?? "null",
    ),
  );
  expect(persisted.state.inspectedItemIds).toContain("E3");
  expect(persisted.state.pinnedEvidenceIds).not.toContain("E3");

  await page.getByRole("button", { name: /close evidence/i }).click();
  await expect(page.getByRole("status")).toContainText(/exploring/i);
  await expect(prompt).toBeFocused();
  await setUnsupportedCameraYaw(canvas, CAMERA_FORWARD_POSITIVE_X_YAW);

  const drouetPrompt = page.getByRole("button", { name: /inspect drouet station/i });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  try {
    try {
      await expect(drouetPrompt).toBeVisible({ timeout: 12_000 });
    } catch (error) {
      const finalPosition = await telemetry.getAttribute("data-position");
      throw new Error(
        `Drouet traversal ended at ${finalPosition ?? "an unknown position"}.`,
        { cause: error },
      );
    }
  } finally {
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
  }
  await drouetPrompt.click();

  await expect(
    page.getByRole("dialog", { name: /conversation with drouet station/i }),
  ).toBeVisible();
  await expect(
    page.locator('section[role="status"]').filter({ hasText: /spatial archive/i }),
  ).toContainText(/cinematic/i);
  await expect(page.getByText(/ai-directed dramatization is bounded/i)).toBeVisible();
  await expect(page.getByLabel(/choose source station/i)).toHaveCount(0);
  const evidenceSelect = page.getByLabel(/present inspected evidence/i);
  await expect(evidenceSelect.locator('option[value="E3"]')).toHaveCount(1);
  await expect(evidenceSelect.locator('option[value="E4"]')).toHaveCount(0);

  await page.getByLabel(/question for the source station/i).fill(
    "What did the route information allow you to do?",
  );
  await page.getByRole("button", { name: /ask source/i }).click();
  await expect(page.getByRole("article", { name: /source response/i })).toBeVisible();
  await expect(page.getByText(/cannot be pinned or scored as evidence/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /hear response/i })).toBeVisible();

  await page.getByRole("button", { name: /close conversation/i }).click();
  await expect(
    page.locator('section[role="status"]').filter({ hasText: /spatial archive/i }),
  ).toContainText(/exploring/i);
  await expect(drouetPrompt).toBeFocused();
});

test("discovers the route by walking and fast travels without changing case authority", async ({
  page,
}) => {
  await installUnsupportedPointerLock(page);
  await page.addInitScript(() => {
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
  });
  await page.goto("/play/world");
  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i);

  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();

  const caseRevisionBefore = await page.evaluate(() => {
    const saved = JSON.parse(
      window.localStorage.getItem("history-unbroken:varennes:state") ?? "null",
    ) as { state?: { revision?: number } } | null;
    return saved?.state?.revision ?? 0;
  });

  const location = page.getByRole("complementary", {
    name: /current reconstruction location/i,
  });
  const telemetry = page.getByTestId("world-player-position");
  await setUnsupportedCameraYaw(canvas, CAMERA_FORWARD_POSITIVE_X_YAW);
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  try {
    try {
      await expect(location).toContainText(/royal lodging and civic area/i, {
        timeout: 22_000,
      });
    } catch (error) {
      throw new Error(
        `Civic traversal ended at ${await telemetry.getAttribute("data-position")}.`,
        { cause: error },
      );
    }
  } finally {
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ShiftLeft");
  }

  await page.getByRole("button", { name: /open route journal/i }).click();
  await expect(
    page.getByRole("dialog", { name: /case journal/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /fast travel to post-road square/i }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /fast travel to post-road square/i })
    .click();

  await expect(location).toContainText(/post-road square/i);
  await expect(
    page.locator('section[role="status"]').filter({ hasText: /spatial archive/i }),
  ).toContainText(/exploring/i);
  const caseRevisionAfter = await page.evaluate(() => {
    const saved = JSON.parse(
      window.localStorage.getItem("history-unbroken:varennes:state") ?? "null",
    ) as { state?: { revision?: number } } | null;
    return saved?.state?.revision ?? 0;
  });
  expect(caseRevisionAfter).toBe(caseRevisionBefore);
});

test("hands a prevalidated persisted case from the world to the authoritative caseboard and repair", async ({
  page,
}) => {
  const commandCount = 50;
  const savedState = {
    persistenceVersion: "1.2.0",
    savedAt: "2026-07-15T12:00:00.000Z",
    state: {
      stateVersion: "1.2.0",
      caseId: "varennes",
      caseSchemaVersion: "1.0.0",
      caseVersion: "1.0.3",
      revision: commandCount,
      phase: "case_brief",
      completedCommandIds: Array.from(
        { length: commandCount },
        (_, index) => `setup-${index}`,
      ),
      inspectedItemIds: [
        "E1",
        "E2",
        "E3",
        "E4",
        "E5",
        "E7",
        "E6A",
        "E6B",
        "E6C",
        "FO1",
        "FO2",
        "FO3",
      ],
      completedComparisonIds: [
        "CMP-REJECT-E6A",
        "CMP-SUPPORT-E6B",
        "CMP-REJECT-E6C",
      ],
      rejectedAnomalyIds: ["E6A", "E6C"],
      activeAnomalyId: "E6B",
      pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
      selectedConditionIds: ["COND-BG-001", "COND-JR-002"],
      placedCausalNodeIds: [
        "NODE-RECOGNITION",
        "NODE-ROUTE",
        "NODE-PURSUIT",
        "NODE-WARNING",
        "NODE-MOBILIZATION",
        "NODE-OBSTRUCTION",
        "NODE-PASSPORT",
        "NODE-DETENTION",
      ],
      connectedCausalEdgeIds: [
        "EDGE-RECOGNITION-ROUTE",
        "EDGE-ROUTE-PURSUIT",
        "EDGE-PURSUIT-WARNING",
        "EDGE-WARNING-MOBILIZATION",
        "EDGE-MOBILIZATION-OBSTRUCTION",
        "EDGE-MOBILIZATION-PASSPORT",
        "EDGE-OBSTRUCTION-DETENTION",
        "EDGE-PASSPORT-DETENTION",
      ],
      completedRepairActionIds: [],
      completedRepairStepIds: [],
      caseBrief: {
        argument:
          "Accurate route information enabled pursuit, but local civic action also mattered and the later political outcome was not inevitable.",
        selectedConsequenceId: "CONS-REACTION-CONTINUITY",
        selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
        submitted: true,
      },
      repairCompleted: false,
    },
  };

  await page.addInitScript((state) => {
    window.localStorage.setItem(
      "history-unbroken:varennes:state",
      JSON.stringify(state),
    );
  }, savedState);
  await page.goto("/play/world");

  await page.getByRole("button", { name: /open causal caseboard/i }).click();
  await expect(page.getByRole("dialog", { name: /causal caseboard/i })).toBeVisible();
  await expect(page.getByText("Repair ready", { exact: true })).toBeVisible();

  const repairLink = page.getByRole("link", {
    name: /review timeline repair/i,
  });
  await expect(repairLink).toHaveAttribute(
    "data-world-phase-after-release",
    "repair",
  );
  await repairLink.click();

  await expect(page).toHaveURL(/\/play\/repair$/);
  await expect(page.getByText(/repair locked/i)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /restore the link\. preserve the uncertainty/i }),
  ).toBeVisible();
});
