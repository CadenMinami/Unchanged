import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";

import {
  evaluateArchivePerformance,
  evaluateFullDistrictPerformance,
  type FullDistrictPerformanceReport,
} from "../../lib/world/performance-gate";
import {
  applyClassroomPerformanceProfile,
  CLASSROOM_PERFORMANCE_PROFILE,
  createTransferTracker,
  installArchiveInvestigationState,
  readWorldRenderWindow,
  resetWorldRenderSamples,
  runArchiveMovementLoop,
} from "./helpers/performance-profile";
import {
  readDistrictZoneReadiness,
  readWorldPlayerPosition,
  returnDistrictToArchive,
  traverseDistrictForward,
} from "./helpers/world-traversal";

test.use({ viewport: { width: 1366, height: 768 } });
test.setTimeout(140_000);

async function expectUsableClassroomWorld(page: Page): Promise<void> {
  await expect(page.getByRole("status").first()).toContainText(
    /reconstruction ready/i,
    { timeout: 20_000 },
  );
  await expect(page.getByLabel("Graphics quality: classroom")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /3d reconstruction unavailable/i }),
  ).toHaveCount(0);
  await readDistrictZoneReadiness(page);
}

async function closeContext(context: BrowserContext | null): Promise<void> {
  if (context) await context.close();
}

async function canvasColorCount(screenshot: Buffer): Promise<number> {
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const pixelStride = Math.max(
    1,
    Math.floor((info.width * info.height) / 3_000),
  );
  for (
    let pixel = 0;
    pixel < info.width * info.height;
    pixel += pixelStride
  ) {
    const index = pixel * info.channels;
    colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
  }
  return colors.size;
}

test("keeps the first interactive archive within the classroom proxy budget", async ({
  baseURL,
  page,
}) => {
  if (!baseURL) throw new Error("Playwright baseURL is required.");
  await installArchiveInvestigationState(page);
  const cdp = await applyClassroomPerformanceProfile(page);
  const transfers = createTransferTracker(cdp, baseURL);

  await page.goto("/play/world", { waitUntil: "domcontentloaded" });

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(prompt).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Graphics quality: classroom")).toBeVisible();
  await prompt.click();
  await expect(
    page.getByRole("dialog", {
      name: /drouet's report to the national assembly/i,
    }),
  ).toBeVisible();

  const interactiveMs = await page.evaluate(() => performance.now());
  await page.getByRole("button", { name: /close evidence/i }).click();
  await page.waitForLoadState("networkidle");
  const initialCompressedBytes = transfers.totalEncodedBytes();

  const canvas = page.getByTestId("world-canvas").locator("canvas");
  const beforeColorCount = await canvasColorCount(await canvas.screenshot());

  await page.waitForTimeout(10_000);
  const frameWindowStartedAt = await resetWorldRenderSamples(page);
  const movementMetrics = await runArchiveMovementLoop(page, 60_000);
  const frameMetrics = await readWorldRenderWindow(
    page,
    frameWindowStartedAt,
    60_000,
  );
  await expect(canvas).toBeVisible();
  await expect(page.getByRole("status").first()).toContainText(
    /reconstruction ready/i,
  );
  const afterColorCount = await canvasColorCount(await canvas.screenshot());
  const canvasNonBlank = beforeColorCount > 20 && afterColorCount > 20;
  expect(movementMetrics.maxDistanceFromStart).toBeGreaterThan(0.5);

  const result = evaluateArchivePerformance({
    canvasNonBlank,
    initialCompressedBytes,
    interactiveMs,
    maxPostLoadStallMs: frameMetrics.maxStallMs,
    medianFps: frameMetrics.medianFps,
    p10Fps: frameMetrics.p10Fps,
  });

  await test.info().attach("archive-performance-report", {
    body: JSON.stringify(
      {
        ...result,
        browserVersion: page.context().browser()?.version() ?? "unknown",
        frameBuckets: frameMetrics.oneSecondFps,
        movement: movementMetrics,
        profile: CLASSROOM_PERFORMANCE_PROFILE,
        viewport: { height: 768, width: 1366 },
      },
      null,
      2,
    ),
    contentType: "application/json",
  });
  console.log(
    `ARCHIVE_PERFORMANCE_REPORT ${JSON.stringify({
      ...result,
      browserVersion: page.context().browser()?.version() ?? "unknown",
      frameBuckets: frameMetrics.oneSecondFps,
      movement: movementMetrics,
      profile: CLASSROOM_PERFORMANCE_PROFILE,
      viewport: { height: 768, width: 1366 },
    })}`,
  );

  expect(result.failures, JSON.stringify(result, null, 2)).toEqual([]);
});

