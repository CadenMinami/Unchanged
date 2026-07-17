import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const wcagTags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

async function expectNoAutomaticViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
  expect(
    results.violations.map((violation) => ({
      help: violation.help,
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

async function advanceToModeSelection(page: Page): Promise<void> {
  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
}

test("keeps the novice primer and route selection free of automatic WCAG A and AA violations", async ({
  page,
}) => {
  await page.goto("/play");
  await expect(page.getByRole("heading", { name: "France is in revolution" })).toBeVisible();
  await expectNoAutomaticViolations(page);

  await page.getByRole("checkbox", { name: "Reduced reading" }).check();
  await advanceToModeSelection(page);
  await expect(page.getByRole("heading", { name: "Enter the record." })).toBeVisible();
  await expectNoAutomaticViolations(page);
});

test("keeps the spatial HUD, evidence dialog, and direct archive free of automatic WCAG A and AA violations", async ({
  page,
}) => {
  await page.goto("/play");
  await advanceToModeSelection(page);
  await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  await expectNoAutomaticViolations(page);

  await prompt.click();
  await expect(
    page.getByRole("dialog", {
      name: /drouet's report to the national assembly/i,
    }),
  ).toBeVisible();
  await expectNoAutomaticViolations(page);
  await page.getByRole("button", { name: "Close evidence" }).click();

  await page.getByRole("link", { name: "Use non-spatial investigation" }).click();
  await expect(page.getByRole("heading", { name: "Find the broken link." })).toBeVisible();
  await expectNoAutomaticViolations(page);
});
