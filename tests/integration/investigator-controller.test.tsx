import { act, fireEvent, render, screen } from "@testing-library/react";
import { createRef, type PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InvestigatorController } from "@/components/world/character/investigator-controller";
import { GRAPHICS_PROFILES } from "@/lib/world/graphics-profile";
import type { EcctrlHandle, MovementInput } from "ecctrl";

const controllerHarness = vi.hoisted(() => ({
  body: {
    linvel: vi.fn(() => ({ x: 3, y: 7, z: -2 })),
    setLinvel: vi.fn(),
    translation: vi.fn(() => ({ x: 4, y: 1, z: -6 })),
  },
  frameCallback: null as
    | ((state: { clock: { elapsedTime: number } }) => void)
    | null,
  invalidate: vi.fn(),
  latestProps: null as Record<string, unknown> | null,
  runActive: false,
  setForwardDir: vi.fn(),
  setMovement: vi.fn<(movement: MovementInput) => void>(),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: (
    callback: NonNullable<typeof controllerHarness.frameCallback>,
  ) => {
    controllerHarness.frameCallback = callback;
  },
  useThree: (selector: (state: { invalidate: () => void }) => unknown) =>
    selector({ invalidate: controllerHarness.invalidate }),
}));

vi.mock("ecctrl", async () => {
  const React = await import("react");
  const MockEcctrl = React.forwardRef(
    ({ children, ...props }: PropsWithChildren<Record<string, unknown>>, ref) => {
      controllerHarness.latestProps = props;
      React.useImperativeHandle(
        ref,
        () =>
          ({
            body: controllerHarness.body,
            get runActive() {
              return controllerHarness.runActive;
            },
            setForwardDir: controllerHarness.setForwardDir,
            setMovement: controllerHarness.setMovement,
          }) as unknown as EcctrlHandle,
        [],
      );

      return <div data-testid="ecctrl">{children}</div>;
    },
  );
  MockEcctrl.displayName = "MockEcctrl";

  return {
    Ecctrl: MockEcctrl,
  };
});

vi.mock("@/components/world/character/investigator-model", () => ({
  InvestigatorModel: ({
    motion,
    profile,
  }: {
    motion: string;
    profile: { tier: string };
  }) => (
    <div
      data-motion={motion}
      data-profile-tier={profile?.tier}
      data-testid="investigator-model"
    />
  ),
}));

function renderController(overrides: {
  enabled?: boolean;
  movementResetGeneration?: number;
  onPositionChange?: (position: [number, number, number]) => void;
} = {}) {
  const controllerRef = createRef<EcctrlHandle>();
  const onControllerReady = vi.fn();
  const props = {
    enabled: overrides.enabled ?? true,
    movementResetGeneration: overrides.movementResetGeneration ?? 0,
    onPositionChange: overrides.onPositionChange,
  };
  const renderElement = () => (
    <InvestigatorController
      controllerRef={controllerRef}
      enabled={props.enabled}
      graphicsProfile={GRAPHICS_PROFILES.high}
      initialPosition={[0, 1, 0]}
      movementResetGeneration={props.movementResetGeneration}
      onControllerReady={onControllerReady}
      onPositionChange={props.onPositionChange}
    />
  );
  const view = render(renderElement());

  return {
    controllerRef,
    onControllerReady,
    rerenderController(next: Partial<typeof props>) {
      Object.assign(props, next);
      view.rerender(renderElement());
    },
    ...view,
  };
}

function latestMovement(): MovementInput {
  const calls = controllerHarness.setMovement.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)?.[0] ?? {};
}

function press(code: string, key: string): void {
  fireEvent.keyDown(window, { code, key });
}

function release(code: string, key: string): void {
  fireEvent.keyUp(window, { code, key });
}

afterEach(() => {
  controllerHarness.frameCallback = null;
  vi.restoreAllMocks();
});

beforeEach(() => {
  controllerHarness.body.linvel.mockReturnValue({ x: 3, y: 7, z: -2 });
  controllerHarness.body.setLinvel.mockReset();
  controllerHarness.body.translation.mockReturnValue({ x: 4, y: 1, z: -6 });
  controllerHarness.invalidate.mockReset();
  controllerHarness.latestProps = null;
  controllerHarness.runActive = false;
  controllerHarness.setForwardDir.mockReset();
  controllerHarness.setMovement.mockReset();
});

