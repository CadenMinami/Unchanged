import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLayoutEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CaseSessionProvider,
  useCaseSession,
} from "@/components/case-session/case-session-provider";
import type { AmbientSoundscape } from "@/lib/audio/ambient-soundscape";
import type {
  CameraInputBoundaryHandle,
  CameraInputChannel,
} from "@/components/world/camera/camera-input-boundary";
import type {
  PrepareWorldInteractionOutcome,
  PreparedWorldInteraction,
  WorldInteractionAdapter,
} from "@/components/world/interaction-adapter";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { CAMERA_CONFIG } from "@/lib/world/camera-config";
import {
  CAMERA_PREFERENCES_STORAGE_KEY,
  CAMERA_PREFERENCES_VERSION,
  loadCameraPreferences,
  type CameraPreferences,
} from "@/lib/world/camera-preferences";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  createInitialSpatialSession,
  recordZoneVisit,
  serializeSpatialSession,
  SPATIAL_SESSION_STORAGE_KEY,
} from "@/lib/world/spatial-session";
import type { WorldModeEvent, WorldModeState } from "@/lib/world/world-mode";
import type { CaseState } from "@/schemas/case-state";
import type { WorldInteractionRequest } from "@/schemas/world-manifest";
import type { ZoneReadinessSnapshot } from "@/components/world/environment/zone-readiness-registry";

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
let reportControllerReady: (() => void) | undefined;
let reportZoneReadiness:
  | ((snapshot: ZoneReadinessSnapshot) => void)
  | undefined;
let runtimeInitialPosition: [number, number, number] | undefined;
let runtimeLocomotionEnabled: boolean | undefined;
let runtimeMovementResetGeneration: number | undefined;
let runtimeCameraInputChannel: CameraInputChannel | undefined;
let runtimeCameraPreferences: CameraPreferences | undefined;
let runtimeTelemetryEnabled: boolean | undefined;
let runtimeTestMode: boolean | undefined;
let sceneShouldThrow = false;
let browserVisibilityState: DocumentVisibilityState = "visible";
let browserHasFocus = true;
let issueCaseCommand:
  | ReturnType<typeof useCaseSession>["issue"]
  | undefined;

type ControlledPointerReleaseResult =
  | { requestId: number; status: "released" }
  | {
      requestId: number;
      status: "failed";
      reason: "pointer_lock_still_active";
    };

const routerMocks = vi.hoisted(() => ({
  push: vi.fn<(destination: string) => void>(),
}));
const transactionEvents = vi.hoisted(() => [] as string[]);
const worldModeMocks = vi.hoisted(() => ({
  transition: vi.fn<(state: WorldModeState, event: WorldModeEvent) => void>(),
}));

const interactionAdapterMocks = vi.hoisted(() => {
  let currentAdapter: WorldInteractionAdapter | null = null;
  return {
    cancel: vi.fn(),
    commit: vi.fn(),
    prepare: vi.fn(),
    attach(adapter: WorldInteractionAdapter) {
      currentAdapter = adapter;
    },
    detach(adapter: WorldInteractionAdapter) {
      if (currentAdapter === adapter) currentAdapter = null;
    },
    get current() {
      return currentAdapter;
    },
    reset() {
      currentAdapter = null;
      this.cancel.mockClear();
      this.commit.mockClear();
      this.prepare.mockClear();
    },
  };
});

const cameraBoundaryMocks = vi.hoisted(() => {
  type PendingRelease = {
    actualRelease: Promise<ControlledPointerReleaseResult>;
    requestId: number;
    resolve: (result: ControlledPointerReleaseResult) => void;
  };
  let releaseMode: "immediate" | "manual" = "immediate";
  let activeBoundary: CameraInputBoundaryHandle | null = null;
  let activeCanvas: HTMLCanvasElement | null = null;
  let activeChannel: CameraInputChannel | null = null;
  let pointerLockElement: Element | null = null;
  let pointerLockSupported = true;
  const pendingReleases: PendingRelease[] = [];
  const requestPointerLock = vi.fn<() => Promise<void>>(
    async () => undefined,
  );

  const requestRelease = vi.fn((requestId: number) => {
    if (!activeBoundary) {
      return Promise.reject(new Error("Camera boundary is not attached."));
    }
    if (releaseMode === "immediate") {
      transactionEvents.push(`release-request:${requestId}`);
      return activeBoundary.requestRelease(requestId);
    }
    pointerLockElement = activeCanvas;
    document.dispatchEvent(new Event("pointerlockchange"));
    const actualRelease = activeBoundary.requestRelease(requestId);
    transactionEvents.push(`release-request:${requestId}`);
    return new Promise<ControlledPointerReleaseResult>((resolve) => {
      pendingReleases.push({ actualRelease, requestId, resolve });
    });
  });
  const clearLookInput = vi.fn(() => activeBoundary?.clearLookInput());

  return {
    captureEligible: undefined as boolean | undefined,
    captureEligibilityHistory: [] as boolean[],
    clearLookInput,
    pendingReleases,
    requestRelease,
    attach(
      boundary: CameraInputBoundaryHandle,
      canvas: HTMLCanvasElement,
      channel: CameraInputChannel,
    ) {
      activeBoundary = boundary;
      activeCanvas = canvas;
      activeChannel = channel;
    },
    detach(boundary: CameraInputBoundaryHandle) {
      if (activeBoundary !== boundary) return;
      activeBoundary = null;
      activeCanvas = null;
      activeChannel = null;
      pointerLockElement = null;
    },
    get cameraInputChannel() {
      return activeChannel;
    },
    get canvas() {
      return activeCanvas;
    },
    get pointerLockElement() {
      return pointerLockElement;
    },
    get pointerLockSupported() {
      return pointerLockSupported;
    },
    requestPointerLock,
    acknowledgeCapture() {
      pointerLockElement = activeCanvas;
      document.dispatchEvent(new Event("pointerlockchange"));
    },
    denyCapture() {
      document.dispatchEvent(new Event("pointerlockerror"));
    },
    releaseCapture() {
      pointerLockElement = null;
      document.dispatchEvent(new Event("pointerlockchange"));
    },
    setPointerLockSupported(supported: boolean) {
      pointerLockSupported = supported;
    },
    holdReleases() {
      releaseMode = "manual";
    },
    releaseImmediately() {
      releaseMode = "immediate";
    },
    async resolveAt(index: number, result?: ControlledPointerReleaseResult) {
      const [pending] = pendingReleases.splice(index, 1);
      if (!pending) throw new Error(`Missing controlled release at index ${index}.`);
      pointerLockElement = null;
      document.dispatchEvent(new Event("pointerlockchange"));
      const actualResult = await pending.actualRelease;
      const reportedResult = result ?? actualResult;
      transactionEvents.push(
        `release-ack:${reportedResult.requestId}:${reportedResult.status}`,
      );
      pending.resolve(reportedResult);
      return pending.requestId;
    },
    reset() {
      releaseMode = "immediate";
      activeBoundary = null;
      activeCanvas = null;
      activeChannel = null;
      pointerLockElement = null;
      pointerLockSupported = true;
      pendingReleases.splice(0);
      requestPointerLock.mockClear();
      requestPointerLock.mockImplementation(async () => undefined);
      requestRelease.mockClear();
      this.clearLookInput.mockClear();
      this.captureEligible = undefined;
      this.captureEligibilityHistory.splice(0);
    },
  };
});

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

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/lib/world/world-mode", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/world/world-mode")>();
  return {
    ...original,
    transitionWorldMode(state: WorldModeState, event: WorldModeEvent) {
      worldModeMocks.transition(state, event);
      return original.transitionWorldMode(state, event);
    },
  };
});

