import { describe, expect, it } from "vitest";

import {
  evaluateArchivePerformance,
  evaluateFullDistrictPerformance,
  FULL_DISTRICT_PERFORMANCE_THRESHOLDS,
  FULL_DISTRICT_ZONE_IDS,
  PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS,
  type FullDistrictPerformanceReport,
  type PhaseOneArchivePerformanceReport,
} from "@/lib/world/performance-gate";

const PASSING_REPORT: PhaseOneArchivePerformanceReport = {
  initialCompressedBytes: 15_000_000,
  interactiveMs: 8_000,
  medianFps: 30,
  p10Fps: 24,
  maxPostLoadStallMs: 250,
  canvasNonBlank: true,
};

const NUMERIC_METRICS = [
  {
    metric: "initialCompressedBytes",
    label: "Initial compressed transfer",
  },
  { metric: "interactiveMs", label: "Archive interactivity" },
  { metric: "medianFps", label: "Median frame rate" },
  { metric: "p10Fps", label: "10th-percentile frame rate" },
  { metric: "maxPostLoadStallMs", label: "Maximum post-load stall" },
] as const;

const INVALID_NUMBERS = [
  { value: Number.NaN, display: "NaN" },
  { value: Number.POSITIVE_INFINITY, display: "Infinity" },
  { value: Number.NEGATIVE_INFINITY, display: "-Infinity" },
  { value: -1, display: "-1" },
] as const;

const INVALID_METRIC_CASES = NUMERIC_METRICS.flatMap(({ metric, label }) =>
  INVALID_NUMBERS.map(({ value, display }) => ({
    metric,
    label,
    value,
    display,
  })),
);

describe("Phase 1 archive performance gate", () => {
  it("passes a report exactly at every approved threshold", () => {
    expect(evaluateArchivePerformance(PASSING_REPORT)).toEqual({
      passed: true,
      metrics: {
        initialCompressedBytes: {
          actual: 15_000_000,
          threshold: 15_000_000,
          comparison: "at_most",
          valid: true,
          passed: true,
        },
        interactiveMs: {
          actual: 8_000,
          threshold: 8_000,
          comparison: "at_most",
          valid: true,
          passed: true,
        },
        medianFps: {
          actual: 30,
          threshold: 30,
          comparison: "at_least",
          valid: true,
          passed: true,
        },
        p10Fps: {
          actual: 24,
          threshold: 24,
          comparison: "at_least",
          valid: true,
          passed: true,
        },
        maxPostLoadStallMs: {
          actual: 250,
          threshold: 250,
          comparison: "at_most",
          valid: true,
          passed: true,
        },
        canvasNonBlank: {
          actual: true,
          expected: true,
          comparison: "equals",
          valid: true,
          passed: true,
        },
      },
      failures: [],
    });
  });

  it("reports every failed metric in a stable human-readable order", () => {
    const result = evaluateArchivePerformance({
      initialCompressedBytes:
        PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS.initialCompressedBytes + 1,
      interactiveMs:
        PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS.interactiveMs + 1,
      medianFps: PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS.medianFps - 1,
      p10Fps: PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS.p10Fps - 1,
      maxPostLoadStallMs:
        PHASE_ONE_ARCHIVE_PERFORMANCE_THRESHOLDS.maxPostLoadStallMs + 1,
      canvasNonBlank: false,
    });

    expect(result.passed).toBe(false);
    expect(
      Object.fromEntries(
        Object.entries(result.metrics).map(([name, metric]) => [
          name,
          metric.passed,
        ]),
      ),
    ).toEqual({
      initialCompressedBytes: false,
      interactiveMs: false,
      medianFps: false,
      p10Fps: false,
      maxPostLoadStallMs: false,
      canvasNonBlank: false,
    });
    expect(result.failures).toEqual([
      "Initial compressed transfer must be at most 15 MB (15000000 bytes); received 15000001 bytes.",
      "Archive interactivity must be at most 8000 ms; received 8001 ms.",
      "Median frame rate must be at least 30 FPS; received 29 FPS.",
      "10th-percentile frame rate must be at least 24 FPS; received 23 FPS.",
      "Maximum post-load stall must be at most 250 ms; received 251 ms.",
      "Canvas must be nonblank; received a blank canvas.",
    ]);
  });

  it.each(INVALID_METRIC_CASES)(
    "rejects $display for $metric",
    ({ metric, label, value, display }) => {
      const report: PhaseOneArchivePerformanceReport = {
        ...PASSING_REPORT,
        [metric]: value,
      };

      const result = evaluateArchivePerformance(report);

      expect(result.passed).toBe(false);
      expect(result.metrics[metric]).toMatchObject({
        actual: value,
        valid: false,
        passed: false,
      });
      expect(result.failures).toEqual([
        `${label} must be a finite nonnegative number; received ${display}.`,
      ]);
    },
  );

  it("is deterministic, leaves the report untouched, and freezes its result", () => {
    const report: PhaseOneArchivePerformanceReport = {
      ...PASSING_REPORT,
      medianFps: 31,
    };
    const before = structuredClone(report);

    const first = evaluateArchivePerformance(report);
    const second = evaluateArchivePerformance(report);

    expect(first).toEqual(second);
    expect(report).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.metrics)).toBe(true);
    expect(Object.isFrozen(first.failures)).toBe(true);
    expect(
      Object.values(first.metrics).every((metric) => Object.isFrozen(metric)),
    ).toBe(true);
  });
});

