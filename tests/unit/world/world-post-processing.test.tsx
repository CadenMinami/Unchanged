import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GRAPHICS_PROFILES } from "@/lib/world/graphics-profile";

const postProcessingMocks = vi.hoisted(() => ({
  bloomConstructed: vi.fn(),
  bloomDisposed: vi.fn(),
  effects: vi.fn(
    ({
      children,
      multisamping,
    }: {
      children?: ReactNode;
      multisamping?: number;
    }) => (
      <div data-multisampling={multisamping} data-testid="effects-composer">
        {children}
      </div>
    ),
  ),
}));

vi.mock("@react-three/drei", () => ({
  Effects: postProcessingMocks.effects,
}));

vi.mock("three/examples/jsm/postprocessing/UnrealBloomPass.js", () => ({
  UnrealBloomPass: class UnrealBloomPassMock {
    dispose = postProcessingMocks.bloomDisposed;

    constructor(
      resolution: { x: number; y: number },
      strength: number,
      radius: number,
      threshold: number,
    ) {
      postProcessingMocks.bloomConstructed({
        radius,
        resolution: [resolution.x, resolution.y],
        strength,
        threshold,
      });
    }
  },
}));

import {
  selectWorldPostProcessingConfig,
  WorldPostProcessing,
} from "@/components/world/environment/world-post-processing";

afterEach(() => {
  vi.clearAllMocks();
});

describe("restrained optional world post-processing", () => {
  it("composes the ledgered presentation effect in SceneRuntime", () => {
    const runtimeSource = readFileSync(
      join(process.cwd(), "components/world/scene-runtime.tsx"),
      "utf8",
    );

    expect(runtimeSource).toMatch(
      /import \{ WorldPostProcessing \} from "\.\/environment\/world-post-processing";/,
    );
    expect(runtimeSource).toMatch(
      /<WorldPostProcessing profile=\{graphicsProfile\} \/>/,
    );
  });

  it("returns before Effects or UnrealBloomPass instantiate for Classroom", () => {
    const view = render(
      <WorldPostProcessing profile={GRAPHICS_PROFILES.classroom} />,
    );

    expect(view.container).toBeEmptyDOMElement();
    expect(postProcessingMocks.effects).not.toHaveBeenCalled();
    expect(postProcessingMocks.bloomConstructed).not.toHaveBeenCalled();
  });

  it.each([
    ["high", GRAPHICS_PROFILES.high, 0.22, 2],
    ["balanced", GRAPHICS_PROFILES.balanced, 0.12, 0],
  ] as const)(
    "uses the %s profile's bloom strength and multisampling budget",
    (_tier, profile, expectedStrength, expectedMultisampling) => {
      const view = render(<WorldPostProcessing profile={profile} />);

      expect(postProcessingMocks.effects).toHaveBeenCalledOnce();
      expect(view.getByTestId("effects-composer")).toHaveAttribute(
        "data-multisampling",
        String(expectedMultisampling),
      );
      expect(postProcessingMocks.bloomConstructed).toHaveBeenCalledOnce();
      expect(postProcessingMocks.bloomConstructed).toHaveBeenCalledWith(
        expect.objectContaining({
          resolution: [1, 1],
          strength: expectedStrength,
        }),
      );
    },
  );

  it("keeps bloom above a high luminance threshold with a narrow radius", () => {
    for (const profile of [
      GRAPHICS_PROFILES.high,
      GRAPHICS_PROFILES.balanced,
    ]) {
      const config = selectWorldPostProcessingConfig(profile);

      expect(config).not.toBeNull();
      expect(config!.bloomStrength).toBeLessThanOrEqual(0.22);
      expect(config!.bloomThreshold).toBeGreaterThanOrEqual(0.9);
      expect(config!.bloomRadius).toBeLessThanOrEqual(0.18);
      expect(config!.multisampling).toBeLessThanOrEqual(2);
    }
  });

  it("disposes the owned bloom pass when the enhanced branch unmounts", () => {
    const view = render(
      <WorldPostProcessing profile={GRAPHICS_PROFILES.balanced} />,
    );

    view.unmount();

    expect(postProcessingMocks.bloomDisposed).toHaveBeenCalledOnce();
  });
});