vi.mock("@/components/world/camera/camera-input-boundary", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/components/world/camera/camera-input-boundary")
  >();
  const React = await import("react");
  const ProductionCameraInputBoundary = original.CameraInputBoundary;

  return {
    ...original,
    CameraInputBoundary: React.forwardRef<
      import("@/components/world/camera/camera-input-boundary").CameraInputBoundaryHandle,
      React.ComponentProps<typeof ProductionCameraInputBoundary>
    >(function ControlledCameraInputBoundary(
      { cameraInputChannel, captureEligible, children, ...props },
      forwardedRef,
    ) {
      const actualRef = React.useRef<CameraInputBoundaryHandle>(null);
      const controlledCanvas = React.useMemo(() => {
        const canvas = document.createElement("canvas");
        if (cameraBoundaryMocks.pointerLockSupported) {
          Object.defineProperty(canvas, "requestPointerLock", {
            configurable: true,
            value: cameraBoundaryMocks.requestPointerLock,
          });
        }
        return canvas;
      }, []);

      React.useLayoutEffect(() => {
        cameraBoundaryMocks.captureEligible = captureEligible;
        cameraBoundaryMocks.captureEligibilityHistory.push(captureEligible);
      }, [captureEligible]);
      React.useLayoutEffect(() => {
        const boundary = actualRef.current;
        if (!boundary) throw new Error("Production camera boundary did not attach.");
        cameraBoundaryMocks.attach(
          boundary,
          controlledCanvas,
          cameraInputChannel,
        );
        return () => cameraBoundaryMocks.detach(boundary);
      }, [cameraInputChannel, controlledCanvas]);
      React.useImperativeHandle(
        forwardedRef,
        () => ({
          clearLookInput: cameraBoundaryMocks.clearLookInput,
          requestRelease: cameraBoundaryMocks.requestRelease,
        }),
        [],
      );
      return (
        <ProductionCameraInputBoundary
          {...props}
          cameraInputChannel={cameraInputChannel}
          canvas={controlledCanvas}
          captureEligible={captureEligible}
          ref={actualRef}
        >
          {children}
        </ProductionCameraInputBoundary>
      );
    }),
  };
});

vi.mock("@/components/world/interaction-adapter", async (importOriginal) => {
  const original = await importOriginal<
    typeof import("@/components/world/interaction-adapter")
  >();
  const React = await import("react");

  return {
    ...original,
    useWorldInteractionAdapter() {
      const actualAdapter = original.useWorldInteractionAdapter();
      const instrumentedAdapter = React.useMemo<WorldInteractionAdapter>(
        () => ({
          prepareWorldInteraction(request) {
            const outcome = actualAdapter.prepareWorldInteraction(request);
            interactionAdapterMocks.prepare(request, outcome);
            if (outcome.status === "prepared") {
              transactionEvents.push(
                `interaction-prepare:${outcome.prepared.preparedId}`,
              );
            }
            return outcome;
          },
          commitPreparedWorldInteraction(prepared) {
            const preparedId =
              typeof prepared === "object" && prepared !== null
                ? String(Reflect.get(prepared, "preparedId"))
                : "invalid";
            transactionEvents.push(`interaction-commit-start:${preparedId}`);
            const outcome =
              actualAdapter.commitPreparedWorldInteraction(prepared);
            interactionAdapterMocks.commit(prepared, outcome);
            transactionEvents.push(
              `interaction-commit-result:${preparedId}:${outcome.status}`,
            );
            return outcome;
          },
          cancelPreparedWorldInteraction(prepared) {
            const preparedId =
              typeof prepared === "object" && prepared !== null
                ? String(Reflect.get(prepared, "preparedId"))
                : "invalid";
            const outcome =
              actualAdapter.cancelPreparedWorldInteraction(prepared);
            interactionAdapterMocks.cancel(prepared, outcome);
            transactionEvents.push(
              `interaction-cancel:${preparedId}:${outcome.status}`,
            );
            return outcome;
          },
        }),
        [actualAdapter],
      );
      React.useLayoutEffect(() => {
        interactionAdapterMocks.attach(instrumentedAdapter);
        return () => interactionAdapterMocks.detach(instrumentedAdapter);
      }, [instrumentedAdapter]);
      return instrumentedAdapter;
    },
  };
});

vi.mock("@/components/world/scene-runtime", () => ({
  SceneRuntime: (props: {
    cameraInputChannel: CameraInputChannel;
    cameraPreferences?: CameraPreferences;
    initialPosition?: [number, number, number];
    locomotionEnabled?: boolean;
    movementResetGeneration?: number;
    telemetryEnabled?: boolean;
    testMode?: boolean;
    onContextLost: () => void;
    onControllerReady?: () => void;
    onZoneReadinessChange?: (snapshot: ZoneReadinessSnapshot) => void;
    onPerformanceSample?: (timestampMs: number, fps: number) => void;
    onPlayerPositionChange?: (position: [number, number, number]) => void;
    onNearbyInteractionChange?: (
      request: WorldInteractionRequest | null,
    ) => void;
  }) => {
    runtimeInitialPosition = props.initialPosition;
    runtimeCameraInputChannel = props.cameraInputChannel;
    runtimeCameraPreferences = props.cameraPreferences;
    runtimeLocomotionEnabled = props.locomotionEnabled;
    runtimeMovementResetGeneration = props.movementResetGeneration;
    runtimeTelemetryEnabled = props.telemetryEnabled;
    runtimeTestMode = props.testMode;
    if (sceneShouldThrow) throw new Error("Scene render failed");
    reportContextLost = props.onContextLost;
    reportControllerReady = props.onControllerReady;
    reportZoneReadiness = props.onZoneReadinessChange;
    reportWorldFrame = props.onPerformanceSample;
    reportNearbyInteraction = props.onNearbyInteractionChange;
    reportWorldPosition = props.onPlayerPositionChange;
    return <div data-testid="scene-runtime">Rendered WebGL scene</div>;
  },
}));

import { WorldShell } from "@/components/world/world-shell";

const casePackage = loadVarennesCase();
const manifest = loadVarennesSceneManifest();

function CaseStateProbe() {
  const { issue, state } = useCaseSession();
  useLayoutEffect(() => {
    issueCaseCommand = issue;
    return () => {
      issueCaseCommand = undefined;
    };
  }, [issue]);
  return (
    <output data-testid="case-state-probe" hidden>
      {JSON.stringify(state)}
    </output>
  );
}

function readCaseState(): CaseState {
  return JSON.parse(screen.getByTestId("case-state-probe").textContent ?? "null") as CaseState;
}

function latestPreparedInteraction(): PreparedWorldInteraction {
  const latestCall = interactionAdapterMocks.prepare.mock.calls.at(-1);
  const outcome = latestCall?.[1] as PrepareWorldInteractionOutcome | undefined;
  if (outcome?.status !== "prepared") {
    throw new Error("Expected an instrumented prepared world interaction.");
  }
  return outcome.prepared;
}

function recordTransactionFocus(event: FocusEvent) {
  if (!(event.target instanceof HTMLElement)) return;
  const label =
    event.target.getAttribute("aria-label") ?? event.target.textContent?.trim();
  if (label) transactionEvents.push(`focus:${label}`);
}

function expectEventsInOrder(...expectedEvents: string[]) {
  let previousIndex = -1;
  for (const expectedEvent of expectedEvents) {
    const eventIndex = transactionEvents.findIndex(
      (event, index) => index > previousIndex && event === expectedEvent,
    );
    expect(eventIndex, `Missing ordered event: ${expectedEvent}`).toBeGreaterThan(
      previousIndex,
    );
    previousIndex = eventIndex;
  }
}