const PASSING_DISTRICT_REPORT: FullDistrictPerformanceReport = {
  coldCompressedBytes: 35_000_000,
  zones: {
    "archive-antechamber": {
      ready: true,
      readyMs: 0,
      interactable: true,
      interactiveMs: 0,
    },
    "post-road-square": {
      ready: true,
      readyMs: 1,
      interactable: true,
      interactiveMs: 2,
    },
    "royal-lodging-civic-area": {
      ready: true,
      readyMs: 3,
      interactable: true,
      interactiveMs: 4,
    },
    "bridge-approach": {
      ready: true,
      readyMs: 5,
      interactable: true,
      interactiveMs: 6,
    },
  },
  warmTraversal: {
    medianFps: 30,
    p10Fps: 24,
    maxStallMs: 250,
  },
};

const DISTRICT_NUMERIC_METRICS = [
  {
    path: ["coldCompressedBytes"] as const,
    label: "Cold full-district compressed transfer",
  },
  ...FULL_DISTRICT_ZONE_IDS.flatMap((zoneId) => [
    {
      path: ["zones", zoneId, "readyMs"] as const,
      label: `${zoneId} readiness time`,
    },
    {
      path: ["zones", zoneId, "interactiveMs"] as const,
      label: `${zoneId} interactivity time`,
    },
  ]),
  {
    path: ["warmTraversal", "medianFps"] as const,
    label: "Warm traversal median frame rate",
  },
  {
    path: ["warmTraversal", "p10Fps"] as const,
    label: "Warm traversal 10th-percentile frame rate",
  },
  {
    path: ["warmTraversal", "maxStallMs"] as const,
    label: "Warm traversal maximum stall",
  },
] as const;

function replaceDistrictNumericMetric(
  report: FullDistrictPerformanceReport,
  path: (typeof DISTRICT_NUMERIC_METRICS)[number]["path"],
  value: number,
): FullDistrictPerformanceReport {
  if (path[0] === "coldCompressedBytes") {
    return { ...report, coldCompressedBytes: value };
  }

  if (path[0] === "warmTraversal") {
    return {
      ...report,
      warmTraversal: { ...report.warmTraversal, [path[1]]: value },
    };
  }

  const zoneId = path[1];
  return {
    ...report,
    zones: {
      ...report.zones,
      [zoneId]: { ...report.zones[zoneId], [path[2]]: value },
    },
  };
}

