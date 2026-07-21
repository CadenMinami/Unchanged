import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GRAPHICS_PROFILES } from "@/lib/world/graphics-profile";

const lightingMocks = vi.hoisted(() => ({
  contactShadows: vi.fn(() => <group data-testid="contact-shadows" />),
  environment: vi.fn(() => <group data-testid="hdri-environment" />),
  optionalAssetBoundary: vi.fn(
    ({ children }: { children: ReactNode }) => (
      <group data-testid="optional-asset-boundary">{children}</group>
    ),
  ),
}));

vi.mock("@react-three/drei", () => ({
  ContactShadows: lightingMocks.contactShadows,
  Environment: lightingMocks.environment,
}));

vi.mock("@/components/world/environment/optional-asset-boundary", () => ({
  OptionalAssetBoundary: lightingMocks.optionalAssetBoundary,
}));

import {
  selectWorldLightingConfig,
  WorldLighting,
} from "@/components/world/environment/world-lighting";

afterEach(() => {
  vi.clearAllMocks();
});

describe("physically coherent world lighting", () => {
  it("moves presentation lighting into a dedicated world module", () => {
    const lightingPath = join(
      process.cwd(),
      "components/world/environment/world-lighting.tsx",
    );
    const districtSource = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/grounded-district.tsx",
      ),
      "utf8",
    );

    expect(existsSync(lightingPath)).toBe(true);
    expect(districtSource).not.toMatch(
      /<hemisphereLight|<directionalLight|<pointLight|<ContactShadows/,
    );

    const runtimeSource = readFileSync(
      join(process.cwd(), "components/world/scene-runtime.tsx"),
      "utf8",
    );
    expect(runtimeSource).toMatch(/<WorldLighting profile=\{graphicsProfile\} \/>/);
  });

  it("uses cool environment fill and profile-owned shadow-map budgets", () => {
    const high = selectWorldLightingConfig(GRAPHICS_PROFILES.high);
    const balanced = selectWorldLightingConfig(GRAPHICS_PROFILES.balanced);
    const classroom = selectWorldLightingConfig(GRAPHICS_PROFILES.classroom);

    expect(high.environment).toMatchObject({
      fillColor: "#8ba0b4",
      fillIntensity: 0.95,
      keyColor: "#b8cae1",
      keyIntensity: 1.45,
      hdriBackgroundIntensity: 0.16,
      hdriEnvironmentIntensity: 0.38,
      shadowMapSize: 2048,
    });
    expect(balanced.environment.shadowMapSize).toBe(1024);
    expect(classroom.environment.shadowMapSize).toBe(0);
  });

  it("uses a licensed pure-sky environment only for enhanced profiles", () => {
    const high = selectWorldLightingConfig(GRAPHICS_PROFILES.high);
    const balanced = selectWorldLightingConfig(GRAPHICS_PROFILES.balanced);
    const classroom = selectWorldLightingConfig(GRAPHICS_PROFILES.classroom);

    expect(high.environment.hdriFile).toBe(
      "/world/hdris/qwantani-dusk-2-puresky/qwantani_dusk_2_puresky_1k.hdr",
    );
    expect(balanced.environment.hdriFile).toBe(high.environment.hdriFile);
    expect(classroom.environment.hdriFile).toBeNull();

    const highView = render(<WorldLighting profile={GRAPHICS_PROFILES.high} />);
    expect(lightingMocks.environment).toHaveBeenCalledWith(
      expect.objectContaining({
        background: true,
        files: high.environment.hdriFile,
      }),
      undefined,
    );
    highView.unmount();

    render(<WorldLighting profile={GRAPHICS_PROFILES.classroom} />);
    expect(lightingMocks.environment).toHaveBeenCalledTimes(1);
  });

  it("keeps enhanced lighting usable when the optional HDR environment fails", () => {
    render(<WorldLighting profile={GRAPHICS_PROFILES.high} />);

    expect(lightingMocks.optionalAssetBoundary).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "world-hdri-environment",
        fallback: expect.anything(),
      }),
      undefined,
    );
  });

  it("limits warm lantern keys and gives every key inverse-square falloff", () => {
    const high = selectWorldLightingConfig(GRAPHICS_PROFILES.high);
    const balanced = selectWorldLightingConfig(GRAPHICS_PROFILES.balanced);
    const classroom = selectWorldLightingConfig(GRAPHICS_PROFILES.classroom);

    expect(high.lanternKeys).toHaveLength(3);
    expect(balanced.lanternKeys).toHaveLength(2);
    expect(classroom.lanternKeys).toHaveLength(0);

    for (const key of [...high.lanternKeys, ...balanced.lanternKeys]) {
      expect(key).toMatchObject({
        color: "#f2a655",
        decay: 2,
        intensity: 8,
      });
      expect(key.distance).toBeGreaterThanOrEqual(8);
      expect(key.distance).toBeLessThanOrEqual(12);
    }
  });

  it("branches Classroom before mounting point or contact-shadow children", () => {
    const view = render(<WorldLighting profile={GRAPHICS_PROFILES.classroom} />);

    expect(lightingMocks.contactShadows).not.toHaveBeenCalled();
    expect(view.container.querySelectorAll("pointlight")).toHaveLength(0);
    expect(view.container.querySelectorAll("hemispherelight")).toHaveLength(1);
    expect(view.container.querySelectorAll("directionallight")).toHaveLength(1);
  });

  it("mounts the bounded enhanced branch only for profiles that allow it", () => {
    const view = render(<WorldLighting profile={GRAPHICS_PROFILES.high} />);

    expect(lightingMocks.contactShadows).toHaveBeenCalledOnce();
    expect(view.container.querySelectorAll("pointlight")).toHaveLength(3);
    expect(view.getByTestId("contact-shadows")).toBeInTheDocument();
  });

  it("never assigns a light to an ambient resident or character body", () => {
    const residentSource = readFileSync(
      join(process.cwd(), "components/world/ambient/ambient-residents.tsx"),
      "utf8",
    );
    const characterSource = readFileSync(
      join(process.cwd(), "components/world/character/period-character.tsx"),
      "utf8",
    );
    const figureSource = readFileSync(
      join(process.cwd(), "components/world/character/period-figure.tsx"),
      "utf8",
    );

    for (const source of [residentSource, characterSource, figureSource]) {
      expect(source).not.toMatch(
        /<ambientLight|<directionalLight|<hemisphereLight|<pointLight|<spotLight/,
      );
    }
  });
});