test("keeps cold district transfer and warm physical traversal inside the Classroom gate", async ({
  baseURL,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  if (!baseURL) throw new Error("Playwright baseURL is required.");

  let coldContext: BrowserContext | null = null;
  let warmContext: BrowserContext | null = null;
  try {
    coldContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const coldPage = await coldContext.newPage();
    await installArchiveInvestigationState(coldPage);
    const coldCdp = await applyClassroomPerformanceProfile(coldPage, {
      cacheDisabled: true,
    });
    const coldTransfers = createTransferTracker(coldCdp, baseURL);

    await coldPage.goto(new URL("/play/world", baseURL).toString(), {
      waitUntil: "domcontentloaded",
    });
    await expectUsableClassroomWorld(coldPage);
    const coldCanvas = coldPage.getByTestId("world-canvas").locator("canvas");
    const coldBeforeColors = await canvasColorCount(
      await coldCanvas.screenshot(),
    );
    const coldCheckpoints = await traverseDistrictForward(coldPage);
    await coldPage.waitForLoadState("networkidle");
    const coldAfterColors = await canvasColorCount(await coldCanvas.screenshot());
    expect(coldBeforeColors).toBeGreaterThan(20);
    expect(coldAfterColors).toBeGreaterThan(20);

    const coldReadiness = await readDistrictZoneReadiness(coldPage);
    const zones = Object.fromEntries(
      coldCheckpoints.map(({ reachedAtMs, zoneId }) => {
        const readiness = coldReadiness[zoneId];
        return [
          zoneId,
          {
            ready: readiness?.assetStatus !== "pending",
            readyMs: reachedAtMs,
            interactable: readiness?.interactableReady === true,
            interactiveMs: reachedAtMs,
          },
        ];
      }),
    ) as FullDistrictPerformanceReport["zones"];

    await closeContext(coldContext);
    coldContext = null;

    warmContext = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
    const warmPage = await warmContext.newPage();
    await installArchiveInvestigationState(warmPage);
    await applyClassroomPerformanceProfile(warmPage, {
      cacheDisabled: false,
    });
    await warmPage.goto(new URL("/play/world", baseURL).toString(), {
      waitUntil: "domcontentloaded",
    });
    await expectUsableClassroomWorld(warmPage);
    const warmCanvas = warmPage.getByTestId("world-canvas").locator("canvas");

    await traverseDistrictForward(warmPage);
    const returnedX = await returnDistrictToArchive(warmPage);
    expect(returnedX).toBeLessThanOrEqual(2.5);
    await warmPage.waitForLoadState("networkidle");
    await warmPage.waitForTimeout(10_000);

    const beforePosition = await readWorldPlayerPosition(warmPage);
    const warmBeforeColors = await canvasColorCount(
      await warmCanvas.screenshot(),
    );
    const frameWindowStartedAt = await resetWorldRenderSamples(warmPage);
    const measuredStartedAt = Date.now();
    const warmCheckpoints = await traverseDistrictForward(warmPage, {
      run: false,
    });
    const measuredDurationMs = 60_000;
    await warmPage.waitForTimeout(
      Math.max(0, measuredDurationMs - (Date.now() - measuredStartedAt)),
    );
    const frameMetrics = await readWorldRenderWindow(
      warmPage,
      frameWindowStartedAt,
      measuredDurationMs,
    );
    const afterPosition = await readWorldPlayerPosition(warmPage);
    const warmAfterColors = await canvasColorCount(await warmCanvas.screenshot());
    const movementDistance = Math.hypot(
      afterPosition[0] - beforePosition[0],
      afterPosition[2] - beforePosition[2],
    );
    expect(warmCheckpoints.at(-1)?.zoneId).toBe("bridge-approach");
    expect(movementDistance).toBeGreaterThan(60);
    expect(warmBeforeColors).toBeGreaterThan(20);
    expect(warmAfterColors).toBeGreaterThan(20);
    await expectUsableClassroomWorld(warmPage);

    const result = evaluateFullDistrictPerformance({
      coldCompressedBytes: coldTransfers.totalEncodedBytes(),
      zones,
      warmTraversal: {
        medianFps: frameMetrics.medianFps,
        p10Fps: frameMetrics.p10Fps,
        maxStallMs: frameMetrics.maxStallMs,
      },
    });

    const report = {
      ...result,
      browserVersion: warmPage.context().browser()?.version() ?? "unknown",
      coldCheckpoints,
      coldTransfers: coldTransfers.entries(),
      frameBuckets: frameMetrics.oneSecondFps,
      movementDistance,
      profile: CLASSROOM_PERFORMANCE_PROFILE,
      warmCheckpoints,
    };
    await testInfo.attach("full-district-performance-report", {
      body: JSON.stringify(report, null, 2),
      contentType: "application/json",
    });
    console.log(`FULL_DISTRICT_PERFORMANCE_REPORT ${JSON.stringify(report)}`);

    expect(result.failures, JSON.stringify(result, null, 2)).toEqual([]);
  } finally {
    await closeContext(coldContext);
    await closeContext(warmContext);
  }
});
