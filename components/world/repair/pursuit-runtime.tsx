"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  FileSearch,
  Footprints,
  Route,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Group } from "three";

import { WorldErrorBoundary } from "@/components/world/world-error-boundary";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesReconstruction } from "@/lib/case-engine/load-reconstruction";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import {
  advancePursuitMotion,
  derivePursuitSequenceState,
  type PursuitMotion,
  type PursuitMotionControls,
  type PursuitSequenceState,
} from "@/lib/world/pursuit-sequence";
import type { repairActionIds } from "@/schemas/reconstruction";
import { subscribeToWebGLContextLoss } from "@/lib/world/webgl-context-loss";

import styles from "./pursuit-repair.module.css";

const reconstruction = loadVarennesReconstruction();
const manifest = loadVarennesSceneManifest();
const casePackage = loadVarennesCase();
const SCENE_SCALE = 0.16;

type RepairActionId = (typeof repairActionIds)[number];
type HeldControl = keyof PursuitMotionControls;

const EMPTY_CONTROLS: PursuitMotionControls = {
  fast: false,
  forward: false,
  left: false,
  reverse: false,
  right: false,
};

const actionCopy: Record<RepairActionId, { label: string; icon: typeof Route }> = {
  "RA-05-OBSTRUCTION": { label: "Restore passage control", icon: Route },
  "RA-05-PASSPORT": { label: "Restore passport inspection", icon: FileSearch },
};

interface PursuitRuntimeProps {
  capabilityCheck?: () => boolean;
  completedActionIds: readonly string[];
  completedStepIds: readonly string[];
  onRequestAction: (id: RepairActionId) => void;
  onRequestStep: (id: (typeof reconstruction.repairSteps)[number]["id"]) => void;
}

