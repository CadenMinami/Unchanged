export const PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS = Object.freeze({
  initialCompressedBytes: 15_000_000,
  interactiveMs: 8_000,
  medianFps: 30,
  p10Fps: 24,
  maxPostLoadStallMs: 250,
  canvasNonBlank: true,
} as const);

export const FULL_DISTRICT_ZONE_IDS = Object.freeze([
  "archive-antechamber",
  "post-road-square",
  "royal-lodging-civic-area",
  "bridge-approach",
] as const);

export type FullDistrictZoneId = (typeof FULL_DISTRICT_ZONE_IDS)[number];

export const FULL_DISTRICT_PERFORMANCE_THRESHOLDS = Object.freeze({
  coldCompressedBytes: 35_000_000,
  warmMedianFps: 30,
  warmP10Fps: 24,
  warmMaxStallMs: 250,
} as const);

export type PhaseOneArchivePerformanceReport = Readonly<{
  initialCompressedBytes: number;
  interactiveMs: number;
  medianFps: number;
  p10Fps: number;
  maxPostLoadStallMs: number;
  canvasNonBlank: boolean;
}>;

export type NumericPerformanceMetricResult = Readonly<{
  actual: number;
  threshold: number;
  comparison: "at_most" | "at_least";
  valid: boolean;
  passed: boolean;
}>;

export type BooleanPerformanceMetricResult = Readonly<{
  actual: boolean;
  expected: boolean;
  comparison: "equals";
  valid: boolean;
  passed: boolean;
}>;

export type PhaseOneArchivePerformanceMetricResults = Readonly<{
  initialCompressedBytes: NumericPerformanceMetricResult;
  interactiveMs: NumericPerformanceMetricResult;
  medianFps: NumericPerformanceMetricResult;
  p10Fps: NumericPerformanceMetricResult;
  maxPostLoadStallMs: NumericPerformanceMetricResult;
  canvasNonBlank: BooleanPerformanceMetricResult;
}>;

export type PhaseOneArchivePerformanceGateResult = Readonly<{
  passed: boolean;
  metrics: PhaseOneArchivePerformanceMetricResults;
  failures: readonly string[];
}>;

export type FullDistrictZonePerformanceReport = Readonly<{
  ready: boolean;
  readyMs: number;
  interactable: boolean;
  interactiveMs: number;
}>;

export type FullDistrictPerformanceReport = Readonly<{
  coldCompressedBytes: number;
  zones: Readonly<
    Record<FullDistrictZoneId, FullDistrictZonePerformanceReport>
  >;
  warmTraversal: Readonly<{
    medianFps: number;
    p10Fps: number;
    maxStallMs: number;
  }>;
}>;

export type FullDistrictZonePerformanceMetricResults = Readonly<{
  ready: BooleanPerformanceMetricResult;
  readyMs: NumericPerformanceMetricResult;
  interactable: BooleanPerformanceMetricResult;
  interactiveMs: NumericPerformanceMetricResult;
}>;

export type FullDistrictPerformanceMetricResults = Readonly<{
  coldCompressedBytes: NumericPerformanceMetricResult;
  zones: Readonly<
    Record<FullDistrictZoneId, FullDistrictZonePerformanceMetricResults>
  >;
  warmTraversal: Readonly<{
    medianFps: NumericPerformanceMetricResult;
    p10Fps: NumericPerformanceMetricResult;
    maxStallMs: NumericPerformanceMetricResult;
  }>;
}>;

export type FullDistrictPerformanceGateResult = Readonly<{
  passed: boolean;
  metrics: FullDistrictPerformanceMetricResults;
  failures: readonly string[];
}>;

function evaluateNumericMetric(
  actual: number,
  threshold: number,
  comparison: "at_most" | "at_least",
): NumericPerformanceMetricResult {
  const valid = Number.isFinite(actual) && actual >= 0;
  const passed =
    valid &&
    (comparison === "at_most" ? actual <= threshold : actual >= threshold);

  return Object.freeze({ actual, threshold, comparison, valid, passed });
}

function evaluateBooleanMetric(
  actual: boolean,
  expected: boolean,
): BooleanPerformanceMetricResult {
  return Object.freeze({
    actual,
    expected,
    comparison: "equals",
    valid: true,
    passed: actual === expected,
  });
}

function evaluateRequiredBooleanMetric(
  actual: boolean,
  expected: boolean,
): BooleanPerformanceMetricResult {
  const valid = typeof actual === "boolean";

  return Object.freeze({
    actual,
    expected,
    comparison: "equals",
    valid,
    passed: valid && actual === expected,
  });
}

