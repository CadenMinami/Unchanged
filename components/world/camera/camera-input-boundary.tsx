"use client";

import {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";

// Browser pointer-lock release is asynchronous. Leave enough time for a
// throttled classroom device to acknowledge the browser event before failing.
const RELEASE_TIMEOUT_MS = 1_000;

export type PointerReleaseResult =
  | { requestId: number; status: "released" }
  | {
      requestId: number;
      status: "failed";
      reason: "pointer_lock_still_active";
    };

export interface CameraInputBoundaryHandle {
  requestRelease(requestId: number): Promise<PointerReleaseResult>;
  clearLookInput(): void;
}

export interface CameraInputSnapshot {
  pointerLockSupported: boolean;
  pointerLockActive: boolean;
  fallbackDragActive: boolean;
  releasePending: boolean;
  captureDenied: boolean;
}

export interface CameraInputChannel {
  getSnapshot(): CameraInputSnapshot;
  subscribe(listener: () => void): () => void;
  consumeLookDelta(): { x: number; y: number };
  consumeWheelDelta(): number;
}

interface CameraInputStore {
  addLookDelta(x: number, y: number): void;
  addWheelDelta(delta: number): void;
  channel: CameraInputChannel;
  clearAllDeltas(): void;
  clearLookDelta(): void;
  updateSnapshot(update: Partial<CameraInputSnapshot>): void;
}

interface PendingRelease {
  canvas: HTMLCanvasElement;
  promise: Promise<PointerReleaseResult>;
  resolve: (result: PointerReleaseResult) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

interface CaptureAttempt {
  acknowledged: boolean;
  browserSettled: boolean;
  canvas: HTMLCanvasElement;
  valid: boolean;
}

interface CameraInputBoundaryProps {
  cameraInputChannel: CameraInputChannel;
  canvas: HTMLCanvasElement | null;
  captureEligible: boolean;
  children: ReactNode;
}

const INITIAL_SNAPSHOT: CameraInputSnapshot = Object.freeze({
  pointerLockSupported: false,
  pointerLockActive: false,
  fallbackDragActive: false,
  releasePending: false,
  captureDenied: false,
});

const inputStores = new WeakMap<CameraInputChannel, CameraInputStore>();

function createInputStore(): CameraInputStore {
  let snapshot = INITIAL_SNAPSHOT;
  let lookDeltaX = 0;
  let lookDeltaY = 0;
  let wheelDelta = 0;
  const listeners = new Set<() => void>();

  const channel: CameraInputChannel = Object.freeze({
    getSnapshot() {
      return snapshot;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    consumeLookDelta() {
      const delta = { x: lookDeltaX, y: lookDeltaY };
      lookDeltaX = 0;
      lookDeltaY = 0;
      return delta;
    },
    consumeWheelDelta() {
      const delta = wheelDelta;
      wheelDelta = 0;
      return delta;
    },
  });

  return {
    channel,
    addLookDelta(x, y) {
      if (x === 0 && y === 0) return;
      lookDeltaX += x;
      lookDeltaY += y;
      listeners.forEach((listener) => listener());
    },
    addWheelDelta(delta) {
      if (delta === 0) return;
      wheelDelta += delta;
      listeners.forEach((listener) => listener());
    },
    clearAllDeltas() {
      lookDeltaX = 0;
      lookDeltaY = 0;
      wheelDelta = 0;
    },
    clearLookDelta() {
      lookDeltaX = 0;
      lookDeltaY = 0;
    },
    updateSnapshot(update) {
      const nextSnapshot = { ...snapshot, ...update };
      const changed = Object.keys(update).some(
        (key) =>
          snapshot[key as keyof CameraInputSnapshot] !==
          nextSnapshot[key as keyof CameraInputSnapshot],
      );
      if (!changed) return;
      snapshot = Object.freeze(nextSnapshot);
      listeners.forEach((listener) => listener());
    },
  };
}

export function createCameraInputChannel(): CameraInputChannel {
  const store = createInputStore();
  inputStores.set(store.channel, store);
  return store.channel;
}

function getInputStore(channel: CameraInputChannel): CameraInputStore {
  const store = inputStores.get(channel);
  if (!store) {
    throw new Error(
      "CameraInputBoundary requires a channel from createCameraInputChannel().",
    );
  }
  return store;
}

function supportsPointerLock(canvas: HTMLCanvasElement): boolean {
  return (
    typeof canvas.requestPointerLock === "function" &&
    typeof document.exitPointerLock === "function" &&
    "pointerLockElement" in document
  );
}

export const CameraInputBoundary = forwardRef<
  CameraInputBoundaryHandle,
  CameraInputBoundaryProps
>(function CameraInputBoundary(
  { cameraInputChannel, canvas, captureEligible, children },
  forwardedRef,
) {
  const store = getInputStore(cameraInputChannel);
  const committedCanvasRef = useRef(canvas);
  const committedCaptureEligibleRef = useRef(captureEligible);
  const activeCaptureAttemptRef = useRef<CaptureAttempt | null>(null);
  const attemptedCanvasesRef = useRef(new WeakSet<HTMLCanvasElement>());
  const invalidatedCanvasesRef = useRef(new WeakSet<HTMLCanvasElement>());
  const mountedRef = useRef(false);
  const pendingReleasesRef = useRef(new Map<number, PendingRelease>());

  const invalidateCaptureAttempt = useCallback(() => {
    const attempt = activeCaptureAttemptRef.current;
    if (!attempt || !attempt.valid) return;
    attempt.valid = false;
    invalidatedCanvasesRef.current.add(attempt.canvas);
    if (attempt.browserSettled) {
      activeCaptureAttemptRef.current = null;
    }
  }, []);

  const reconcileUnlockedInput = useCallback(() => {
    invalidateCaptureAttempt();
    store.clearAllDeltas();
    store.updateSnapshot({
      pointerLockActive: false,
      fallbackDragActive: false,
    });
  }, [invalidateCaptureAttempt, store]);

  const settleRelease = useCallback(
    (requestId: number, result: PointerReleaseResult) => {
      const pending = pendingReleasesRef.current.get(requestId);
      if (!pending) return;
      clearTimeout(pending.timeoutId);
      pendingReleasesRef.current.delete(requestId);
      pending.resolve(result);
      store.updateSnapshot({
        releasePending: pendingReleasesRef.current.size > 0,
      });
    },
    [store],
  );

  const settleCaptureSuccess = useCallback((attempt: CaptureAttempt) => {
    attempt.browserSettled = true;
    if (!attempt.valid && document.pointerLockElement === attempt.canvas) {
      document.exitPointerLock();
    }
    if (
      activeCaptureAttemptRef.current === attempt &&
      (!attempt.valid || attempt.acknowledged)
    ) {
      activeCaptureAttemptRef.current = null;
    }
  }, []);

  const settleCaptureFailure = useCallback(
    (attempt: CaptureAttempt) => {
      attempt.browserSettled = true;
      const publishDenial =
        attempt.valid &&
        committedCanvasRef.current === attempt.canvas &&
        committedCaptureEligibleRef.current;
      attempt.valid = false;
      invalidatedCanvasesRef.current.add(attempt.canvas);
      if (activeCaptureAttemptRef.current === attempt) {
        activeCaptureAttemptRef.current = null;
      }
      if (publishDenial) {
        store.updateSnapshot({ captureDenied: true });
      }
    },
    [store],
  );

  const finalizeBoundary = useCallback(() => {
    mountedRef.current = false;
    invalidateCaptureAttempt();

    const lockedElement = document.pointerLockElement;
    if (
      lockedElement !== null &&
      (lockedElement === committedCanvasRef.current ||
        attemptedCanvasesRef.current.has(lockedElement as HTMLCanvasElement))
    ) {
      document.exitPointerLock();
    }

    const pendingReleases = [...pendingReleasesRef.current.entries()];
    pendingReleasesRef.current.clear();
    for (const [, pending] of pendingReleases) {
      clearTimeout(pending.timeoutId);
    }

    store.clearAllDeltas();
    store.updateSnapshot({
      pointerLockSupported: false,
      pointerLockActive: false,
      fallbackDragActive: false,
      releasePending: false,
      captureDenied: false,
    });

    for (const [requestId, pending] of pendingReleases) {
      pending.resolve(
        document.pointerLockElement === pending.canvas
          ? {
              requestId,
              status: "failed",
              reason: "pointer_lock_still_active",
            }
          : { requestId, status: "released" },
      );
    }
  }, [invalidateCaptureAttempt, store]);

  useLayoutEffect(() => {
    committedCanvasRef.current = canvas;
    committedCaptureEligibleRef.current = captureEligible;
  }, [canvas, captureEligible]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return finalizeBoundary;
  }, [finalizeBoundary]);

  useImperativeHandle(
    forwardedRef,
    () => ({
      clearLookInput() {
        store.clearLookDelta();
      },
      requestRelease(requestId) {
        const activeCanvas = committedCanvasRef.current;
        const existing = pendingReleasesRef.current.get(requestId);
        if (existing) return existing.promise;

        if (!activeCanvas || document.pointerLockElement !== activeCanvas) {
          reconcileUnlockedInput();
          return Promise.resolve({ requestId, status: "released" });
        }

        let resolveRelease!: (result: PointerReleaseResult) => void;
        const promise = new Promise<PointerReleaseResult>((resolve) => {
          resolveRelease = resolve;
        });
        const timeoutId = setTimeout(() => {
          if (document.pointerLockElement === activeCanvas) {
            settleRelease(requestId, {
              requestId,
              status: "failed",
              reason: "pointer_lock_still_active",
            });
            return;
          }
          reconcileUnlockedInput();
          settleRelease(requestId, { requestId, status: "released" });
        }, RELEASE_TIMEOUT_MS);
        pendingReleasesRef.current.set(requestId, {
          canvas: activeCanvas,
          promise,
          resolve: resolveRelease,
          timeoutId,
        });
        store.updateSnapshot({ releasePending: true });
        document.exitPointerLock();
        return promise;
      },
    }),
    [reconcileUnlockedInput, settleRelease, store],
  );

  useEffect(() => {
    if (captureEligible) return;
    invalidateCaptureAttempt();
    store.clearAllDeltas();
    store.updateSnapshot({ fallbackDragActive: false });
    if (
      canvas &&
      document.pointerLockElement === canvas &&
      !store.channel.getSnapshot().releasePending
    ) {
      document.exitPointerLock();
    }
  }, [canvas, captureEligible, invalidateCaptureAttempt, store]);

  useEffect(() => {
    if (!canvas) {
      store.clearAllDeltas();
      store.updateSnapshot({
        pointerLockSupported: false,
        pointerLockActive: false,
        fallbackDragActive: false,
      });
      return;
    }

    let lifecycleInputNeutralized = false;
    const handleClick = () => {
      if (
        !committedCaptureEligibleRef.current ||
        !supportsPointerLock(canvas) ||
        document.pointerLockElement === canvas ||
        activeCaptureAttemptRef.current !== null
      ) {
        return;
      }

      lifecycleInputNeutralized = false;
      const attempt: CaptureAttempt = {
        acknowledged: false,
        browserSettled: false,
        canvas,
        valid: true,
      };
      activeCaptureAttemptRef.current = attempt;
      attemptedCanvasesRef.current.add(canvas);
      invalidatedCanvasesRef.current.delete(canvas);
      try {
        void Promise.resolve(canvas.requestPointerLock()).then(
          () => settleCaptureSuccess(attempt),
          () => settleCaptureFailure(attempt),
        );
      } catch {
        settleCaptureFailure(attempt);
      }
    };
    const endFallbackDrag = () => {
      store.updateSnapshot({ fallbackDragActive: false });
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.button !== 2 ||
        !committedCaptureEligibleRef.current ||
        document.pointerLockElement === canvas
      ) {
        return;
      }
      lifecycleInputNeutralized = false;
      store.clearLookDelta();
      store.updateSnapshot({ fallbackDragActive: true });
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!store.channel.getSnapshot().fallbackDragActive) return;
      store.addLookDelta(event.movementX, event.movementY);
    };
    const handleContextMenu = (event: MouseEvent) => {
      if (store.channel.getSnapshot().fallbackDragActive) {
        event.preventDefault();
      }
    };
    const handleWheel = (event: WheelEvent) => {
      const snapshot = store.channel.getSnapshot();
      if (
        !committedCaptureEligibleRef.current ||
        (!snapshot.pointerLockActive && !snapshot.fallbackDragActive)
      ) {
        return;
      }
      store.addWheelDelta(event.deltaY);
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!store.channel.getSnapshot().pointerLockActive) return;
      store.addLookDelta(event.movementX, event.movementY);
    };
    const handlePointerLockError = () => {
      const attempt = activeCaptureAttemptRef.current;
      if (!attempt) return;
      settleCaptureFailure(attempt);
    };
    const handlePointerLockChange = () => {
      const lockedElement = document.pointerLockElement;
      const pointerLockActive = lockedElement === canvas;
      const validCapture =
        pointerLockActive &&
        committedCanvasRef.current === canvas &&
        committedCaptureEligibleRef.current &&
        !invalidatedCanvasesRef.current.has(canvas);

      if (
        lockedElement !== null &&
        lockedElement !== canvas &&
        attemptedCanvasesRef.current.has(lockedElement as HTMLCanvasElement)
      ) {
        store.clearAllDeltas();
        store.updateSnapshot({ pointerLockActive: false });
        document.exitPointerLock();
        return;
      }

      if (pointerLockActive && !validCapture) {
        reconcileUnlockedInput();
        document.exitPointerLock();
        return;
      }

      if (validCapture) {
        lifecycleInputNeutralized = false;
        store.clearAllDeltas();
        const attempt = activeCaptureAttemptRef.current;
        if (attempt?.canvas === canvas && attempt.valid) {
          attempt.acknowledged = true;
          if (attempt.browserSettled) {
            activeCaptureAttemptRef.current = null;
          }
        }
      } else if (
        activeCaptureAttemptRef.current === null ||
        activeCaptureAttemptRef.current.acknowledged
      ) {
        reconcileUnlockedInput();
      }

      store.updateSnapshot({
        pointerLockActive: validCapture,
        fallbackDragActive: validCapture
          ? false
          : store.channel.getSnapshot().fallbackDragActive,
        captureDenied: validCapture
          ? false
          : store.channel.getSnapshot().captureDenied,
      });

      for (const [requestId, pending] of pendingReleasesRef.current) {
        if (document.pointerLockElement !== pending.canvas) {
          settleRelease(requestId, { requestId, status: "released" });
        }
      }
    };
    const neutralizeLifecycleInput = () => {
      if (lifecycleInputNeutralized) return;
      lifecycleInputNeutralized = true;
      invalidateCaptureAttempt();
      store.clearAllDeltas();
      endFallbackDrag();
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        neutralizeLifecycleInput();
      }
    };

    store.updateSnapshot({
      pointerLockSupported: supportsPointerLock(canvas),
      pointerLockActive: document.pointerLockElement === canvas,
    });
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", endFallbackDrag);
    canvas.addEventListener("contextmenu", handleContextMenu);
    canvas.addEventListener("wheel", handleWheel);
    document.addEventListener("pointerlockchange", handlePointerLockChange);
    document.addEventListener("pointerlockerror", handlePointerLockError);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerup", endFallbackDrag);
    document.addEventListener("pointercancel", endFallbackDrag);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", neutralizeLifecycleInput);

    return () => {
      invalidateCaptureAttempt();
      store.clearAllDeltas();
      store.updateSnapshot({ fallbackDragActive: false });
      if (mountedRef.current && document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
      canvas.removeEventListener("click", handleClick);
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", endFallbackDrag);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      canvas.removeEventListener("wheel", handleWheel);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
      document.removeEventListener("pointerlockerror", handlePointerLockError);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerup", endFallbackDrag);
      document.removeEventListener("pointercancel", endFallbackDrag);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", neutralizeLifecycleInput);
    };
  }, [
    canvas,
    invalidateCaptureAttempt,
    reconcileUnlockedInput,
    settleCaptureFailure,
    settleCaptureSuccess,
    settleRelease,
    store,
  ]);

  return children;
});