function supportsWebGL(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function initialMotion(minimumDistance: number): PursuitMotion {
  return { distance: minimumDistance, lateralOffset: 0 };
}

function SourceLinks({ sourceIds }: { sourceIds: readonly string[] }) {
  return (
    <div className={styles.sourceLinks} aria-label="Canonical sources">
      {sourceIds.map((sourceId) => {
        const source = casePackage.sources.find((item) => item.id === sourceId);
        if (!source) return null;

        return (
          <a
            aria-label={`Open repair source: ${source.title}`}
            href={source.citationUrl}
            key={source.id}
            rel="noreferrer"
            target="_blank"
          >
            {source.title}
          </a>
        );
      })}
    </div>
  );
}

function PursuitCamera({ motionRef }: { motionRef: RefObject<PursuitMotion> }) {
  const { camera } = useThree();

  useFrame(() => {
    const motion = motionRef.current;
    const traceX = motion.distance * SCENE_SCALE;
    const traceZ = motion.lateralOffset * 0.62;
    camera.position.set(traceX - 2.8, 3.2, traceZ + 5.2);
    camera.lookAt(traceX + 1.4, 0.25, traceZ);
  });

  return null;
}

function PursuitContextLossMonitor({
  onContextLost,
}: {
  onContextLost: () => void;
}) {
  const renderer = useThree((state) => state.gl);

  useEffect(
    () => subscribeToWebGLContextLoss(renderer.domElement, onContextLost),
    [onContextLost, renderer],
  );

  return null;
}

function PursuitTrace({ motionRef }: { motionRef: RefObject<PursuitMotion> }) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;
    group.position.set(
      motionRef.current.distance * SCENE_SCALE,
      0.24,
      motionRef.current.lateralOffset * 0.62,
    );
  });

  return (
    <group ref={groupRef}>
      {[-0.28, 0.28].map((offset) => (
        <group key={offset} position={[0, 0, offset]}>
          <mesh castShadow scale={[0.42, 0.2, 0.18]}>
            <boxGeometry />
            <meshStandardMaterial color="#1d2527" roughness={0.95} />
          </mesh>
          <mesh castShadow position={[0.07, 0.28, 0]} scale={[0.13, 0.38, 0.13]}>
            <boxGeometry />
            <meshStandardMaterial color="#d7ac56" roughness={0.9} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SchematicPursuit({
  motionRef,
  onContextLost,
}: {
  motionRef: RefObject<PursuitMotion>;
  onContextLost: () => void;
}) {
  const path = manifest.repairPath;

  return (
    <Canvas
      camera={{ fov: 46, position: [0, 3.2, 5.2] }}
      className={styles.canvas}
      dpr={[1, 1.5]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <color attach="background" args={["#d8ddd3"]} />
      <ambientLight intensity={1.2} />
      <directionalLight intensity={1.8} position={[4, 7, 5]} />
      <PursuitContextLossMonitor onContextLost={onContextLost} />
      <PursuitCamera motionRef={motionRef} />
      <mesh receiveShadow position={[path.checkpoints.at(-1)!.distance * SCENE_SCALE / 2, -0.1, 0]}>
        <boxGeometry args={[path.checkpoints.at(-1)!.distance * SCENE_SCALE + 2, 0.16, 3.1]} />
        <meshStandardMaterial color="#7a786d" roughness={1} />
      </mesh>
      {[-path.corridorHalfWidth, path.corridorHalfWidth].map((offset) => (
        <mesh key={offset} position={[path.checkpoints.at(-1)!.distance * SCENE_SCALE / 2, 0.01, offset * 0.62]}>
          <boxGeometry args={[path.checkpoints.at(-1)!.distance * SCENE_SCALE + 2, 0.04, 0.05]} />
          <meshStandardMaterial color="#b74335" roughness={1} />
        </mesh>
      ))}
      {path.checkpoints.map((checkpoint) => (
        <mesh key={checkpoint.repairStepId} position={[checkpoint.distance * SCENE_SCALE, 0.26, 0]}>
          <cylinderGeometry args={[0.18, 0.18, 0.5, 8]} />
          <meshStandardMaterial color="#285a78" roughness={0.85} />
        </mesh>
      ))}
      {path.localActions.map((action) => (
        <group
          key={action.repairActionId}
          position={[
            path.checkpoints[4]!.distance * SCENE_SCALE,
            0.22,
            action.lateralOffset * 0.62,
          ]}
        >
          <mesh
            rotation={
              action.repairActionId === "RA-05-OBSTRUCTION"
                ? [0, 0, Math.PI / 2]
                : [0, 0, 0]
            }
          >
            {action.repairActionId === "RA-05-OBSTRUCTION" ? (
              <boxGeometry args={[0.12, 0.75, 0.34]} />
            ) : (
              <cylinderGeometry args={[0.2, 0.2, 0.42, 8]} />
            )}
            <meshStandardMaterial color="#2d6b51" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((index) => (
        <mesh
          key={`counterfactual-${index}`}
          position={[
            (path.counterfactualBoundary.distance - 5 + index * 1.5) *
              SCENE_SCALE,
            0.04,
            path.counterfactualBoundary.lateralOffset * 0.38,
          ]}
        >
          <boxGeometry args={[0.13, 0.05, 0.13]} />
          <meshStandardMaterial color="#b74335" roughness={1} />
        </mesh>
      ))}
      <PursuitTrace motionRef={motionRef} />
    </Canvas>
  );
}

interface CurrentRepairControlsProps {
  canRequestStep: boolean;
  currentStep: (typeof reconstruction.repairSteps)[number] | undefined;
  availableActionIds: readonly RepairActionId[];
  onRequestAction: (id: RepairActionId) => void;
  onRequestStep: (id: (typeof reconstruction.repairSteps)[number]["id"]) => void;
}

function CurrentRepairControls({
  canRequestStep,
  currentStep,
  availableActionIds,
  onRequestAction,
  onRequestStep,
}: CurrentRepairControlsProps) {
  if (!currentStep) {
    return <p className={styles.complete}>The bounded reconstruction is fully reviewed.</p>;
  }

  if (!canRequestStep) {
    return <p className={styles.checkpointNotice}>Reach the current checkpoint to review this action.</p>;
  }

  if (availableActionIds.length > 0) {
    return (
      <div className={styles.actionCluster}>
        <p>These two local actions can be completed in either order.</p>
        {availableActionIds.map((actionId) => {
          const action = actionCopy[actionId];
          const Icon = action.icon;
          return (
            <button key={actionId} onClick={() => onRequestAction(actionId)} type="button">
              <Icon aria-hidden="true" />
              {action.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <button className={styles.stepAction} onClick={() => onRequestStep(currentStep.id)} type="button">
      <ShieldCheck aria-hidden="true" />
      {currentStep.actionLabel}
    </button>
  );
}

function PointerHoldControl({
  control,
  icon: Icon,
  label,
  onChange,
}: {
  control: HeldControl;
  icon: typeof ArrowUp;
  label: string;
  onChange: (control: HeldControl, held: boolean) => void;
}) {
  return (
    <button
      aria-label={label}
      className={styles.motionButton}
      onPointerCancel={() => onChange(control, false)}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(control, true);
      }}
      onPointerLeave={() => onChange(control, false)}
      onPointerUp={() => onChange(control, false)}
      onBlur={() => onChange(control, false)}
      onKeyDown={(event) => {
        if ((event.code === "Enter" || event.code === "Space") && !event.repeat) {
          event.preventDefault();
          onChange(control, true);
        }
      }}
      onKeyUp={(event) => {
        if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          onChange(control, false);
        }
      }}
      title={label}
      type="button"
    >
      <Icon aria-hidden="true" />
    </button>
  );
}

export function PursuitRuntime({
  capabilityCheck = supportsWebGL,
  completedActionIds,
  completedStepIds,
  onRequestAction,
  onRequestStep,
}: PursuitRuntimeProps) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(() =>
    process.env.NODE_ENV === "test" ? false : null,
  );
  const [runtimeFailed, setRuntimeFailed] = useState(false);
  const handleRuntimeFailure = useCallback(() => setRuntimeFailed(true), []);
  const sequence = useMemo(
    () => derivePursuitSequenceState(manifest.repairPath, completedStepIds, completedActionIds),
    [completedActionIds, completedStepIds],
  );

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setWebglAvailable(capabilityCheck());
    });
    return () => {
      cancelled = true;
    };
  }, [capabilityCheck]);

  return (
    <PursuitExperience
      onRequestAction={onRequestAction}
      onRequestStep={onRequestStep}
      onRuntimeFailure={handleRuntimeFailure}
      runtimeFailed={runtimeFailed}
      sequence={sequence}
      webglAvailable={webglAvailable}
    />
  );
}

interface PursuitExperienceProps {
  onRequestAction: (id: RepairActionId) => void;
  onRequestStep: (id: (typeof reconstruction.repairSteps)[number]["id"]) => void;
  onRuntimeFailure: () => void;
  runtimeFailed: boolean;
  sequence: PursuitSequenceState;
  webglAvailable: boolean | null;
}

function PursuitExperience({
  onRequestAction,
  onRequestStep,
  onRuntimeFailure,
  runtimeFailed,
  sequence,
  webglAvailable,
}: PursuitExperienceProps) {
  const motionRef = useRef(initialMotion(sequence.minimumDistance));
  const checkpointReachedRef = useRef(false);
  const [reachedStepId, setReachedStepId] = useState<string | null>(null);
  const controlsRef = useRef<PursuitMotionControls>({ ...EMPTY_CONTROLS });
  const currentStep = reconstruction.repairSteps.find((step) => step.id === sequence.currentStepId);
  const availableActionIds = sequence.availableActionIds as RepairActionId[];
  const spatialAvailable = webglAvailable === true && !runtimeFailed;
  const directAvailable = webglAvailable === false || runtimeFailed;
  const handleRuntimeFailure = useCallback(() => {
    controlsRef.current = { ...EMPTY_CONTROLS };
    onRuntimeFailure();
  }, [onRuntimeFailure]);

  useEffect(() => {
    controlsRef.current = { ...EMPTY_CONTROLS };
    motionRef.current = initialMotion(sequence.minimumDistance);
    checkpointReachedRef.current = false;
  }, [sequence.currentStepId, sequence.minimumDistance]);

  useEffect(() => {
    if (!spatialAvailable) return;

    const clearControls = () => {
      controlsRef.current = { ...EMPTY_CONTROLS };
    };

    const setControl = (event: KeyboardEvent, held: boolean) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select")) return;
      const controlByKey: Record<string, HeldControl | undefined> = {
        ArrowDown: "reverse",
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "forward",
        KeyA: "left",
        KeyD: "right",
        KeyS: "reverse",
        KeyW: "forward",
        ShiftLeft: "fast",
        ShiftRight: "fast",
      };
      const control = controlByKey[event.code];
      if (!control) return;
      event.preventDefault();
      controlsRef.current = { ...controlsRef.current, [control]: held };
    };
    const handleKeyDown = (event: KeyboardEvent) => setControl(event, true);
    const handleKeyUp = (event: KeyboardEvent) => setControl(event, false);
    const handleVisibilityChange = () => {
      if (document.hidden) clearControls();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearControls);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearControls();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearControls);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [spatialAvailable]);

  useEffect(() => {
    if (!spatialAvailable || typeof window.requestAnimationFrame !== "function") return;

    let frameId = 0;
    let previousTimestamp: number | null = null;
    const advance = (timestamp: number) => {
      const elapsed = previousTimestamp === null ? 0 : Math.min((timestamp - previousTimestamp) / 1000, 0.05);
      previousTimestamp = timestamp;
      const next = advancePursuitMotion(
        motionRef.current,
        controlsRef.current,
        elapsed,
        sequence,
        manifest.repairPath,
      );
      if (
        next.distance !== motionRef.current.distance ||
        next.lateralOffset !== motionRef.current.lateralOffset
      ) {
        motionRef.current = next;
        if (
          !checkpointReachedRef.current &&
          next.distance >= sequence.maximumDistance
        ) {
          checkpointReachedRef.current = true;
          setReachedStepId(sequence.currentStepId);
        }
      }
      frameId = window.requestAnimationFrame(advance);
    };
    frameId = window.requestAnimationFrame(advance);
    return () => window.cancelAnimationFrame(frameId);
  }, [sequence, spatialAvailable]);

  const setHeldControl = (control: HeldControl, held: boolean) => {
    controlsRef.current = { ...controlsRef.current, [control]: held };
  };

  return (
    <section className={styles.runtime} aria-labelledby="pursuit-heading">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>HISTORICAL RECONSTRUCTION / SCHEMATIC, NOT TO SCALE</p>
          <h2 id="pursuit-heading">Guided pursuit trace</h2>
        </div>
        <p className={styles.manifestLabel}>{manifest.repairPath.placementLabel}</p>
      </header>

      {webglAvailable === null ? (
        <div className={styles.directControls} aria-busy="true">
          <p className={styles.kicker}>Checking spatial reconstruction</p>
          <p>The direct historical sequence remains available if the renderer cannot start.</p>
        </div>
      ) : spatialAvailable ? (
        <>
          <div className={styles.sceneFrame} data-testid="pursuit-canvas">
            <WorldErrorBoundary
              onError={handleRuntimeFailure}
              renderFallback={() => (
                <p className={styles.canvasFallback}>Switching to direct reconstruction controls.</p>
              )}
              resetKey={0}
            >
              <SchematicPursuit
                motionRef={motionRef}
                onContextLost={handleRuntimeFailure}
              />
            </WorldErrorBoundary>
            <p className={styles.traceLabel}><Footprints aria-hidden="true" /> Controlled schematic paired pursuit trace</p>
            <p className={styles.unknownMarker}>
              Fictional branch / {manifest.repairPath.counterfactualBoundary.label}
            </p>
          </div>
          <div className={styles.motionControls} aria-label="Pursuit movement controls">
            <PointerHoldControl control="left" icon={ArrowLeft} label="Steer left" onChange={setHeldControl} />
            <PointerHoldControl control="forward" icon={ArrowUp} label="Advance pursuit" onChange={setHeldControl} />
            <PointerHoldControl control="right" icon={ArrowRight} label="Steer right" onChange={setHeldControl} />
            <PointerHoldControl control="reverse" icon={ArrowDown} label="Ease pursuit back" onChange={setHeldControl} />
            <PointerHoldControl control="fast" icon={Zap} label="Change pursuit pace" onChange={setHeldControl} />
          </div>
          <p className={styles.keyboardHint}>W or Up advances. S or Down eases back. A/D or Left/Right steer. Hold Shift to change pace.</p>
        </>
      ) : directAvailable ? (
        <div className={styles.directControls}>
          <p className={styles.kicker}>Direct reconstruction controls</p>
          <p>Use the same current reconstruction step and local actions without spatial rendering.</p>
        </div>
      ) : null}

      {currentStep ? (
        <section className={styles.currentStep} aria-labelledby="current-step-heading">
          <div>
            <p className={styles.kicker}>Current reconstruction step</p>
            <h3 id="current-step-heading">{currentStep.title}</h3>
            <p>{currentStep.statement}</p>
            {currentStep.id === "RS-06-DETENTION" ? (
              <p className={styles.detentionRelation}>The two local actions contributed to this bounded reconstruction of guarded detention.</p>
            ) : null}
            <SourceLinks sourceIds={currentStep.sourceIds} />
          </div>
          <CurrentRepairControls
            availableActionIds={availableActionIds}
            canRequestStep={directAvailable || reachedStepId === sequence.currentStepId}
            currentStep={currentStep}
            onRequestAction={onRequestAction}
            onRequestStep={onRequestStep}
          />
        </section>
      ) : (
        <p className={styles.complete}>The bounded reconstruction is fully reviewed.</p>
      )}

      <details className={styles.limitations}>
        <summary>Reconstruction limitations</summary>
        <ul>
          {Object.values(manifest.repairPath.limitations).map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}
