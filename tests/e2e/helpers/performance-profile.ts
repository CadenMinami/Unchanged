import type { CDPSession, Page } from "@playwright/test";

const MEBABIT_BYTES = 1_000_000 / 8;

export const CLASSROOM_PERFORMANCE_PROFILE = Object.freeze({
  cpuSlowdownRate: 4,
  downloadBytesPerSecond: 9 * MEBABIT_BYTES * 0.9,
  hardwareConcurrency: 4,
  latencyMs: 60 * 2.75,
  uploadBytesPerSecond: 1.5 * MEBABIT_BYTES * 0.9,
});

export type FrameWindowMetrics = Readonly<{
  maxStallMs: number;
  medianFps: number;
  oneSecondFps: readonly number[];
  p10Fps: number;
}>;

export type WorldRenderSample = Readonly<{
  fps: number;
  timestampMs: number;
}>;

export type MovementLoopMetrics = Readonly<{
  maxDistanceFromStart: number;
  segments: number;
}>;

type ResponseReceivedEvent = Readonly<{
  requestId: string;
  response: Readonly<{ url: string }>;
}>;

type LoadingFinishedEvent = Readonly<{
  encodedDataLength: number;
  requestId: string;
}>;

const investigationState = {
  persistenceVersion: "1.2.0",
  savedAt: "2026-07-15T12:00:00.000Z",
  state: {
    stateVersion: "1.2.0",
    caseId: "varennes",
    caseSchemaVersion: "1.0.0",
    caseVersion: "1.0.3",
    revision: 2,
    phase: "investigation",
    completedCommandIds: ["performance-fracture", "performance-investigation"],
    inspectedItemIds: [],
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
} as const;

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor((sorted.length - 1) * percentileValue);
  return sorted[index] ?? 0;
}

export function summarizeWorldRenderWindow(
  samples: readonly WorldRenderSample[],
  startedAtMs: number,
  durationMs: number,
): FrameWindowMetrics {
  const endedAtMs = startedAtMs + durationMs;
  const framesPerSecond = Array.from(
    { length: Math.ceil(durationMs / 1_000) },
    () => 0,
  );
  const ordered = samples
    .filter(
      (sample) =>
        Number.isFinite(sample.timestampMs) && sample.timestampMs >= startedAtMs,
    )
    .sort((left, right) => left.timestampMs - right.timestampMs);
  const frameTimestamps: number[] = [startedAtMs];

  for (const sample of ordered) {
    if (sample.timestampMs >= endedAtMs) {
      frameTimestamps.push(sample.timestampMs);
      break;
    }
    const bucket = Math.floor((sample.timestampMs - startedAtMs) / 1_000);
    if (bucket >= 0 && bucket < framesPerSecond.length) {
      framesPerSecond[bucket] += 1;
    }
    frameTimestamps.push(sample.timestampMs);
  }

  if (frameTimestamps.length === 1 || frameTimestamps.at(-1)! < endedAtMs) {
    frameTimestamps.push(endedAtMs);
  }
  const frameDeltas = frameTimestamps.slice(1).map(
    (timestamp, index) => timestamp - (frameTimestamps[index] ?? startedAtMs),
  );

  return Object.freeze({
    maxStallMs: Math.max(0, ...frameDeltas),
    medianFps: percentile(framesPerSecond, 0.5),
    oneSecondFps: Object.freeze(framesPerSecond),
    p10Fps: percentile(framesPerSecond, 0.1),
  });
}

export async function installArchiveInvestigationState(
  page: Page,
  options: Readonly<{
    deviceMemoryGb?: number;
    hardwareConcurrency?: number;
    spatialSession?: string;
    testMode?: boolean;
  }> = {},
): Promise<void> {
  await page.addInitScript(({ savedState, setup }) => {
    Object.defineProperty(window.navigator, "deviceMemory", {
      configurable: true,
      value: setup.deviceMemoryGb,
    });
    Object.defineProperty(window.navigator, "hardwareConcurrency", {
      configurable: true,
      value: setup.hardwareConcurrency,
    });
    window.localStorage.setItem(
      "history-unbroken:varennes:state",
      JSON.stringify(savedState),
    );
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");
    window.sessionStorage.setItem(
      "history-unbroken:world-performance-telemetry",
      "1",
    );
    if (
      setup.spatialSession &&
      !window.localStorage.getItem(
        "history-unbroken:varennes:spatial-session",
      )
    ) {
      window.localStorage.setItem(
        "history-unbroken:varennes:spatial-session",
        setup.spatialSession,
      );
    }
    if (setup.testMode) {
      window.sessionStorage.setItem("history-unbroken:world-test-mode", "1");
    }
  }, {
    savedState: investigationState,
    setup: {
      deviceMemoryGb: options.deviceMemoryGb ?? 4,
      hardwareConcurrency: options.hardwareConcurrency ?? 4,
      spatialSession: options.spatialSession,
      testMode: options.testMode ?? false,
    },
  });
}

