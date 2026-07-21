import { act, fireEvent, render } from "@testing-library/react";
import {
  createRef,
  forwardRef,
  type RefObject,
  startTransition,
  Suspense,
  useImperativeHandle,
  useState,
  useSyncExternalStore,
} from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CameraInputBoundary,
  createCameraInputChannel,
  type CameraInputBoundaryHandle,
  type CameraInputChannel,
} from "@/components/world/camera/camera-input-boundary";
import {
  CAMERA_PREFERENCES_STORAGE_KEY,
  CAMERA_PREFERENCES_VERSION,
} from "@/lib/world/camera-preferences";

interface MountedBoundary {
  canvas: HTMLCanvasElement;
  channel: CameraInputChannel;
  handleRef: RefObject<CameraInputBoundaryHandle | null>;
  rerender: (canvas: HTMLCanvasElement, captureEligible?: boolean) => void;
  unmount: () => void;
}

interface EligibilityCommitHarnessHandle {
  suspendIneligibleRender(): void;
}

let pointerLockElement: Element | null;
let exitPointerLock: ReturnType<typeof vi.fn>;
let visibilityState: DocumentVisibilityState;

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const neverSettles = new Promise<void>(() => undefined);

function SuspendAfterBoundary({ active }: { active: boolean }) {
  if (active) throw neverSettles;
  return null;
}

const EligibilityCommitHarness = forwardRef<
  EligibilityCommitHarnessHandle,
  {
    cameraInputChannel: CameraInputChannel;
    canvas: HTMLCanvasElement;
  }
>(function EligibilityCommitHarness(
  { cameraInputChannel, canvas },
  forwardedRef,
) {
  const [state, setState] = useState({ eligible: true, suspend: false });
  useImperativeHandle(forwardedRef, () => ({
    suspendIneligibleRender() {
      setState({ eligible: false, suspend: true });
    },
  }));

  return (
    <Suspense fallback={<div data-testid="suspended-update" />}>
      <CameraInputBoundary
        cameraInputChannel={cameraInputChannel}
        canvas={canvas}
        captureEligible={state.eligible}
      >
        <div data-testid="committed-boundary" />
      </CameraInputBoundary>
      <SuspendAfterBoundary active={state.suspend} />
    </Suspense>
  );
});

function makeCanvas() {
  const canvas = document.createElement("canvas");
  Object.defineProperty(canvas, "requestPointerLock", {
    configurable: true,
    value: vi.fn(() => Promise.resolve()),
  });
  document.body.append(canvas);
  return canvas;
}

function requestPointerLockMock(canvas: HTMLCanvasElement) {
  return vi.mocked(canvas.requestPointerLock);
}

function setPointerLock(element: Element | null) {
  pointerLockElement = element;
}

function dispatchPointerLockChange() {
  act(() => document.dispatchEvent(new Event("pointerlockchange")));
}

function dispatchVisibilityChange(state: DocumentVisibilityState) {
  visibilityState = state;
  act(() => document.dispatchEvent(new Event("visibilitychange")));
}

function dispatchMouseMove(target: EventTarget, movementX: number, movementY: number) {
  const event = new MouseEvent("mousemove", { bubbles: true });
  Object.defineProperties(event, {
    movementX: { value: movementX },
    movementY: { value: movementY },
  });
  act(() => target.dispatchEvent(event));
}

function dispatchPointerMove(
  target: EventTarget,
  movementX: number,
  movementY: number,
) {
  const event = new Event("pointermove", { bubbles: true });
  Object.defineProperties(event, {
    movementX: { value: movementX },
    movementY: { value: movementY },
  });
  act(() => target.dispatchEvent(event));
}

function mountBoundary(captureEligible = true): MountedBoundary {
  const canvas = makeCanvas();
  const channel = createCameraInputChannel();
  const handleRef = createRef<CameraInputBoundaryHandle>();
  const view = render(
    <CameraInputBoundary
      cameraInputChannel={channel}
      canvas={canvas}
      captureEligible={captureEligible}
      ref={handleRef}
    >
      <div data-testid="boundary-child" />
    </CameraInputBoundary>,
  );

  return {
    canvas,
    channel,
    handleRef,
    rerender(nextCanvas, nextCaptureEligible = captureEligible) {
      view.rerender(
        <CameraInputBoundary
          cameraInputChannel={channel}
          canvas={nextCanvas}
          captureEligible={nextCaptureEligible}
          ref={handleRef}
        >
          <div data-testid="boundary-child" />
        </CameraInputBoundary>,
      );
    },
    unmount: view.unmount,
  };
}

