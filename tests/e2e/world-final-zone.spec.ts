import { expect, test, type Locator, type Page } from "@playwright/test";
import sharp from "sharp";

test.use({ viewport: { width: 1280, height: 720 } });
test.setTimeout(60_000);

const FINAL_ZONE_LABEL = "Final reconstruction boundary";
const FINAL_ZONE_CAPTION =
  "The marked boundary closes this schematic teaching district.";

type PlayerPosition = [number, number, number];

async function installAutoReleasingPointerLock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let pointerLockElement: Element | null = null;
    let exitRequests = 0;

    const announceChange = () =>
      document.dispatchEvent(new Event("pointerlockchange"));
    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => pointerLockElement,
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: () => {
        exitRequests += 1;
        queueMicrotask(() => {
          pointerLockElement = null;
          announceChange();
        });
      },
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "requestPointerLock", {
      configurable: true,
      value: () => {
        pointerLockElement = document.querySelector("canvas");
        announceChange();
        return Promise.resolve();
      },
    });
    Object.defineProperty(window, "__finalZonePointerLock", {
      configurable: true,
      value: {
        snapshot: () => ({ exitRequests, locked: pointerLockElement !== null }),
      },
    });
  });
}

async function readPlayerPosition(
  telemetry: Locator,
): Promise<PlayerPosition> {
  const serialized = await telemetry.getAttribute("data-position");
  const position = JSON.parse(serialized ?? "null") as unknown;
  if (
    !Array.isArray(position) ||
    position.length !== 3 ||
    !position.every((coordinate) => Number.isFinite(coordinate))
  ) {
    throw new Error(`Invalid final-zone player position: ${serialized ?? "missing"}`);
  }
  return position as PlayerPosition;
}

