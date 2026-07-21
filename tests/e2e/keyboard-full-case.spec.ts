import { expect, test, type Locator, type Page } from "@playwright/test";

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

const nodeOptionIndexes = new Map(
  [...causalNodes]
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((node, index) => [node.id, index + 1]),
);
const nodeLabels = new Map(causalNodes.map((node) => [node.id, node.label]));

const relationOptionIndexes = new Map([
  ["contributed_to", 1],
  ["enabled", 2],
  ["triggered", 3],
]);

async function tabTo(page: Page, target: Locator, limit = 160): Promise<void> {
  for (let index = 0; index < limit; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }

  const targetName =
    (await target.getAttribute("aria-label")) ?? (await target.textContent())?.trim();
  throw new Error(`Keyboard focus did not reach ${targetName ?? "the target"}.`);
}

async function pressOn(page: Page, target: Locator, key: "Enter" | "Space"): Promise<void> {
  await tabTo(page, target);
  await page.keyboard.press(key);
}

async function chooseWithArrowKeys(
  page: Page,
  select: Locator,
  optionIndex: number,
  expectedValue: string,
  optionLabel: string,
): Promise<void> {
  await tabTo(page, select);
  for (let index = 0; index < optionIndex; index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  if ((await select.inputValue()) !== expectedValue) {
    await page.keyboard.type(optionLabel);
  }
  await expect(select).toHaveValue(expectedValue);
}

test("a novice can complete the deterministic case from home to debrief using only the keyboard", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "The Road That Should Have Closed" }),
  ).toBeVisible();
  await pressOn(page, page.getByRole("link", { name: "Begin investigation" }), "Enter");

  await expect(page.getByRole("heading", { name: "France is in revolution" })).toBeVisible();
  for (let step = 0; step < 5; step += 1) {
    await pressOn(page, page.getByRole("button", { name: "Continue context" }), "Enter");
  }
  await pressOn(page, page.getByRole("button", { name: "Open temporal fracture" }), "Enter");
  await expect(page.getByRole("heading", { name: "The carriage passed Varennes." })).toBeVisible();
  await pressOn(page, page.getByRole("button", { name: "Confirm case mission" }), "Enter");
  await pressOn(
    page,
    page.getByRole("link", { name: "Use non-spatial investigation" }),
    "Enter",
  );

  await expect(page.getByRole("heading", { name: "Find the broken link." })).toBeVisible();
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
    await pressOn(page, page.getByTestId(`inspect-${itemId}`), "Enter");
  }
  for (const evidence of evidenceToPin) {
    await pressOn(page, page.getByRole("button", { name: evidence.label }), "Enter");
  }

  await pressOn(page, page.getByRole("button", { name: "Record recognition finding" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Eliminate Recognition Echo" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Record route finding" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Mark Route Echo as best fit" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Record authorization finding" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Eliminate Authorization Echo" }), "Enter");
  await pressOn(page, page.getByRole("link", { name: "Open causal caseboard" }), "Enter");

  await expect(
    page.getByRole("heading", { name: "Build one defensible explanation." }),
  ).toBeVisible();
  await pressOn(
    page,
    page.getByRole("button", {
      name: /Select condition: Unfinished constitutional settlement/i,
    }),
    "Enter",
  );
  await pressOn(
    page,
    page.getByRole("button", { name: /Select condition: Municipal officers, residents/i }),
    "Enter",
  );
  for (const node of causalNodes) {
    await pressOn(page, page.getByRole("button", { name: `Place ${node.label}` }), "Enter");
  }

  const causeSelect = page.getByLabel("Cause", { exact: true });
  const relationshipSelect = page.getByLabel("Relationship", { exact: true });
  const effectSelect = page.getByLabel("Effect", { exact: true });
  for (const [fromNodeId, verb, toNodeId] of causalEdges) {
    await chooseWithArrowKeys(
      page,
      causeSelect,
      nodeOptionIndexes.get(fromNodeId)!,
      fromNodeId,
      nodeLabels.get(fromNodeId)!,
    );
    await chooseWithArrowKeys(
      page,
      relationshipSelect,
      relationOptionIndexes.get(verb)!,
      verb,
      verb.replaceAll("_", " "),
    );
    await chooseWithArrowKeys(
      page,
      effectSelect,
      nodeOptionIndexes.get(toNodeId)!,
      toNodeId,
      nodeLabels.get(toNodeId)!,
    );
    await pressOn(page, page.getByRole("button", { name: "Test causal link" }), "Enter");
  }

  await pressOn(
    page,
    page.getByLabel(/Later records used competing political framings/i),
    "Space",
  );
  const uncertaintyCheckboxes = page.getByRole("checkbox");
  await expect(uncertaintyCheckboxes).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await pressOn(page, uncertaintyCheckboxes.nth(index), "Space");
  }
  const argument =
    "The corrected route information enabled Drouet's pursuit and warning, but local civic action and the unsettled constitutional settlement also shaped the detention and its political meaning. The sources do not settle every private motive or make later outcomes inevitable.";
  const argumentInput = page.getByLabel("Argument in your own words");
  await tabTo(page, argumentInput);
  await page.keyboard.type(argument);
  await pressOn(page, page.getByRole("button", { name: "Save and submit Case Brief" }), "Enter");
  await expect(page.getByRole("heading", { name: "Repair ready" })).toBeVisible();
  await pressOn(page, page.getByRole("link", { name: "Review timeline repair" }), "Enter");

  await expect(
    page.getByRole("heading", { name: "Restore the link. Preserve the uncertainty." }),
  ).toBeVisible();
  await pressOn(page, page.getByLabel("Reduced motion"), "Space");
  await expect(
    page.getByText(
      "In Drouet's report, the route information enabled him and Guillaume to travel by side roads toward Varennes.",
    ),
  ).toBeVisible();
  for (const action of [
    "Restore Varennes route information",
    "Send the pursuit toward Varennes",
    "Warn people in Varennes",
    "Mobilize the local response",
  ]) {
    await pressOn(page, page.getByRole("button", { name: action }), "Enter");
  }
  await pressOn(page, page.getByRole("button", { name: "Restore passage control" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Restore passport inspection" }), "Enter");
  await pressOn(
    page,
    page.getByRole("button", { name: "Restore passage control and inspection" }),
    "Enter",
  );
  await pressOn(page, page.getByRole("button", { name: "Place the travelers under guard" }), "Enter");
  await pressOn(page, page.getByRole("button", { name: "Complete reconstruction" }), "Enter");
  await pressOn(page, page.getByRole("link", { name: "Open learning summary" }), "Enter");

  await expect(page.getByRole("heading", { name: "Case reconstructed." })).toBeVisible();
  await expect(page.getByText(argument)).toBeVisible();
  await expect(page.getByText("3", { exact: true }).first()).toBeVisible();

  const finalState = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("history-unbroken:varennes:state") ?? "null"),
  );
  expect(finalState.state.phase).toBe("debrief");
  expect(finalState.state.repairCompleted).toBe(true);
});