export async function applyClassroomPerformanceProfile(
  page: Page,
  options: Readonly<{ cacheDisabled?: boolean }> = {},
): Promise<CDPSession> {
  const session = await page.context().newCDPSession(page);
  await session.send("Network.enable");
  await session.send("Network.setCacheDisabled", {
    cacheDisabled: options.cacheDisabled ?? true,
  });
  await session.send("Network.emulateNetworkConditions", {
    connectionType: "cellular4g",
    downloadThroughput:
      CLASSROOM_PERFORMANCE_PROFILE.downloadBytesPerSecond,
    latency: CLASSROOM_PERFORMANCE_PROFILE.latencyMs,
    offline: false,
    uploadThroughput: CLASSROOM_PERFORMANCE_PROFILE.uploadBytesPerSecond,
  });
  await session.send("Emulation.setCPUThrottlingRate", {
    rate: CLASSROOM_PERFORMANCE_PROFILE.cpuSlowdownRate,
  });
  await session.send("Emulation.setHardwareConcurrencyOverride", {
    hardwareConcurrency:
      CLASSROOM_PERFORMANCE_PROFILE.hardwareConcurrency,
  });
  return session;
}

export function createTransferTracker(session: CDPSession, origin: string) {
  const expectedOrigin = new URL(origin).origin;
  const requestUrls = new Map<string, string>();
  const encodedBytes = new Map<string, number>();

  session.on("Network.responseReceived", (event: ResponseReceivedEvent) => {
    requestUrls.set(event.requestId, event.response.url);
  });
  session.on("Network.loadingFinished", (event: LoadingFinishedEvent) => {
    const url = requestUrls.get(event.requestId);
    if (url && new URL(url).origin === expectedOrigin) {
      encodedBytes.set(event.requestId, event.encodedDataLength);
    }
  });

  return Object.freeze({
    entries: () =>
      Object.freeze(
        [...encodedBytes.entries()]
          .map(([requestId, encodedDataLength]) => ({
            encodedDataLength,
            requestId,
            url: requestUrls.get(requestId) ?? "unknown",
          }))
          .sort((left, right) => left.requestId.localeCompare(right.requestId)),
      ),
    totalEncodedBytes: () =>
      [...encodedBytes.values()].reduce((total, bytes) => total + bytes, 0),
  });
}

export async function resetWorldRenderSamples(page: Page): Promise<number> {
  return page.evaluate(() => {
    const telemetry = (
      window as Window & {
        __historyUnbrokenWorldPerformance?: {
          samples: WorldRenderSample[];
        };
      }
    ).__historyUnbrokenWorldPerformance;
    if (!telemetry) throw new Error("World render telemetry is unavailable.");
    telemetry.samples.length = 0;
    return performance.now();
  });
}

export async function readWorldRenderWindow(
  page: Page,
  startedAtMs: number,
  durationMs: number,
): Promise<FrameWindowMetrics> {
  const samples = await page.evaluate(() => {
    const telemetry = (
      window as Window & {
        __historyUnbrokenWorldPerformance?: {
          samples: WorldRenderSample[];
        };
      }
    ).__historyUnbrokenWorldPerformance;
    if (!telemetry) throw new Error("World render telemetry is unavailable.");
    return telemetry.samples;
  });
  return summarizeWorldRenderWindow(samples, startedAtMs, durationMs);
}

export async function runArchiveMovementLoop(
  page: Page,
  durationMs: number,
): Promise<MovementLoopMetrics> {
  const keys = ["KeyW", "KeyD", "KeyS", "KeyA"] as const;
  const positionOutput = page.getByTestId("world-player-position");
  await page.waitForFunction(() => {
    const output = document.querySelector<HTMLOutputElement>(
      '[data-testid="world-player-position"]',
    );
    return Boolean(output?.dataset.position && output.dataset.position !== "[]");
  });
  const readPosition = async () =>
    JSON.parse((await positionOutput.getAttribute("data-position")) ?? "[]") as [
      number,
      number,
      number,
    ];
  const startedPosition = await readPosition();
  const startedAt = Date.now();
  let maxDistanceFromStart = 0;
  let segment = 0;

  while (Date.now() - startedAt < durationMs) {
    const key = keys[segment % keys.length];
    await page.keyboard.down(key);
    await page.waitForTimeout(850);
    await page.keyboard.up(key);
    await page.waitForTimeout(150);
    const position = await readPosition();
    maxDistanceFromStart = Math.max(
      maxDistanceFromStart,
      Math.hypot(
        position[0] - startedPosition[0],
        position[2] - startedPosition[2],
      ),
    );
    segment += 1;
  }

  return Object.freeze({ maxDistanceFromStart, segments: segment });
}