function expectPendingWorldTransaction(options: {
  actionKind:
    | "interaction"
    | "journal"
    | "caseboard"
    | "camera_settings"
    | "runtime_unavailable";
  caseStateBefore: CaseState;
  resetGenerationBefore: number | undefined;
  runtimeUnmounted?: boolean;
}): number {
  const pendingRelease = cameraBoundaryMocks.pendingReleases.at(-1);
  if (!pendingRelease) throw new Error("Expected a held camera release.");
  const hud = screen.getByTestId("world-hud");

  expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledTimes(1);
  expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledWith(
    pendingRelease.requestId,
  );
  expect(cameraBoundaryMocks.clearLookInput).toHaveBeenCalledTimes(1);
  if (options.runtimeUnmounted) {
    expect(screen.queryByTestId("scene-runtime")).toBeNull();
  } else {
    expect(runtimeMovementResetGeneration).toBeGreaterThan(
      options.resetGenerationBefore ?? -1,
    );
    expect(runtimeLocomotionEnabled).toBe(false);
  }
  expect(cameraBoundaryMocks.captureEligible).toBe(false);
  expect(screen.getByRole("status")).toHaveTextContent(
    /spatial archive \/ exploring/i,
  );
  expect(readCaseState()).toEqual(options.caseStateBefore);
  expect(cameraBoundaryMocks.cameraInputChannel).toBe(runtimeCameraInputChannel);
  expect(runtimeCameraInputChannel?.getSnapshot().releasePending).toBe(true);
  expect(hud).toHaveAttribute("data-camera-release-pending", "true");
  expect(hud).toHaveAttribute("data-pending-action", options.actionKind);
  expect(Number(hud.dataset.pendingRequestId)).toBe(pendingRelease.requestId);
  expectEventsInOrder(`release-request:${pendingRelease.requestId}`);
  return pendingRelease.requestId;
}

function expectMatchingReleaseAcknowledged(requestId: number) {
  expectEventsInOrder(
    `release-request:${requestId}`,
    `release-ack:${requestId}:released`,
  );
  expect(runtimeCameraInputChannel?.getSnapshot().releasePending).toBe(false);
  const hud = screen.queryByTestId("world-hud");
  if (hud) {
    expect(hud).toHaveAttribute("data-camera-release-pending", "false");
  }
}

function findInteraction(
  predicate: (request: WorldInteractionRequest) => boolean,
): WorldInteractionRequest {
  const interactable = manifest.interactables.find((item) =>
    predicate({
      interactableId: item.interactableId,
      zoneId: item.zoneId,
      interactionType: item.interactionType,
      canonicalTarget: item.canonicalTarget,
    }),
  );
  if (!interactable) throw new Error("Missing world interaction fixture.");
  return {
    interactableId: interactable.interactableId,
    zoneId: interactable.zoneId,
    interactionType: interactable.interactionType,
    canonicalTarget: interactable.canonicalTarget,
  };
}

async function resolveControlledReleaseAt(
  index: number,
  result?: ControlledPointerReleaseResult,
) {
  await act(async () => {
    await cameraBoundaryMocks.resolveAt(index, result);
    await Promise.resolve();
  });
}

function renderShell(capabilityCheck: () => boolean, initialState?: CaseState) {
  return render(
    <CaseSessionProvider initialState={initialState} persist={false}>
      <WorldShell capabilityCheck={capabilityCheck} />
      <CaseStateProbe />
    </CaseSessionProvider>,
  );
}

function repairReadyCaseState(): CaseState {
  return {
    ...createInitialCaseState(casePackage),
    phase: "case_brief",
    revision: 24,
    completedCommandIds: Array.from(
      { length: 14 },
      (_, index) => `setup-${index}`,
    ),
    inspectedItemIds: [
      ...casePackage.evidence.map((item) => item.id),
      ...casePackage.anomalies.map((item) => item.id),
      ...casePackage.branchObservations.map((item) => item.id),
    ],
    completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
    rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    activeAnomalyId: casePackage.solution.activeAnomalyId,
    pinnedEvidenceIds: ["E1", "E2", "E3", "E5", "E7"],
    selectedConditionIds: casePackage.conditions.map((condition) => condition.id),
    placedCausalNodeIds: [...casePackage.solution.requiredCausalNodeIds],
    connectedCausalEdgeIds: [...casePackage.solution.requiredCausalEdgeIds],
    caseBrief: {
      argument:
        "The route correction enabled pursuit, but local capacity and the unsettled constitution shaped what followed. The evidence does not establish Louis's complete motives or make later outcomes inevitable.",
      selectedConsequenceId: casePackage.solution.limitedConsequenceIds[0],
      selectedUncertaintyIds: [...casePackage.solution.uncertaintyIds],
      submitted: true,
    },
  };
}

function dispatchDocumentVisibility(state: DocumentVisibilityState) {
  browserVisibilityState = state;
  fireEvent(document, new Event("visibilitychange"));
}

function dispatchWindowFocus(focused: boolean) {
  browserHasFocus = focused;
  fireEvent(window, new Event(focused ? "focus" : "blur"));
}

