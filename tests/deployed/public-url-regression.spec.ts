import { expect, test, type Page } from "@playwright/test";

const evidenceToPin = [
  { id: "E1", label: "Pin Louis's declaration" },
  { id: "E2", label: "Pin Travel dossier" },
  { id: "E3", label: "Pin Drouet's report" },
  { id: "E5", label: "Pin Civic response" },
  { id: "E7", label: "Pin Political reactions" },
];

const causalNodes = [
  { id: "NODE-RECOGNITION", label: "Recognition or suspicion" },
  { id: "NODE-ROUTE", label: "Accurate route information" },
  { id: "NODE-PURSUIT", label: "Redirected pursuit" },
  { id: "NODE-WARNING", label: "Warning at Varennes" },
  { id: "NODE-MOBILIZATION", label: "Local mobilization" },
  { id: "NODE-OBSTRUCTION", label: "Blocked onward passage" },
  { id: "NODE-PASSPORT", label: "Passport inspection" },
  { id: "NODE-DETENTION", label: "Guarded collective detention" },
];

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

async function runWithoutAiRequests(
  page: Page,
  operation: () => Promise<void>,
): Promise<void> {
  const aiRequests: string[] = [];
  await page.route("**/api/ai/**", async (route) => {
    aiRequests.push(route.request().url());
    await route.abort();
  });

  await operation();
  expect(aiRequests).toEqual([]);
}

async function advanceToInvestigation(page: Page): Promise<void> {
  await page.goto("/play");
  await expect(
    page.getByRole("heading", { name: "France is in revolution" }),
  ).toBeVisible();
  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
}

test("identifies the deployed case without a provider call", async ({ request }) => {
  const response = await request.get("/api/health");

  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    application: "history-unbroken",
    case: { id: "varennes" },
  });
});

test("completes the deterministic fallback case without contacting AI routes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });

  await runWithoutAiRequests(page, async () => {
    await advanceToInvestigation(page);
    await page.getByRole("link", { name: "Use non-spatial investigation" }).click();
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
    await page.getByRole("link", { name: "Open causal caseboard" }).click();

    for (const condition of [
      "Unfinished constitutional settlement",
      "Municipal officers, residents",
    ]) {
      await page.getByRole("button", {
        name: new RegExp(`Select condition: ${condition}`, "i"),
      }).click();
    }
    for (const node of causalNodes) {
      await page.getByRole("button", { name: `Place ${node.label}` }).click();
    }
    for (const [fromNodeId, verb, toNodeId] of causalEdges) {
      await page.getByLabel("Cause", { exact: true }).selectOption(fromNodeId);
      await page
        .getByLabel("Relationship", { exact: true })
        .selectOption(verb);
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
    await page.getByRole("button", { name: "Save and submit Case Brief" }).click();
    await expect(page.getByRole("heading", { name: "Repair ready" })).toBeVisible();
    await page.getByRole("link", { name: "Review timeline repair" }).click();

    for (const action of [
      "Restore Varennes route information",
      "Send the pursuit toward Varennes",
      "Warn people in Varennes",
      "Mobilize the local response",
      "Restore passage control",
      "Restore passport inspection",
      "Restore passage control and inspection",
      "Place the travelers under guard",
      "Complete reconstruction",
    ]) {
      await page.getByRole("button", { name: action }).click();
    }
    await page.getByRole("link", { name: "Open learning summary" }).click();
    await expect(
      page.getByRole("heading", { name: "Case reconstructed." }),
    ).toBeVisible();
  });
});

test("opens the 3D reconstruction and inspected evidence without contacting AI routes", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await runWithoutAiRequests(page, async () => {
    await advanceToInvestigation(page);
    await page.getByRole("link", { name: "Enter 3D reconstruction" }).click();
    await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
      timeout: 15_000,
    });

    const prompt = page.getByRole("button", {
      name: /inspect drouet account table/i,
    });
    await expect(prompt).toBeVisible();
    await prompt.click();
    await expect(
      page.getByRole("dialog", {
        name: /drouet's report to the national assembly/i,
      }),
    ).toBeVisible();
  });
});
