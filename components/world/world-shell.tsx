"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type MouseEvent,
} from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { InvestigationModeLink } from "@/components/investigation-mode/investigation-mode-link";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { isInvestigationComplete } from "@/lib/case-engine/selectors";
import {
  ambientSoundReducer,
  createAmbientSoundscape,
  initialAmbientSoundState,
  shouldMuteAmbientSound,
  type AmbientSoundscape,
} from "@/lib/audio/ambient-soundscape";
import {
  GRAPHICS_PROFILES,
  selectInitialGraphicsTier,
  type GraphicsTier,
} from "@/lib/world/graphics-profile";
import {
  loadCameraPreferences,
  saveCameraPreferences,
  type CameraPreferences,
} from "@/lib/world/camera-preferences";
import {
  createPerformanceMonitor,
  recordPerformanceSample,
  type PerformanceMonitorState,
} from "@/lib/world/performance-monitor";
import {
  decideReasoningHandoff,
  getWorldReasoningHandoff,
} from "@/lib/world/reasoning-handoff";
import {
  createInitialSpatialSession,
  persistInvestigationMode,
  recordZoneVisit,
  requestFastTravel,
  resolveAuthoredSafeSpawn,
  restoreSpatialSession,
  serializeSpatialSession,
  SPATIAL_SESSION_STORAGE_KEY,
  type SafeSpawnReference,
  updateGuidanceSetting,
} from "@/lib/world/spatial-session";
import {
  canCaptureWorldPointer,
  canUseLocomotion,
  createWorldModeState,
  transitionWorldMode,
  type WorldModeState,
} from "@/lib/world/world-mode";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";
import { findVisitedZoneSpawn } from "@/lib/world/zone-discovery";
import type { SpatialSessionEnvelope } from "@/schemas/spatial-session";
import type {
  WorldInteractionRequest,
  WorldZoneId,
} from "@/schemas/world-manifest";

import { FocusOverlayHost } from "./focus-overlay-host";
import {
  CameraInputBoundary,
  createCameraInputChannel,
  type CameraInputBoundaryHandle,
} from "./camera/camera-input-boundary";
import { CameraSettingsPanel } from "./camera/camera-settings-panel";
import {
  useWorldInteractionAdapter,
  type PreparedWorldInteraction,
} from "./interaction-adapter";
import { CinematicConversation } from "./dialogue/cinematic-conversation";
import type { StationId } from "../characters/character-interview";
import {
  StaticDossier,
  type StaticDossierStationId,
} from "./dialogue/static-dossier";
import { SceneRuntime } from "./scene-runtime";
import {
  createZoneReadinessSnapshot,
  type ZoneReadinessSnapshot,
} from "./environment/zone-readiness-registry";
import { WorldErrorBoundary } from "./world-error-boundary";
import { WorldHud } from "./world-hud";
import { JournalMap } from "./journal/journal-map";
import { WorldCaseboardOverlay } from "./reasoning/world-caseboard-overlay";
import styles from "./world-shell.module.css";

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function initialGraphicsTier(): GraphicsTier {
  if (typeof navigator === "undefined") return "balanced";
  const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
  return selectInitialGraphicsTier({
    deviceMemoryGb: navigatorWithMemory.deviceMemory,
    hardwareConcurrency: navigator.hardwareConcurrency,
  });
}

const manifest = loadVarennesSceneManifest();
const ambientLines = loadVarennesAmbientLines();
const casePackage = loadVarennesCase();
const JOURNAL_FRACTURE_RECORD_IDS: ReadonlySet<string> = new Set([
  ...casePackage.anomalies.map((record) => record.id),
  ...casePackage.branchObservations.map((record) => record.id),
]);
const ACTIVE_RENDERED_ZONE_IDS: ReadonlySet<WorldZoneId> = new Set([
  "archive-antechamber",
  "post-road-square",
  "royal-lodging-civic-area",
  "bridge-approach",
]);
const RELEASE_ACK_TIMEOUT_MS = 1_500;
const CONTEXT_LOSS_REASON = "The graphics context was interrupted.";
const SCENE_RENDER_FAILURE_REASON = "The scene stopped while rendering.";

type PendingWorldAction = Readonly<{
  requestId: number;
  acceptedAt: number;
}> & (
  | { kind: "interaction"; prepared: PreparedWorldInteraction }
  | { kind: "journal"; source: "hud" | "nearby" }
  | { kind: "caseboard" }
  | { kind: "camera_settings" }
  | { kind: "runtime_unavailable"; reason: string }
  | {
      kind: "route_teardown";
      destination:
        | "/"
        | "/play"
        | "/play/investigate"
        | "/play/repair"
        | "/play/debrief";
      source:
        | "brand_link"
        | "briefing_link"
        | "non_spatial_link"
        | "case_handoff_link";
      modeAfterRelease?: "non_spatial";
      phaseAfterRelease?: "repair";
    }
);

type PendingWorldActionInput = PendingWorldAction extends infer Action
  ? Action extends PendingWorldAction
    ? Omit<Action, "requestId" | "acceptedAt">
    : never
  : never;

type RouteTeardownAction = Extract<
  PendingWorldAction,
  { kind: "route_teardown" }
>;

type FailedWorldAction = Readonly<{
  action: PendingWorldAction;
  reason: string;
  recovery: "retry_action" | "review_caseboard";
  retryRequest?: PreparedWorldInteraction["request"];
}>;

function isRouteTeardownDestination(
  destination: string,
): destination is RouteTeardownAction["destination"] {
  return (
    destination === "/" ||
    destination === "/play" ||
    destination === "/play/investigate" ||
    destination === "/play/repair" ||
    destination === "/play/debrief"
  );
}

function interactionModeEvent(
  prepared: PreparedWorldInteraction,
): { type: "open_focus" } | { type: "start_cinematic" } | null {
  const { target } = prepared;
  if (target.targetType === "evidence" || target.targetType === "case_surface") {
    return { type: "open_focus" };
  }
  if (isGeneratedDialogueStationId(target.stationId)) {
    return { type: "start_cinematic" };
  }
  if (isStaticDossierStationId(target.stationId)) {
    return { type: "open_focus" };
  }
  return null;
}

type BrowserStorageKind = "localStorage" | "sessionStorage";

