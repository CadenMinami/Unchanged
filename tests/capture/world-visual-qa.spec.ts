import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

import { loadVarennesSceneManifest } from "../../lib/world/scene-manifest";
import {
  createInitialSpatialSession,
  serializeSpatialSession,
} from "../../lib/world/spatial-session";
import { installArchiveInvestigationState } from "../e2e/helpers/performance-profile";
import { alignCameraYaw } from "../e2e/helpers/world-traversal";

const manifest = loadVarennesSceneManifest();
const requestedZoneId = process.env.HISTORY_UNBROKEN_CAPTURE_ZONE;
const captureZones = requestedZoneId
  ? manifest.zones.filter((zone) => zone.zoneId === requestedZoneId)
  : manifest.zones;

if (captureZones.length === 0) {
  throw new Error(`Unknown visual QA zone: ${requestedZoneId}.`);
}

const PROFILES = [
  {
    tier: "high",
    deviceMemoryGb: 16,
    hardwareConcurrency: 12,
    viewport: { width: 1440, height: 900 },
  },
  {
    tier: "balanced",
    deviceMemoryGb: 6,
    hardwareConcurrency: 6,
    viewport: { width: 1440, height: 900 },
  },
  {
    tier: "classroom",
    deviceMemoryGb: 4,
    hardwareConcurrency: 4,
    viewport: { width: 390, height: 844 },
  },
] as const;

type WorldSubjectTelemetry = Readonly<{
  name: string;
  present: boolean;
  projected?: boolean;
  intersectsViewport?: boolean;
  meshCount?: number;
  screenCenterNdc?: readonly [number, number, number];
  screenHeightRatio?: number;
  screenWidthRatio?: number;
  visibleMeshCount?: number;
}>;

async function readWorldSubject(
  page: Page,
  subjectName: string,
): Promise<WorldSubjectTelemetry> {
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  const serialized = await canvas.getAttribute("data-world-subjects");
  const subjects = JSON.parse(serialized ?? "null") as WorldSubjectTelemetry[];
  const subject = subjects.find(({ name }) => name === subjectName);
  if (!subject) throw new Error(`Missing world subject telemetry: ${subjectName}.`);
  return subject;
}

async function sampledColorCount(image: Buffer): Promise<number> {
  const { data, info } = await sharp(image)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  const stride = Math.max(1, Math.floor((info.width * info.height) / 3_000));
  for (let pixel = 0; pixel < info.width * info.height; pixel += stride) {
    const index = pixel * info.channels;
    colors.add(`${data[index]}:${data[index + 1]}:${data[index + 2]}`);
  }
  return colors.size;
}

function spatialSessionAt(zoneId: (typeof manifest.zones)[number]["zoneId"]): string {
  const zone = manifest.zones.find((candidate) => candidate.zoneId === zoneId);
  const spawn = zone?.safeSpawns[0];
  if (!zone || !spawn) throw new Error(`Missing visual QA spawn for ${zoneId}.`);
  return serializeSpatialSession({
    ...createInitialSpatialSession(manifest),
    discoveredZoneIds: manifest.zones.map((candidate) => candidate.zoneId),
    lastSafeSpawn: { zoneId, spawnId: spawn.spawnId },
  });
}

async function captureCanvas(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const canvas = page.getByTestId("world-canvas").locator("canvas");
  await expect(canvas).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  const outputPath = testInfo.outputPath(`${name}.png`);
  const dataUrl = await canvas.evaluate((element) => {
    if (!(element instanceof HTMLCanvasElement)) {
      throw new Error("World render target is not a canvas.");
    }
    return element.toDataURL("image/png");
  });
  const screenshot = Buffer.from(dataUrl.split(",")[1] ?? "", "base64");
  await writeFile(outputPath, screenshot);
  expect(screenshot.byteLength).toBeGreaterThan(8_000);
  expect(await sampledColorCount(screenshot)).toBeGreaterThan(20);
  await testInfo.attach(name, { path: outputPath, contentType: "image/png" });
}

async function captureViewport(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const outputPath = testInfo.outputPath(`${name}.png`);
  await page.screenshot({
    animations: "disabled",
    path: outputPath,
  });
  await testInfo.attach(name, { path: outputPath, contentType: "image/png" });
}

