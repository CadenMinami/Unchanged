import { expect, test } from "@playwright/test";

const commandCount = 64;
const repairState = {
  persistenceVersion: "1.2.0",
  savedAt: "2026-07-14T12:00:00.000Z",
  state: {
    stateVersion: "1.2.0",
    caseId: "varennes",
    caseSchemaVersion: "1.0.0",
    caseVersion: "1.0.3",
    revision: commandCount,
    phase: "repair",
    completedCommandIds: Array.from({ length: commandCount }, (_, index) => `setup-${index}`),
    inspectedItemIds: ["E1", "E2", "E3", "E4", "E5", "E7", "E6A", "E6B", "E6C", "FO1", "FO2", "FO3"],
    completedComparisonIds: ["CMP-REJECT-E6A", "CMP-SUPPORT-E6B", "CMP-REJECT-E6C"],
    rejectedAnomalyIds: ["E6A", "E6C"],
    activeAnomalyId: "E6B",
    pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
    selectedConditionIds: ["COND-BG-001", "COND-CV-001"],
    placedCausalNodeIds: ["NODE-RECOGNITION", "NODE-ROUTE", "NODE-PURSUIT", "NODE-WARNING", "NODE-MOBILIZATION", "NODE-OBSTRUCTION", "NODE-PASSPORT", "NODE-DETENTION"],
    connectedCausalEdgeIds: ["EDGE-RECOGNITION-ROUTE", "EDGE-ROUTE-PURSUIT", "EDGE-PURSUIT-WARNING", "EDGE-WARNING-MOBILIZATION", "EDGE-MOBILIZATION-OBSTRUCTION", "EDGE-MOBILIZATION-PASSPORT", "EDGE-OBSTRUCTION-DETENTION", "EDGE-PASSPORT-DETENTION"],
    completedRepairActionIds: [],
    completedRepairStepIds: [],
    caseBrief: {
      argument: "The route correction enabled pursuit while collective local action shaped the detention. The later political future remained contingent.",
      selectedConsequenceId: "CONS-REACTION-CONTINUITY",
      selectedUncertaintyIds: ["UNC-MOTIVE", "UNC-NOT-INEVITABLE"],
      submitted: true,
    },
    repairCompleted: false,
  },
};

async function expectNoOverflow(page: import("@playwright/test").Page) {
  const layout = await page.evaluate(() => ({
    overflows: document.documentElement.scrollWidth > window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    offenders: [...document.querySelectorAll<HTMLElement>("body *")]
      .map((element) => ({
        tag: element.tagName,
        text: element.textContent?.trim().slice(0, 50) ?? "",
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      }))
      .filter((element) => element.left < 0 || element.right > window.innerWidth)
      .slice(0, 10),
  }));
  expect(layout).toEqual({
    overflows: false,
    scrollWidth: 320,
    viewportWidth: 320,
    offenders: [],
  });
}

test("repair and debrief complete at a 320px viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript((savedState) => {
    window.localStorage.setItem("history-unbroken:varennes:state", JSON.stringify(savedState));
  }, repairState);

  await page.goto("/play/repair");
  await expect(page.getByRole("heading", { name: "Restore the link. Preserve the uncertainty." })).toBeVisible();
  await expectNoOverflow(page);

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
  await page.getByRole("button", { name: "Restore passage control and inspection" }).click();
  await page.getByRole("button", { name: "Place the travelers under guard" }).click();
  await page.getByRole("button", { name: "Complete reconstruction" }).click();
  await page.getByRole("link", { name: "Open learning summary" }).click();

  await expect(page.getByRole("heading", { name: "Case reconstructed." })).toBeVisible();
  await expectNoOverflow(page);
});