describe("InvestigatorController Ecctrl contract", () => {
  it("passes the active graphics profile to the investigator presentation", () => {
    renderController();

    expect(screen.getByTestId("investigator-model")).toHaveAttribute(
      "data-profile-tier",
      "high",
    );
  });

  it("passes raw directional flags to Ecctrl's native camera basis", () => {
    renderController();

    press("KeyW", "w");
    press("KeyD", "d");
    press("ShiftLeft", "Shift");

    expect(controllerHarness.latestProps?.useCustomForward).toBe(false);
    expect(latestMovement()).toEqual({
      forward: true,
      backward: false,
      leftward: false,
      rightward: true,
      run: true,
      jump: false,
    });
    expect(latestMovement()).not.toHaveProperty("joystick");
    expect(controllerHarness.setForwardDir).not.toHaveBeenCalled();
  });

  it("keeps a demand render loop awake across movement edges and active motion", () => {
    renderController();
    act(() => {
      controllerHarness.frameCallback?.({ clock: { elapsedTime: 0 } });
    });
    controllerHarness.invalidate.mockClear();

    press("KeyW", "w");
    expect(controllerHarness.invalidate).toHaveBeenCalledTimes(1);

    controllerHarness.invalidate.mockClear();
    act(() => {
      controllerHarness.frameCallback?.({ clock: { elapsedTime: 0.2 } });
    });
    expect(controllerHarness.invalidate).toHaveBeenCalledTimes(1);

    controllerHarness.invalidate.mockClear();
    release("KeyW", "w");
    expect(controllerHarness.invalidate).toHaveBeenCalledTimes(1);
  });

  it("zeros horizontal velocity immediately when locomotion is disabled", () => {
    const { rerenderController } = renderController();
    controllerHarness.body.setLinvel.mockClear();

    rerenderController({ enabled: false });

    expect(controllerHarness.body.setLinvel).toHaveBeenCalledWith(
      { x: 0, y: 7, z: 0 },
      true,
    );
  });

  it("does not resume a movement key held across a reset", () => {
    const { rerenderController } = renderController();
    press("KeyW", "w");
    expect(latestMovement().forward).toBe(true);

    rerenderController({ enabled: false, movementResetGeneration: 1 });
    expect(latestMovement().forward).toBe(false);

    rerenderController({ enabled: true });

    expect(latestMovement().forward).toBe(false);
  });

  it("clears movement and horizontal velocity on a reset generation edge", () => {
    const { rerenderController } = renderController();
    press("KeyW", "w");
    controllerHarness.body.setLinvel.mockClear();

    rerenderController({ movementResetGeneration: 1 });

    expect(latestMovement()).toEqual({
      forward: false,
      backward: false,
      leftward: false,
      rightward: false,
      run: false,
      jump: false,
    });
    expect(controllerHarness.body.setLinvel).toHaveBeenCalledWith(
      { x: 0, y: 7, z: 0 },
      true,
    );
  });

  it("starts in the neutralized input path for a nonzero reset generation", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    renderController({ movementResetGeneration: 7 });
    const keydownListeners = addEventListener.mock.calls
      .filter(([eventName]) => eventName === "keydown")
      .map(([, listener]) => listener);
    expect(keydownListeners).toHaveLength(2);
    const aggregateKeydown = keydownListeners.at(-1);
    expect(typeof aggregateKeydown).toBe("function");

    act(() => {
      if (typeof aggregateKeydown === "function") {
        aggregateKeydown(new KeyboardEvent("keydown", { code: "KeyW", key: "w" }));
      }
    });

    expect(latestMovement().forward).toBe(false);

    press("KeyW", "w");
    expect(latestMovement().forward).toBe(true);
  });

  it("keeps W and ArrowUp blocked independently until each is released", () => {
    const { rerenderController } = renderController();
    press("KeyW", "w");
    press("ArrowUp", "ArrowUp");

    rerenderController({ enabled: false, movementResetGeneration: 1 });
    rerenderController({ enabled: true });
    expect(latestMovement().forward).toBe(false);

    release("KeyW", "w");
    expect(latestMovement().forward).toBe(false);

    press("KeyW", "w");
    expect(latestMovement().forward).toBe(true);

    release("KeyW", "w");
    expect(latestMovement().forward).toBe(false);

    release("ArrowUp", "ArrowUp");
    expect(latestMovement().forward).toBe(false);

    press("ArrowUp", "ArrowUp");
    expect(latestMovement().forward).toBe(true);
  });

  it("ignores unrelated keys instead of resurrecting a blocked W", () => {
    const { rerenderController } = renderController();
    press("KeyW", "w");
    rerenderController({ enabled: false, movementResetGeneration: 1 });
    rerenderController({ enabled: true });
    const callCountAfterReset = controllerHarness.setMovement.mock.calls.length;

    press("KeyE", "e");
    press("Space", " ");

    expect(controllerHarness.setMovement).toHaveBeenCalledTimes(
      callCountAfterReset,
    );
    expect(latestMovement().forward).toBe(false);
  });

  it("requires Shift to be released before a fresh run edge", () => {
    const { rerenderController } = renderController();
    press("ShiftLeft", "Shift");
    expect(latestMovement().run).toBe(true);

    rerenderController({ enabled: false, movementResetGeneration: 1 });
    rerenderController({ enabled: true });
    expect(latestMovement().run).toBe(false);

    press("ShiftLeft", "Shift");
    expect(latestMovement().run).toBe(false);

    release("ShiftLeft", "Shift");
    expect(latestMovement().run).toBe(false);

    press("ShiftLeft", "Shift");
    expect(latestMovement().run).toBe(true);
  });

  it("requires a genuine post-reset movement key down edge", () => {
    const { rerenderController } = renderController();
    press("KeyW", "w");
    rerenderController({ enabled: false, movementResetGeneration: 1 });
    rerenderController({ enabled: true });

    release("KeyW", "w");
    expect(latestMovement().forward).toBe(false);

    press("KeyE", "e");
    expect(latestMovement().forward).toBe(false);

    press("KeyW", "w");
    expect(latestMovement().forward).toBe(true);
  });

  it.each(["window blur", "document hidden"] as const)(
    "blocks held movement aliases and Shift through %s until matching keyup",
    (lifecycleEdge) => {
      const visibilityState = vi
        .spyOn(document, "visibilityState", "get")
        .mockReturnValue("visible");
      renderController();
      press("KeyW", "w");
      press("ArrowUp", "ArrowUp");
      press("ShiftLeft", "Shift");
      expect(latestMovement()).toMatchObject({ forward: true, run: true });
      controllerHarness.body.setLinvel.mockClear();

      if (lifecycleEdge === "window blur") {
        fireEvent.blur(window);
      } else {
        visibilityState.mockReturnValue("hidden");
        fireEvent(document, new Event("visibilitychange"));
      }

      expect(latestMovement()).toMatchObject({ forward: false, run: false });
      expect(controllerHarness.body.setLinvel).toHaveBeenCalledWith(
        { x: 0, y: 7, z: 0 },
        true,
      );

      if (lifecycleEdge === "window blur") {
        fireEvent.focus(window);
      } else {
        visibilityState.mockReturnValue("visible");
        fireEvent(document, new Event("visibilitychange"));
      }
      press("KeyE", "e");
      fireEvent.keyDown(window, { code: "KeyW", key: "w", repeat: true });
      fireEvent.keyDown(window, {
        code: "ArrowUp",
        key: "ArrowUp",
        repeat: true,
      });
      fireEvent.keyDown(window, {
        code: "ShiftLeft",
        key: "Shift",
        repeat: true,
      });
      press("KeyW", "w");
      press("ArrowUp", "ArrowUp");
      press("ShiftLeft", "Shift");
      expect(latestMovement()).toMatchObject({ forward: false, run: false });

      release("KeyW", "w");
      press("KeyW", "w");
      expect(latestMovement().forward).toBe(true);
      expect(latestMovement().run).toBe(false);

      release("KeyW", "w");
      expect(latestMovement().forward).toBe(false);
      release("ArrowUp", "ArrowUp");
      press("ArrowUp", "ArrowUp");
      expect(latestMovement().forward).toBe(true);

      release("ArrowUp", "ArrowUp");
      release("ShiftLeft", "Shift");
      press("ShiftLeft", "Shift");
      expect(latestMovement()).toMatchObject({ forward: false, run: true });
    },
  );

  it("preserves telemetry and leaves visible heading with Ecctrl", () => {
    const onPositionChange = vi.fn();
    const { onControllerReady } = renderController({ onPositionChange });

    act(() => {
      controllerHarness.frameCallback?.({ clock: { elapsedTime: 0.2 } });
    });

    expect(onControllerReady).toHaveBeenCalledTimes(1);
    expect(onPositionChange).toHaveBeenCalledWith([4, 1, -6]);
    expect(screen.getByTestId("ecctrl")).toContainElement(
      screen.getByTestId("investigator-model"),
    );
    expect(controllerHarness.setForwardDir).not.toHaveBeenCalled();
  });
});