for (const profile of PROFILES) {
  test(`captures deterministic ${profile.tier} district and character framing`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    await page.setViewportSize(profile.viewport);
    await installArchiveInvestigationState(page, {
      deviceMemoryGb: profile.deviceMemoryGb,
      hardwareConcurrency: profile.hardwareConcurrency,
      spatialSession: spatialSessionAt(captureZones[0].zoneId),
      testMode: true,
    });

    for (const zone of captureZones) {
      await page.goto("/play/world");
      await expect(page.getByRole("status").first()).toContainText(
        /reconstruction ready/i,
        { timeout: 20_000 },
      );
      await expect(
        page.getByLabel(`Graphics quality: ${profile.tier}`),
      ).toBeVisible();
      await expect(page.getByTestId("world-canvas-shell")).toHaveAttribute(
        "data-world-zones-ready",
        "true",
      );
      await captureCanvas(
        page,
        testInfo,
        `${profile.tier}-${zone.zoneId}-medium`,
      );
      await captureViewport(
        page,
        testInfo,
        `${profile.tier}-${zone.zoneId}-viewport`,
      );

      if (
        profile.tier !== "classroom" &&
        (zone.zoneId === "archive-antechamber" ||
          zone.zoneId === "post-road-square" ||
          zone.zoneId === "royal-lodging-civic-area")
      ) {
        const canvas = page.getByTestId("world-canvas").locator("canvas");
        await expect(canvas).toHaveAttribute(
          "data-world-subjects",
          /principal-character-(?:investigator|drouet|louis)/,
          { timeout: 20_000 },
        );
        const targetYaw =
          zone.zoneId === "archive-antechamber"
            ? Math.PI / 2
            : zone.zoneId === "post-road-square"
              ? Math.atan2(-1.5, -2)
              : Math.atan2(4.5, 1.5);
        const closeSubject =
          zone.zoneId === "archive-antechamber"
            ? "investigator"
            : zone.zoneId === "post-road-square"
              ? "drouet"
              : "louis";
        await alignCameraYaw(page, targetYaw);
        await canvas.dispatchEvent("pointerdown", {
          button: 2,
          buttons: 2,
          isPrimary: true,
          pointerId: 2,
          pointerType: "mouse",
        });
        await canvas.dispatchEvent("wheel", { deltaY: -400 });
        await canvas.dispatchEvent("pointerup", {
          button: 2,
          buttons: 0,
          isPrimary: true,
          pointerId: 2,
          pointerType: "mouse",
        });
        const subjectTelemetry = await readWorldSubject(
          page,
          `principal-character-${closeSubject}`,
        );
        expect(subjectTelemetry).toMatchObject({
          present: true,
          projected: true,
          intersectsViewport: true,
        });
        expect(subjectTelemetry.screenHeightRatio).toBeGreaterThan(0.08);
        expect(subjectTelemetry.meshCount).toBeGreaterThan(0);
        expect(subjectTelemetry.visibleMeshCount).toBeGreaterThan(0);
        expect(subjectTelemetry.screenCenterNdc?.[0]).toBeGreaterThan(-0.65);
        expect(subjectTelemetry.screenCenterNdc?.[0]).toBeLessThan(0.65);
        expect(subjectTelemetry.screenCenterNdc?.[1]).toBeGreaterThan(-0.65);
        expect(subjectTelemetry.screenCenterNdc?.[1]).toBeLessThan(0.65);
        await testInfo.attach(`${profile.tier}-${closeSubject}-projection`, {
          body: JSON.stringify(subjectTelemetry, null, 2),
          contentType: "application/json",
        });
        await captureCanvas(
          page,
          testInfo,
          `${profile.tier}-${closeSubject}-close`,
        );
      }

      const nextZone = captureZones[captureZones.indexOf(zone) + 1];
      if (nextZone) {
        await page.evaluate(
          (serialized) =>
            window.localStorage.setItem(
              "history-unbroken:varennes:spatial-session",
              serialized,
            ),
          spatialSessionAt(nextZone.zoneId),
        );
      }
    }
  });
}
