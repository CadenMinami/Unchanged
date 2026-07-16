import { expect, test } from "@playwright/test";

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

test("a novice can complete the deterministic case from context to debrief", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/play");

  await expect(page.getByRole("heading", { name: "France is in revolution" })).toBeVisible();
  for (let step = 0; step < 5; step += 1) {
    await page.getByRole("button", { name: "Continue context" }).click();
  }
  await page.getByRole("button", { name: "Open temporal fracture" }).click();
  await expect(page.getByRole("heading", { name: "The carriage passed Varennes." })).toBeVisible();
  await page.getByRole("button", { name: "Confirm case mission" }).click();
  await page.getByRole("link", { name: "Use non-spatial investigation" }).click();

  await expect(page.getByRole("heading", { name: "Find the broken link." })).toBeVisible();
  for (const itemId of ["E6A", "E6B", "E6C", "FO1", "FO2", "FO3", "E1", "E2", "E3", "E4", "E5", "E7"]) {
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

  await expect(page.getByRole("heading", { name: "Build one defensible explanation." })).toBeVisible();
  await page.getByRole("button", { name: /Select condition: Unfinished constitutional settlement/i }).click();
  await page.getByRole("button", { name: /Select condition: Municipal officers, residents/i }).click();
  for (const node of causalNodes) {
    await page.getByRole("button", { name: `Place ${node.label}` }).click();
  }
  for (const [fromNodeId, verb, toNodeId] of causalEdges) {
    await page.getByLabel("Cause", { exact: true }).selectOption(fromNodeId);
    await page.getByLabel("Relationship", { exact: true }).selectOption(verb);
    await page.getByLabel("Effect", { exact: true }).selectOption(toNodeId);
    await page.getByRole("button", { name: "Test causal link" }).click();
  }

  await page.getByLabel(/Later records used competing political framings/i).check();
  for (const uncertainty of await page.getByRole("checkbox").all()) {
    await uncertainty.check();
  }
  const argument =
    "The corrected route information enabled Drouet's pursuit and warning, but local civic action and the unsettled constitutional settlement also shaped the detention and its political meaning. The sources do not settle every private motive or make later outcomes inevitable.";
  await page.getByLabel("Argument in your own words").fill(argument);
  await page.getByRole("button", { name: "Save and submit Case Brief" }).click();
  await expect(page.getByRole("heading", { name: "Repair ready" })).toBeVisible();
  await page.getByRole("link", { name: "Review timeline repair" }).click();

  await expect(page.getByRole("heading", { name: "Restore the link. Preserve the uncertainty." })).toBeVisible();
  await page.getByLabel("Reduced motion").check();
  await expect(page.getByText("In Drouet's report, the route information enabled him and Guillaume to travel by side roads toward Varennes.")).toBeVisible();
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
  await page.getByRole("button", { name: "Restore passage control and inspection" }).click();
  await page.getByRole("button", { name: "Place the travelers under guard" }).click();
  await page.getByRole("button", { name: "Complete reconstruction" }).click();
  await page.getByRole("link", { name: "Open learning summary" }).click();

  await expect(page.getByRole("heading", { name: "Case reconstructed." })).toBeVisible();
  await expect(page.getByText(argument)).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  const finalState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("history-unbroken:varennes:state") ?? "null"),
  );
  expect(finalState.state.phase).toBe("debrief");
  expect(finalState.state.repairCompleted).toBe(true);
});
