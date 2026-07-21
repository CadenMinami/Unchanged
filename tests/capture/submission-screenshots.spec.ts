import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const outputDirectory = path.join(
  process.cwd(),
  "docs",
  "assets",
  "screenshots",
);

const expectedScreenshots = [
  "00-grounded-world.png",
  "01-fracture-opening.png",
  "02-teacher-setup.png",
  "03-evidence-interview.png",
  "04-evidence-comparison.png",
  "05-causal-caseboard.png",
  "06-hypothesis-feedback.png",
  "07-repair-sequence.png",
  "08-teacher-report.png",
] as const;
const expectedOutputEntrySet = new Set<string>([
  ...expectedScreenshots,
  "README.md",
]);

const evidenceToPin = [
  { id: "E1", label: "Pin Louis's declaration" },
  { id: "E2", label: "Pin Travel dossier" },
  { id: "E3", label: "Pin Drouet's report" },
  { id: "E5", label: "Pin Civic response" },
  { id: "E7", label: "Pin Political reactions" },
] as const;

const causalNodes = [
  { id: "NODE-RECOGNITION", label: "Recognition or suspicion" },
  { id: "NODE-ROUTE", label: "Accurate route information" },
  { id: "NODE-PURSUIT", label: "Redirected pursuit" },
  { id: "NODE-WARNING", label: "Warning at Varennes" },
  { id: "NODE-MOBILIZATION", label: "Local mobilization" },
  { id: "NODE-OBSTRUCTION", label: "Blocked onward passage" },
  { id: "NODE-PASSPORT", label: "Passport inspection" },
  { id: "NODE-DETENTION", label: "Guarded collective detention" },
] as const;

const causalEdges = [
  ["NODE-RECOGNITION", "enabled", "NODE-ROUTE"],
  ["NODE-ROUTE", "enabled", "NODE-PURSUIT"],
  ["NODE-PURSUIT", "enabled", "NODE-WARNING"],
  ["NODE-WARNING", "triggered", "NODE-MOBILIZATION"],
  ["NODE-MOBILIZATION", "enabled", "NODE-OBSTRUCTION"],
  ["NODE-MOBILIZATION", "enabled", "NODE-PASSPORT"],
  ["NODE-OBSTRUCTION", "contributed_to", "NODE-DETENTION"],
  ["NODE-PASSPORT", "contributed_to", "NODE-DETENTION"],
] as const;

async function capture(page: Page, filename: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  await page.screenshot({
    animations: "disabled",
    path: path.join(outputDirectory, filename),
  });
}

