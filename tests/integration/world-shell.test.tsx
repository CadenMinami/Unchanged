import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseSessionProvider } from "@/components/case-session/case-session-provider";
import type { AmbientSoundscape } from "@/lib/audio/ambient-soundscape";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  createInitialSpatialSession,
  recordZoneVisit,
  serializeSpatialSession,
  SPATIAL_SESSION_STORAGE_KEY,
} from "@/lib/world/spatial-session";
import type { CaseState } from "@/schemas/case-state";
import type { WorldInteractionRequest } from "@/schemas/world-manifest";

let reportWorldPosition:
  | ((position: [number, number, number]) => void)
  | undefined;
let reportWorldFrame:
  | ((timestampMs: number, fps: number) => void)
  | undefined;
let reportNearbyInteraction:
  | ((request: WorldInteractionRequest | null) => void)
  | undefined;
let reportContextLost: (() => void) | undefined;
let runtimeInitialPosition: [number, number, number] | undefined;

const ambientAudioMocks = vi.hoisted(() => {
  const defaultSoundscape = {
    destroy: vi.fn(async () => undefined),
    setMuted: vi.fn(async () => undefined),
  };
  return {
    create: vi.fn<() => AmbientSoundscape>(() => defaultSoundscape),
    defaultSoundscape,
  };
});

vi.mock("@/lib/audio/ambient-soundscape", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/lib/audio/ambient-soundscape")
  >();
  return {
    ...original,
    createAmbientSoundscape: ambientAudioMocks.create,
  };
});

vi.mock("@/components/world/scene-runtime", () => ({
  SceneRuntime: (props: {
    initialPosition?: [number, number, number];
    onContextLost: () => void;
    onPerformanceSample?: (timestampMs: number, fps: number) => void;
    onPlayerPositionChange?: (position: [number, number, number]) => void;
    onNearbyInteractionChange?: (
      request: WorldInteractionRequest | null,
    ) => void;
  }) => {
    runtimeInitialPosition = props.initialPosition;
    reportContextLost = props.onContextLost;
    reportWorldFrame = props.onPerformanceSample;
    reportNearbyInteraction = props.onNearbyInteractionChange;
    reportWorldPosition = props.onPlayerPositionChange;
    return <div data-testid="scene-runtime">Rendered WebGL scene</div>;
  },
}));

import { WorldShell } from "@/components/world/world-shell";

const casePackage = loadVarennesCase();
const manifest = loadVarennesSceneManifest();

function renderShell(capabilityCheck: () => boolean, initialState?: CaseState) {
  return render(
    <CaseSessionProvider initialState={initialState} persist={false}>
      <WorldShell capabilityCheck={capabilityCheck} />
    </CaseSessionProvider>,
  );
}

