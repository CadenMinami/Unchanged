import { act, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  applyZoneReadinessReport,
  createZoneReadinessSnapshot,
  useZoneReadinessReporter,
  WORLD_ZONE_IDS,
  ZoneReadinessRegistry,
  type ZoneReadinessSnapshot,
} from "@/components/world/environment/zone-readiness-registry";

function Probe({
  assetStatus,
  interactableReady,
  zoneId,
}: {
  assetStatus: "loaded" | "fallback";
  interactableReady: boolean;
  zoneId: (typeof WORLD_ZONE_IDS)[number];
}) {
  const report = useZoneReadinessReporter(zoneId);

  useEffect(() => {
    report({ assetStatus, interactableReady });
  }, [assetStatus, interactableReady, report]);

  return <span>{zoneId}</span>;
}

describe("zone readiness registry", () => {
  it("starts every canonical zone pending and derives aggregate readiness", () => {
    const snapshot = createZoneReadinessSnapshot(4);

    expect(Object.keys(snapshot.zones)).toEqual(WORLD_ZONE_IDS);
    expect(snapshot.allAssetsResolved).toBe(false);
    expect(snapshot.allInteractablesReady).toBe(false);
    expect(snapshot.allReady).toBe(false);
    expect(snapshot.revision).toBe(0);
  });

  it("accepts stable monotonic reports and ignores duplicate or stale runtime reports", () => {
    const initial = createZoneReadinessSnapshot(7);
    const loaded = applyZoneReadinessReport(initial, {
      runtimeKey: 7,
      zoneId: "archive-antechamber",
      assetStatus: "loaded",
      interactableReady: true,
    });

    expect(loaded).not.toBe(initial);
    expect(loaded.revision).toBe(1);
    expect(loaded.zones["archive-antechamber"]).toEqual({
      assetStatus: "loaded",
      interactableReady: true,
    });
    expect(
      applyZoneReadinessReport(loaded, {
        runtimeKey: 7,
        zoneId: "archive-antechamber",
        assetStatus: "loaded",
        interactableReady: true,
      }),
    ).toBe(loaded);
    expect(
      applyZoneReadinessReport(loaded, {
        runtimeKey: 6,
        zoneId: "archive-antechamber",
        assetStatus: "fallback",
        interactableReady: false,
      }),
    ).toBe(loaded);
    expect(
      applyZoneReadinessReport(loaded, {
        runtimeKey: 7,
        zoneId: "archive-antechamber",
        assetStatus: "pending",
        interactableReady: false,
      }),
    ).toBe(loaded);
  });

  it("publishes once per real change and resets all zones for a new runtime key", () => {
    const onChange = vi.fn<(snapshot: ZoneReadinessSnapshot) => void>();
    const view = render(
      <ZoneReadinessRegistry onChange={onChange} runtimeKey={1}>
        <Probe
          assetStatus="fallback"
          interactableReady
          zoneId="archive-antechamber"
        />
      </ZoneReadinessRegistry>,
    );

    expect(screen.getByText("archive-antechamber")).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls.at(-1)?.[0].zones["archive-antechamber"]).toEqual({
      assetStatus: "fallback",
      interactableReady: true,
    });

    act(() => {
      view.rerender(
        <ZoneReadinessRegistry onChange={onChange} runtimeKey={2}>
          <Probe
            assetStatus="fallback"
            interactableReady
            zoneId="archive-antechamber"
          />
        </ZoneReadinessRegistry>,
      );
    });

    const resetSnapshot = onChange.mock.calls.find(
      ([snapshot]) => snapshot.runtimeKey === 2 && snapshot.revision === 0,
    )?.[0];
    expect(resetSnapshot).toBeDefined();
    expect(resetSnapshot?.zones["post-road-square"].assetStatus).toBe("pending");
  });
});
