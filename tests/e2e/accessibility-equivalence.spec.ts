import { expect, test, type Locator, type Page } from "@playwright/test";

const LEARNING_SESSION_STORAGE_KEY =
  "history-unbroken:varennes:learning-session";
const SPATIAL_SESSION_STORAGE_KEY =
  "history-unbroken:varennes:spatial-session";

async function advanceToModeSelection(page: Page): Promise<void> {
  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
}

async function tabTo(page: Page, target: Locator, limit = 40): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  throw new Error(`Keyboard focus did not reach ${await target.getAttribute("aria-label")}.`);
}

test("preserves reduced reading, evidence progress, and route choice across investigation modes", async ({
  page,
}) => {
  await page.goto("/play");

  await page.getByRole("checkbox", { name: "Reduced reading" }).check();
  await expect(page.getByText(/France has been in revolution since 1789/i)).toBeVisible();
  await advanceToModeSelection(page);
  await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  await prompt.click();
  const worldEvidence = page.getByRole("dialog", {
    name: /drouet's report to the national assembly/i,
  });
  await expect(worldEvidence.getByText("Source limit", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close evidence" }).click();

  await page.getByRole("link", { name: "Use non-spatial investigation" }).click();
  await expect(page).toHaveURL(/\/play\/investigate$/);
  await expect(page.getByTestId("inspect-E3")).toHaveAccessibleName(
    /Inspected Drouet's Report to the National Assembly \(E3\)/i,
  );
  await expect(
    page.locator("article").filter({ has: page.getByTestId("inspect-E3") }).getByText(
      "Source limit",
      { exact: true },
    ),
  ).toBeVisible();

  const persisted = await page.evaluate(
    ({ learningKey, spatialKey }) => ({
      learning: JSON.parse(window.localStorage.getItem(learningKey) ?? "null"),
      spatial: JSON.parse(window.localStorage.getItem(spatialKey) ?? "null"),
    }),
    {
      learningKey: LEARNING_SESSION_STORAGE_KEY,
      spatialKey: SPATIAL_SESSION_STORAGE_KEY,
    },
  );
  expect(persisted.learning.session.preferences.readingMode).toBe("reduced");
  expect(persisted.spatial.mode).toBe("non_spatial");
});

test("keeps the world evidence handoff operable by keyboard with modal focus restoration", async ({
  page,
}) => {
  await page.goto("/play");
  await advanceToModeSelection(page);

  const spatialChoice = page.getByRole("link", {
    name: "Enter 3D reconstruction",
  });
  await tabTo(page, spatialChoice);
  await page.keyboard.press("Enter");

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  await tabTo(page, prompt);
  await page.keyboard.press("Enter");

  const close = page.getByRole("button", { name: "Close evidence" });
  await expect(close).toBeFocused();
  const finalSourceLink = page.getByRole("link", { name: "Open catalog record" }).last();
  await page.keyboard.press("Shift+Tab");
  await expect(finalSourceLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(prompt).toBeFocused();

  const nonSpatialChoice = page.getByRole("link", {
    name: "Use non-spatial investigation",
  });
  await tabTo(page, nonSpatialChoice);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/play\/investigate$/);
  await expect(page.getByTestId("inspect-E3")).toHaveAccessibleName(
    /Inspected Drouet's Report to the National Assembly \(E3\)/i,
  );
});
