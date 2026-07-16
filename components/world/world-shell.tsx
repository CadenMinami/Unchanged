"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { isInvestigationComplete } from "@/lib/case-engine/selectors";
import {
  GRAPHICS_PROFILES,
  selectInitialGraphicsTier,
  type GraphicsTier,
} from "@/lib/world/graphics-profile";
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
  canUseLocomotion,
  createWorldModeState,
  transitionWorldMode,
  type WorldModeState,
} from "@/lib/world/world-mode";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import { findVisitedZoneSpawn } from "@/lib/world/zone-discovery";
import type { SpatialSessionEnvelope } from "@/schemas/spatial-session";
import type {
  WorldInteractionRequest,
  WorldZoneId,
} from "@/schemas/world-manifest";

import { FocusOverlayHost } from "./focus-overlay-host";
import { useWorldInteractionAdapter } from "./interaction-adapter";
import { CinematicConversation } from "./dialogue/cinematic-conversation";
import type { StationId } from "../characters/character-interview";
import {
  StaticDossier,
  type StaticDossierStationId,
} from "./dialogue/static-dossier";
import { SceneRuntime } from "./scene-runtime";
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
        <Link href="/play/investigate">Use non-spatial investigation</Link>
      </div>
    </Tag>
  );
}

export function WorldShell({ capabilityCheck = supportsWebGL }: WorldShellProps) {
  const { issue, state } = useCaseSession();
  const courseAlignment = useOptionalCourseAlignment();
  const [capabilityAttempt, setCapabilityAttempt] = useState(0);
  const [webglAvailable, setWebglAvailable] = useState(capabilityCheck);
  const [runtimeKey, setRuntimeKey] = useState(0);
  const [runtimeIssue, setRuntimeIssue] = useState<string | null>(null);
  const [graphicsTier, setGraphicsTier] = useState<GraphicsTier>(initialGraphicsTier);
  const [offerNonSpatial, setOfferNonSpatial] = useState(false);
  const [worldMode, setWorldMode] = useState<WorldModeState>(createWorldModeState);
  const [nearbyInteraction, setNearbyInteraction] =
    useState<WorldInteractionRequest | null>(null);
  const [focusedEvidenceId, setFocusedEvidenceId] = useState<string | null>(null);
  const [focusedStationId, setFocusedStationId] = useState<StationId | null>(null);
  const [focusedStaticStationId, setFocusedStaticStationId] =
    useState<StaticDossierStationId | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [caseboardOpen, setCaseboardOpen] = useState(false);
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
  const playerPositionOutputRef = useRef<HTMLOutputElement>(null);
  const interact = useWorldInteractionAdapter();
  const performanceMonitor = useRef<PerformanceMonitorState>(
    createPerformanceMonitor(graphicsTier),
  );
  const performanceSamplesRef = useRef<
    Array<{ fps: number; timestampMs: number }>
  >([]);
  const spatialSessionRef = useRef(spatialSession);
  const persistedSpatialSessionRef = useRef<string | null>(null);
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

  const retry = useCallback(() => {
    setWebglAvailable(capabilityCheck());
    setCapabilityAttempt((attempt) => attempt + 1);
    setRuntimeIssue(null);
    setRuntimePlayerPosition(
      resolveControllerStartPosition(spatialSessionRef.current),
    );
    setRuntimeKey((key) => key + 1);
  }, [capabilityCheck]);

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

  useEffect(() => {
    const handleVisibility = () => {
      setWorldMode((current) => {
        const event = document.hidden ? { type: "suspend" as const } : { type: "resume" as const };
        return transitionWorldMode(current, event).state;
      });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const openNearbyInteraction = useCallback(() => {
    if (!nearbyInteraction || worldMode.mode !== "exploring") return;
    const outcome = interact(nearbyInteraction);
    if (outcome.status !== "opened") return;
    if (
      outcome.target.targetType === "case_surface" &&
      outcome.target.surfaceId !== "journal"
    ) {
      return;
    }
    if (outcome.target.targetType === "station") {
      const stationId = outcome.target.stationId;
      if (
        !isGeneratedDialogueStationId(stationId) &&
        !isStaticDossierStationId(stationId)
      ) {
        return;
      }
    }

    const event =
      outcome.target.targetType === "station" &&
      isGeneratedDialogueStationId(outcome.target.stationId)
        ? { type: "start_cinematic" as const }
        : { type: "open_focus" as const };
    const transition = transitionWorldMode(worldMode, event);
    if (!transition.allowed) return;
    setWorldMode(transition.state);
    if (outcome.target.targetType === "evidence") {
      setFocusedEvidenceId(outcome.target.evidenceId);
    } else if (outcome.target.targetType === "station") {
      if (isGeneratedDialogueStationId(outcome.target.stationId)) {
        setFocusedStationId(outcome.target.stationId);
      } else if (isStaticDossierStationId(outcome.target.stationId)) {
        setFocusedStaticStationId(outcome.target.stationId);
      }
    } else if (
      outcome.target.surfaceId === "journal"
    ) {
      journalInvokerRef.current = interactionButtonRef.current;
      setJournalOpen(true);
    }
  }, [interact, nearbyInteraction, worldMode]);

  const openJournal = useCallback(() => {
    if (worldMode.mode !== "exploring") return;
    const transition = transitionWorldMode(worldMode, { type: "open_focus" });
    if (!transition.allowed) return;
    journalInvokerRef.current = journalButtonRef.current;
    setWorldMode(transition.state);
    setJournalOpen(true);
  }, [worldMode]);

  const closeJournal = useCallback(() => {
    const transition = transitionWorldMode(worldMode, {
      type: "return_to_exploring",
    });
    if (!transition.allowed) return;
    setJournalOpen(false);
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
      setRuntimeKey((key) => key + 1);
      setJournalOpen(false);
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
    let nextCaseState = state;
    if (reasoningHandoff.command) {
      const result = issue(reasoningHandoff.command);
      if (result.status === "rejected") return;
      nextCaseState = result.state;
    }

    const decision = decideReasoningHandoff(nextCaseState, worldMode, {
      type: "open_caseboard",
    });
    if (!decision.allowed) return;
    setWorldMode(decision.state);
    setCaseboardOpen(true);
  }, [issue, reasoningHandoff.command, state, worldMode]);

  const closeCaseboard = useCallback(() => {
    const decision = decideReasoningHandoff(state, worldMode, {
      type: "return_to_exploration",
    });
    if (!decision.allowed) return;
    setCaseboardOpen(false);
    setWorldMode(decision.state);
  }, [state, worldMode]);

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
    <main className={styles.world} data-testid="world-canvas-shell">
      <div className={styles.canvasFrame} data-testid="world-canvas">
        <WorldErrorBoundary
          renderFallback={(boundaryRetry) => (
            <WorldUnavailable
              compact
              onRetry={() => {
                boundaryRetry();
                retry();
              }}
              reason="The scene stopped while rendering."
            />
          )}
          resetKey={runtimeKey}
        >
          <SceneRuntime
            graphicsProfile={GRAPHICS_PROFILES[graphicsTier]}
            initialPosition={runtimePlayerPosition}
            key={runtimeKey}
            locomotionEnabled={canUseLocomotion(worldMode)}
            reducedMotion={courseAlignment?.preferences.motionMode === "reduced"}
            onContextLost={() =>
              setRuntimeIssue("The graphics context was interrupted.")
            }
            onNearbyInteractionChange={setNearbyInteraction}
            onPlayerPositionChange={recordPlayerPosition}
            onPerformanceSample={recordFrame}
            testMode={testMode}
          />
        </WorldErrorBoundary>
      </div>
      <WorldHud
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
        onInteract={openNearbyInteraction}
        onGuidanceSettingChange={setGuidanceSetting}
        onOpenJournal={openJournal}
        onOpenCaseboard={openCaseboard}
        offerNonSpatial={offerNonSpatial}
        worldMode={worldMode.mode}
      />
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
    </main>
  );
}