function readBrowserStorage(
  storageKind: BrowserStorageKind,
  key: string,
): string | null {
  try {
    return window[storageKind].getItem(key);
  } catch {
    return null;
  }
}

function writeBrowserStorage(
  storageKind: BrowserStorageKind,
  key: string,
  value: string,
): boolean {
  try {
    window[storageKind].setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function resolveControllerStartPosition(
  session: ReturnType<typeof createInitialSpatialSession>,
): [number, number, number] {
  const safeSpawn = resolveAuthoredSafeSpawn(manifest, session.lastSafeSpawn);
  if (!safeSpawn) {
    throw new Error("The spatial session requires an authored safe spawn.");
  }
  return [
    safeSpawn.position[0],
    safeSpawn.position[1] + 1.2,
    safeSpawn.position[2],
  ];
}

function isStaticDossierStationId(
  stationId: string,
): stationId is StaticDossierStationId {
  return (
    stationId === "STATION-VARENNES-CIVIC" ||
    stationId === "STATION-ASSEMBLY"
  );
}

function isGeneratedDialogueStationId(stationId: string): stationId is StationId {
  return stationId === "CHAR-DROUET" || stationId === "CHAR-LOUIS";
}

interface WorldShellProps {
  capabilityCheck?: () => boolean;
}

interface WorldUnavailableProps {
  compact?: boolean;
  onRetry: () => void;
  reason: string;
}

function WorldUnavailable({ compact = false, onRetry, reason }: WorldUnavailableProps) {
  const Tag = compact ? "section" : "main";

  return (
    <Tag
      className={compact ? styles.runtimeUnavailable : styles.unavailable}
      data-testid={compact ? "world-runtime-fallback" : "world-canvas-shell"}
    >
      <AlertTriangle aria-hidden="true" />
      <p className={styles.eyebrow}>Spatial reconstruction / Paused</p>
      <h1>3D reconstruction unavailable.</h1>
      <p>{reason} Your historical case progress remains available in the non-spatial route.</p>
      <div>
        <button onClick={onRetry} type="button">
          <RefreshCw aria-hidden="true" />
          Retry 3D reconstruction
        </button>
        <InvestigationModeLink href="/play/investigate" mode="non_spatial">
          Use non-spatial investigation
        </InvestigationModeLink>
      </div>
    </Tag>
  );
}

export function WorldShell({ capabilityCheck = supportsWebGL }: WorldShellProps) {
  const { issue, state } = useCaseSession();
  const router = useRouter();
  const courseAlignment = useOptionalCourseAlignment();
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const [webglAvailable, setWebglAvailable] = useState(capabilityCheck);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [runtimeIssue, setRuntimeIssue] = useState<string | null>(null);
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const [routeTeardownActive, setRouteTeardownActive] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [zoneReadiness, setZoneReadiness] = useState<ZoneReadinessSnapshot>(
    () => createZoneReadinessSnapshot(0),
  );
  const [worldCanvas, setWorldCanvas] = useState<HTMLCanvasElement | null>(null);
  const [graphicsTier, setGraphicsTier] = useState<GraphicsTier>(initialGraphicsTier);
  const [cameraPreferences, setCameraPreferences] =
    useState<CameraPreferences>(loadCameraPreferences);
  const [offerNonSpatial, setOfferNonSpatial] = useState(false);
  const [ambientSound, dispatchAmbientSound] = useReducer(
    ambientSoundReducer,
    initialAmbientSoundState,
  );
  const [worldMode, setWorldMode] = useState<WorldModeState>(createWorldModeState);
  const [nearbyInteraction, setNearbyInteraction] =
    useState<WorldInteractionRequest | null>(null);
  const [focusedEvidenceId, setFocusedEvidenceId] = useState<string | null>(null);
  const [focusedStationId, setFocusedStationId] = useState<StationId | null>(null);
  const [focusedStaticStationId, setFocusedStaticStationId] =
    useState<StaticDossierStationId | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [caseboardOpen, setCaseboardOpen] = useState(false);
  const [cameraSettingsOpen, setCameraSettingsOpen] = useState(false);
  const [movementResetGeneration, setMovementResetGeneration] = useState(0);
  const [pendingAction, setPendingAction] =
    useState<PendingWorldAction | null>(null);
  const [failedAction, setFailedAction] = useState<FailedWorldAction | null>(
    null,
  );
  const [spatialSession, setSpatialSession] = useState(() => {
    const serialized = readBrowserStorage(
      "localStorage",
      SPATIAL_SESSION_STORAGE_KEY,
    );
    return serialized
      ? restoreSpatialSession(manifest, serialized).session
      : createInitialSpatialSession(manifest);
  });
  const [runtimePlayerPosition, setRuntimePlayerPosition] = useState(() =>
    resolveControllerStartPosition(spatialSession),
  );
  const interactionButtonRef = useRef<HTMLButtonElement>(null);
  const journalButtonRef = useRef<HTMLButtonElement>(null);
  const journalInvokerRef = useRef<HTMLElement>(null);
  const reasoningButtonRef = useRef<HTMLButtonElement>(null);
  const cameraSettingsButtonRef = useRef<HTMLButtonElement>(null);
  const failureRetryButtonRef = useRef<HTMLButtonElement>(null);
  const playerPositionOutputRef = useRef<HTMLOutputElement>(null);
  const cameraInputBoundaryRef = useRef<CameraInputBoundaryHandle>(null);
  const [cameraInputChannel] = useState(createCameraInputChannel);
  const cameraInputSnapshot = useSyncExternalStore(
    cameraInputChannel.subscribe,
    cameraInputChannel.getSnapshot,
    cameraInputChannel.getSnapshot,
  );
  const cameraPreferencesRef = useRef(cameraPreferences);
  const {
    cancelPreparedWorldInteraction,
    commitPreparedWorldInteraction,
    prepareWorldInteraction,
  } = useWorldInteractionAdapter();
  const performanceMonitor = useRef<PerformanceMonitorState>(
    createPerformanceMonitor(graphicsTier),
  );
  const ambientSoundscapeRef = useRef<AmbientSoundscape | null>(null);
  const performanceSamplesRef = useRef<
    Array<{ fps: number; timestampMs: number }>
  >([]);
  const spatialSessionRef = useRef(spatialSession);
  const persistedSpatialSessionRef = useRef<string | null>(null);
  const worldModeRef = useRef(worldMode);
  const caseStateRef = useRef(state);
  const pendingActionRef = useRef<PendingWorldAction | null>(null);
  const pendingPreparedInteractionRef = useRef<{
    prepared: PreparedWorldInteraction;
    requestId: number;
  } | null>(null);
  const failedActionRef = useRef<FailedWorldAction | null>(null);
  const nextRequestIdRef = useRef(0);
  const lastAcceptedAtRef = useRef(0);
  const releaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coordinatorMountedRef = useRef(true);
  const browserActivityActiveRef = useRef(true);
  const testMode =
    process.env.NEXT_PUBLIC_WORLD_TEST_MODE === "1" ||
    readBrowserStorage("sessionStorage", "history-unbroken:world-test-mode") ===
      "1";
  const telemetryEnabled =
    readBrowserStorage("sessionStorage", "history-unbroken:world-telemetry") ===
    "1";
  const performanceTelemetryEnabled =
    readBrowserStorage(
      "sessionStorage",
      "history-unbroken:world-performance-telemetry",
    ) === "1";
  const reasoningHandoff = getWorldReasoningHandoff(
    state,
    isInvestigationComplete(casePackage, state),
  );

  useLayoutEffect(() => {
    worldModeRef.current = worldMode;
    caseStateRef.current = state;
  }, [state, worldMode]);

  const persistCameraPreferences = useCallback(
    (nextPreferences: CameraPreferences) => {
      const current = cameraPreferencesRef.current;
      if (
        current.sensitivity === nextPreferences.sensitivity &&
        current.invertY === nextPreferences.invertY &&
        current.pointerLockIntroduced ===
          nextPreferences.pointerLockIntroduced
      ) {
        return;
      }
      cameraPreferencesRef.current = nextPreferences;
      setCameraPreferences(nextPreferences);
      saveCameraPreferences(nextPreferences);
    },
    [],
  );

  useEffect(() => {
    if (
      !cameraInputSnapshot.pointerLockActive ||
      cameraPreferencesRef.current.pointerLockIntroduced
    ) {
      return;
    }
    persistCameraPreferences({
      ...cameraPreferencesRef.current,
      pointerLockIntroduced: true,
    });
  }, [cameraInputSnapshot.pointerLockActive, persistCameraPreferences]);

  useEffect(() => {
    if (
      failedAction?.action.kind === "route_teardown" &&
      failedAction.action.source === "case_handoff_link"
    ) {
      failureRetryButtonRef.current?.focus();
    }
  }, [failedAction]);

  const clearReleaseDeadline = useCallback(() => {
    if (releaseTimeoutRef.current === null) return;
    clearTimeout(releaseTimeoutRef.current);
    releaseTimeoutRef.current = null;
  }, []);

  const unwindCaseHandoffForFailure = useCallback(
    (action: PendingWorldAction) => {
      if (
        action.kind !== "route_teardown" ||
        action.source !== "case_handoff_link"
      ) {
        return;
      }
      setCaseboardOpen(false);
      const transition = transitionWorldMode(worldModeRef.current, {
        type: "return_to_exploring",
      });
      if (!transition.allowed) return;
      worldModeRef.current = transition.state;
      setWorldMode(transition.state);
    },
    [],
  );

  const failPendingAction = useCallback(
    (action: PendingWorldAction, reason: string) => {
      if (
        !coordinatorMountedRef.current ||
        pendingActionRef.current?.requestId !== action.requestId
      ) {
        return;
      }

      clearReleaseDeadline();
      pendingActionRef.current = null;
      const pendingPrepared = pendingPreparedInteractionRef.current;
      pendingPreparedInteractionRef.current = null;
      if (pendingPrepared?.requestId === action.requestId) {
        cancelPreparedWorldInteraction(pendingPrepared.prepared);
      }
      const failure: FailedWorldAction = pendingPrepared
        ? {
            action,
            reason,
            recovery: "retry_action",
            retryRequest: pendingPrepared.prepared.request,
          }
        : { action, reason, recovery: "retry_action" };
      unwindCaseHandoffForFailure(action);
      failedActionRef.current = failure;
      setPendingAction(null);
      setFailedAction(failure);
    },
    [
      cancelPreparedWorldInteraction,
      clearReleaseDeadline,
      unwindCaseHandoffForFailure,
    ],
  );

  const cancelPendingAction = useCallback(
    (action: PendingWorldAction) => {
      if (pendingActionRef.current?.requestId !== action.requestId) return;

      clearReleaseDeadline();
      pendingActionRef.current = null;
      const pendingPrepared = pendingPreparedInteractionRef.current;
      pendingPreparedInteractionRef.current = null;
      if (pendingPrepared?.requestId === action.requestId) {
        cancelPreparedWorldInteraction(pendingPrepared.prepared);
      }
      setPendingAction(null);
    },
    [cancelPreparedWorldInteraction, clearReleaseDeadline],
  );

  const finalizePendingAction = useCallback(
    (action: PendingWorldAction) => {
      if (
        !coordinatorMountedRef.current ||
        pendingActionRef.current?.requestId !== action.requestId
      ) {
        return;
      }

      const pendingPrepared = pendingPreparedInteractionRef.current;
      const prepared =
        pendingPrepared?.requestId === action.requestId
          ? pendingPrepared.prepared
          : null;

      let nextWorldMode: WorldModeState | null = null;
      if (action.kind === "interaction") {
        const event = interactionModeEvent(action.prepared);
        if (!event) {
          failPendingAction(action, "The requested world surface is unavailable.");
          return;
        }
        const transition = transitionWorldMode(worldModeRef.current, event);
        if (!transition.allowed) {
          failPendingAction(action, "The requested world surface is no longer available.");
          return;
        }
        nextWorldMode = transition.state;
      } else if (
        action.kind === "journal" ||
        action.kind === "camera_settings"
      ) {
        const transition = transitionWorldMode(worldModeRef.current, {
          type: "open_focus",
        });
        if (!transition.allowed) {
          failPendingAction(action, "The requested world surface is no longer available.");
          return;
        }
        nextWorldMode = transition.state;
      } else if (action.kind === "caseboard") {
        const currentState = caseStateRef.current;
        const handoff = getWorldReasoningHandoff(
          currentState,
          isInvestigationComplete(casePackage, currentState),
        );
        const prospectiveState = handoff.command
          ? { ...currentState, phase: "case_brief" as const }
          : currentState;
        const decision = decideReasoningHandoff(
          prospectiveState,
          worldModeRef.current,
          { type: "open_caseboard" },
        );
        if (!decision.allowed) {
          failPendingAction(action, "The caseboard is no longer available.");
          return;
        }
        nextWorldMode = decision.state;
      }

      clearReleaseDeadline();
      pendingActionRef.current = null;
      pendingPreparedInteractionRef.current = null;

      const presentFinalizationFailure = (
        reason: string,
        retryRequest?: PreparedWorldInteraction["request"],
        recovery: FailedWorldAction["recovery"] = "retry_action",
      ) => {
        unwindCaseHandoffForFailure(action);
        const failure: FailedWorldAction = retryRequest
          ? { action, reason, recovery, retryRequest }
          : { action, reason, recovery };
        failedActionRef.current = failure;
        setPendingAction(null);
        setFailedAction(failure);
      };

      if (
        action.kind === "interaction" ||
        (action.kind === "journal" && action.source === "nearby")
      ) {
        if (!prepared) {
          presentFinalizationFailure(
            "The prepared world interaction expired before it could open.",
            action.kind === "interaction" ? action.prepared.request : undefined,
          );
          return;
        }
        const outcome = commitPreparedWorldInteraction(prepared);
        if (outcome.status !== "opened") {
          presentFinalizationFailure(
            "The prepared world interaction could not be committed.",
            prepared.request,
          );
          return;
        }
      }

      if (action.kind === "caseboard") {
        const currentState = caseStateRef.current;
        const handoff = getWorldReasoningHandoff(
          currentState,
          isInvestigationComplete(casePackage, currentState),
        );
        if (handoff.command) {
          const result = issue(handoff.command);
          if (result.status === "rejected" || result.status === "stale") {
            presentFinalizationFailure(
              "The case phase changed before the caseboard could open.",
            );
            return;
          }
          caseStateRef.current = result.state;
        }
      }

      setPendingAction(null);
      failedActionRef.current = null;
      setFailedAction(null);

      if (action.kind === "route_teardown") {
        if (action.phaseAfterRelease) {
          const result = issue({
            type: "advance_phase",
            phase: action.phaseAfterRelease,
          });
          if (result.status === "rejected" || result.status === "stale") {
            presentFinalizationFailure(
              "The case is no longer eligible for repair. Review the caseboard before continuing.",
              undefined,
              "review_caseboard",
            );
            return;
          }
          caseStateRef.current = result.state;
        }
        setRouteTeardownActive(true);
        if (action.modeAfterRelease) {
          try {
            const nextSession = persistInvestigationMode(
              window.localStorage,
              manifest,
              action.modeAfterRelease,
            );
            spatialSessionRef.current = nextSession;
            persistedSpatialSessionRef.current = serializeSpatialSession(nextSession);
          } catch {
            // Navigation remains available when browser storage is unavailable.
          }
        }
        router.push(action.destination);
        return;
      }

      if (action.kind === "runtime_unavailable") {
        if (action.reason === SCENE_RENDER_FAILURE_REASON) {
          setRuntimeFailed(true);
        } else {
          setRuntimeIssue(action.reason);
        }
        return;
      }

      if (!nextWorldMode) return;
      worldModeRef.current = nextWorldMode;
      setWorldMode(nextWorldMode);
      if (action.kind === "interaction") {
        const { target } = action.prepared;
        if (target.targetType === "evidence") {
          setFocusedEvidenceId(target.evidenceId);
        } else if (target.targetType === "station") {
          if (isGeneratedDialogueStationId(target.stationId)) {
            setFocusedStationId(target.stationId);
          } else if (isStaticDossierStationId(target.stationId)) {
            setFocusedStaticStationId(target.stationId);
          }
        }
      } else if (action.kind === "journal") {
        journalInvokerRef.current =
          action.source === "nearby"
            ? interactionButtonRef.current
            : journalButtonRef.current;
        setJournalOpen(true);
      } else if (action.kind === "caseboard") {
        setCaseboardOpen(true);
      } else if (action.kind === "camera_settings") {
        setCameraSettingsOpen(true);
      }
    },
    [
      clearReleaseDeadline,
      commitPreparedWorldInteraction,
      failPendingAction,
      issue,
      router,
      unwindCaseHandoffForFailure,
    ],
  );

  const acceptPendingAction = useCallback(
    (
      input: PendingWorldActionInput,
      preparedInteraction?: PreparedWorldInteraction,
    ): boolean => {
      if (pendingActionRef.current !== null) return false;

      nextRequestIdRef.current += 1;
      const acceptedAt = Math.max(Date.now(), lastAcceptedAtRef.current + 1);
      lastAcceptedAtRef.current = acceptedAt;
      const action = Object.freeze({
        ...input,
        requestId: nextRequestIdRef.current,
        acceptedAt,
      }) as PendingWorldAction;
      const prepared =
        input.kind === "interaction" ? input.prepared : preparedInteraction;

      pendingActionRef.current = action;
      pendingPreparedInteractionRef.current = prepared
        ? { requestId: action.requestId, prepared }
        : null;
      failedActionRef.current = null;
      setFailedAction(null);
      setPendingAction(action);
      setMovementResetGeneration((generation) => generation + 1);
      cameraInputBoundaryRef.current?.clearLookInput();

      releaseTimeoutRef.current = setTimeout(() => {
        failPendingAction(
          action,
          "Camera input did not acknowledge release before the timeout.",
        );
      }, RELEASE_ACK_TIMEOUT_MS);

      const boundary = cameraInputBoundaryRef.current;
      if (!boundary) {
        queueMicrotask(() =>
          failPendingAction(action, "Camera input release is currently unavailable."),
        );
        return true;
      }

      try {
        void boundary
          .requestRelease(action.requestId)
          .then((result) => {
            if (result.requestId !== action.requestId) return;
            if (result.status === "failed") {
              failPendingAction(
                action,
                "Camera input could not be released. Try again.",
              );
              return;
            }
            finalizePendingAction(action);
          })
          .catch(() => {
            failPendingAction(action, "Camera input release failed unexpectedly.");
          });
      } catch {
        failPendingAction(action, "Camera input release failed unexpectedly.");
      }
      return true;
    },
    [failPendingAction, finalizePendingAction],
  );

  const retry = useCallback(() => {
    setSceneReady(false);
    setRuntimeFailed(false);
    setWorldCanvas(null);
    setWebglAvailable(capabilityCheck());
    setCapabilityAttempt((attempt) => attempt + 1);
    setRuntimeIssue(null);
    setNearbyInteraction(null);
    setRuntimePlayerPosition(
      resolveControllerStartPosition(spatialSessionRef.current),
    );
    setRuntimeKey((key) => key + 1);
  }, [capabilityCheck]);

  const activeZoneReadiness =
    zoneReadiness.runtimeKey === runtimeKey
      ? zoneReadiness
      : createZoneReadinessSnapshot(runtimeKey);

  const reportWorldCanvas = useCallback((canvas: HTMLCanvasElement) => {
    setWorldCanvas((current) => (current === canvas ? current : canvas));
  }, []);

  const recordFrame = useCallback((timestampMs: number, fps: number) => {
    if (performanceTelemetryEnabled) {
      performanceSamplesRef.current.push({ timestampMs, fps });
    }
    const result = recordPerformanceSample(performanceMonitor.current, {
      timestampMs,
      fps,
    });
    performanceMonitor.current = result.state;

    if (result.event?.type === "graphics_tier_downgraded") {
      setGraphicsTier(result.event.to);
    }
    if (result.event?.type === "offer_non_spatial_route") {
      setOfferNonSpatial(true);
    }
  }, [performanceTelemetryEnabled]);

  const toggleAmbientSound = useCallback(async () => {
    const nextMuted = !ambientSound.muted;
    let soundscape = ambientSoundscapeRef.current;
    try {
      if (!soundscape && !nextMuted) {
        soundscape = createAmbientSoundscape(new AudioContext());
        ambientSoundscapeRef.current = soundscape;
      }
      await soundscape?.setMuted(nextMuted);
      if (ambientSoundscapeRef.current !== soundscape) return;
      dispatchAmbientSound({ type: "mute_changed", muted: nextMuted });
    } catch {
      if (ambientSoundscapeRef.current !== soundscape) return;
      ambientSoundscapeRef.current = null;
      if (soundscape) void soundscape.destroy();
      dispatchAmbientSound({ type: "mute_changed", muted: true });
    }
  }, [ambientSound.muted]);

  const recordPlayerPosition = useCallback((position: [number, number, number]) => {
    if (playerPositionOutputRef.current) {
      playerPositionOutputRef.current.dataset.position = JSON.stringify(position);
    }
    const visitedSpawn = findVisitedZoneSpawn(
      manifest,
      position,
      8,
      ACTIVE_RENDERED_ZONE_IDS,
    );
    if (!visitedSpawn) return;

    const current = spatialSessionRef.current;
    const currentSerialized = serializeSpatialSession(current);
    if (
      current.lastSafeSpawn.zoneId === visitedSpawn.zoneId &&
      current.lastSafeSpawn.spawnId === visitedSpawn.spawnId
    ) {
      if (
        persistedSpatialSessionRef.current !== currentSerialized &&
        writeBrowserStorage(
          "localStorage",
          SPATIAL_SESSION_STORAGE_KEY,
          currentSerialized,
        )
      ) {
        persistedSpatialSessionRef.current = currentSerialized;
      }
      return;
    }

    const result = recordZoneVisit(manifest, current, visitedSpawn);
    if (!result.accepted) return;
    spatialSessionRef.current = result.session;
    setSpatialSession(result.session);
    const serialized = serializeSpatialSession(result.session);
    if (
      writeBrowserStorage(
        "localStorage",
        SPATIAL_SESSION_STORAGE_KEY,
        serialized,
      )
    ) {
      persistedSpatialSessionRef.current = serialized;
    }
  }, []);

  useEffect(() => {
    const serialized = serializeSpatialSession(spatialSessionRef.current);
    const persisted = readBrowserStorage(
      "localStorage",
      SPATIAL_SESSION_STORAGE_KEY,
    );
    if (persisted === serialized) {
      persistedSpatialSessionRef.current = persisted;
      return;
    }
    if (
      writeBrowserStorage(
        "localStorage",
        SPATIAL_SESSION_STORAGE_KEY,
        serialized,
      )
    ) {
      persistedSpatialSessionRef.current = serialized;
    }
  }, []);

  useEffect(() => {
    if (!performanceTelemetryEnabled) return;
    const target = window as Window & {
      __historyUnbrokenWorldPerformance?: {
        samples: Array<{ fps: number; timestampMs: number }>;
      };
    };
    const bridge = { samples: performanceSamplesRef.current };
    target.__historyUnbrokenWorldPerformance = bridge;
    return () => {
      if (target.__historyUnbrokenWorldPerformance === bridge) {
        delete target.__historyUnbrokenWorldPerformance;
      }
    };
  }, [performanceTelemetryEnabled]);

  useEffect(
    () => () => {
      const soundscape = ambientSoundscapeRef.current;
      ambientSoundscapeRef.current = null;
      if (soundscape) void soundscape.destroy();
    },
    [],
  );

  useEffect(() => {
    coordinatorMountedRef.current = true;
    return () => {
      coordinatorMountedRef.current = false;
      clearReleaseDeadline();
      const pendingPrepared = pendingPreparedInteractionRef.current;
      pendingPreparedInteractionRef.current = null;
      pendingActionRef.current = null;
      if (pendingPrepared) {
        cancelPreparedWorldInteraction(pendingPrepared.prepared);
      }
    };
  }, [cancelPreparedWorldInteraction, clearReleaseDeadline]);

  useEffect(() => {
    if (webglAvailable && !runtimeIssue && !runtimeFailed) return;
    const soundscape = ambientSoundscapeRef.current;
    if (!soundscape) return;
    ambientSoundscapeRef.current = null;
    dispatchAmbientSound({ type: "mute_changed", muted: true });
    void soundscape.destroy();
  }, [runtimeFailed, runtimeIssue, webglAvailable]);

  useEffect(() => {
    const handleVisibility = () => {
      const soundscape = ambientSoundscapeRef.current;
      if (soundscape) {
        void soundscape
          .setMuted(
            shouldMuteAmbientSound({
              documentHidden: document.hidden,
              userMuted: ambientSound.muted,
            }),
          )
          .catch(() => {
            if (!document.hidden) {
              dispatchAmbientSound({ type: "mute_changed", muted: true });
            }
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [ambientSound.muted]);

  useEffect(() => {
    const coordinateBrowserActivity = () => {
      if (!coordinatorMountedRef.current) return;

      const active =
        document.visibilityState === "visible" && document.hasFocus();
      if (browserActivityActiveRef.current === active) return;
      browserActivityActiveRef.current = active;

      if (!active) {
        const activeAction = pendingActionRef.current;
        if (activeAction) cancelPendingAction(activeAction);
      }

      const transition = transitionWorldMode(worldModeRef.current, {
        type: active ? "resume" : "suspend",
      });
      if (!transition.allowed) return;
      if (!active) {
        setMovementResetGeneration((generation) => generation + 1);
      }
      worldModeRef.current = transition.state;
      setWorldMode(transition.state);
    };

    coordinateBrowserActivity();
    window.addEventListener("blur", coordinateBrowserActivity);
    window.addEventListener("focus", coordinateBrowserActivity);
    document.addEventListener("visibilitychange", coordinateBrowserActivity);
    return () => {
      window.removeEventListener("blur", coordinateBrowserActivity);
      window.removeEventListener("focus", coordinateBrowserActivity);
      document.removeEventListener("visibilitychange", coordinateBrowserActivity);
    };
  }, [cancelPendingAction]);

  const beginPreparedInteraction = useCallback(
    (request: unknown) => {
      if (worldModeRef.current.mode !== "exploring") return;
      const preparation = prepareWorldInteraction(request);
      if (preparation.status !== "prepared") return;
      const event = interactionModeEvent(preparation.prepared);
      if (!event) {
        cancelPreparedWorldInteraction(preparation.prepared);
        return;
      }
      const transition = transitionWorldMode(worldModeRef.current, event);
      if (!transition.allowed) {
        cancelPreparedWorldInteraction(preparation.prepared);
        return;
      }

      const accepted =
        preparation.prepared.target.targetType === "case_surface"
          ? acceptPendingAction(
              { kind: "journal", source: "nearby" },
              preparation.prepared,
            )
          : acceptPendingAction({
              kind: "interaction",
              prepared: preparation.prepared,
            });
      if (!accepted) cancelPreparedWorldInteraction(preparation.prepared);
    },
    [
      acceptPendingAction,
      cancelPreparedWorldInteraction,
      prepareWorldInteraction,
    ],
  );

  const openNearbyInteraction = useCallback(() => {
    if (!nearbyInteraction) return;
    beginPreparedInteraction(nearbyInteraction);
  }, [beginPreparedInteraction, nearbyInteraction]);

  const openJournal = useCallback(() => {
    if (worldModeRef.current.mode !== "exploring") return;
    const transition = transitionWorldMode(worldModeRef.current, {
      type: "open_focus",
    });
    if (!transition.allowed) return;
    acceptPendingAction({ kind: "journal", source: "hud" });
  }, [acceptPendingAction]);

  const openCameraSettings = useCallback(() => {
    if (worldModeRef.current.mode !== "exploring") return;
    const transition = transitionWorldMode(worldModeRef.current, {
      type: "open_focus",
    });
    if (!transition.allowed) return;
    acceptPendingAction({ kind: "camera_settings" });
  }, [acceptPendingAction]);

  const closeJournal = useCallback(() => {
    const transition = transitionWorldMode(worldMode, {
      type: "return_to_exploring",
    });
    if (!transition.allowed) return;
    setJournalOpen(false);
    worldModeRef.current = transition.state;
    setWorldMode(transition.state);
  }, [worldMode]);

  const fastTravel = useCallback(
    (destination: SafeSpawnReference) => {
      if (!journalOpen || worldMode.mode !== "focused") return;
      const result = requestFastTravel(
        manifest,
        spatialSessionRef.current,
        destination,
      );
      if (!result.accepted) return;
      const transition = transitionWorldMode(worldMode, {
        type: "return_to_exploring",
      });
      if (!transition.allowed) return;

      spatialSessionRef.current = result.session;
      setSpatialSession(result.session);
      const serialized = serializeSpatialSession(result.session);
      if (
        writeBrowserStorage(
          "localStorage",
          SPATIAL_SESSION_STORAGE_KEY,
          serialized,
        )
      ) {
        persistedSpatialSessionRef.current = serialized;
      }
      setRuntimePlayerPosition([
        result.safeSpawn.position[0],
        result.safeSpawn.position[1] + 1.2,
        result.safeSpawn.position[2],
      ]);
      setSceneReady(false);
      setNearbyInteraction(null);
      setRuntimeKey((key) => key + 1);
      setJournalOpen(false);
      worldModeRef.current = transition.state;
      setWorldMode(transition.state);
      journalInvokerRef.current = journalButtonRef.current;
      queueMicrotask(() => journalButtonRef.current?.focus());
    },
    [journalOpen, worldMode],
  );

  const inspectJournalRecord = useCallback(
    (recordId: string) => {
      if (!JOURNAL_FRACTURE_RECORD_IDS.has(recordId)) return;
      issue({ type: "inspect_item", itemId: recordId });
    },
    [issue],
  );

  const setGuidanceSetting = useCallback(
    (guidanceSetting: SpatialSessionEnvelope["guidanceSetting"]) => {
      const next = updateGuidanceSetting(
        spatialSessionRef.current,
        guidanceSetting,
      );
      spatialSessionRef.current = next;
      setSpatialSession(next);
      const serialized = serializeSpatialSession(next);
      if (
        writeBrowserStorage(
          "localStorage",
          SPATIAL_SESSION_STORAGE_KEY,
          serialized,
        )
      ) {
        persistedSpatialSessionRef.current = serialized;
      }
    },
    [],
  );

  const openCaseboard = useCallback(() => {
    const prospectiveState = reasoningHandoff.command
      ? { ...state, phase: "case_brief" as const }
      : state;
    const decision = decideReasoningHandoff(prospectiveState, worldModeRef.current, {
      type: "open_caseboard",
    });
    if (!decision.allowed) return;
    acceptPendingAction({ kind: "caseboard" });
  }, [acceptPendingAction, reasoningHandoff.command, state]);

  const closeCaseboard = useCallback(() => {
    const decision = decideReasoningHandoff(state, worldMode, {
      type: "return_to_exploration",
    });
    if (!decision.allowed) return;
    setCaseboardOpen(false);
    worldModeRef.current = decision.state;
    setWorldMode(decision.state);
  }, [state, worldMode]);

  const closeCameraSettings = useCallback(() => {
    const transition = transitionWorldMode(worldModeRef.current, {
      type: "return_to_exploring",
    });
    if (!transition.allowed) return;
    setCameraSettingsOpen(false);
    worldModeRef.current = transition.state;
    setWorldMode(transition.state);
    queueMicrotask(() => cameraSettingsButtonRef.current?.focus());
  }, []);

  const requestRuntimeUnavailable = useCallback(
    (reason: string) => {
      setSceneReady(false);
      const activeAction = pendingActionRef.current;
      if (activeAction?.kind === "runtime_unavailable") return;
      if (activeAction) cancelPendingAction(activeAction);
      acceptPendingAction({ kind: "runtime_unavailable", reason });
    },
    [acceptPendingAction, cancelPendingAction],
  );

  const retryFailedAction = useCallback(() => {
    const failure = failedActionRef.current;
    if (!failure || pendingActionRef.current) return;
    if (failure.recovery === "review_caseboard") {
      acceptPendingAction({ kind: "caseboard" });
      return;
    }
    if (failure.retryRequest) {
      beginPreparedInteraction(failure.retryRequest);
      return;
    }

    const { action } = failure;
    switch (action.kind) {
      case "journal":
        acceptPendingAction({ kind: "journal", source: action.source });
        return;
      case "caseboard":
        acceptPendingAction({ kind: "caseboard" });
        return;
      case "camera_settings":
        acceptPendingAction({ kind: "camera_settings" });
        return;
      case "runtime_unavailable":
        acceptPendingAction({
          kind: "runtime_unavailable",
          reason: action.reason,
        });
        return;
      case "route_teardown":
        acceptPendingAction({
          kind: "route_teardown",
          destination: action.destination,
          source: action.source,
          ...(action.modeAfterRelease
            ? { modeAfterRelease: action.modeAfterRelease }
            : {}),
          ...(action.phaseAfterRelease
            ? { phaseAfterRelease: action.phaseAfterRelease }
            : {}),
        });
        return;
      case "interaction":
        beginPreparedInteraction(action.prepared.request);
    }
  }, [acceptPendingAction, beginPreparedInteraction]);

  const handleWorldRouteClick = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank") return;
      const destination = anchor.getAttribute("href");
      if (!destination || !isRouteTeardownDestination(destination)) return;

      event.preventDefault();
      event.stopPropagation();
      const declaredSource = anchor.dataset.worldRouteSource;
      const source: RouteTeardownAction["source"] =
        declaredSource === "brand_link" ||
        declaredSource === "briefing_link" ||
        declaredSource === "non_spatial_link" ||
        declaredSource === "case_handoff_link"
          ? declaredSource
          : destination === "/"
            ? "brand_link"
            : destination === "/play"
              ? "briefing_link"
              : /non-spatial/i.test(anchor.textContent ?? "")
                ? "non_spatial_link"
                : "case_handoff_link";
      const modeAfterRelease =
        anchor.dataset.worldModeAfterRelease === "non_spatial" ||
        /non-spatial/i.test(anchor.textContent ?? "")
          ? "non_spatial"
          : undefined;
      const phaseAfterRelease =
        anchor.dataset.worldPhaseAfterRelease === "repair"
          ? "repair"
          : undefined;
      acceptPendingAction({
        kind: "route_teardown",
        destination,
        source,
        ...(modeAfterRelease ? { modeAfterRelease } : {}),
        ...(phaseAfterRelease ? { phaseAfterRelease } : {}),
      });
    },
    [acceptPendingAction],
  );

  useEffect(() => {
    const handleInteractionKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyE" || event.repeat) return;
      openNearbyInteraction();
    };
    window.addEventListener("keydown", handleInteractionKey);
    return () => window.removeEventListener("keydown", handleInteractionKey);
  }, [openNearbyInteraction]);

  const nearbyInteractionLabel = nearbyInteraction
    ? manifest.interactables.find(
        (item) => item.interactableId === nearbyInteraction.interactableId,
      )?.label ?? null
    : null;
  const currentZoneIndex = Math.max(
    0,
    manifest.zones.findIndex(
      (zone) => zone.zoneId === spatialSession.lastSafeSpawn.zoneId,
    ),
  );
  const currentZoneLabel =
    manifest.zones[currentZoneIndex]?.label ?? "Archive antechamber";
  const currentAmbientLineId =
    manifest.zones[currentZoneIndex]?.ambientLineIds[0];
  const currentAmbientCaption =
    ambientLines.lines.find(
      (line) => line.ambientLineId === currentAmbientLineId,
    )?.text ?? "This district has no authored ambient caption.";
  const runtimeTeardownActive =
    pendingAction !== null ||
    failedAction !== null ||
    routeTeardownActive ||
    runtimeIssue !== null ||
    runtimeFailed;
  const cameraCaptureEligible =
    canCaptureWorldPointer(worldMode) &&
    !runtimeTeardownActive;
  const locomotionEnabled =
    canUseLocomotion(worldMode) && !runtimeTeardownActive;

  if (!webglAvailable) {
    return (
      <WorldUnavailable
        key={capabilityAttempt}
        onRetry={retry}
        reason="This browser did not provide a usable WebGL context."
      />
    );
  }

  if (runtimeIssue) {
    return <WorldUnavailable onRetry={retry} reason={runtimeIssue} />;
  }

  return (
    <main
      className={styles.world}
      data-world-zone-readiness={JSON.stringify(activeZoneReadiness.zones)}
      data-world-zones-ready={activeZoneReadiness.allReady}
      data-testid="world-canvas-shell"
      onClickCapture={handleWorldRouteClick}
    >
      <div className={styles.canvasFrame} data-testid="world-canvas">
        <CameraInputBoundary
          cameraInputChannel={cameraInputChannel}
          canvas={worldCanvas}
          captureEligible={cameraCaptureEligible}
          ref={cameraInputBoundaryRef}
        >
          <WorldErrorBoundary
            onError={() => requestRuntimeUnavailable(SCENE_RENDER_FAILURE_REASON)}
            renderFallback={(boundaryRetry) =>
              runtimeFailed ? (
                <WorldUnavailable
                  compact
                  onRetry={() => {
                    boundaryRetry();
                    retry();
                  }}
                  reason={SCENE_RENDER_FAILURE_REASON}
                />
              ) : null
            }
            resetKey={runtimeKey}
          >
            <SceneRuntime
              cameraInputChannel={cameraInputChannel}
              cameraPreferences={cameraPreferences}
              graphicsProfile={GRAPHICS_PROFILES[graphicsTier]}
              initialPosition={runtimePlayerPosition}
              key={runtimeKey}
              locomotionEnabled={locomotionEnabled}
              movementResetGeneration={movementResetGeneration}
              reducedMotion={courseAlignment?.preferences.motionMode === "reduced"}
              onCanvasElement={reportWorldCanvas}
              onContextLost={() => requestRuntimeUnavailable(CONTEXT_LOSS_REASON)}
              onControllerReady={() => setSceneReady(true)}
              onNearbyInteractionChange={setNearbyInteraction}
              onPlayerPositionChange={recordPlayerPosition}
              onPerformanceSample={recordFrame}
              onZoneReadinessChange={setZoneReadiness}
              runtimeKey={runtimeKey}
              telemetryEnabled={telemetryEnabled}
              testMode={testMode}
            />
          </WorldErrorBoundary>
        </CameraInputBoundary>
      </div>
      <WorldHud
        ambientCaption={currentAmbientCaption}
        ambientMuted={ambientSound.muted}
        cameraInputSnapshot={cameraInputSnapshot}
        cameraPointerLockIntroduced={
          cameraPreferences.pointerLockIntroduced
        }
        cameraSettingsOpen={cameraSettingsOpen}
        cameraSettingsButtonRef={cameraSettingsButtonRef}
        currentZoneIndex={currentZoneIndex}
        currentZoneLabel={currentZoneLabel}
        graphicsTier={graphicsTier}
        handoffHref={reasoningHandoff.href}
        handoffLabel={reasoningHandoff.label}
        handoffOpensCaseboard={
          state.phase === "case_brief" || reasoningHandoff.command !== null
        }
        interactionButtonRef={interactionButtonRef}
        journalButtonRef={journalButtonRef}
        guidanceSetting={spatialSession.guidanceSetting}
        reasoningButtonRef={reasoningButtonRef}
        nearbyInteractionLabel={nearbyInteractionLabel}
        onAmbientMuteChange={() => void toggleAmbientSound()}
        onInteract={openNearbyInteraction}
        onGuidanceSettingChange={setGuidanceSetting}
        onOpenCameraSettings={openCameraSettings}
        onOpenJournal={openJournal}
        onOpenCaseboard={openCaseboard}
        offerNonSpatial={offerNonSpatial}
        pendingAction={pendingAction}
        ready={sceneReady}
        worldMode={worldMode.mode}
      />
      {failedAction ? (
        <section aria-labelledby="world-action-failure-heading" role="alert">
          <AlertTriangle aria-hidden="true" />
          <h2 id="world-action-failure-heading">
            {failedAction.recovery === "review_caseboard"
              ? "The case changed before repair."
              : "Unable to release camera input."}
          </h2>
          <p>{failedAction.reason}</p>
          <button
            onClick={retryFailedAction}
            ref={failureRetryButtonRef}
            type="button"
          >
            <RefreshCw aria-hidden="true" />
            {failedAction.recovery === "review_caseboard"
              ? "Review caseboard"
              : "Retry world action"}
          </button>
        </section>
      ) : null}
      {telemetryEnabled ? (
        <output
          aria-hidden="true"
          data-position="[]"
          data-testid="world-player-position"
          hidden
          ref={playerPositionOutputRef}
        />
      ) : null}
      {focusedEvidenceId ? (
        <FocusOverlayHost
          evidenceId={focusedEvidenceId}
          invokerRef={interactionButtonRef}
          onClose={() => {
            setFocusedEvidenceId(null);
            setWorldMode((current) =>
              transitionWorldMode(current, { type: "return_to_exploring" }).state,
            );
          }}
        />
      ) : null}
      {focusedStationId ? (
        <CinematicConversation
          fallbackFocusRef={journalButtonRef}
          invokerRef={interactionButtonRef}
          onClose={() => {
            setFocusedStationId(null);
            setWorldMode((current) =>
              transitionWorldMode(current, { type: "return_to_exploring" }).state,
            );
          }}
          stationId={focusedStationId}
        />
      ) : null}
      {focusedStaticStationId ? (
        <StaticDossier
          invokerRef={interactionButtonRef}
          onClose={() => {
            setFocusedStaticStationId(null);
            setWorldMode((current) =>
              transitionWorldMode(current, { type: "return_to_exploring" }).state,
            );
          }}
          stationId={focusedStaticStationId}
        />
      ) : null}
      {journalOpen ? (
        <JournalMap
          anomalyRecords={casePackage.anomalies}
          branchObservationRecords={casePackage.branchObservations}
          currentZoneId={spatialSession.lastSafeSpawn.zoneId}
          inspectedRecordIds={state.inspectedItemIds}
          invokerRef={journalInvokerRef}
          manifest={manifest}
          onClose={closeJournal}
          onFastTravel={fastTravel}
          onInspectRecord={inspectJournalRecord}
          spatialSession={spatialSession}
        />
      ) : null}
      {caseboardOpen ? (
        <WorldCaseboardOverlay
          invokerRef={reasoningButtonRef}
          onClose={closeCaseboard}
        />
      ) : null}
      {cameraSettingsOpen ? (
        <CameraSettingsPanel
          onChange={persistCameraPreferences}
          onClose={closeCameraSettings}
          preferences={cameraPreferences}
        />
      ) : null}
    </main>
  );
}