function numericFailure(
  label: string,
  metric: NumericPerformanceMetricResult,
  thresholdFailure: (actual: number) => string,
): string | null {
  if (!metric.valid) {
    return `${label} must be a finite nonnegative number; received ${String(metric.actual)}.`;
  }

  return metric.passed ? null : thresholdFailure(metric.actual);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredNumericFailure(
  source: Record<string, unknown>,
  key: string,
  label: string,
  metric: NumericPerformanceMetricResult,
  thresholdFailure: (actual: number) => string,
): string | null {
  if (!hasOwn(source, key)) return `${label} is required.`;
  return numericFailure(label, metric, thresholdFailure);
}

function requiredBooleanFailure(
  source: Record<string, unknown>,
  key: string,
  label: string,
  metric: BooleanPerformanceMetricResult,
): string | null {
  if (!hasOwn(source, key)) return `${label} signal is required.`;
  if (!metric.valid) {
    return `${label} signal must be a boolean; received ${String(metric.actual)}.`;
  }
  return metric.passed
    ? null
    : `${label.replace(/ readiness$| interactivity$/, "")} must report ${key === "ready" ? "ready" : "interactable"}; received ${String(metric.actual)}.`;
}

export function evaluateArchivePerformance(
  report: PhaseOneArchivePerformanceReport,
): PhaseOneArchivePerformanceGateResult {
  const thresholds = PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS;
  const metrics = Object.freeze({
    initialCompressedBytes: evaluateNumericMetric(
      report.initialCompressedBytes,
      thresholds.initialCompressedBytes,
      "at_most",
    ),
    interactiveMs: evaluateNumericMetric(
      report.interactiveMs,
      thresholds.interactiveMs,
      "at_most",
    ),
    medianFps: evaluateNumericMetric(
      report.medianFps,
      thresholds.medianFps,
      "at_least",
    ),
    p10Fps: evaluateNumericMetric(
      report.p10Fps,
      thresholds.p10Fps,
      "at_least",
    ),
    maxPostLoadStallMs: evaluateNumericMetric(
      report.maxPostLoadStallMs,
      thresholds.maxPostLoadStallMs,
      "at_most",
    ),
    canvasNonBlank: evaluateBooleanMetric(
      report.canvasNonBlank,
      thresholds.canvasNonBlank,
    ),
  });

  const failures = Object.freeze(
    [
      numericFailure(
        "Initial compressed transfer",
        metrics.initialCompressedBytes,
        (actual) =>
          `Initial compressed transfer must be at most 15 MB (${thresholds.initialCompressedBytes} bytes); received ${String(actual)} bytes.`,
      ),
      numericFailure(
        "Archive interactivity",
        metrics.interactiveMs,
        (actual) =>
          `Archive interactivity must be at most ${thresholds.interactiveMs} ms; received ${String(actual)} ms.`,
      ),
      numericFailure("Median frame rate", metrics.medianFps, (actual) =>
        `Median frame rate must be at least ${thresholds.medianFps} FPS; received ${String(actual)} FPS.`,
      ),
      numericFailure(
        "10th-percentile frame rate",
        metrics.p10Fps,
        (actual) =>
          `10th-percentile frame rate must be at least ${thresholds.p10Fps} FPS; received ${String(actual)} FPS.`,
      ),
      numericFailure(
        "Maximum post-load stall",
        metrics.maxPostLoadStallMs,
        (actual) =>
          `Maximum post-load stall must be at most ${thresholds.maxPostLoadStallMs} ms; received ${String(actual)} ms.`,
      ),
      metrics.canvasNonBlank.passed
        ? null
        : "Canvas must be nonblank; received a blank canvas.",
    ].filter((failure): failure is string => failure !== null),
  );

  return Object.freeze({
    passed: failures.length === 0,
    metrics,
    failures,
  });
}

export function evaluateFullDistrictPerformance(
  report: FullDistrictPerformanceReport,
): FullDistrictPerformanceGateResult {
  const thresholds = FULL_DISTRICT_PERFORMANCE_THRESHOLDS;
  const rawReport: Record<string, unknown> = isRecord(report) ? report : {};
  const rawZones: Record<string, unknown> = isRecord(rawReport.zones)
    ? rawReport.zones
    : {};
  const rawWarmTraversal: Record<string, unknown> = isRecord(
    rawReport.warmTraversal,
  )
    ? rawReport.warmTraversal
    : {};

  const coldCompressedBytes = evaluateNumericMetric(
    rawReport.coldCompressedBytes as number,
    thresholds.coldCompressedBytes,
    "at_most",
  );

  const zones = Object.fromEntries(
    FULL_DISTRICT_ZONE_IDS.map((zoneId) => {
      const rawZone = isRecord(rawZones[zoneId]) ? rawZones[zoneId] : {};

      return [
        zoneId,
        Object.freeze({
          ready: evaluateRequiredBooleanMetric(rawZone.ready as boolean, true),
          readyMs: evaluateNumericMetric(rawZone.readyMs as number, 0, "at_least"),
          interactable: evaluateRequiredBooleanMetric(
            rawZone.interactable as boolean,
            true,
          ),
          interactiveMs: evaluateNumericMetric(
            rawZone.interactiveMs as number,
            0,
            "at_least",
          ),
        }),
      ];
    }),
  ) as Record<FullDistrictZoneId, FullDistrictZonePerformanceMetricResults>;

  const warmTraversal = Object.freeze({
    medianFps: evaluateNumericMetric(
      rawWarmTraversal.medianFps as number,
      thresholds.warmMedianFps,
      "at_least",
    ),
    p10Fps: evaluateNumericMetric(
      rawWarmTraversal.p10Fps as number,
      thresholds.warmP10Fps,
      "at_least",
    ),
    maxStallMs: evaluateNumericMetric(
      rawWarmTraversal.maxStallMs as number,
      thresholds.warmMaxStallMs,
      "at_most",
    ),
  });

  const failures: Array<string | null> = [
    requiredNumericFailure(
      rawReport,
      "coldCompressedBytes",
      "Cold full-district compressed transfer",
      coldCompressedBytes,
      (actual) =>
        `Cold full-district compressed transfer must be at most 35 MB (${thresholds.coldCompressedBytes} bytes); received ${String(actual)} bytes.`,
    ),
  ];

  for (const zoneId of FULL_DISTRICT_ZONE_IDS) {
    const rawZone = isRecord(rawZones[zoneId]) ? rawZones[zoneId] : null;
    const zoneMetrics = zones[zoneId];

    if (!rawZone) {
      failures.push(`District zone metrics are required for ${zoneId}.`);
      continue;
    }

    failures.push(
      requiredBooleanFailure(
        rawZone,
        "ready",
        `${zoneId} readiness`,
        zoneMetrics.ready,
      ),
      requiredNumericFailure(
        rawZone,
        "readyMs",
        `${zoneId} readiness time`,
        zoneMetrics.readyMs,
        () => "",
      ),
      requiredBooleanFailure(
        rawZone,
        "interactable",
        `${zoneId} interactivity`,
        zoneMetrics.interactable,
      ),
      requiredNumericFailure(
        rawZone,
        "interactiveMs",
        `${zoneId} interactivity time`,
        zoneMetrics.interactiveMs,
        () => "",
      ),
    );
  }

  const unexpectedZoneIds = Object.keys(rawZones)
    .filter(
      (zoneId) =>
        !FULL_DISTRICT_ZONE_IDS.includes(zoneId as FullDistrictZoneId),
    )
    .sort();
  for (const zoneId of unexpectedZoneIds) {
    failures.push(`Unexpected district zone metric: ${zoneId}.`);
  }

  failures.push(
    requiredNumericFailure(
      rawWarmTraversal,
      "medianFps",
      "Warm traversal median frame rate",
      warmTraversal.medianFps,
      (actual) =>
        `Warm traversal median frame rate must be at least ${thresholds.warmMedianFps} FPS; received ${String(actual)} FPS.`,
    ),
    requiredNumericFailure(
      rawWarmTraversal,
      "p10Fps",
      "Warm traversal 10th-percentile frame rate",
      warmTraversal.p10Fps,
      (actual) =>
        `Warm traversal 10th-percentile frame rate must be at least ${thresholds.warmP10Fps} FPS; received ${String(actual)} FPS.`,
    ),
    requiredNumericFailure(
      rawWarmTraversal,
      "maxStallMs",
      "Warm traversal maximum stall",
      warmTraversal.maxStallMs,
      (actual) =>
        `Warm traversal maximum stall must be at most ${thresholds.warmMaxStallMs} ms; received ${String(actual)} ms.`,
    ),
  );

  const stableFailures = Object.freeze(
    failures.filter((failure): failure is string => failure !== null),
  );
  const metrics = Object.freeze({
    coldCompressedBytes,
    zones: Object.freeze(zones),
    warmTraversal,
  });

  return Object.freeze({
    passed: stableFailures.length === 0,
    metrics,
    failures: stableFailures,
  });
}
