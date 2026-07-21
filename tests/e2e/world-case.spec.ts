import { expect, test, type Locator, type Page } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 720 } });

async function moveWithPositionDiagnostics(
  page: Page,
  telemetry: Locator,
  label: string,
  keys: readonly string[],
  waitForDestination: () => Promise<void>,
): Promise<void> {
  for (const key of keys) await page.keyboard.down(key);
  try {
    try {
      await waitForDestination();
    } catch (error) {
      const finalPosition = await telemetry.getAttribute("data-position");
      throw new Error(
        `${label} ended at ${finalPosition ?? "an unknown position"}.`,
        { cause: error },
      );
    }
  } finally {
    for (const key of [...keys].reverse()) await page.keyboard.up(key);
  }
}

async function readCaseState(page: Page): Promise<unknown> {
  return page.evaluate(() => {
    const saved = window.localStorage.getItem(
      "history-unbroken:varennes:state",
    );
    return saved ? JSON.parse(saved).state : null;
  });
}

test("completes the real-entry E3-to-Drouet-to-E1-to-Louis world case path", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const initialStorageMarker = "history-unbroken:world-case-initial-storage";
    if (!window.sessionStorage.getItem(initialStorageMarker)) {
      const hadCaseState = window.localStorage.getItem(
        "history-unbroken:varennes:state",
      );
      const hadSpatialState = window.localStorage.getItem(
        "history-unbroken:varennes:spatial-session",
      );
      window.sessionStorage.setItem(
        initialStorageMarker,
        JSON.stringify({
          hadCaseState: hadCaseState !== null,
          hadSpatialState: hadSpatialState !== null,
        }),
      );
    }
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
  });
  await page.goto("/play");

  const initialStorage = await page.evaluate(() =>
    JSON.parse(
      window.sessionStorage.getItem(
        "history-unbroken:world-case-initial-storage",
      ) ?? "null",
    ),
  );
  expect(initialStorage).toEqual({
    hadCaseState: false,
    hadSpatialState: false,
  });

  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
  await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  const telemetry = page.getByTestId("world-player-position");
  await expect(telemetry).toHaveAttribute("data-position", /^\[-?\d/, {
    timeout: 15_000,
  });

  const e3Prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(e3Prompt).toBeVisible();
  await e3Prompt.click();
  await expect(
    page.getByRole("dialog", {
      name: /drouet's report to the national assembly/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/only this reviewed DOM record counts as evidence/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /close evidence/i }).click();

  const drouetPrompt = page.getByRole("button", {
    name: /inspect drouet station/i,
  });
  await moveWithPositionDiagnostics(
    page,
    telemetry,
    "Drouet traversal",
    ["ShiftLeft", "KeyW"],
    () => expect(drouetPrompt).toBeVisible({ timeout: 15_000 }),
  );
  await drouetPrompt.click();

  const drouetConversation = page.getByRole("dialog", {
    name: /conversation with drouet station/i,
  });
  await expect(drouetConversation).toBeVisible();
  const drouetEvidence = drouetConversation.getByLabel(
    /present inspected evidence/i,
  );
  await expect(drouetEvidence.locator('option[value="E3"]')).toHaveCount(1);
  await drouetEvidence.selectOption("E3");
  await drouetConversation
    .getByLabel(/question for the source station/i)
    .fill("What did the route information allow you to do?");
  await drouetConversation.getByRole("button", { name: /ask source/i }).click();
  await expect(
    drouetConversation.getByRole("article", { name: /source response/i }),
  ).toBeVisible();
  await drouetConversation
    .getByRole("button", { name: /close conversation/i })
    .click();

  const location = page.getByRole("complementary", {
    name: /current reconstruction location/i,
  });
  await moveWithPositionDiagnostics(
    page,
    telemetry,
    "Civic discovery traversal",
    ["ShiftLeft", "KeyW"],
    () =>
      expect(location).toContainText(/royal lodging and civic area/i, {
        timeout: 22_000,
      }),
  );

  await page.getByRole("button", { name: /open route journal/i }).click();
  const journal = page.getByRole("dialog", { name: /case journal/i });
  await expect(journal).toBeVisible();
  await journal
    .getByRole("button", {
      name: /return to royal lodging and civic area safe point/i,
    })
    .click();
  await expect(location).toContainText(/royal lodging and civic area/i);
  await expect(telemetry).toHaveAttribute("data-position", /^\[48(?:\.0*)?,/, {
    timeout: 15_000,
  });

  const e1Prompt = page.getByRole("button", {
    name: /inspect louis declaration/i,
  });
  await expect(e1Prompt).toBeVisible({ timeout: 12_000 });
  await e1Prompt.click();
  await expect(
    page.getByRole("dialog", { name: /louis xvi's declaration/i }),
  ).toBeVisible();
  await expect(
    page.getByText(/only this reviewed DOM record counts as evidence/i),
  ).toBeVisible();
  await page.getByRole("button", { name: /close evidence/i }).click();

  const louisPrompt = page.getByRole("button", {
    name: /inspect louis station/i,
  });
  await page
    .getByTestId("world-canvas")
    .locator("canvas")
    .click({ position: { x: 600, y: 350 } });
  await moveWithPositionDiagnostics(
    page,
    telemetry,
    "Louis traversal",
    ["ShiftLeft", "KeyW"],
    () => expect(louisPrompt).toBeVisible({ timeout: 12_000 }),
  );
  await louisPrompt.click();

  const louisConversation = page.getByRole("dialog", {
    name: /conversation with louis xvi station/i,
  });
  await expect(louisConversation).toBeVisible();
  const louisEvidence = louisConversation.getByLabel(
    /present inspected evidence/i,
  );
  const louisEvidenceOptions = await louisEvidence.locator("option").evaluateAll(
    (options) => options.map((option) => (option as HTMLOptionElement).value),
  );
  expect(louisEvidenceOptions).toEqual(["", "E1"]);
  await louisEvidence.selectOption("E1");

  const authoritativeStateBeforeLouis = await readCaseState(page);
  expect(authoritativeStateBeforeLouis).toMatchObject({
    inspectedItemIds: ["E3", "E1"],
    pinnedEvidenceIds: [],
  });
  await louisConversation
    .getByLabel(/question for the source station/i)
    .fill(
      "What does your declaration state, and what can it not prove about your motive?",
    );
  await louisConversation.getByRole("button", { name: /ask source/i }).click();
  await expect(
    louisConversation.getByRole("article", { name: /source response/i }),
  ).toBeVisible();
  await expect(
    louisConversation.getByText(/cannot be pinned or scored as evidence/i),
  ).toBeVisible();

  const authoritativeStateAfterLouis = await readCaseState(page);
  expect(authoritativeStateAfterLouis).toEqual(authoritativeStateBeforeLouis);
});
