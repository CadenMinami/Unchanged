import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

test("questions Louis from E1 without changing case authority", async ({ page }) => {
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
    sceneManifestVersion: "1.1.0",
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

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i);
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
  await page
    .getByTestId("world-canvas")
    .locator("canvas")
    .click({ position: { x: 600, y: 350 } });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyD");
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
    await page.keyboard.up("KeyD");
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
  await expect(page.getByRole("status")).toContainText(/exploring/i);
  const focusedButton = page.locator("button:focus");
  await expect(focusedButton).toHaveCount(1);
  await expect(focusedButton).toHaveAccessibleName(
    /inspect louis station|open route journal/i,
  );
});