describe("full-district performance gate", () => {
  it("publishes the approved thresholds and exact canonical zone order", () => {
    expect(FULL_DISTRICT_PERFORMANCE_THRESHOLDS).toEqual({
      coldCompressedBytes: 35_000_000,
      warmMedianFps: 30,
      warmP10Fps: 24,
      warmMaxStallMs: 250,
    });
    expect(FULL_DISTRICT_ZONE_IDS).toEqual([
      "archive-antechamber",
      "post-road-square",
      "royal-lodging-civic-area",
      "bridge-approach",
    ]);
  });

  it("passes a complete report exactly at every approved threshold", () => {
    const result = evaluateFullDistrictPerformance(PASSING_DISTRICT_REPORT);

    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
    expect(result.metrics.coldCompressedBytes).toMatchObject({
      actual: 35_000_000,
      threshold: 35_000_000,
      comparison: "at_most",
      valid: true,
      passed: true,
    });
    expect(Object.keys(result.metrics.zones)).toEqual(FULL_DISTRICT_ZONE_IDS);
    for (const zoneId of FULL_DISTRICT_ZONE_IDS) {
      expect(result.metrics.zones[zoneId]).toMatchObject({
        ready: { actual: true, expected: true, valid: true, passed: true },
        readyMs: { actual: expect.any(Number), valid: true, passed: true },
        interactable: {
          actual: true,
          expected: true,
          valid: true,
          passed: true,
        },
        interactiveMs: {
          actual: expect.any(Number),
          valid: true,
          passed: true,
        },
      });
    }
    expect(result.metrics.warmTraversal).toMatchObject({
      medianFps: { threshold: 30, comparison: "at_least", passed: true },
      p10Fps: { threshold: 24, comparison: "at_least", passed: true },
      maxStallMs: { threshold: 250, comparison: "at_most", passed: true },
    });
  });

  it("reports every failed requirement in a stable canonical order", () => {
    const result = evaluateFullDistrictPerformance({
      coldCompressedBytes: 35_000_001,
      zones: Object.fromEntries(
        FULL_DISTRICT_ZONE_IDS.map((zoneId) => [
          zoneId,
          {
            ready: false,
            readyMs: Number.NaN,
            interactable: false,
            interactiveMs: -1,
          },
        ]),
      ) as FullDistrictPerformanceReport["zones"],
      warmTraversal: {
        medianFps: 29,
        p10Fps: 23,
        maxStallMs: 251,
      },
    });

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      "Cold full-district compressed transfer must be at most 35 MB (35000000 bytes); received 35000001 bytes.",
      "archive-antechamber must report ready; received false.",
      "archive-antechamber readiness time must be a finite nonnegative number; received NaN.",
      "archive-antechamber must report interactable; received false.",
      "archive-antechamber interactivity time must be a finite nonnegative number; received -1.",
      "post-road-square must report ready; received false.",
      "post-road-square readiness time must be a finite nonnegative number; received NaN.",
      "post-road-square must report interactable; received false.",
      "post-road-square interactivity time must be a finite nonnegative number; received -1.",
      "royal-lodging-civic-area must report ready; received false.",
      "royal-lodging-civic-area readiness time must be a finite nonnegative number; received NaN.",
      "royal-lodging-civic-area must report interactable; received false.",
      "royal-lodging-civic-area interactivity time must be a finite nonnegative number; received -1.",
      "bridge-approach must report ready; received false.",
      "bridge-approach readiness time must be a finite nonnegative number; received NaN.",
      "bridge-approach must report interactable; received false.",
      "bridge-approach interactivity time must be a finite nonnegative number; received -1.",
      "Warm traversal median frame rate must be at least 30 FPS; received 29 FPS.",
      "Warm traversal 10th-percentile frame rate must be at least 24 FPS; received 23 FPS.",
      "Warm traversal maximum stall must be at most 250 ms; received 251 ms.",
    ]);
  });

  it.each(
    DISTRICT_NUMERIC_METRICS.flatMap(({ path, label }) =>
      INVALID_NUMBERS.map(({ value, display }) => ({
        path,
        label,
        value,
        display,
      })),
    ),
  )("rejects $display for $label", ({ path, label, value, display }) => {
    const result = evaluateFullDistrictPerformance(
      replaceDistrictNumericMetric(PASSING_DISTRICT_REPORT, path, value),
    );

    expect(result.passed).toBe(false);
    expect(result.failures).toEqual([
      `${label} must be a finite nonnegative number; received ${display}.`,
    ]);
  });

  it("rejects omitted and unexpected zone metrics without throwing", () => {
    const incompleteArchive = {
      ...PASSING_DISTRICT_REPORT.zones["archive-antechamber"],
    };
    Reflect.deleteProperty(incompleteArchive, "interactiveMs");
    const report = {
      ...PASSING_DISTRICT_REPORT,
      zones: {
        ...PASSING_DISTRICT_REPORT.zones,
        "archive-antechamber": incompleteArchive,
        "unexpected-zone": PASSING_DISTRICT_REPORT.zones["bridge-approach"],
      },
    } as unknown as FullDistrictPerformanceReport;

    const result = evaluateFullDistrictPerformance(report);

    expect(result.passed).toBe(false);
    expect(Object.keys(result.metrics.zones)).toEqual(FULL_DISTRICT_ZONE_IDS);
    expect(result.failures).toEqual([
      "archive-antechamber interactivity time is required.",
      "Unexpected district zone metric: unexpected-zone.",
    ]);
  });

  it("rejects an omitted canonical zone and warm metric without throwing", () => {
    const incompleteZones = { ...PASSING_DISTRICT_REPORT.zones };
    Reflect.deleteProperty(incompleteZones, "bridge-approach");
    const incompleteWarmTraversal = {
      ...PASSING_DISTRICT_REPORT.warmTraversal,
    };
    Reflect.deleteProperty(incompleteWarmTraversal, "p10Fps");
    const report = {
      ...PASSING_DISTRICT_REPORT,
      zones: incompleteZones,
      warmTraversal: incompleteWarmTraversal,
    } as unknown as FullDistrictPerformanceReport;

    const result = evaluateFullDistrictPerformance(report);

    expect(result.passed).toBe(false);
    expect(result.failures).toContain(
      "District zone metrics are required for bridge-approach.",
    );
    expect(result.failures).toContain(
      "Warm traversal 10th-percentile frame rate is required.",
    );
  });

  it("is deterministic, does not mutate the report, and deeply freezes its result", () => {
    const report = structuredClone(PASSING_DISTRICT_REPORT);
    const before = structuredClone(report);

    const first = evaluateFullDistrictPerformance(report);
    const second = evaluateFullDistrictPerformance(report);

    expect(first).toEqual(second);
    expect(report).toEqual(before);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.metrics)).toBe(true);
    expect(Object.isFrozen(first.metrics.zones)).toBe(true);
    expect(Object.isFrozen(first.metrics.warmTraversal)).toBe(true);
    expect(Object.isFrozen(first.failures)).toBe(true);
    for (const zoneId of FULL_DISTRICT_ZONE_IDS) {
      expect(Object.isFrozen(first.metrics.zones[zoneId])).toBe(true);
      expect(
        Object.values(first.metrics.zones[zoneId]).every((metric) =>
          Object.isFrozen(metric),
        ),
      ).toBe(true);
    }
  });
});
