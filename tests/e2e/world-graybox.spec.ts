import { expect, test } from "@playwright/test";
import sharp from "sharp";

test.use({ viewport: { width: 1280, height: 720 } });

test("renders a nonblank Varennes graybox inside the client-only world route", async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
  });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();

  const bounds = await canvas.boundingBox();
  expect(bounds?.width).toBeGreaterThan(900);
  expect(bounds?.height).toBeGreaterThan(500);

  const screenshot = await canvas.screenshot();
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

  await expect(
    page.getByRole("link", { name: /use non-spatial investigation/i }),
  ).toHaveAttribute("href", "/play/investigate");
});

test("keyboard movement changes the rendered world frame", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i);
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
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  const quality = page.locator('[aria-label^="Graphics quality:"]');
  await expect(prompt).toBeVisible();
  await expect(quality).toBeVisible();

  const promptBounds = await prompt.boundingBox();
  const qualityBounds = await quality.boundingBox();
  expect(promptBounds).not.toBeNull();
  expect(qualityBounds).not.toBeNull();
  expect(promptBounds!.y).toBeGreaterThanOrEqual(
    qualityBounds!.y + qualityBounds!.height + 12,
  );

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

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i);
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

  const drouetPrompt = page.getByRole("button", { name: /inspect drouet station/i });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyS");
  await page.keyboard.down("KeyD");
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
    await page.keyboard.up("KeyD");
    await page.keyboard.up("KeyS");
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
  await page.goto("/play/world");
  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i);

  const ambientDisclosures = page.getByText(
    /authored dramatization; not testimony or evidence/i,
  );
  await expect.poll(() => ambientDisclosures.count()).toBeGreaterThan(0);

  const caseRevisionBefore = await page.evaluate(() => {
    const saved = JSON.parse(
      window.localStorage.getItem("history-unbroken:varennes:state") ?? "null",
    ) as { state?: { revision?: number } } | null;
    return saved?.state?.revision ?? 0;
  });

  const location = page.getByRole("complementary", {
    name: /current reconstruction location/i,
  });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyS");
  await page.keyboard.down("KeyD");
  try {
    await expect(location).toContainText(/royal lodging and civic area/i, {
      timeout: 22_000,
    });
  } finally {
    await page.keyboard.up("KeyD");
    await page.keyboard.up("KeyS");
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

  await page.getByRole("link", { name: /review timeline repair/i }).click();

  await expect(page).toHaveURL(/\/play\/repair$/);
  await expect(
    page.getByRole("heading", { name: /restore the link\. preserve the uncertainty/i }),
  ).toBeVisible();
});