function CameraSnapshotProbe({
  channel,
  onRender,
}: {
  channel: CameraInputChannel;
  onRender: (snapshot: ReturnType<CameraInputChannel["getSnapshot"]>) => void;
}) {
  const snapshot = useSyncExternalStore(
    channel.subscribe,
    channel.getSnapshot,
    channel.getSnapshot,
  );
  onRender(snapshot);
  return null;
}

async function expectPromisePending(promise: Promise<unknown>) {
  let settled = false;
  void promise.finally(() => {
    settled = true;
  });
  await act(async () => Promise.resolve());
  expect(settled).toBe(false);
}

describe("CameraInputBoundary", () => {
  beforeEach(() => {
    pointerLockElement = null;
    visibilityState = "visible";
    exitPointerLock = vi.fn();
    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => pointerLockElement,
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: exitPointerLock,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibilityState,
    });
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.querySelectorAll("canvas").forEach((canvas) => canvas.remove());
  });

  it("requests pointer lock once from an eligible canvas click", () => {
    const { canvas, channel } = mountBoundary();

    fireEvent.click(canvas);

    expect(requestPointerLockMock(canvas)).toHaveBeenCalledTimes(1);
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockSupported: true,
      pointerLockActive: false,
      captureDenied: false,
    });
  });

  it.each([
    "pending overlay",
    "focused mode",
    "cinematic mode",
    "suspended mode",
    "runtime failure",
    "route teardown",
  ])("does not capture when WorldShell marks %s ineligible", () => {
    const { canvas, channel } = mountBoundary(false);

    fireEvent.click(canvas);
    fireEvent.pointerDown(canvas, { button: 2 });

    expect(requestPointerLockMock(canvas)).not.toHaveBeenCalled();
    expect(channel.getSnapshot().fallbackDragActive).toBe(false);
  });

  it("does not apply eligibility from an uncommitted suspended render", () => {
    const canvas = makeCanvas();
    const channel = createCameraInputChannel();
    const controlRef = createRef<EligibilityCommitHarnessHandle>();
    render(
      <EligibilityCommitHarness
        cameraInputChannel={channel}
        canvas={canvas}
        ref={controlRef}
      />,
    );

    act(() => {
      startTransition(() => controlRef.current!.suspendIneligibleRender());
    });
    fireEvent.click(canvas);

    expect(requestPointerLockMock(canvas)).toHaveBeenCalledTimes(1);
  });

  it("uses pointerlockchange as the source of acknowledged lock state", async () => {
    const { canvas, channel } = mountBoundary();

    fireEvent.click(canvas);
    await act(async () => Promise.resolve());
    expect(channel.getSnapshot().pointerLockActive).toBe(false);

    setPointerLock(canvas);
    dispatchPointerLockChange();
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: true,
      captureDenied: false,
    });
  });

  it("publishes capture denial when requestPointerLock rejects without dismissing onboarding", async () => {
    const { canvas, channel } = mountBoundary();
    requestPointerLockMock(canvas).mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    const storedPreferences = JSON.stringify({
      version: CAMERA_PREFERENCES_VERSION,
      preferences: {
        sensitivity: 1,
        invertY: false,
        pointerLockIntroduced: false,
      },
    });
    window.localStorage.setItem(
      CAMERA_PREFERENCES_STORAGE_KEY,
      storedPreferences,
    );

    fireEvent.click(canvas);
    await act(async () => Promise.resolve());

    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      captureDenied: true,
    });
    expect(window.localStorage.getItem(CAMERA_PREFERENCES_STORAGE_KEY)).toBe(
      storedPreferences,
    );
  });

  it("publishes pointerlockerror as denial and keeps right-drag fallback usable", () => {
    const { canvas, channel } = mountBoundary();
    requestPointerLockMock(canvas).mockReturnValueOnce(
      new Promise<void>(() => undefined),
    );

    fireEvent.click(canvas);
    act(() => document.dispatchEvent(new Event("pointerlockerror")));
    expect(channel.getSnapshot().captureDenied).toBe(true);

    fireEvent.pointerDown(canvas, { button: 2 });
    dispatchPointerMove(canvas, 7, -4);

    expect(channel.getSnapshot().fallbackDragActive).toBe(true);
    expect(channel.consumeLookDelta()).toEqual({ x: 7, y: -4 });
  });

  it("hands look input from fallback drag to valid pointer lock without overlap", async () => {
    const capture = deferred<void>();
    const { canvas, channel } = mountBoundary();
    requestPointerLockMock(canvas).mockReturnValueOnce(capture.promise);
    fireEvent.click(canvas);
    fireEvent.pointerDown(canvas, { button: 2 });
    dispatchPointerMove(canvas, 6, -3);

    setPointerLock(canvas);
    dispatchPointerLockChange();

    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: true,
      fallbackDragActive: false,
    });
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });

    dispatchPointerMove(canvas, 4, 5);
    dispatchMouseMove(document, 7, -2);

    expect(channel.consumeLookDelta()).toEqual({ x: 7, y: -2 });
    await act(async () => capture.resolve());
  });

  it("notifies native deltas without changing snapshots or rerendering subscribers", () => {
    const { canvas, channel } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();
    const acknowledgedSnapshot = channel.getSnapshot();
    const onSnapshotRender = vi.fn();
    render(
      <CameraSnapshotProbe
        channel={channel}
        onRender={onSnapshotRender}
      />,
    );
    onSnapshotRender.mockClear();
    const invalidate = vi.fn();
    const unsubscribe = channel.subscribe(invalidate);

    dispatchMouseMove(document, 3, -2);
    dispatchMouseMove(document, 4, 5);
    fireEvent.wheel(canvas, { deltaY: 18 });

    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(channel.getSnapshot()).toBe(acknowledgedSnapshot);
    expect(onSnapshotRender).not.toHaveBeenCalled();
    expect(channel.consumeLookDelta()).toEqual({ x: 7, y: 3 });
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(channel.consumeWheelDelta()).toBe(18);
    expect(channel.consumeWheelDelta()).toBe(0);
    unsubscribe();
  });

  it("clears deltas on ordinary pointer-lock loss without changing world mode", () => {
    const { canvas, channel } = mountBoundary();
    const worldMode = { mode: "exploring", velocity: [1, 0, 2] } as const;
    setPointerLock(canvas);
    dispatchPointerLockChange();
    dispatchMouseMove(document, 9, -6);
    fireEvent.wheel(canvas, { deltaY: 12 });

    setPointerLock(null);
    dispatchPointerLockChange();

    expect(channel.getSnapshot().pointerLockActive).toBe(false);
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(channel.consumeWheelDelta()).toBe(0);
    expect(worldMode).toEqual({ mode: "exploring", velocity: [1, 0, 2] });
  });

  it("neutralizes fallback input when the document becomes hidden", () => {
    const { canvas, channel } = mountBoundary();
    fireEvent.pointerDown(canvas, { button: 2 });
    dispatchPointerMove(canvas, 9, -6);
    fireEvent.wheel(canvas, { deltaY: 12 });

    dispatchVisibilityChange("hidden");

    expect(channel.getSnapshot().fallbackDragActive).toBe(false);
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(channel.consumeWheelDelta()).toBe(0);
  });

  it("exits a deferred capture that resolves after the document becomes hidden", async () => {
    const capture = deferred<void>();
    const { canvas, channel } = mountBoundary();
    requestPointerLockMock(canvas).mockReturnValueOnce(capture.promise);
    exitPointerLock.mockImplementation(() => setPointerLock(null));
    fireEvent.click(canvas);

    dispatchVisibilityChange("hidden");
    setPointerLock(canvas);
    await act(async () => capture.resolve());
    dispatchPointerLockChange();

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      captureDenied: false,
    });
  });

  it("uses pointer-lock acknowledgment to resolve an existing release when hidden", async () => {
    vi.useFakeTimers();
    const { canvas, channel, handleRef } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();
    const release = handleRef.current!.requestRelease(52);
    expect(channel.getSnapshot().releasePending).toBe(true);
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    exitPointerLock.mockImplementation(() => setPointerLock(null));

    dispatchVisibilityChange("hidden");

    expect(exitPointerLock).toHaveBeenCalledTimes(2);
    expect(channel.getSnapshot().releasePending).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    await expectPromisePending(release);

    dispatchPointerLockChange();

    await expect(release).resolves.toEqual({ requestId: 52, status: "released" });
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      releasePending: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not restore input or recapture on visible and focus events", () => {
    const { canvas, channel } = mountBoundary();
    fireEvent.pointerDown(canvas, { button: 2 });
    dispatchPointerMove(canvas, 5, -3);
    fireEvent.wheel(canvas, { deltaY: 8 });
    dispatchVisibilityChange("hidden");

    dispatchVisibilityChange("visible");
    act(() => window.dispatchEvent(new Event("focus")));

    expect(requestPointerLockMock(canvas)).not.toHaveBeenCalled();
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      fallbackDragActive: false,
    });
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(channel.consumeWheelDelta()).toBe(0);
  });

  it("neutralizes duplicate blur and hidden events only once", () => {
    const { canvas } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();

    act(() => window.dispatchEvent(new Event("blur")));
    dispatchVisibilityChange("hidden");
    act(() => window.dispatchEvent(new Event("blur")));

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
  });

  it("releases only after pointerlockchange acknowledges that the canvas is unlocked", async () => {
    const { canvas, channel, handleRef } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();

    const release = handleRef.current!.requestRelease(41);
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: true,
      releasePending: true,
    });
    await expectPromisePending(release);

    setPointerLock(null);
    dispatchPointerLockChange();

    await expect(release).resolves.toEqual({ requestId: 41, status: "released" });
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      releasePending: false,
    });
  });

  it("does not let a stale timeout acknowledgment resolve a newer release", async () => {
    vi.useFakeTimers();
    const { canvas, handleRef } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();

    const olderRelease = handleRef.current!.requestRelease(10);
    await act(async () => vi.advanceTimersByTime(100));
    const newerRelease = handleRef.current!.requestRelease(11);
    setPointerLock(null);

    await act(async () => vi.advanceTimersByTime(900));
    await expect(olderRelease).resolves.toEqual({
      requestId: 10,
      status: "released",
    });
    await expectPromisePending(newerRelease);

    await act(async () => vi.advanceTimersByTime(100));
    await expect(newerRelease).resolves.toEqual({
      requestId: 11,
      status: "released",
    });
  });

  it("reconciles acknowledged state and input when timeout observes an unlocked canvas", async () => {
    vi.useFakeTimers();
    const { canvas, channel, handleRef } = mountBoundary();
    const capture = deferred<void>();
    requestPointerLockMock(canvas).mockReturnValueOnce(capture.promise);
    fireEvent.click(canvas);
    setPointerLock(canvas);
    dispatchPointerLockChange();
    dispatchMouseMove(document, 8, -5);
    fireEvent.wheel(canvas, { deltaY: 14 });
    exitPointerLock.mockImplementation(() => setPointerLock(null));

    const release = handleRef.current!.requestRelease(50);
    await act(async () => vi.advanceTimersByTime(999));
    await expectPromisePending(release);
    await act(async () => vi.advanceTimersByTime(1));

    await expect(release).resolves.toEqual({ requestId: 50, status: "released" });
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: false,
      releasePending: false,
    });
    expect(channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(channel.consumeWheelDelta()).toBe(0);

    setPointerLock(canvas);
    await act(async () => capture.resolve());
    expect(exitPointerLock).toHaveBeenCalledTimes(2);
    expect(channel.getSnapshot().pointerLockActive).toBe(false);
  });

  it("returns a typed timeout failure while the canvas remains locked", async () => {
    vi.useFakeTimers();
    const { canvas, channel, handleRef } = mountBoundary();
    setPointerLock(canvas);
    dispatchPointerLockChange();

    const release = handleRef.current!.requestRelease(51);
    await act(async () => vi.advanceTimersByTime(1_000));

    await expect(release).resolves.toEqual({
      requestId: 51,
      status: "failed",
      reason: "pointer_lock_still_active",
    });
    expect(channel.getSnapshot()).toMatchObject({
      pointerLockActive: true,
      releasePending: false,
    });
  });

  it("starts right-drag only on the canvas and suppresses context menu only while active", () => {
    const { canvas, channel } = mountBoundary();

    fireEvent.pointerDown(document.body, { button: 2 });
    expect(channel.getSnapshot().fallbackDragActive).toBe(false);
    expect(fireEvent.contextMenu(canvas)).toBe(true);

    fireEvent.pointerDown(canvas, { button: 2 });
    expect(channel.getSnapshot().fallbackDragActive).toBe(true);
    expect(fireEvent.contextMenu(canvas)).toBe(false);

    fireEvent.pointerUp(document, { button: 2 });
    expect(channel.getSnapshot().fallbackDragActive).toBe(false);
    expect(fireEvent.contextMenu(canvas)).toBe(true);
  });

  it.each(["pointercancel", "pointerleave"])(
    "ends right-drag on %s",
    (eventType) => {
      const { canvas, channel } = mountBoundary();
      fireEvent.pointerDown(canvas, { button: 2 });

      fireEvent(canvas, new Event(eventType, { bubbles: true }));

      expect(channel.getSnapshot().fallbackDragActive).toBe(false);
      expect(fireEvent.contextMenu(canvas)).toBe(true);
    },
  );

  it("ends active input and exits an owned lock when capture becomes ineligible", () => {
    const mounted = mountBoundary();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    fireEvent.pointerDown(mounted.canvas, { button: 2 });

    mounted.rerender(mounted.canvas, false);

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().fallbackDragActive).toBe(false);
    fireEvent.click(mounted.canvas);
    expect(requestPointerLockMock(mounted.canvas)).not.toHaveBeenCalled();
  });

  it("exits a late capture that resolves after capture becomes ineligible", async () => {
    const capture = deferred<void>();
    const mounted = mountBoundary();
    requestPointerLockMock(mounted.canvas).mockReturnValueOnce(capture.promise);
    exitPointerLock.mockImplementation(() => setPointerLock(null));
    fireEvent.click(mounted.canvas);

    mounted.rerender(mounted.canvas, false);
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    await act(async () => capture.resolve());

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().pointerLockActive).toBe(false);
  });

  it("detaches an old canvas, exits its owned lock, and binds its replacement", () => {
    const mounted = mountBoundary();
    const replacement = makeCanvas();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();

    mounted.rerender(replacement);

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    fireEvent.click(mounted.canvas);
    expect(requestPointerLockMock(mounted.canvas)).not.toHaveBeenCalled();
    fireEvent.click(replacement);
    expect(requestPointerLockMock(replacement)).toHaveBeenCalledTimes(1);
  });

  it("has the replacement listener exit a late lock on the old canvas", async () => {
    const capture = deferred<void>();
    const mounted = mountBoundary();
    const replacement = makeCanvas();
    requestPointerLockMock(mounted.canvas).mockReturnValueOnce(capture.promise);
    exitPointerLock.mockImplementation(() => setPointerLock(null));
    fireEvent.click(mounted.canvas);

    mounted.rerender(replacement);
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    await act(async () => capture.resolve());

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().pointerLockActive).toBe(false);
    expect(requestPointerLockMock(replacement)).not.toHaveBeenCalled();
  });

  it("serializes capture across replacement and attributes a delayed error to the old attempt", async () => {
    const oldCapture = deferred<void>();
    const mounted = mountBoundary();
    const replacement = makeCanvas();
    requestPointerLockMock(mounted.canvas).mockReturnValueOnce(
      oldCapture.promise,
    );
    fireEvent.click(mounted.canvas);

    mounted.rerender(replacement);
    fireEvent.click(replacement);
    expect(requestPointerLockMock(replacement)).not.toHaveBeenCalled();

    fireEvent.pointerDown(replacement, { button: 2 });
    dispatchPointerMove(replacement, 6, -3);
    expect(mounted.channel.getSnapshot()).toMatchObject({
      fallbackDragActive: true,
      captureDenied: false,
    });
    expect(mounted.channel.consumeLookDelta()).toEqual({ x: 6, y: -3 });

    act(() => document.dispatchEvent(new Event("pointerlockerror")));
    expect(mounted.channel.getSnapshot().captureDenied).toBe(false);
    fireEvent.pointerUp(document, { button: 2 });
    fireEvent.click(replacement);
    expect(requestPointerLockMock(replacement)).toHaveBeenCalledTimes(1);

    await act(async () => oldCapture.reject(new Error("stale denial")));
    expect(mounted.channel.getSnapshot().captureDenied).toBe(false);
  });

  it("actively exits an owned lock before removing teardown listeners", () => {
    const documentRemove = vi.spyOn(document, "removeEventListener");
    const windowRemove = vi.spyOn(window, "removeEventListener");
    const mounted = mountBoundary();
    const canvasRemove = vi.spyOn(mounted.canvas, "removeEventListener");
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();

    mounted.unmount();

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(documentRemove).toHaveBeenCalledWith(
      "pointerlockchange",
      expect.any(Function),
    );
    expect(documentRemove).toHaveBeenCalledWith(
      "pointerlockerror",
      expect.any(Function),
    );
    expect(documentRemove).toHaveBeenCalledWith("mousemove", expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith("pointerup", expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith(
      "pointercancel",
      expect.any(Function),
    );
    expect(windowRemove).toHaveBeenCalledWith("blur", expect.any(Function));
    expect(documentRemove).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(canvasRemove).toHaveBeenCalledWith("click", expect.any(Function));
    expect(canvasRemove).toHaveBeenCalledWith("pointerdown", expect.any(Function));
    expect(canvasRemove).toHaveBeenCalledWith("pointermove", expect.any(Function));
    expect(canvasRemove).toHaveBeenCalledWith("pointerleave", expect.any(Function));
    expect(canvasRemove).toHaveBeenCalledWith("contextmenu", expect.any(Function));
    expect(canvasRemove).toHaveBeenCalledWith("wheel", expect.any(Function));

    fireEvent.click(mounted.canvas);
    expect(requestPointerLockMock(mounted.canvas)).not.toHaveBeenCalled();
    setPointerLock(mounted.canvas);
    dispatchVisibilityChange("hidden");
    act(() => window.dispatchEvent(new Event("blur")));
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
  });

  it("reconciles the external channel and deltas on active-lock teardown", () => {
    const mounted = mountBoundary();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    dispatchMouseMove(document, 4, -7);
    fireEvent.wheel(mounted.canvas, { deltaY: 11 });

    mounted.unmount();

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot()).toEqual({
      pointerLockSupported: false,
      pointerLockActive: false,
      fallbackDragActive: false,
      releasePending: false,
      captureDenied: false,
    });
    expect(mounted.channel.consumeLookDelta()).toEqual({ x: 0, y: 0 });
    expect(mounted.channel.consumeWheelDelta()).toBe(0);
  });

  it("clears release timers and settles every pending promise on teardown", async () => {
    vi.useFakeTimers();
    const mounted = mountBoundary();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    const firstRelease = mounted.handleRef.current!.requestRelease(70);
    const secondRelease = mounted.handleRef.current!.requestRelease(71);

    mounted.unmount();

    await expect(firstRelease).resolves.toEqual({
      requestId: 70,
      status: "failed",
      reason: "pointer_lock_still_active",
    });
    await expect(secondRelease).resolves.toEqual({
      requestId: 71,
      status: "failed",
      reason: "pointer_lock_still_active",
    });
    expect(mounted.channel.getSnapshot()).toEqual({
      pointerLockSupported: false,
      pointerLockActive: false,
      fallbackDragActive: false,
      releasePending: false,
      captureDenied: false,
    });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not duplicate pointer-lock exit when eligibility drops during a pending release", async () => {
    const mounted = mountBoundary();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();

    const release = mounted.handleRef.current!.requestRelease(72);
    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().releasePending).toBe(true);

    mounted.rerender(mounted.canvas, false);

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().releasePending).toBe(true);

    setPointerLock(null);
    dispatchPointerLockChange();
    await expect(release).resolves.toEqual({
      requestId: 72,
      status: "released",
    });
  });

  it("exits a late capture that resolves after boundary unmount", async () => {
    const capture = deferred<void>();
    const mounted = mountBoundary();
    requestPointerLockMock(mounted.canvas).mockReturnValueOnce(capture.promise);
    exitPointerLock.mockImplementation(() => setPointerLock(null));
    fireEvent.click(mounted.canvas);

    mounted.unmount();
    setPointerLock(mounted.canvas);
    dispatchPointerLockChange();
    await act(async () => capture.resolve());

    expect(exitPointerLock).toHaveBeenCalledTimes(1);
    expect(mounted.channel.getSnapshot().pointerLockActive).toBe(false);
  });
});
