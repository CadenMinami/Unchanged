import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const STORAGE_KEY = "history-unbroken:varennes:state";

test.describe.configure({ mode: "serial" });

const repairStepIds = [
  "RS-01-ROUTE",
  "RS-02-PURSUIT",
  "RS-03-WARNING",
  "RS-04-MOBILIZATION",
  "RS-05-OBSTRUCTION",
  "RS-06-DETENTION",
] as const;

const stepActions = [
  "Restore Varennes route information",
  "Send the pursuit toward Varennes",
  "Warn people in Varennes",
  "Mobilize the local response",
] as const;

function repairState({
  completedActionIds = [],
  completedStepIds = [],
  phase = "repair",
}: {
  completedActionIds?: string[];
  completedStepIds?: string[];
  phase?: "case_brief" | "repair";
} = {}) {
  const revision = 64 + completedActionIds.length + completedStepIds.length;
  return {
    persistenceVersion: "1.2.0",
    savedAt: "2026-07-16T10:00:00.000Z",
    state: {
      stateVersion: "1.2.0",
      caseId: "varennes",
      caseSchemaVersion: "1.0.0",
      caseVersion: "1.0.3",
      revision,
      phase,
      completedCommandIds: Array.from(
        { length: revision },
        (_, index) => `repair-browser-${index}`,
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
      selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
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
      completedRepairActionIds: completedActionIds,
      completedRepairStepIds: completedStepIds,
      caseBrief: {
        argument:
          "The route correction enabled pursuit while collective local action shaped detention. The later future remained contingent.",
        selectedConsequenceId: "CONS-REACTION-CONTINUITY",
        selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
        submitted: true,
      },
      repairCompleted: false,
    },
  };
}

async function seedRepairState(
  page: Page,
  state: ReturnType<typeof repairState>,
): Promise<void> {
  await page.addInitScript(
    ({ key, value }) => window.localStorage.setItem(key, JSON.stringify(value)),
    { key: STORAGE_KEY, value: state },
  );
}

async function rideToAction(page: Page, accessibleName: string): Promise<void> {
  const action = page.getByRole("button", { name: accessibleName });
  await page.keyboard.down("KeyW");
  try {
    await expect(action).toBeVisible({ timeout: 8_000 });
  } finally {
    await page.keyboard.up("KeyW");
  }
}

async function rideToActionWithPointer(page: Page, accessibleName: string): Promise<void> {
  const control = page.getByRole("button", { name: "Advance pursuit" });
  await control.hover();
  await page.mouse.down();
  try {
    await expect(page.getByRole("button", { name: accessibleName })).toBeVisible({ timeout: 8_000 });
  } finally {
    await page.mouse.up();
  }
}

async function sampledCanvasColorCount(page: Page): Promise<number> {
  const canvas = page.getByTestId("pursuit-canvas").locator("canvas");
  const screenshot = await canvas.screenshot();
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const pixelStride = Math.max(
    1,
    Math.floor((info.width * info.height) / 3_000),
  );
  for (let pixel = 0; pixel < info.width * info.height; pixel += pixelStride) {
    const index = pixel * info.channels;
    colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
  }
  return colors.size;
}

test("plays the bounded pursuit through reducer-owned checkpoints", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedRepairState(page, repairState());
  await page.goto("/play/repair");

  const scene = page.getByTestId("pursuit-canvas");
  await expect(scene).toBeVisible();
  const canvas = scene.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect
    .poll(async () => (await canvas.boundingBox())?.width ?? 0)
    .toBeGreaterThan(700);
  await expect
    .poll(async () => (await canvas.boundingBox())?.height ?? 0)
    .toBeGreaterThan(300);
  await expect.poll(() => sampledCanvasColorCount(page), { timeout: 8_000 }).toBeGreaterThan(12);

  const advanceControl = page.getByRole("button", { name: "Advance pursuit" });
  await advanceControl.focus();
  await page.keyboard.down("Space");
  try {
    await expect(page.getByRole("button", { name: stepActions[0] })).toBeVisible({ timeout: 8_000 });
  } finally {
    await page.keyboard.up("Space");
  }
  await page.getByRole("button", { name: stepActions[0] }).click();

  await rideToActionWithPointer(page, stepActions[1]);
  await page.getByRole("button", { name: stepActions[1] }).click();
  await page.waitForTimeout(1_600);
  await expect(page.getByRole("button", { name: stepActions[2] })).toBeHidden();

  for (const actionName of stepActions.slice(2)) {
    await rideToAction(page, actionName);
    await page.getByRole("button", { name: actionName }).click();
  }

  await rideToAction(page, "Restore passage control");
  await page.getByRole("button", { name: "Restore passport inspection" }).click();
  await expect(
    page.getByRole("button", { name: "Restore passage control" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore passage control" }).click();
  await page
    .getByRole("button", { name: "Restore passage control and inspection" })
    .click();

  await rideToAction(page, "Place the travelers under guard");
  await expect(page.getByText(/contributed to this bounded reconstruction/i)).toBeVisible();
  await page.getByRole("button", { name: "Place the travelers under guard" }).click();
  await page.getByRole("button", { name: "Complete reconstruction" }).click();
  await expect(page.getByRole("heading", { name: "Timeline repair recorded." })).toBeVisible();
});

test("uses the same granular path in reduced-motion mode", async ({ page }) => {
  await seedRepairState(page, repairState());
  await page.goto("/play/repair");
  await page.getByLabel("Reduced motion").check();

  await expect(
    page.getByRole("heading", { name: "Reduced-motion reconstruction" }),
  ).toBeVisible();
  await expect(page.getByText(/two local actions can be completed in either order/i)).toBeVisible();
  await page.getByRole("button", { name: stepActions[0] }).click();
  await expect(page.getByRole("status")).toContainText(/step 2 of 6/i);
});

test("resumes at the next canonical checkpoint after refresh", async ({ page }) => {
  await seedRepairState(
    page,
    repairState({ completedStepIds: [...repairStepIds.slice(0, 2)] }),
  );
  await page.goto("/play/repair");
  await expect(page.getByRole("heading", { name: "Deliver the warning" })).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Deliver the warning" })).toBeVisible();
});

test("fails closed when persisted repair steps are out of order", async ({ page }) => {
  await seedRepairState(
    page,
    repairState({ completedStepIds: ["RS-02-PURSUIT"] }),
  );
  await page.goto("/play/repair");

  await expect(page.getByRole("heading", { name: "Repair locked." })).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas")).toHaveCount(0);
});

test("keeps the pursuit unavailable before the deterministic repair phase", async ({ page }) => {
  await seedRepairState(page, repairState({ phase: "case_brief" }));
  await page.goto("/play/repair");

  await expect(page.getByRole("heading", { name: "Repair locked." })).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas")).toHaveCount(0);
});

test("falls back to the same current step when the WebGL context is lost", async ({ page }) => {
  await seedRepairState(page, repairState());
  await page.goto("/play/repair");

  const canvas = page.getByTestId("pursuit-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => sampledCanvasColorCount(page), { timeout: 8_000 }).toBeGreaterThan(12);
  await canvas.evaluate((element) => {
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(page.getByText(/direct reconstruction controls/i)).toBeVisible();
  await expect(page.getByRole("button", { name: stepActions[0] })).toBeVisible();
  await page.getByRole("button", { name: stepActions[0] }).click();
  await expect(page.getByRole("status")).toContainText(/step 2 of 6/i);
  await expect(page.getByText(/direct reconstruction controls/i)).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas")).toHaveCount(0);
});

test("keeps the spatial repair controls inside a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedRepairState(page, repairState());
  await page.goto("/play/repair");

  await expect(page.getByTestId("pursuit-canvas")).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas").locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Advance pursuit" })).toBeVisible();
  const layout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    controlBounds: Array.from(
      document.querySelectorAll<HTMLElement>('[aria-label="Pursuit movement controls"] button'),
    ).map((element) => {
      const bounds = element.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, width: bounds.width };
    }),
  }));

  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.controlBounds).toHaveLength(5);
  for (const bounds of layout.controlBounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(layout.viewportWidth);
    expect(bounds.width).toBeGreaterThanOrEqual(40);
  }
});