function transitionCalls(type: "resume" | "suspend") {
  return worldModeMocks.transition.mock.calls.filter(
    ([, event]) => event.type === type,
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
    reportControllerReady = undefined;
    reportZoneReadiness = undefined;
    reportWorldFrame = undefined;
    reportNearbyInteraction = undefined;
    reportWorldPosition = undefined;
    runtimeInitialPosition = undefined;
    runtimeLocomotionEnabled = undefined;
    runtimeMovementResetGeneration = undefined;
    runtimeCameraInputChannel = undefined;
    runtimeCameraPreferences = undefined;
    runtimeTelemetryEnabled = undefined;
    runtimeTestMode = undefined;
    sceneShouldThrow = false;
    browserVisibilityState = "visible";
    browserHasFocus = true;
    issueCaseCommand = undefined;
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => browserVisibilityState,
    );
    vi.spyOn(document, "hidden", "get").mockImplementation(
      () => browserVisibilityState === "hidden",
    );
    vi.spyOn(document, "hasFocus").mockImplementation(() => browserHasFocus);
    transactionEvents.splice(0);
    worldModeMocks.transition.mockClear();
    interactionAdapterMocks.reset();
    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => cameraBoundaryMocks.pointerLockElement,
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: vi.fn(),
    });
    cameraBoundaryMocks.reset();
    routerMocks.push.mockReset();
    document.addEventListener("focusin", recordTransactionFocus);
  });

  afterEach(() => {
    document.removeEventListener("focusin", recordTransactionFocus);
    vi.useRealTimers();
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

  it("announces readiness only after the movement controller is available", () => {
    renderShell(() => true);

    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /preparing varennes reconstruction/i,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      /reconstruction ready/i,
    );

    act(() => reportControllerReady?.());

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

  it("publishes stable four-zone diagnostics without changing visible readiness copy", () => {
    renderShell(() => true);
    const shell = screen.getByTestId("world-canvas-shell");

    expect(shell).toHaveAttribute("data-world-zones-ready", "false");

    act(() =>
      reportZoneReadiness?.({
        runtimeKey: 0,
        revision: 4,
        zones: {
          "archive-antechamber": {
            assetStatus: "loaded",
            interactableReady: true,
          },
          "post-road-square": {
            assetStatus: "fallback",
            interactableReady: true,
          },
          "royal-lodging-civic-area": {
            assetStatus: "loaded",
            interactableReady: true,
          },
          "bridge-approach": {
            assetStatus: "loaded",
            interactableReady: true,
          },
        },
        allAssetsResolved: true,
        allInteractablesReady: true,
        allReady: true,
      }),
    );

    expect(shell).toHaveAttribute("data-world-zones-ready", "true");
    expect(shell.getAttribute("data-world-zone-readiness")).toContain(
      '"post-road-square":{"assetStatus":"fallback","interactableReady":true}',
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /preparing varennes reconstruction/i,
    );
  });

  it("keeps first-use camera guidance after click, fallback drag, and denial", async () => {
    renderShell(() => true);
    act(() => reportControllerReady?.());
    const canvas = cameraBoundaryMocks.canvas;
    if (!canvas) throw new Error("Expected the controlled world canvas.");

    expect(screen.getByRole("status")).toHaveTextContent(
      /click world to capture camera/i,
    );

    fireEvent.click(canvas);
    await act(async () => Promise.resolve());
    expect(cameraBoundaryMocks.requestPointerLock).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY)).toBeNull();

    fireEvent.pointerDown(canvas, { button: 2 });
    expect(runtimeCameraInputChannel?.getSnapshot().fallbackDragActive).toBe(true);
    expect(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY)).toBeNull();
    fireEvent.pointerUp(document, { button: 2 });

    act(() => cameraBoundaryMocks.denyCapture());
    expect(screen.getByRole("status")).toHaveTextContent(
      /capture blocked.*right-drag fallback/i,
    );
    expect(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY)).toBeNull();
  });

  it("persists camera introduction once after acknowledged capture", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    renderShell(() => true);
    act(() => reportControllerReady?.());
    setItem.mockClear();
    const canvas = cameraBoundaryMocks.canvas;
    if (!canvas) throw new Error("Expected the controlled world canvas.");

    fireEvent.click(canvas);
    await act(async () => Promise.resolve());
    expect(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY)).toBeNull();

    act(() => cameraBoundaryMocks.acknowledgeCapture());
    await waitFor(() => {
      expect(loadCameraPreferences()).toMatchObject({
        pointerLockIntroduced: true,
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /camera captured.*escape to release/i,
    );

    act(() => cameraBoundaryMocks.acknowledgeCapture());
    act(() => cameraBoundaryMocks.releaseCapture());
    expect(screen.getByRole("status")).not.toHaveTextContent(
      /click world to capture camera/i,
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(
      /move with w a s d|shift toggles/i,
    );
    fireEvent.click(canvas);
    act(() => cameraBoundaryMocks.acknowledgeCapture());

    expect(
      setItem.mock.calls.filter(
        ([key]) => key === CAMERA_PREFERENCES_STORAGE_KEY,
      ),
    ).toHaveLength(1);
  });

  it("announces unsupported pointer lock while keeping fallback look and locomotion", () => {
    cameraBoundaryMocks.setPointerLockSupported(false);
    renderShell(() => true);
    act(() => reportControllerReady?.());
    const canvas = cameraBoundaryMocks.canvas;
    if (!canvas) throw new Error("Expected the controlled world canvas.");

    expect(screen.getByRole("status")).toHaveTextContent(
      /right-drag to look.*keyboard remains available/i,
    );
    expect(runtimeLocomotionEnabled).toBe(true);
    fireEvent.pointerDown(canvas, { button: 2 });
    expect(runtimeCameraInputChannel?.getSnapshot()).toMatchObject({
      fallbackDragActive: true,
      pointerLockSupported: false,
    });
    expect(runtimeLocomotionEnabled).toBe(true);
  });

  it("clears an announced ready state when the scene error boundary activates", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderShell(() => true);
    act(() => reportControllerReady?.());
    expect(screen.getByRole("status")).toHaveTextContent(
      /reconstruction ready/i,
    );

    sceneShouldThrow = true;
    await user.click(screen.getByRole("button", { name: "Guidance guided" }));

    expect(screen.getByTestId("world-runtime-fallback")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /preparing varennes reconstruction/i,
    );
    consoleError.mockRestore();
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
      await screen.findByRole("heading", {
        name: /3d reconstruction unavailable/i,
      }),
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

  it("passes telemetry opt-in to the runtime without enabling world test mode", () => {
    window.sessionStorage.setItem("history-unbroken:world-telemetry", "1");

    renderShell(() => true);

    expect(runtimeTelemetryEnabled).toBe(true);
    expect(runtimeTestMode).toBe(false);
  });

  it.each(["window blur", "document hidden"] as const)(
    "coordinates %s with visibility and focus as one activity state",
    (firstInactiveEdge) => {
      renderShell(() => true);
      const initialResetGeneration = runtimeMovementResetGeneration ?? 0;

      if (firstInactiveEdge === "window blur") {
        dispatchWindowFocus(false);
      } else {
        dispatchDocumentVisibility("hidden");
      }

      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);
      expect(runtimeLocomotionEnabled).toBe(false);
      expect(screen.getByRole("status")).toHaveTextContent(
        /spatial archive \/ suspended/i,
      );
      expect(transitionCalls("suspend")).toEqual([
        [
          { mode: "exploring", resumeMode: null },
          { type: "suspend" },
        ],
      ]);

      dispatchWindowFocus(false);
      dispatchDocumentVisibility("hidden");
      dispatchWindowFocus(false);

      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);
      expect(transitionCalls("suspend")).toHaveLength(1);

      dispatchDocumentVisibility("visible");

      expect(screen.getByRole("status")).toHaveTextContent(
        /spatial archive \/ suspended/i,
      );
      expect(transitionCalls("resume")).toHaveLength(0);

      dispatchWindowFocus(true);

      expect(screen.getByRole("status")).toHaveTextContent(
        /spatial archive \/ exploring/i,
      );
      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);
      expect(transitionCalls("resume")).toEqual([
        [
          { mode: "suspended", resumeMode: "exploring" },
          { type: "resume" },
        ],
      ]);
      expect(cameraBoundaryMocks.requestRelease).not.toHaveBeenCalled();
      expect(runtimeCameraInputChannel?.getSnapshot()).toMatchObject({
        pointerLockActive: false,
        fallbackDragActive: false,
      });
    },
  );

  it("keeps a focused overlay mounted and resumes it as focused", async () => {
    const user = userEvent.setup();
    renderShell(() => true);
    await user.click(screen.getByRole("button", { name: /open route journal/i }));
    expect(
      await screen.findByRole("dialog", { name: /case journal/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    worldModeMocks.transition.mockClear();
    cameraBoundaryMocks.requestRelease.mockClear();
    const initialResetGeneration = runtimeMovementResetGeneration ?? 0;

    dispatchWindowFocus(false);

    expect(screen.getByRole("dialog", { name: /case journal/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );
    expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);

    dispatchDocumentVisibility("hidden");
    dispatchWindowFocus(true);

    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );
    expect(transitionCalls("resume")).toHaveLength(0);

    dispatchDocumentVisibility("visible");

    expect(screen.getByRole("dialog", { name: /case journal/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    expect(transitionCalls("suspend")).toEqual([
      [{ mode: "focused", resumeMode: null }, { type: "suspend" }],
    ]);
    expect(transitionCalls("resume")).toEqual([
      [
        { mode: "suspended", resumeMode: "focused" },
        { type: "resume" },
      ],
    ]);
    expect(runtimeLocomotionEnabled).toBe(false);
    expect(cameraBoundaryMocks.captureEligible).toBe(false);
    expect(cameraBoundaryMocks.requestRelease).not.toHaveBeenCalled();
  });

  it("removes activity listeners so suspended unmount cannot resume late", () => {
    const mounted = renderShell(() => true);
    dispatchWindowFocus(false);
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );
    worldModeMocks.transition.mockClear();

    mounted.unmount();
    dispatchWindowFocus(true);
    dispatchDocumentVisibility("hidden");
    dispatchDocumentVisibility("visible");

    expect(worldModeMocks.transition).not.toHaveBeenCalled();
    expect(screen.queryByTestId("world-canvas-shell")).toBeNull();
  });

  it.each([
    ["W", "KeyW", "w"],
    ["ArrowUp", "ArrowUp", "ArrowUp"],
  ] as const)(
    "publishes one controller reset edge while %s and Shift stay held",
    (_label, movementCode, movementKey) => {
      renderShell(() => true);
      const initialResetGeneration = runtimeMovementResetGeneration ?? 0;
      fireEvent.keyDown(window, { code: movementCode, key: movementKey });
      fireEvent.keyDown(window, { code: "ShiftLeft", key: "Shift" });

      dispatchWindowFocus(false);
      dispatchWindowFocus(true);

      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);
      expect(runtimeLocomotionEnabled).toBe(true);

      fireEvent.keyDown(window, { code: "KeyQ", key: "q" });
      fireEvent.keyDown(window, {
        code: movementCode,
        key: movementKey,
        repeat: true,
      });
      fireEvent.keyDown(window, {
        code: "ShiftLeft",
        key: "Shift",
        repeat: true,
      });

      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);

      fireEvent.keyUp(window, { code: movementCode, key: movementKey });
      fireEvent.keyUp(window, { code: "ShiftLeft", key: "Shift" });
      fireEvent.keyDown(window, { code: movementCode, key: movementKey });
      fireEvent.keyDown(window, { code: "ShiftLeft", key: "Shift" });

      expect(runtimeMovementResetGeneration).toBe(initialResetGeneration + 1);
      expect(runtimeLocomotionEnabled).toBe(true);
      expect(transitionCalls("suspend")).toHaveLength(1);
      expect(transitionCalls("resume")).toHaveLength(1);
    },
  );

  it("keeps ambient muting tied to visibility while focus gates world activity", async () => {
    const user = userEvent.setup();
    renderShell(() => true);
    await user.click(
      screen.getByRole("button", { name: /enable ambient sound/i }),
    );
    ambientAudioMocks.defaultSoundscape.setMuted.mockClear();

    dispatchWindowFocus(false);

    expect(ambientAudioMocks.defaultSoundscape.setMuted).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );

    dispatchDocumentVisibility("hidden");
    expect(ambientAudioMocks.defaultSoundscape.setMuted).toHaveBeenLastCalledWith(
      true,
    );

    dispatchDocumentVisibility("visible");
    expect(ambientAudioMocks.defaultSoundscape.setMuted).toHaveBeenLastCalledWith(
      false,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );

    dispatchWindowFocus(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ exploring/i,
    );
    expect(ambientAudioMocks.defaultSoundscape.setMuted).toHaveBeenCalledTimes(2);
  });

  it("cancels a prepared E3 action before suspension and ignores its stale release", async () => {
    vi.useFakeTimers();
    const e3 = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "evidence" &&
        request.canonicalTarget.evidenceId === "E3",
    );
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    const caseStateBefore = readCaseState();
    act(() => reportNearbyInteraction?.(e3));
    fireEvent.click(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    );
    const requestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;
    const prepared = latestPreparedInteraction();
    const resetAfterPendingAction = runtimeMovementResetGeneration ?? 0;
    expect(requestId).toBeTypeOf("number");
    expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledTimes(1);
    const timerCountWhilePending = vi.getTimerCount();
    expect(timerCountWhilePending).toBeGreaterThan(0);
    worldModeMocks.transition.mockClear();

    dispatchWindowFocus(false);

    expect(interactionAdapterMocks.cancel).toHaveBeenCalledTimes(1);
    expect(interactionAdapterMocks.cancel).toHaveBeenCalledWith(prepared, {
      status: "cancelled",
    });
    expect(screen.getByTestId("world-hud")).not.toHaveAttribute(
      "data-pending-action",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ suspended/i,
    );
    expect(runtimeMovementResetGeneration).toBe(resetAfterPendingAction + 1);
    expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(timerCountWhilePending - 1);
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.queryByRole("dialog")).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1_600);
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    await resolveControlledReleaseAt(0);
    dispatchWindowFocus(true);

    expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledTimes(1);
    expect(interactionAdapterMocks.cancel).toHaveBeenCalledTimes(1);
    expect(interactionAdapterMocks.commit).not.toHaveBeenCalled();
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ exploring/i,
    );
    expect(transitionCalls("suspend")).toHaveLength(1);
    expect(transitionCalls("resume")).toHaveLength(1);

    const registryProbe =
      interactionAdapterMocks.current?.commitPreparedWorldInteraction(prepared);
    expect(registryProbe).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
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
    act(() => reportControllerReady?.());
    expect(screen.getByRole("status")).toHaveTextContent(
      /reconstruction ready/i,
    );
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
    expect(screen.getByRole("status")).toHaveTextContent(
      /preparing varennes reconstruction/i,
    );
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

  it("defers evidence mutation, mode transition, mount, and focus until matching release", async () => {
    const user = userEvent.setup();
    const e3 = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "evidence" &&
        request.canonicalTarget.evidenceId === "E3",
    );
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
    };
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, initialState);
    const initialResetGeneration = runtimeMovementResetGeneration;
    const caseStateBefore = readCaseState();
    act(() => reportNearbyInteraction?.(e3));

    await user.click(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    );

    const requestId = expectPendingWorldTransaction({
      actionKind: "interaction",
      caseStateBefore,
      resetGenerationBefore: initialResetGeneration,
    });
    const prepared = latestPreparedInteraction();
    const pendingHud = screen.getByTestId("world-hud");
    expect(Number(pendingHud.dataset.pendingAcceptedAt)).toBeGreaterThan(0);
    expect(readCaseState().inspectedItemIds).not.toContain("E3");
    expect(screen.queryByRole("dialog")).toBeNull();

    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(readCaseState().inspectedItemIds).toContain("E3");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /close evidence/i })).toHaveFocus();
    });
    expectMatchingReleaseAcknowledged(requestId);
    expectEventsInOrder(
      `release-ack:${requestId}:released`,
      `interaction-commit-start:${prepared.preparedId}`,
      "focus:Close evidence",
    );
    expect(screen.getByRole("status")).toHaveTextContent(/spatial archive \/ focused/i);
  });

  it.each([
    {
      kind: "generated dialogue",
      stationId: "CHAR-LOUIS",
      promptName: /inspect louis station/i,
      dialogName: /conversation with louis xvi station/i,
      closeName: /close conversation/i,
      initialInspectedItemIds: ["E1"],
      worldMode: "cinematic",
    },
    {
      kind: "static dossier",
      stationId: "STATION-VARENNES-CIVIC",
      promptName: /inspect varennes civic response station/i,
      dialogName: /varennes civic record/i,
      closeName: /close dossier/i,
      initialInspectedItemIds: [],
      worldMode: "focused",
    },
  ])(
    "defers the $kind station surface and focus until release",
    async ({
      stationId,
      promptName,
      dialogName,
      closeName,
      initialInspectedItemIds,
      worldMode,
    }) => {
      const user = userEvent.setup();
      const station = findInteraction(
        (request) =>
          request.canonicalTarget.targetType === "station" &&
          request.canonicalTarget.stationId === stationId,
      );
      cameraBoundaryMocks.holdReleases();
      renderShell(() => true, {
        ...createInitialCaseState(casePackage),
        phase: "investigation",
        inspectedItemIds: initialInspectedItemIds,
      });
      act(() => reportNearbyInteraction?.(station));
      const caseStateBefore = readCaseState();
      const resetGenerationBefore = runtimeMovementResetGeneration;

      await user.click(screen.getByRole("button", { name: promptName }));

      const requestId = expectPendingWorldTransaction({
        actionKind: "interaction",
        caseStateBefore,
        resetGenerationBefore,
      });
      const prepared = latestPreparedInteraction();
      expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();

      await resolveControlledReleaseAt(0);

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: dialogName })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: closeName })).toHaveFocus();
      });
      expectMatchingReleaseAcknowledged(requestId);
      expect(readCaseState()).toEqual(caseStateBefore);
      expect(
        screen.getByText(new RegExp(`spatial archive / ${worldMode}`, "i"), {
          selector: "section[role='status'] > p",
        }),
      ).toBeInTheDocument();
      const focusLabel =
        prepared.target.targetType === "station" &&
        prepared.target.stationId === "CHAR-LOUIS"
          ? "Close conversation"
          : "Close dossier";
      expectEventsInOrder(
        `release-ack:${requestId}:released`,
        `interaction-commit-start:${prepared.preparedId}`,
        `focus:${focusLabel}`,
      );
    },
  );

  it("defers a nearby journal surface while preserving its physical invoker", async () => {
    const user = userEvent.setup();
    const journal = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "case_surface" &&
        request.canonicalTarget.surfaceId === "journal",
    );
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    act(() => reportNearbyInteraction?.(journal));
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;

    await user.click(
      screen.getByRole("button", { name: /inspect case journal/i }),
    );

    const requestId = expectPendingWorldTransaction({
      actionKind: "journal",
      caseStateBefore,
      resetGenerationBefore,
    });
    const prepared = latestPreparedInteraction();
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /case journal/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close case journal/i }),
      ).toHaveFocus();
    });
    expectMatchingReleaseAcknowledged(requestId);
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    expectEventsInOrder(
      `release-ack:${requestId}:released`,
      `interaction-commit-start:${prepared.preparedId}`,
      "focus:Close case journal",
    );
    await user.click(
      screen.getByRole("button", { name: /close case journal/i }),
    );
    expect(
      screen.getByRole("button", { name: /inspect case journal/i }),
    ).toHaveFocus();
  });

  it("defers the HUD journal surface and focuses it only after release", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;

    await user.click(
      screen.getByRole("button", { name: /open route journal/i }),
    );

    const requestId = expectPendingWorldTransaction({
      actionKind: "journal",
      caseStateBefore,
      resetGenerationBefore,
    });
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: /case journal/i })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close case journal/i }),
      ).toHaveFocus();
    });
    expectMatchingReleaseAcknowledged(requestId);
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    expectEventsInOrder(
      `release-ack:${requestId}:released`,
      "focus:Close case journal",
    );
  });

  it("defers the caseboard phase command until camera release", async () => {
    const user = userEvent.setup();
    const initialState = {
      ...createInitialCaseState(casePackage),
      phase: "investigation" as const,
      completedComparisonIds: [...casePackage.solution.requiredComparisonIds],
      activeAnomalyId: casePackage.solution.activeAnomalyId,
      rejectedAnomalyIds: [...casePackage.solution.rejectedAnomalyIds],
    };
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, initialState);
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;

    await user.click(
      screen.getByRole("button", { name: /build causal caseboard/i }),
    );

    const requestId = expectPendingWorldTransaction({
      actionKind: "caseboard",
      caseStateBefore,
      resetGenerationBefore,
    });
    expect(screen.queryByRole("dialog", { name: /causal caseboard/i })).toBeNull();
    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(readCaseState().phase).toBe("case_brief");
      expect(
        screen.getByRole("dialog", { name: /causal caseboard/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close causal caseboard/i }),
      ).toHaveFocus();
    });
    expectMatchingReleaseAcknowledged(requestId);
    expect(readCaseState()).toEqual({
      ...caseStateBefore,
      completedCommandIds: [
        ...caseStateBefore.completedCommandIds,
        expect.any(String),
      ],
      phase: "case_brief",
      revision: caseStateBefore.revision + 1,
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    expectEventsInOrder(
      `release-ack:${requestId}:released`,
      "focus:Close causal caseboard",
    );
  });

  it("opens a minimal camera-settings surface only after release", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;

    const trigger = screen.getByRole("button", { name: /open camera settings/i });
    await user.click(trigger);

    const requestId = expectPendingWorldTransaction({
      actionKind: "camera_settings",
      caseStateBefore,
      resetGenerationBefore,
    });
    expect(
      screen.queryByRole("dialog", { name: /camera settings/i }),
    ).toBeNull();
    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(
        screen.getByRole("dialog", { name: /camera settings/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /close camera settings/i }),
      ).toHaveFocus();
    });
    expectMatchingReleaseAcknowledged(requestId);
    expect(readCaseState()).toEqual(caseStateBefore);
    const modalSuppressedStatus = screen.getByTestId("world-status");
    expect(modalSuppressedStatus).not.toBeVisible();
    expect(modalSuppressedStatus).toHaveTextContent(
      /spatial archive \/ focused/i,
    );
    expectEventsInOrder(
      `release-ack:${requestId}:released`,
      "focus:Close camera settings",
    );
    await user.click(
      screen.getByRole("button", { name: /close camera settings/i }),
    );
    expect(trigger).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent(
      /spatial archive \/ exploring/i,
    );
  });

  it("restores camera preferences and persists native settings controls only", async () => {
    const caseStorageKey = "history-unbroken:varennes:state";
    const restoredPreferences: CameraPreferences = {
      sensitivity: 1.7,
      invertY: true,
      pointerLockIntroduced: true,
    };
    window.localStorage.setItem(caseStorageKey, "case-storage-sentinel");
    window.localStorage.setItem(
      CAMERA_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: CAMERA_PREFERENCES_VERSION,
        preferences: restoredPreferences,
      }),
    );
    window.sessionStorage.setItem("session-sentinel", "unchanged");
    const user = userEvent.setup();
    renderShell(() => true);
    const caseStateBefore = readCaseState();
    const caseStorageBefore = window.localStorage.getItem(caseStorageKey);
    const spatialStorageBefore = window.localStorage.getItem(
      SPATIAL_SESSION_STORAGE_KEY,
    );

    expect(runtimeCameraPreferences).toEqual(restoredPreferences);
    await user.click(
      screen.getByRole("button", { name: /open camera settings/i }),
    );

    const sensitivity = await screen.findByRole("slider", {
      name: /look sensitivity/i,
    });
    const invertY = screen.getByRole("checkbox", {
      name: /invert vertical look/i,
    });
    expect(sensitivity).toHaveAttribute(
      "min",
      String(CAMERA_CONFIG.sensitivity.min),
    );
    expect(sensitivity).toHaveAttribute(
      "max",
      String(CAMERA_CONFIG.sensitivity.max),
    );
    expect(sensitivity).toHaveAttribute(
      "step",
      String(CAMERA_CONFIG.sensitivity.step),
    );
    expect(sensitivity).toHaveValue(String(restoredPreferences.sensitivity));
    expect(invertY).toBeChecked();
    expect(screen.getByText("1.7x")).toBeVisible();

    fireEvent.change(sensitivity, { target: { value: "1.4" } });
    await user.click(invertY);

    expect(loadCameraPreferences()).toEqual({
      sensitivity: 1.4,
      invertY: false,
      pointerLockIntroduced: true,
    });
    expect(runtimeCameraPreferences).toEqual(loadCameraPreferences());
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(window.localStorage.getItem(caseStorageKey)).toBe(caseStorageBefore);
    expect(window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY)).toBe(
      spatialStorageBefore,
    );
    expect(window.sessionStorage.getItem("session-sentinel")).toBe("unchanged");
  });

  it("contains settings focus and restores the free cursor on Escape and close", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    const canvas = cameraBoundaryMocks.canvas;
    if (!canvas) throw new Error("Expected the controlled world canvas.");
    fireEvent.click(canvas);
    act(() => cameraBoundaryMocks.acknowledgeCapture());
    expect(runtimeCameraInputChannel?.getSnapshot().pointerLockActive).toBe(true);

    const trigger = screen.getByRole("button", { name: /open camera settings/i });
    await user.click(trigger);
    await resolveControlledReleaseAt(0);
    const close = await screen.findByRole("button", {
      name: /close camera settings/i,
    });
    const sensitivity = screen.getByRole("slider", {
      name: /look sensitivity/i,
    });
    const invertY = screen.getByRole("checkbox", {
      name: /invert vertical look/i,
    });
    expect(close).toHaveFocus();
    expect(runtimeCameraInputChannel?.getSnapshot().pointerLockActive).toBe(false);

    await user.tab();
    expect(sensitivity).toHaveFocus();
    await user.tab();
    expect(invertY).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(invertY).toHaveFocus();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: /camera settings/i }),
    ).toBeNull();
    expect(trigger).toHaveFocus();
    expect(runtimeCameraInputChannel?.getSnapshot().pointerLockActive).toBe(false);
    expect(cameraBoundaryMocks.requestPointerLock).toHaveBeenCalledTimes(1);

    await user.click(trigger);
    await resolveControlledReleaseAt(0);
    await user.click(
      await screen.findByRole("button", { name: /close camera settings/i }),
    );
    expect(trigger).toHaveFocus();
    expect(runtimeCameraInputChannel?.getSnapshot().pointerLockActive).toBe(false);
    expect(cameraBoundaryMocks.requestPointerLock).toHaveBeenCalledTimes(1);
  });

  it("cancels a failed evidence release and retries with a fresh transaction", async () => {
    const user = userEvent.setup();
    const e3 = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "evidence" &&
        request.canonicalTarget.evidenceId === "E3",
    );
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    act(() => reportNearbyInteraction?.(e3));
    await user.click(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    );
    const firstRequestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;
    const firstAcceptedAt = Number(
      screen.getByTestId("world-hud").dataset.pendingAcceptedAt,
    );

    await resolveControlledReleaseAt(0, {
      requestId: firstRequestId ?? -1,
      status: "failed",
      reason: "pointer_lock_still_active",
    });

    expect(readCaseState().inspectedItemIds).not.toContain("E3");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/camera input/i);

    await user.click(screen.getByRole("button", { name: /retry/i }));
    const secondRequestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;
    expect(secondRequestId).toBeGreaterThan(firstRequestId ?? -1);
    expect(
      Number(screen.getByTestId("world-hud").dataset.pendingAcceptedAt),
    ).toBeGreaterThan(firstAcceptedAt);
    expect(readCaseState().inspectedItemIds).not.toContain("E3");
    await resolveControlledReleaseAt(0);

    await waitFor(() => {
      expect(readCaseState().inspectedItemIds).toContain("E3");
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("cancels and removes a prepared E3 interaction when release times out", async () => {
    vi.useFakeTimers();
    const e3 = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "evidence" &&
        request.canonicalTarget.evidenceId === "E3",
    );
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;
    act(() => reportNearbyInteraction?.(e3));

    fireEvent.click(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    );

    const requestId = expectPendingWorldTransaction({
      actionKind: "interaction",
      caseStateBefore,
      resetGenerationBefore,
    });
    const prepared = latestPreparedInteraction();
    expect(interactionAdapterMocks.cancel).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_600);
      await Promise.resolve();
    });

    expect(interactionAdapterMocks.cancel).toHaveBeenCalledTimes(1);
    expect(interactionAdapterMocks.cancel).toHaveBeenCalledWith(prepared, {
      status: "cancelled",
    });
    expectEventsInOrder(
      `release-request:${requestId}`,
      `interaction-cancel:${prepared.preparedId}:cancelled`,
    );
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/camera input/i);

    const registryProbe =
      interactionAdapterMocks.current?.commitPreparedWorldInteraction(prepared);
    expect(registryProbe).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(readCaseState()).toEqual(caseStateBefore);
  });

  it("cancels and removes a prepared E3 interaction when runtime failure supersedes it", async () => {
    const e3 = findInteraction(
      (request) =>
        request.canonicalTarget.targetType === "evidence" &&
        request.canonicalTarget.evidenceId === "E3",
    );
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;
    act(() => reportNearbyInteraction?.(e3));
    fireEvent.click(
      screen.getByRole("button", { name: /inspect drouet account table/i }),
    );
    const interactionRequestId = expectPendingWorldTransaction({
      actionKind: "interaction",
      caseStateBefore,
      resetGenerationBefore,
    });
    const prepared = latestPreparedInteraction();
    const resetGenerationAfterInteraction = runtimeMovementResetGeneration;

    act(() => reportContextLost?.());

    expect(interactionAdapterMocks.cancel).toHaveBeenCalledTimes(1);
    expect(interactionAdapterMocks.cancel).toHaveBeenCalledWith(prepared, {
      status: "cancelled",
    });
    expect(cameraBoundaryMocks.pendingReleases).toHaveLength(2);
    const runtimeRequestId = cameraBoundaryMocks.pendingReleases[1]?.requestId;
    expect(runtimeRequestId).toBeGreaterThan(interactionRequestId);
    expect(runtimeMovementResetGeneration).toBeGreaterThan(
      resetGenerationAfterInteraction ?? -1,
    );
    expect(runtimeLocomotionEnabled).toBe(false);
    expect(cameraBoundaryMocks.captureEligible).toBe(false);
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("world-hud")).toHaveAttribute(
      "data-pending-action",
      "runtime_unavailable",
    );
    expect(Number(screen.getByTestId("world-hud").dataset.pendingRequestId)).toBe(
      runtimeRequestId,
    );

    const registryProbe =
      interactionAdapterMocks.current?.commitPreparedWorldInteraction(prepared);
    expect(registryProbe).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(readCaseState()).toEqual(caseStateBefore);
    expectEventsInOrder(
      `release-request:${interactionRequestId}`,
      `interaction-cancel:${prepared.preparedId}:cancelled`,
      `release-request:${runtimeRequestId}`,
    );

    await resolveControlledReleaseAt(0);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeNull();
    expect(readCaseState()).toEqual(caseStateBefore);

    await resolveControlledReleaseAt(0);

    expect(
      await screen.findByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeInTheDocument();
    expect(readCaseState()).toEqual(caseStateBefore);
    expectEventsInOrder(
      `release-ack:${interactionRequestId}:released`,
      `release-ack:${runtimeRequestId}:released`,
    );
  });

  it("ignores stale release completion and times out instead of waiting indefinitely", async () => {
    vi.useFakeTimers();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);

    fireEvent.click(
      screen.getByRole("button", { name: /open route journal/i }),
    );
    const requestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;
    await resolveControlledReleaseAt(0, {
      requestId: (requestId ?? 1) - 1,
      status: "released",
    });

    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1_600);
      await Promise.resolve();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/camera input/i);
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
  });

  it("ignores an old timed-out completion after a retry has started", async () => {
    vi.useFakeTimers();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    fireEvent.click(
      screen.getByRole("button", { name: /open route journal/i }),
    );
    const oldRequestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;
    await act(async () => {
      vi.advanceTimersByTime(1_600);
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    const newRequestId = cameraBoundaryMocks.pendingReleases[1]?.requestId;
    expect(newRequestId).toBeGreaterThan(oldRequestId ?? -1);

    await resolveControlledReleaseAt(0);
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
    await resolveControlledReleaseAt(0);

    expect(
      screen.getByRole("dialog", { name: /case journal/i }),
    ).toBeInTheDocument();
  });

  it("defers context-loss presentation until release and resets movement immediately", async () => {
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    const initialResetGeneration = runtimeMovementResetGeneration;
    const caseStateBefore = readCaseState();

    act(() => reportContextLost?.());

    const requestId = expectPendingWorldTransaction({
      actionKind: "runtime_unavailable",
      caseStateBefore,
      resetGenerationBefore: initialResetGeneration,
    });
    expect(
      screen.queryByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeNull();
    expect(screen.getByTestId("scene-runtime")).toBeInTheDocument();
    await resolveControlledReleaseAt(0);

    expectMatchingReleaseAcknowledged(requestId);
    expect(
      await screen.findByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeInTheDocument();
    expect(readCaseState()).toEqual(caseStateBefore);
    expect(screen.getByText(/graphics context was interrupted/i)).toBeInTheDocument();
  });

  it("supersedes an opening surface when the runtime fails and ignores its stale release", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);

    await user.click(
      screen.getByRole("button", { name: /open route journal/i }),
    );
    const journalRequestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;

    act(() => reportContextLost?.());

    expect(cameraBoundaryMocks.pendingReleases).toHaveLength(2);
    const runtimeRequestId = cameraBoundaryMocks.pendingReleases[1]?.requestId;
    expect(runtimeRequestId).toBeGreaterThan(journalRequestId ?? -1);
    await resolveControlledReleaseAt(0);
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeNull();

    await resolveControlledReleaseAt(0);

    expect(
      await screen.findByRole("heading", { name: /3d reconstruction unavailable/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /case journal/i })).toBeNull();
  });

  it("keeps the camera boundary mounted while deferring scene-error presentation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true);
    sceneShouldThrow = true;
    const caseStateBefore = readCaseState();
    const resetGenerationBefore = runtimeMovementResetGeneration;

    await user.click(screen.getByRole("button", { name: "Guidance guided" }));

    const requestId = expectPendingWorldTransaction({
      actionKind: "runtime_unavailable",
      caseStateBefore,
      resetGenerationBefore,
      runtimeUnmounted: true,
    });
    expect(screen.queryByTestId("world-runtime-fallback")).toBeNull();
    await resolveControlledReleaseAt(0);

    expectMatchingReleaseAcknowledged(requestId);
    expect(await screen.findByTestId("world-runtime-fallback")).toBeInTheDocument();
    expect(readCaseState()).toEqual(caseStateBefore);
    consoleError.mockRestore();
  });

  it.each([
    {
      destination: "/",
      linkName: "History Unbroken",
      phase: "primer" as const,
    },
    {
      destination: "/play",
      linkName: "Return to case briefing",
      phase: "primer" as const,
    },
    {
      destination: "/play/investigate",
      linkName: "Use non-spatial investigation",
      phase: "investigation" as const,
      modeAfterRelease: "non_spatial",
    },
    {
      destination: "/play/repair",
      linkName: "Continue timeline repair",
      phase: "repair" as const,
    },
    {
      destination: "/play/debrief",
      linkName: "Open learning summary",
      phase: "debrief" as const,
    },
  ])(
    "defers internal navigation to $destination until release",
    async ({ destination, linkName, phase, modeAfterRelease }) => {
      const user = userEvent.setup();
      cameraBoundaryMocks.holdReleases();
      renderShell(() => true, {
        ...createInitialCaseState(casePackage),
        phase,
      });
      const storedBeforeClick = window.localStorage.getItem(
        SPATIAL_SESSION_STORAGE_KEY,
      );

      await user.click(screen.getByRole("link", { name: linkName }));

      expect(routerMocks.push).not.toHaveBeenCalled();
      expect(window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY)).toBe(
        storedBeforeClick,
      );
      expect(runtimeLocomotionEnabled).toBe(false);
      expect(cameraBoundaryMocks.captureEligible).toBe(false);
      await resolveControlledReleaseAt(0);

      await waitFor(() => expect(routerMocks.push).toHaveBeenCalledWith(destination));
      expect(runtimeLocomotionEnabled).toBe(false);
      expect(cameraBoundaryMocks.captureEligible).toBe(false);
      const storedAfterRelease = JSON.parse(
        window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY) ?? "null",
      );
      if (modeAfterRelease) {
        expect(storedAfterRelease.mode).toBe(modeAfterRelease);
      } else {
        expect(storedAfterRelease.mode).toBe("spatial");
      }
    },
  );

  it("advances the repair phase only after the camera release is acknowledged", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    const initialState = repairReadyCaseState();

    renderShell(() => true, initialState);
    await user.click(
      screen.getByRole("button", { name: /open causal caseboard/i }),
    );
    await resolveControlledReleaseAt(0);
    const repairLink = await screen.findByRole("link", {
      name: /review timeline repair/i,
    });

    await user.click(repairLink);

    expect(readCaseState().phase).toBe("case_brief");
    expect(routerMocks.push).not.toHaveBeenCalledWith("/play/repair");
    await resolveControlledReleaseAt(0);

    await waitFor(() => expect(readCaseState().phase).toBe("repair"));
    expect(routerMocks.push).toHaveBeenCalledWith("/play/repair");
  });

  it("does not advance the repair phase when camera release fails", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, repairReadyCaseState());
    await user.click(
      screen.getByRole("button", { name: /open causal caseboard/i }),
    );
    await resolveControlledReleaseAt(0);
    await user.click(
      await screen.findByRole("link", { name: /review timeline repair/i }),
    );

    await resolveControlledReleaseAt(0, {
      requestId: cameraBoundaryMocks.pendingReleases[0]!.requestId,
      status: "failed",
      reason: "pointer_lock_still_active",
    });

    expect(readCaseState().phase).toBe("case_brief");
    expect(routerMocks.push).not.toHaveBeenCalledWith("/play/repair");
    expect(
      screen.queryByRole("dialog", { name: /causal caseboard/i }),
    ).toBeNull();
    const retryButton = screen.getByRole("button", {
      name: /retry world action/i,
    });
    expect(retryButton).toBeVisible();
    expect(retryButton).toHaveFocus();
  });

  it("unwinds the caseboard when repair eligibility changes during release", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, repairReadyCaseState());
    await user.click(
      screen.getByRole("button", { name: /open causal caseboard/i }),
    );
    await resolveControlledReleaseAt(0);
    await user.click(
      await screen.findByRole("link", { name: /review timeline repair/i }),
    );

    act(() => {
      issueCaseCommand?.({
        type: "remove_causal_node",
        nodeId: casePackage.solution.requiredCausalNodeIds[0],
      });
    });
    await resolveControlledReleaseAt(0);

    expect(readCaseState().phase).toBe("case_brief");
    expect(routerMocks.push).not.toHaveBeenCalledWith("/play/repair");
    expect(
      screen.queryByRole("dialog", { name: /causal caseboard/i }),
    ).toBeNull();
    expect(
      screen.getByText(
        /case is no longer eligible for repair.*review the caseboard/i,
      ),
    ).toBeInTheDocument();
    const reviewButton = screen.getByRole("button", {
      name: /review caseboard/i,
    });
    expect(reviewButton).toHaveFocus();

    await user.click(reviewButton);
    await resolveControlledReleaseAt(0);

    expect(
      await screen.findByRole("dialog", { name: /causal caseboard/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/causal chain incomplete/i)).toBeInTheDocument();
  });

  it("does not mutate the current case for a modified repair-link click", async () => {
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, repairReadyCaseState());
    fireEvent.click(
      screen.getByRole("button", { name: /open causal caseboard/i }),
    );
    await resolveControlledReleaseAt(0);
    const requestCountBeforeModifiedClick =
      cameraBoundaryMocks.requestRelease.mock.calls.length;

    const preventExternalNavigation = (event: MouseEvent) =>
      event.preventDefault();
    window.addEventListener("click", preventExternalNavigation);
    fireEvent.click(
      await screen.findByRole("link", { name: /review timeline repair/i }),
      { ctrlKey: true },
    );
    window.removeEventListener("click", preventExternalNavigation);

    expect(readCaseState().phase).toBe("case_brief");
    expect(cameraBoundaryMocks.requestRelease).toHaveBeenCalledTimes(
      requestCountBeforeModifiedClick,
    );
    expect(routerMocks.push).not.toHaveBeenCalledWith("/play/repair");
  });

  it("leaves route and mode storage unchanged when navigation release fails", async () => {
    const user = userEvent.setup();
    cameraBoundaryMocks.holdReleases();
    renderShell(() => true, {
      ...createInitialCaseState(casePackage),
      phase: "investigation",
    });
    const storedBeforeClick = window.localStorage.getItem(
      SPATIAL_SESSION_STORAGE_KEY,
    );
    await user.click(
      screen.getByRole("link", { name: /use non-spatial investigation/i }),
    );
    const requestId = cameraBoundaryMocks.pendingReleases[0]?.requestId;

    await resolveControlledReleaseAt(0, {
      requestId: requestId ?? -1,
      status: "failed",
      reason: "pointer_lock_still_active",
    });

    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SPATIAL_SESSION_STORAGE_KEY)).toBe(
      storedBeforeClick,
    );
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});
