import { expect, type Locator, type Page } from "@playwright/test";

import { CAMERA_CONFIG } from "../../../lib/world/camera-config";

export const DISTRICT_ZONE_TARGETS = Object.freeze([
  { zoneId: "archive-antechamber", x: 0 },
  { zoneId: "post-road-square", x: 24 },
  { zoneId: "royal-lodging-civic-area", x: 48 },
  { zoneId: "bridge-approach", x: 72 },
] as const);

export type DistrictZoneReadiness = Readonly<{
  assetStatus: "pending" | "loaded" | "fallback";
  interactableReady: boolean;
}>;

export type DistrictTraversalCheckpoint = Readonly<{
  reachedAtMs: number;
  x: number;
  zoneId: (typeof DISTRICT_ZONE_TARGETS)[number]["zoneId"];
}>;

type CameraTelemetry = Readonly<{
  cameraYaw: number;
  sampleId: number;
  yaw: number;
}>;

function angularDistance(first: number, second: number): number {
  return Math.abs(
    Math.atan2(Math.sin(first - second), Math.cos(first - second)),
  );
}

async function readCameraTelemetry(canvas: Locator): Promise<CameraTelemetry> {
  const serialized = await canvas.getAttribute("data-camera-telemetry");
  const telemetry = JSON.parse(serialized ?? "null") as Partial<CameraTelemetry>;
  if (
    typeof telemetry.cameraYaw !== "number" ||
    typeof telemetry.sampleId !== "number" ||
    typeof telemetry.yaw !== "number"
  ) {
    throw new Error(`Invalid camera telemetry: ${serialized ?? "missing"}`);
  }
  return telemetry as CameraTelemetry;
}

export async function alignCameraYaw(
  page: Page,
  targetYaw: number,
): Promise<void> {
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toHaveAttribute("data-camera-telemetry", /"cameraYaw":/, {
    timeout: 20_000,
  });
  let before = await readCameraTelemetry(canvas);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const signedDelta = Math.atan2(
      Math.sin(targetYaw - before.yaw),
      Math.cos(targetYaw - before.yaw),
    );
    if (Math.abs(signedDelta) <= 0.04) break;
    const movementX = signedDelta / CAMERA_CONFIG.yaw.radiansPerPixel;
    const pointerId = attempt + 1;

    await canvas.dispatchEvent("pointerdown", {
      button: 2,
      buttons: 2,
      isPrimary: true,
      pointerId,
      pointerType: "mouse",
    });
    await canvas.evaluate((element, input) => {
      const event = new PointerEvent("pointermove", {
        bubbles: true,
        buttons: 2,
        isPrimary: true,
        pointerId: input.pointerId,
        pointerType: "mouse",
      });
      Object.defineProperty(event, "movementX", { value: input.movementX });
      element.dispatchEvent(event);
    }, { movementX, pointerId });
    await canvas.dispatchEvent("pointerup", {
      button: 2,
      buttons: 0,
      isPrimary: true,
      pointerId,
      pointerType: "mouse",
    });

    await expect
      .poll(
        async () => (await readCameraTelemetry(canvas)).sampleId,
        { timeout: 5_000 },
      )
      .toBeGreaterThan(before.sampleId);
    before = await readCameraTelemetry(canvas);
  }

  await expect
    .poll(
      async () => {
        const current = await readCameraTelemetry(canvas);
        return Math.max(
          angularDistance(current.yaw, targetYaw),
          angularDistance(current.cameraYaw, targetYaw),
        );
      },
      { timeout: 15_000 },
    )
    .toBeLessThanOrEqual(0.04);
}

export async function alignCameraWithPositiveDistrictX(
  page: Page,
): Promise<void> {
  await alignCameraYaw(page, Math.PI / 2);
}

export async function readWorldPlayerPosition(
  page: Page,
): Promise<readonly [number, number, number]> {
  const output = page.getByTestId("world-player-position");
  await expect(output).toHaveAttribute("data-position", /^\[-?\d/, {
    timeout: 20_000,
  });
  const position = JSON.parse(
    (await output.getAttribute("data-position")) ?? "null",
  ) as unknown;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((value) => typeof value === "number" && Number.isFinite(value))
  ) {
    throw new Error("World player telemetry did not contain a finite position.");
  }
  return position as [number, number, number];
}

export async function readDistrictZoneReadiness(
  page: Page,
): Promise<Readonly<Record<string, DistrictZoneReadiness>>> {
  const shell = page.getByTestId("world-canvas-shell");
  await expect(shell).toHaveAttribute("data-world-zones-ready", "true", {
    timeout: 20_000,
  });
  const zones = JSON.parse(
    (await shell.getAttribute("data-world-zone-readiness")) ?? "null",
  ) as Record<string, DistrictZoneReadiness>;
  expect(Object.keys(zones)).toEqual(
    DISTRICT_ZONE_TARGETS.map(({ zoneId }) => zoneId),
  );
  return Object.freeze(zones);
}

async function holdRoadKeyUntilX(
  page: Page,
  key: "KeyW" | "KeyS",
  targetX: number,
  run: boolean,
): Promise<number> {
  if (run) await page.keyboard.down("ShiftLeft");
  await page.keyboard.down(key);
  try {
    await expect
      .poll(
        async () => (await readWorldPlayerPosition(page))[0],
        { intervals: [250], timeout: 60_000 },
      )
      [key === "KeyW" ? "toBeGreaterThanOrEqual" : "toBeLessThanOrEqual"](
        targetX,
      );
  } finally {
    await page.keyboard.up(key);
    if (run) await page.keyboard.up("ShiftLeft");
  }
  return (await readWorldPlayerPosition(page))[0];
}

export async function traverseDistrictForward(
  page: Page,
  options: Readonly<{ run?: boolean }> = {},
): Promise<readonly DistrictTraversalCheckpoint[]> {
  await alignCameraWithPositiveDistrictX(page);
  const startedAt = performance.now();
  const checkpoints: DistrictTraversalCheckpoint[] = [
    {
      reachedAtMs: 0,
      x: (await readWorldPlayerPosition(page))[0],
      zoneId: "archive-antechamber",
    },
  ];

  for (const target of DISTRICT_ZONE_TARGETS.slice(1)) {
    const x = await holdRoadKeyUntilX(
      page,
      "KeyW",
      target.x - 2,
      options.run ?? true,
    );
    checkpoints.push({
      reachedAtMs: performance.now() - startedAt,
      x,
      zoneId: target.zoneId,
    });
  }

  return Object.freeze(checkpoints);
}

export async function returnDistrictToArchive(page: Page): Promise<number> {
  await alignCameraWithPositiveDistrictX(page);
  return holdRoadKeyUntilX(page, "KeyS", 2, true);
}