test("loads the source-safe final zone with a reachable E5 prompt", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: 4,
    });
    Object.defineProperty(navigator, "hardwareConcurrency", {
      configurable: true,
      value: 4,
    });
  });
  await installAutoReleasingPointerLock(page);
  const spatialState = {
    spatialSessionVersion: "1.0.0",
    caseId: "varennes",
    caseVersion: "1.0.3",
    sceneManifestVersion: "1.3.0",
    mode: "spatial",
    lastSafeSpawn: {
      zoneId: "bridge-approach",
      spawnId: "SPAWN-BRIDGE-ENTRY",
    },
    discoveredZoneIds: [
      "archive-antechamber",
      "post-road-square",
      "royal-lodging-civic-area",
      "bridge-approach",
    ],
    guidanceSetting: "subtle",
    graphicsTier: "balanced",
  };

  const caseState = {
    persistenceVersion: "1.2.0",
    savedAt: "2026-07-19T12:00:00.000Z",
    state: {
      stateVersion: "1.2.0",
      caseId: "varennes",
      caseSchemaVersion: "1.0.0",
      caseVersion: "1.0.3",
      revision: 7,
      phase: "investigation",
      completedCommandIds: Array.from({ length: 7 }, (_, index) => `final-zone-${index}`),
      inspectedItemIds: ["E1", "E2", "E3", "E4", "E7"],
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

  await page.addInitScript(({ session, savedCaseState }) => {
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
    window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
    window.localStorage.setItem(
      "history-unbroken:varennes:spatial-session",
      JSON.stringify(session),
    );
    if (!window.localStorage.getItem("history-unbroken:varennes:state")) {
      window.localStorage.setItem(
        "history-unbroken:varennes:state",
        JSON.stringify(savedCaseState),
      );
    }
  }, { session: spatialState, savedCaseState: caseState });
  await page.goto("/play/world");

  await expect(page.getByRole("status")).toContainText(/reconstruction ready/i, {
    timeout: 15_000,
  });
  await expect(
    page.getByLabel("Graphics quality: classroom"),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", {
      name: /current reconstruction location/i,
    }),
  ).toContainText(FINAL_ZONE_LABEL);
  await expect(
    page.getByRole("complementary", {
      name: /ambient reconstruction caption/i,
    }),
  ).toContainText(FINAL_ZONE_CAPTION);

  const telemetry = page.getByTestId("world-player-position");
  await expect(telemetry).toHaveAttribute("data-position", /^\[72(?:\.0*)?,/);
  const positionBefore = await readPlayerPosition(telemetry);

  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  const screenshot = await canvas.screenshot();
  const { data: pixels, info } = await sharp(screenshot)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const pixelStride = Math.max(1, Math.floor((info.width * info.height) / 3_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += pixelStride) {
    const index = pixel * info.channels;
    colors.add(`${pixels[index]}:${pixels[index + 1]}:${pixels[index + 2]}`);
  }
  expect(colors.size).toBeGreaterThan(20);

  const dossierPrompt = page.getByRole("button", {
    name: /inspect passage and detention dossier/i,
  });
  await expect(dossierPrompt).toBeVisible();

  await page.waitForTimeout(500);
  const positionAfter = await readPlayerPosition(telemetry);
  const horizontalDrift = Math.hypot(
    positionAfter[0] - positionBefore[0],
    positionAfter[2] - positionBefore[2],
  );
  const verticalSettle = Math.abs(positionAfter[1] - positionBefore[1]);
  expect(horizontalDrift).toBeLessThan(0.02);
  expect(verticalSettle).toBeLessThan(0.1);

  await dossierPrompt.focus();
  await expect(dossierPrompt).toBeFocused();
  await page.keyboard.press("Enter");

  const evidenceDialog = page.getByRole("dialog", {
    name: /varennes civic-response dossier/i,
  });
  await expect(evidenceDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(evidenceDialog).toHaveCount(0);
  await expect(dossierPrompt).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          window.localStorage.getItem("history-unbroken:varennes:state") ??
            "null",
        ) as { state?: { inspectedItemIds?: string[] } } | null;
        return saved?.state?.inspectedItemIds ?? [];
      }),
    )
    .toContain("E5");

  await canvas.click({ position: { x: 640, y: 360 } });
  await expect(
    page.getByRole("button", { name: /open camera settings/i }),
  ).toHaveAttribute("data-pointer-lock-active", "true");
  // Pointer lock has no cursor target. Dispatching this accessible button's
  // activation exercises the same command while preserving captured state.
  await dossierPrompt.dispatchEvent("click");
  await expect(evidenceDialog).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as Window & {
            __finalZonePointerLock: {
              snapshot(): { exitRequests: number; locked: boolean };
            };
          }
        ).__finalZonePointerLock.snapshot(),
      ),
    )
    .toEqual({ exitRequests: 1, locked: false });

  await page.keyboard.press("Escape");
  await expect(evidenceDialog).toHaveCount(0);
  await expect(dossierPrompt).toBeFocused();

  await page.evaluate(() => {
    const revision = 21;
    window.localStorage.setItem(
      "history-unbroken:varennes:state",
      JSON.stringify({
        persistenceVersion: "1.2.0",
        savedAt: "2026-07-19T12:10:00.000Z",
        state: {
          stateVersion: "1.2.0",
          caseId: "varennes",
          caseSchemaVersion: "1.0.0",
          caseVersion: "1.0.3",
          revision,
          phase: "case_brief",
          completedCommandIds: Array.from(
            { length: revision },
            (_, index) => `caseboard-handoff-${index}`,
          ),
          inspectedItemIds: [
            "E1",
            "E2",
            "E3",
            "E4",
            "E5",
            "E7",
            "E6A",
            "E6B",
            "E6C",
            "FO1",
            "FO2",
            "FO3",
          ],
          completedComparisonIds: [
            "CMP-REJECT-E6A",
            "CMP-SUPPORT-E6B",
            "CMP-REJECT-E6C",
          ],
          rejectedAnomalyIds: ["E6A", "E6C"],
          activeAnomalyId: "E6B",
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
      }),
    );
  });
  await page.reload();
  await expect(page.getByTestId("world-status")).toContainText(
    /reconstruction ready/i,
    { timeout: 15_000 },
  );
  const caseboardHandoff = page.getByRole("button", {
    name: /open causal caseboard/i,
  });
  await caseboardHandoff.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: /causal caseboard/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /unable to release camera input/i }),
  ).toHaveCount(0);
});
