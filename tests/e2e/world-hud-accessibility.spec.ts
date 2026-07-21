import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { installArchiveInvestigationState } from "./helpers/performance-profile";

const DRAMATIZATION_DISCLOSURE =
  "Authored dramatization; not testimony or evidence.";

const viewports = [
  { label: "narrow mobile", width: 320, height: 700 },
  { label: "mobile", width: 390, height: 844 },
  { label: "desktop", width: 1280, height: 720 },
] as const;

const classroomZones = [
  {
    prompt: /inspect drouet account table/i,
    spawnId: "SPAWN-ARCHIVE-ENTRY",
    zoneId: "archive-antechamber",
  },
  {
    prompt: /inspect drouet station/i,
    spawnId: "SPAWN-POST-ROAD-ENTRY",
    zoneId: "post-road-square",
  },
  {
    prompt: /inspect louis declaration/i,
    spawnId: "SPAWN-CIVIC-ENTRY",
    zoneId: "royal-lodging-civic-area",
  },
  {
    prompt: /inspect passage and detention dossier/i,
    spawnId: "SPAWN-BRIDGE-ENTRY",
    zoneId: "bridge-approach",
  },
] as const;

function spatialSessionFor(
  zone: (typeof classroomZones)[number],
): string {
  return JSON.stringify({
    spatialSessionVersion: "1.0.0",
    caseId: "varennes",
    caseVersion: "1.0.3",
    sceneManifestVersion: "1.3.0",
    mode: "spatial",
    lastSafeSpawn: {
      zoneId: zone.zoneId,
      spawnId: zone.spawnId,
    },
    discoveredZoneIds: classroomZones.map(({ zoneId }) => zoneId),
    guidanceSetting: "subtle",
    graphicsTier: "classroom",
  });
}

async function expectNoAutomaticViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.map((node) => node.target.join(" ")),
    })),
  ).toEqual([]);
}

async function installClassroomUnsupportedPointerLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: 2,
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "requestPointerLock", {
      configurable: true,
      value: undefined,
    });
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
  });
}

async function expectInsideViewport(
  locator: Locator,
  viewport: Readonly<{ width: number; height: number }>,
): Promise<void> {
  const bounds = await locator.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}

async function expectPairwiseSeparation(
  controls: ReadonlyArray<readonly [string, Locator]>,
): Promise<void> {
  const bounds = await Promise.all(
    controls.map(async ([name, locator]) => {
      await expect(locator, `${name} must remain visible`).toBeVisible();
      const box = await locator.boundingBox();
      expect(box, `${name} must have layout bounds`).not.toBeNull();
      return [name, box!] as const;
    }),
  );

  for (let left = 0; left < bounds.length; left += 1) {
    for (let right = left + 1; right < bounds.length; right += 1) {
      const [leftName, leftBounds] = bounds[left]!;
      const [rightName, rightBounds] = bounds[right]!;
      const overlaps =
        leftBounds.x < rightBounds.x + rightBounds.width &&
        leftBounds.x + leftBounds.width > rightBounds.x &&
        leftBounds.y < rightBounds.y + rightBounds.height &&
        leftBounds.y + leftBounds.height > rightBounds.y;
      expect(overlaps, `${leftName} overlaps ${rightName}`).toBe(false);
    }
  }
}