describe("world runtime shell", () => {
  beforeEach(() => {
    vi.stubGlobal("AudioContext", vi.fn());
    ambientAudioMocks.create.mockReset();
    ambientAudioMocks.create.mockImplementation(
      () => ambientAudioMocks.defaultSoundscape,
    );
    ambientAudioMocks.defaultSoundscape.destroy.mockClear();
    ambientAudioMocks.defaultSoundscape.setMuted.mockClear();
    window.localStorage.clear();
    window.sessionStorage.clear();
    delete (
      window as Window & {
        __historyUnbrokenWorldPerformance?: unknown;
      }
    ).__historyUnbrokenWorldPerformance;
    reportContextLost = undefined;
    reportWorldFrame = undefined;
    reportNearbyInteraction = undefined;
    reportWorldPosition = undefined;
    runtimeInitialPosition = undefined;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fails into the non-spatial route when WebGL is unavailable", () => {
    renderShell(() => false);

    expect(screen.getByRole("heading", { name: /3d reconstruction unavailable/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /use non-spatial investigation/i }),
    ).toHaveAttribute("href", "/play/investigate");
    expect(screen.queryByTestId("scene-runtime")).toBeNull();
  });

  it("renders the scene behind an accessible ready status when WebGL is available", () => {
    renderShell(() => true);

    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/reconstruction ready/i);
    expect(
      screen.getByRole("link", { name: /use non-spatial investigation/i }),
    ).toHaveAttribute("href", "/play/investigate");
    expect(screen.getByRole("link", { name: /return to case briefing/i })).toHaveAttribute(
      "href",
      "/play",
    );
    expect(
      screen.getByRole("button", { name: /enable ambient sound/i }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("complementary", {
        name: /ambient reconstruction caption/i,
      }),
    ).toHaveTextContent(
      /the archive remains still around the open case materials.*authored dramatization; not testimony or evidence/i,
    );
  });

  it("checks WebGL capability once across ordinary shell rerenders", async () => {
    const user = userEvent.setup();
    const capabilityCheck = vi.fn(() => true);

    renderShell(capabilityCheck);
    await user.click(screen.getByRole("button", { name: "Guidance guided" }));

    expect(capabilityCheck).toHaveBeenCalledTimes(1);
  });

  it("checks WebGL capability again only when the player retries", async () => {
    const user = userEvent.setup();
    const capabilityCheck = vi
      .fn<() => boolean>()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    renderShell(capabilityCheck);
    await user.click(
      screen.getByRole("button", { name: /retry 3d reconstruction/i }),
    );

    expect(capabilityCheck).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();
  });

  it("preserves case progress through active WebGL context loss and retry", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      inspectedItemIds: ["E6A"],
    };

    renderShell(() => true, initialState);

    expect(reportContextLost).toBeTypeOf("function");
    act(() => reportContextLost?.());

    expect(
      screen.getByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/graphics context was interrupted/i)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /retry 3d reconstruction/i }),
    );
    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /open route journal/i }));

    expect(
      screen.getByRole("region", { name: /fracture records/i }),
    ).toHaveTextContent("E6A Inspected");
  });

  it("destroys enabled ambience before replacing the world after context loss", async () => {
    const user = userEvent.setup();

    renderShell(() => true);
    await user.click(
      screen.getByRole("button", { name: /enable ambient sound/i }),
    );
    expect(ambientAudioMocks.defaultSoundscape.setMuted).toHaveBeenCalledWith(false);

    act(() => reportContextLost?.());

    await waitFor(() => {
      expect(ambientAudioMocks.defaultSoundscape.destroy).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeInTheDocument();
  });

  it("ignores a rejected unmute from a destroyed soundscape after retry", async () => {
    const user = userEvent.setup();
    let rejectFirstUnmute: ((reason?: unknown) => void) | undefined;
    const firstSoundscape = {
      destroy: vi.fn(async () => undefined),
      setMuted: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectFirstUnmute = reject;
          }),
      ),
    };
    const secondSoundscape = {
      destroy: vi.fn(async () => undefined),
      setMuted: vi.fn(async () => undefined),
    };
    ambientAudioMocks.create
      .mockReturnValueOnce(firstSoundscape)
      .mockReturnValueOnce(secondSoundscape);

    renderShell(() => true);
    await user.click(
      screen.getByRole("button", { name: /enable ambient sound/i }),
    );
    act(() => reportContextLost?.());
    await waitFor(() => expect(firstSoundscape.destroy).toHaveBeenCalledTimes(1));

    await user.click(
      screen.getByRole("button", { name: /retry 3d reconstruction/i }),
    );
    await user.click(
      screen.getByRole("button", { name: /enable ambient sound/i }),
    );
    expect(
      screen.getByRole("button", { name: /mute ambient sound/i }),
    ).toBeInTheDocument();

    await act(async () => {
      rejectFirstUnmute?.(new Error("old context failed"));
      await Promise.resolve();
    });
    expect(
      screen.getByRole("button", { name: /mute ambient sound/i }),
    ).toBeInTheDocument();
    expect(secondSoundscape.destroy).not.toHaveBeenCalled();
  });

  it("lets the player choose and persist objective guidance", async () => {
    const user = userEvent.setup();

    renderShell(() => true);

    expect(
      screen.getByRole("button", { name: "Guidance subtle" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/objective \/ return to case briefing/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/follow nearby prompts, then review discoveries/i),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Guidance guided" }));

    expect(
      screen.getByRole("button", { name: "Guidance guided" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByText(/follow nearby prompts, then review discoveries/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guidance off" }));

    expect(
      screen.getByRole("button", { name: "Guidance off" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText(/objective \/ return to case briefing/i)).toBeNull();
    expect(
      screen.queryByText(/follow nearby prompts, then review discoveries/i),
    ).toBeNull();
    expect(
      JSON.parse(
        window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY) ?? "null",
      ),
    ).toMatchObject({ guidanceSetting: "off" });
  });

  it("opens the case file while required investigation work remains", () => {
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };

    renderShell(() => true, initialState);

    expect(screen.getByRole("link", { name: /open case file/i })).toHaveAttribute(
      "href",
      "/play/investigate",
    );
  });

  it("advances a completed investigation through the reducer before opening the caseboard", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
      activeAnomalyId: casePackage.solution.activeAnomalyId,
      rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    };

    renderShell(() => true, initialState);

    const control = screen.getByRole("button", { name: /build causal caseboard/i });
    await user.click(control);

    expect(screen.getByRole("dialog", { name: /causal caseboard/i })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /build one defensible explanation/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close causal caseboard/i }));

    expect(screen.queryByRole("dialog", { name: /causal caseboard/i })).toBeNull();
    expect(screen.getByRole("button", { name: /open causal caseboard/i })).toHaveFocus();
  });

  it("persists a first valid zone visit from the runtime position callback", () => {
    renderShell(() => true);

    expect(reportWorldPosition).toBeTypeOf("function");
    act(() => reportWorldPosition?.([24, 1.2, 0]));

    expect(
      screen.getByRole("complementary", {
        name: /current reconstruction location/i,
      }),
    ).toHaveTextContent(/post-road square/i);
    expect(
      JSON.parse(
        window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY) ?? "null",
      ),
    ).toMatchObject({
      discoveredZoneIds: ["archive-antechamber", "post-road-square"],
      lastSafeSpawn: {
        zoneId: "post-road-square",
        spawnId: "SPAWN-POST-ROAD-ENTRY",
      },
    });
  });

  it("restores the controller at the last authored safe spawn", () => {
    const visited = recordZoneVisit(
      manifest,
      createInitialSpatialSession(manifest),
      {
        zoneId: "post-road-square",
        spawnId: "SPAWN-POST-ROAD-ENTRY",
      },
    );
    if (!visited.accepted) throw new Error("Expected a valid post-road visit.");
    window.localStorage.setItem(
      SPATIAL_SESSION_STORAGE_KEY,
      serializeSpatialSession(visited.session),
    );

    renderShell(() => true);

    expect(runtimeInitialPosition).toEqual([24, 1.2, 0]);
    expect(
      screen.getByRole("complementary", {
        name: /current reconstruction location/i,
      }),
    ).toHaveTextContent(/post-road square/i);
  });

  it("replaces discarded persisted spatial data with the recovered session", () => {
    window.localStorage.setItem(SPATIAL_SESSION_STORAGE_KEY, "not valid json");

    renderShell(() => true);

    expect(
      JSON.parse(
        window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY) ?? "null",
      ),
    ).toEqual(createInitialSpatialSession(manifest));
  });

  it("continues with an in-memory spatial session when browser storage fails", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Storage disabled", "SecurityError");
      });

    expect(() => renderShell(() => true)).not.toThrow();
    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();

    getItem.mockRestore();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage disabled", "SecurityError");
    });

    expect(() => act(() => reportWorldPosition?.([24, 1.2, 0]))).not.toThrow();
    expect(
      screen.getByRole("complementary", {
        name: /current reconstruction location/i,
      }),
    ).toHaveTextContent(/post-road square/i);
  });

  it("exposes renderer-owned frame samples only when the performance gate opts in", () => {
    window.sessionStorage.setItem(
      "history-unbroken:world-performance-telemetry",
      "1",
    );
    renderShell(() => true);

    expect(reportWorldFrame).toBeTypeOf("function");
    act(() => {
      reportWorldFrame?.(100, 60);
      reportWorldFrame?.(116.7, 59.9);
    });

    expect(
      (
        window as Window & {
          __historyUnbrokenWorldPerformance?: {
            samples: Array<{ fps: number; timestampMs: number }>;
          };
        }
      ).__historyUnbrokenWorldPerformance?.samples,
    ).toEqual([
      { timestampMs: 100, fps: 60 },
      { timestampMs: 116.7, fps: 59.9 },
    ]);
  });

  it("opens an authorized civic station as a fixed dossier instead of a character chat", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    const civic = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "station" &&
        item.canonicalTarget.stationId === "STATION-VARENNES-CIVIC",
    );
    if (!civic) throw new Error("Missing civic station fixture.");

    renderShell(() => true, initialState);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: civic.interactableId,
        zoneId: civic.zoneId,
        interactionType: civic.interactionType,
        canonicalTarget: civic.canonicalTarget,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /inspect varennes civic response station/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /varennes civic record/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("opens Louis as a source-bounded cinematic station", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      inspectedItemIds: ["E1"],
    };
    const louis = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "station" &&
        item.canonicalTarget.stationId === "CHAR-LOUIS",
    );
    if (!louis) throw new Error("Missing Louis station fixture.");

    renderShell(() => true, initialState);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: louis.interactableId,
        zoneId: louis.zoneId,
        interactionType: louis.interactionType,
        canonicalTarget: louis.canonicalTarget,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /inspect louis station/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /conversation with louis xvi station/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "This station voices Louis's stated declaration. The source cannot establish his complete private motive, and this dramatization cannot become historical evidence.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /E1 \/ Louis's declaration/i }),
    ).toBeInTheDocument();
  });

  it("returns focus to the persistent journal control when a cinematic prompt disappears", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      inspectedItemIds: ["E1"],
    };
    const louis = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "station" &&
        item.canonicalTarget.stationId === "CHAR-LOUIS",
    );
    if (!louis) throw new Error("Missing Louis station fixture.");

    renderShell(() => true, initialState);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: louis.interactableId,
        zoneId: louis.zoneId,
        interactionType: louis.interactionType,
        canonicalTarget: louis.canonicalTarget,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /inspect louis station/i }),
    );
    act(() => reportNearbyInteraction?.(null));
    await user.click(screen.getByRole("button", { name: /close conversation/i }));

    expect(screen.getByRole("button", { name: /open route journal/i })).toHaveFocus();
  });

  it("returns focus to a cinematic prompt that remains available", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      inspectedItemIds: ["E1"],
    };
    const louis = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "station" &&
        item.canonicalTarget.stationId === "CHAR-LOUIS",
    );
    if (!louis) throw new Error("Missing Louis station fixture.");

    renderShell(() => true, initialState);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: louis.interactableId,
        zoneId: louis.zoneId,
        interactionType: louis.interactionType,
        canonicalTarget: louis.canonicalTarget,
      }),
    );
    const louisPrompt = screen.getByRole("button", {
      name: /inspect louis station/i,
    });
    await user.click(louisPrompt);
    await user.click(screen.getByRole("button", { name: /close conversation/i }));

    expect(louisPrompt).toHaveFocus();
  });

  it("opens the canonical route journal from its physical world station", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    const journal = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "case_surface" &&
        item.canonicalTarget.surfaceId === "journal",
    );
    if (!journal) throw new Error("Missing route journal fixture.");

    renderShell(() => true, initialState);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: journal.interactableId,
        zoneId: journal.zoneId,
        interactionType: journal.interactionType,
        canonicalTarget: journal.canonicalTarget,
      }),
    );
    await user.click(
      screen.getByRole("button", { name: /inspect case journal/i }),
    );

    expect(
      screen.getByRole("dialog", { name: /case journal/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /open full comparison workspace/i }),
    ).toHaveAttribute("href", "/play/investigate");
    await user.click(screen.getByRole("button", { name: "Inspect E6A" }));
    expect(
      screen.getByRole("region", { name: /fracture records/i }),
    ).toHaveTextContent("E6A Inspected");
    await user.click(
      screen.getByRole("button", { name: /close case journal/i }),
    );
    expect(
      screen.getByRole("button", { name: /inspect case journal/i }),
    ).toHaveFocus();
  });

  it("fast travels only to a previously visited authored safe spawn", async () => {
    const user = userEvent.setup();
    const initial = createInitialSpatialSession(manifest);
    const postRoadVisit = recordZoneVisit(manifest, initial, {
      zoneId: "post-road-square",
      spawnId: "SPAWN-POST-ROAD-ENTRY",
    });
    if (!postRoadVisit.accepted) throw new Error("Expected a post-road visit.");
    const returnedToArchive = recordZoneVisit(manifest, postRoadVisit.session, {
      zoneId: "archive-antechamber",
      spawnId: "SPAWN-ARCHIVE-ENTRY",
    });
    if (!returnedToArchive.accepted) throw new Error("Expected an archive visit.");
    window.localStorage.setItem(
      SPATIAL_SESSION_STORAGE_KEY,
      serializeSpatialSession(returnedToArchive.session),
    );
    const e3 = manifest.interactables.find(
      (item) =>
        item.canonicalTarget.targetType === "evidence" &&
        item.canonicalTarget.evidenceId === "E3",
    );
    if (!e3) throw new Error("Missing E3 interaction fixture.");

    renderShell(() => true);
    expect(runtimeInitialPosition).toEqual([0, 1.2, 0]);
    act(() =>
      reportNearbyInteraction?.({
        interactableId: e3.interactableId,
        zoneId: e3.zoneId,
        interactionType: e3.interactionType,
        canonicalTarget: e3.canonicalTarget,
      }),
    );
    expect(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /open route journal/i }),
    );
    expect(
      screen.queryByRole("button", { name: /fast travel to bridge approach/i }),
    ).toBeNull();
    await user.click(
      screen.getByRole("button", { name: /fast travel to post-road square/i }),
    );

    expect(runtimeInitialPosition).toEqual([24, 1.2, 0]);
    expect(
      screen.queryByRole("button", { name: /inspect drouet account table/i }),
    ).toBeNull();
    expect(
      screen.getByRole("complementary", {
        name: /current reconstruction location/i,
      }),
    ).toHaveTextContent(/post-road square/i);
    expect(
      JSON.parse(
        window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY) ?? "null",
      ),
    ).toMatchObject({
      lastSafeSpawn: {
        zoneId: "post-road-square",
        spawnId: "SPAWN-POST-ROAD-ENTRY",
      },
    });
    expect(
      screen.getByRole("button", { name: /open route journal/i }),
    ).toHaveFocus();
  });
});
