"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const WORLD_ZONE_IDS = [
  "archive-antechamber",
  "post-road-square",
  "royal-lodging-civic-area",
  "bridge-approach",
] as const;

export type WorldZoneReadinessId = (typeof WORLD_ZONE_IDS)[number];
export type ZoneAssetStatus = "pending" | "loaded" | "fallback";

export type ZoneReadinessState = Readonly<{
  assetStatus: ZoneAssetStatus;
  interactableReady: boolean;
}>;

export type ZoneReadinessSnapshot = Readonly<{
  runtimeKey: number;
  revision: number;
  zones: Readonly<Record<WorldZoneReadinessId, ZoneReadinessState>>;
  allAssetsResolved: boolean;
  allInteractablesReady: boolean;
  allReady: boolean;
}>;

export type ZoneReadinessReport = Readonly<{
  runtimeKey: number;
  zoneId: WorldZoneReadinessId;
  assetStatus: ZoneAssetStatus;
  interactableReady: boolean;
}>;

type ZoneReportInput = Omit<ZoneReadinessReport, "runtimeKey" | "zoneId">;
type ZoneReporter = (report: ZoneReportInput) => void;

function deriveSnapshot(
  runtimeKey: number,
  revision: number,
  zones: ZoneReadinessSnapshot["zones"],
): ZoneReadinessSnapshot {
  const states = WORLD_ZONE_IDS.map((zoneId) => zones[zoneId]);
  const allAssetsResolved = states.every(
    ({ assetStatus }) => assetStatus !== "pending",
  );
  const allInteractablesReady = states.every(
    ({ interactableReady }) => interactableReady,
  );

  return Object.freeze({
    runtimeKey,
    revision,
    zones: Object.freeze(zones),
    allAssetsResolved,
    allInteractablesReady,
    allReady: allAssetsResolved && allInteractablesReady,
  });
}

export function createZoneReadinessSnapshot(
  runtimeKey: number,
): ZoneReadinessSnapshot {
  const zones = Object.fromEntries(
    WORLD_ZONE_IDS.map((zoneId) => [
      zoneId,
      Object.freeze({ assetStatus: "pending", interactableReady: false }),
    ]),
  ) as Record<WorldZoneReadinessId, ZoneReadinessState>;

  return deriveSnapshot(runtimeKey, 0, zones);
}

function nextAssetStatus(
  current: ZoneAssetStatus,
  reported: ZoneAssetStatus,
): ZoneAssetStatus {
  if (reported === "pending" || current === "fallback") return current;
  if (reported === "fallback") return "fallback";
  return current === "pending" ? "loaded" : current;
}

export function applyZoneReadinessReport(
  snapshot: ZoneReadinessSnapshot,
  report: ZoneReadinessReport,
): ZoneReadinessSnapshot {
  if (report.runtimeKey !== snapshot.runtimeKey) return snapshot;

  const current = snapshot.zones[report.zoneId];
  const assetStatus = nextAssetStatus(current.assetStatus, report.assetStatus);
  const interactableReady =
    current.interactableReady || report.interactableReady;

  if (
    current.assetStatus === assetStatus &&
    current.interactableReady === interactableReady
  ) {
    return snapshot;
  }

  return deriveSnapshot(snapshot.runtimeKey, snapshot.revision + 1, {
    ...snapshot.zones,
    [report.zoneId]: Object.freeze({ assetStatus, interactableReady }),
  });
}

const ZoneReadinessContext = createContext<
  ((report: Omit<ZoneReadinessReport, "runtimeKey">) => void) | null
>(null);

export function ZoneReadinessRegistry({
  children,
  onChange,
  runtimeKey,
}: Readonly<{
  children: ReactNode;
  onChange: (snapshot: ZoneReadinessSnapshot) => void;
  runtimeKey: number;
}>) {
  const [snapshot, setSnapshot] = useState(() =>
    createZoneReadinessSnapshot(runtimeKey),
  );

  if (snapshot.runtimeKey !== runtimeKey) {
    setSnapshot(createZoneReadinessSnapshot(runtimeKey));
  }

  useEffect(() => {
    onChange(snapshot);
  }, [onChange, snapshot]);

  const report = useCallback(
    (next: Omit<ZoneReadinessReport, "runtimeKey">) => {
      setSnapshot((current) =>
        applyZoneReadinessReport(current, { ...next, runtimeKey }),
      );
    },
    [runtimeKey],
  );

  return (
    <ZoneReadinessContext.Provider value={report}>
      {children}
    </ZoneReadinessContext.Provider>
  );
}

export function useZoneReadinessReporter(
  zoneId: WorldZoneReadinessId,
): ZoneReporter {
  const report = useContext(ZoneReadinessContext);

  if (!report) {
    throw new Error(
      "useZoneReadinessReporter must be used inside ZoneReadinessRegistry.",
    );
  }

  return useMemo(
    () => (next: ZoneReportInput) => report({ ...next, zoneId }),
    [report, zoneId],
  );
}

export function ZoneReadinessSignal({
  assetStatus = "loaded",
  interactableReady = true,
  zoneId,
}: Readonly<{
  assetStatus?: Exclude<ZoneAssetStatus, "pending">;
  interactableReady?: boolean;
  zoneId: WorldZoneReadinessId;
}>) {
  const report = useZoneReadinessReporter(zoneId);

  useEffect(() => {
    report({ assetStatus, interactableReady });
  }, [assetStatus, interactableReady, report]);

  return null;
}