for (const viewport of viewports) {
  test(`keeps ${viewport.label} Classroom HUD and camera settings separated`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await installClassroomUnsupportedPointerLock(page);
    await page.goto("/play/world");

    const status = page.locator('section[role="status"]');
    await expect(status).toContainText(/reconstruction ready/i, {
      timeout: 15_000,
    });
    await expect(status).toContainText(
      /right-drag to look.*keyboard remains available/i,
    );
    await expect(
      page.getByLabel("Graphics quality: classroom"),
    ).toBeVisible();

    const prompt = page.getByRole("button", {
      name: /inspect drouet account table/i,
    });
    const journal = page.getByRole("button", { name: /open route journal/i });
    const route = page.getByRole("navigation", {
      name: /reconstruction route/i,
    });
    const sound = page.getByRole("button", { name: /enable ambient sound/i });
    const settingsButton = page.getByRole("button", {
      name: /open camera settings/i,
    });
    const quality = page.getByLabel("Graphics quality: classroom");

    await expectPairwiseSeparation([
      ["status", status],
      ["prompt", prompt],
      ["journal", journal],
      ["route", route],
      ["sound", sound],
      ["camera settings control", settingsButton],
      ["graphics quality", quality],
    ]);
    for (const locator of [
      status,
      prompt,
      journal,
      route,
      sound,
      settingsButton,
      quality,
    ]) {
      await expectInsideViewport(locator, viewport);
    }

    await expect(
      page.getByText(DRAMATIZATION_DISCLOSURE).filter({ visible: true }),
    ).toBeVisible();
    await settingsButton.click();

    const settings = page.getByRole("dialog", { name: /camera settings/i });
    await expect(settings).toBeVisible();
    await expect(status).toBeHidden();
    await expectPairwiseSeparation([
      ["camera settings dialog", settings],
      ["prompt", prompt],
      ["journal", journal],
      ["route", route],
      ["sound", sound],
      ["camera settings control", settingsButton],
      ["graphics quality", quality],
    ]);
    await expectInsideViewport(settings, viewport);
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      )
      .toBe(true);

    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expect(status).toBeVisible();
    await expect(settingsButton).toBeFocused();
  });
}

test("keeps explicit provenance labels visible in forced colors", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await installClassroomUnsupportedPointerLock(page);
  await installArchiveInvestigationState(page, {
    deviceMemoryGb: 2,
    hardwareConcurrency: 2,
    spatialSession: spatialSessionFor(classroomZones[0]),
    testMode: true,
  });
  await page.goto("/play/world");

  const prompt = page.getByRole("button", {
    name: /inspect drouet account table/i,
  });
  await expect(prompt).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText(DRAMATIZATION_DISCLOSURE).filter({ visible: true }),
  ).toBeVisible();
  await prompt.click();

  const evidenceDialog = page.getByRole("dialog", {
    name: /drouet's report to the national assembly/i,
  });
  await expect(evidenceDialog).toBeVisible();
  await expect(
    evidenceDialog.getByText("Verified historical record", { exact: true }),
  ).toBeVisible();
  await expectNoAutomaticViolations(page);
});

test("keeps every Classroom zone prompt visible, unobscured, and accessible", async ({
  page,
}) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await installClassroomUnsupportedPointerLock(page);
  await installArchiveInvestigationState(page, {
    deviceMemoryGb: 2,
    hardwareConcurrency: 2,
    spatialSession: spatialSessionFor(classroomZones[0]),
    testMode: true,
  });

  for (const [index, zone] of classroomZones.entries()) {
    if (index > 0) {
      await page.evaluate((serialized) => {
        window.localStorage.setItem(
          "history-unbroken:varennes:spatial-session",
          serialized,
        );
      }, spatialSessionFor(zone));
    }
    await page.goto("/play/world");

    await expect(
      page.locator('section[role="status"]'),
    ).toContainText(/reconstruction ready/i, { timeout: 15_000 });
    await expect(page.getByLabel("Graphics quality: classroom")).toBeVisible();
    const prompt = page.getByRole("button", { name: zone.prompt });
    await expect(prompt).toBeVisible();
    await expectInsideViewport(prompt, viewport);
    expect(
      await prompt.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const topmost = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2,
        );
        return topmost === element || element.contains(topmost);
      }),
      `${zone.zoneId} prompt must be topmost at its center`,
    ).toBe(true);
    await expectNoAutomaticViolations(page);

    if (zone.zoneId === "post-road-square") continue;
    await prompt.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectNoAutomaticViolations(page);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(prompt).toBeFocused();
  }
});