test("captures the complete submission storyboard from the real case flow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 16,
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 12,
    });
    // Keep the reproducible screenshot flow at the authored High profile.
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
  });
  await mkdir(outputDirectory, { recursive: true });
  for (const entry of await readdir(outputDirectory)) {
    if (entry.endsWith(".png")) {
      await rm(path.join(outputDirectory, entry), { force: true });
    }
  }

  await page.goto("/teacher");
  await expect(
    page.getByRole("heading", { name: "Prepare this case" }),
  ).toBeVisible();
  await capture(page, "02-teacher-setup.png");

  await page.getByRole("button", { name: "Review sample packet" }).click();
  const alignmentReview = page.getByRole("region", { name: "Alignment review" });
  await expect(alignmentReview).toBeVisible();
  await page.getByRole("button", { name: "Confirm alignment" }).click();
  await page.getByRole("link", { name: "Launch student case" }).click();

  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await expect(
    page.getByRole("heading", { name: "The carriage passed Varennes." }),
  ).toBeVisible();
  await capture(page, "01-fracture-opening.png");

  await page.getByRole("button", { name: "Confirm case mission" }).click();
  await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();
  await expect(page.getByRole("status")).toContainText(
    /reconstruction ready/i,
    { timeout: 15_000 },
  );
  await expect(page.getByLabel("Graphics quality: high")).toBeVisible();
  await capture(page, "00-grounded-world.png");

  const e3Prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await e3Prompt.click();
  await expect(
    page.getByRole("dialog", {
      name: /drouet's report to the national assembly/i,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /close evidence/i }).click();

  const drouetPrompt = page.getByRole("button", {
    name: /inspect drouet station/i,
  });
  const currentLocation = page.getByRole("complementary", {
    name: /current reconstruction location/i,
  });
  await page.keyboard.down("KeyW");
  try {
    await expect(currentLocation).toContainText(/post-road square/i, {
      timeout: 18_000,
    });
  } finally {
    await page.keyboard.up("KeyW");
  }
  await page.getByRole("button", { name: /open route journal/i }).click();
  const journal = page.getByRole("dialog", { name: /case journal/i });
  await expect(journal).toBeVisible();
  await journal
    .getByRole("button", {
      name: /return to post-road square safe point/i,
    })
    .click();
  await expect(page.getByRole("status")).toContainText(
    /reconstruction ready/i,
    { timeout: 15_000 },
  );
  await expect(drouetPrompt).toBeVisible({ timeout: 10_000 });
  await drouetPrompt.click();
  const conversation = page.getByRole("dialog", {
    name: /conversation with drouet station/i,
  });
  await conversation
    .getByLabel(/present inspected evidence/i)
    .selectOption("E3");
  await conversation
    .getByLabel(/question for the source station/i)
    .fill("What did the route information allow you to do?");
  await conversation.getByRole("button", { name: /ask source/i }).click();
  await expect(
    conversation.getByRole("article", { name: /source response/i }),
  ).toBeVisible();
  await capture(page, "03-evidence-interview.png");
  await conversation
    .getByRole("button", { name: /close conversation/i })
    .click();

  await page
    .getByRole("link", { name: /use non-spatial investigation/i })
    .click();
  await expect(
    page.getByRole("heading", { name: "Find the broken link." }),
  ).toBeVisible();

  for (const itemId of [
    "E6A",
    "E6B",
    "E6C",
    "FO1",
    "FO2",
    "FO3",
    "E1",
    "E2",
    "E3",
    "E4",
    "E5",
    "E7",
  ]) {
    await page.getByTestId(`inspect-${itemId}`).click();
  }
  for (const evidence of evidenceToPin) {
    await page.getByRole("button", { name: evidence.label }).click();
  }
  await page.getByRole("button", { name: "Record recognition finding" }).click();
  await page.getByRole("button", { name: "Eliminate Recognition Echo" }).click();
  await page.getByRole("button", { name: "Record route finding" }).click();
  await page.getByRole("button", { name: "Mark Route Echo as best fit" }).click();
  await page.getByRole("button", { name: "Record authorization finding" }).click();
  await page.getByRole("button", { name: "Eliminate Authorization Echo" }).click();
  await page
    .getByRole("heading", { name: "Reviewed evidence file" })
    .scrollIntoViewIfNeeded();
  await capture(page, "04-evidence-comparison.png");

  await page.getByRole("link", { name: "Open causal caseboard" }).click();
  await page
    .getByRole("button", {
      name: /Select condition: Unfinished constitutional settlement/i,
    })
    .click();
  await page
    .getByRole("button", {
      name: /Select condition: Municipal officers, residents/i,
    })
    .click();
  for (const node of causalNodes) {
    await page.getByRole("button", { name: `Place ${node.label}` }).click();
  }
  for (const [fromNodeId, verb, toNodeId] of causalEdges.slice(0, 4)) {
    await page.getByLabel("Cause", { exact: true }).selectOption(fromNodeId);
    await page.getByLabel("Relationship", { exact: true }).selectOption(verb);
    await page.getByLabel("Effect", { exact: true }).selectOption(toNodeId);
    await page.getByRole("button", { name: "Test causal link" }).click();
  }
  await page
    .getByRole("heading", { name: "Recorded links" })
    .scrollIntoViewIfNeeded();
  await capture(page, "05-causal-caseboard.png");

  for (const [fromNodeId, verb, toNodeId] of causalEdges.slice(4)) {
    await page.getByLabel("Cause", { exact: true }).selectOption(fromNodeId);
    await page.getByLabel("Relationship", { exact: true }).selectOption(verb);
    await page.getByLabel("Effect", { exact: true }).selectOption(toNodeId);
    await page.getByRole("button", { name: "Test causal link" }).click();
  }

  await page
    .getByLabel(/Later records used competing political framings/i)
    .check();
  for (const uncertainty of await page.getByRole("checkbox").all()) {
    await uncertainty.check();
  }
  await page.getByLabel("Argument in your own words").fill(
    "The corrected route information enabled Drouet's pursuit and warning, but local civic action and the unsettled constitutional settlement also shaped the detention and its political meaning. The sources do not settle every private motive or make later outcomes inevitable.",
  );
  await page
    .getByRole("button", { name: "Save and submit Case Brief" })
    .click();
  const feedbackHeading = page.getByRole("heading", {
    name: "AI-assisted formative feedback",
  });
  await expect(feedbackHeading).toBeVisible();
  await expect(
    page.getByText(/Authored fallback|Reasoning rubric/).first(),
  ).toBeVisible();
  await feedbackHeading.scrollIntoViewIfNeeded();
  await capture(page, "06-hypothesis-feedback.png");

  await expect(page.getByRole("heading", { name: "Repair ready" })).toBeVisible();
  await page.getByRole("link", { name: "Review timeline repair" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Restore the link. Preserve the uncertainty.",
    }),
  ).toBeVisible();
  await expect(page.getByTestId("pursuit-canvas")).toBeVisible({
    timeout: 15_000,
  });
  await page.getByTestId("pursuit-canvas").scrollIntoViewIfNeeded();
  await capture(page, "07-repair-sequence.png");

  await page.getByLabel("Reduced motion").check();
  for (const action of [
    "Restore Varennes route information",
    "Send the pursuit toward Varennes",
    "Warn people in Varennes",
    "Mobilize the local response",
  ]) {
    await page.getByRole("button", { name: action }).click();
  }
  await page.getByRole("button", { name: "Restore passage control" }).click();
  await page.getByRole("button", { name: "Restore passport inspection" }).click();
  await page
    .getByRole("button", { name: "Restore passage control and inspection" })
    .click();
  await page
    .getByRole("button", { name: "Place the travelers under guard" })
    .click();
  await page.getByRole("button", { name: "Complete reconstruction" }).click();
  await page.getByRole("link", { name: "Open learning summary" }).click();
  await page.getByRole("link", { name: "Open teacher report" }).click();
  await expect(page.getByText("Case reconstructed", { exact: true })).toBeVisible();
  await capture(page, "08-teacher-report.png");

  for (const entry of await readdir(outputDirectory)) {
    if (!expectedOutputEntrySet.has(entry)) {
      await rm(path.join(outputDirectory, entry), { force: true });
    }
  }
  await expect((await readdir(outputDirectory)).sort()).toEqual(
    [...expectedOutputEntrySet].sort(),
  );
  await expect(
    (await readdir(outputDirectory))
      .filter((entry) => entry.endsWith(".png"))
      .sort(),
  ).toEqual([...expectedScreenshots].sort());
});
