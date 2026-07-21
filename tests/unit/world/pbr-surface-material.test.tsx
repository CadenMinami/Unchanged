import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render } from "@testing-library/react";
import sharp from "sharp";
import { Texture } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";

const textureMocks = vi.hoisted(() => ({
  useTexture: vi.fn(),
}));

vi.mock("@react-three/drei", () => ({
  useTexture: textureMocks.useTexture,
}));

import {
  FACADE_PBR_TEXTURE_URLS,
  FACADE_PBR_USED_FAMILIES,
  FacadeSurfaceMaterial,
  getScaleAwareFacadeRepeat,
  selectFacadePbrFamily,
} from "@/components/world/environment/pbr-surface-material";
import { ModularFacade } from "@/components/world/environment/modular-facade";
import { DISTRICT_FACADE_PLACEMENTS } from "@/components/world/environment/district-layout";

function sourceTextures() {
  return {
    map: new Texture(),
    normalMap: new Texture(),
    roughnessMap: new Texture(),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("facade PBR material boundary", () => {
  it("keeps the runtime registry to the four accepted facade families", () => {
    expect(FACADE_PBR_USED_FAMILIES).toEqual([
      "plaster",
      "stone",
      "timber",
      "roof",
    ]);
    expect(Object.keys(FACADE_PBR_TEXTURE_URLS)).toEqual(
      FACADE_PBR_USED_FAMILIES,
    );

    const urls = Object.values(FACADE_PBR_TEXTURE_URLS).flatMap((textureSet) =>
      Object.values(textureSet),
    );
    expect(urls).toHaveLength(12);
    expect(urls.every((url) => url.endsWith("_1k.jpg"))).toBe(true);
    expect(urls.some((url) => url.includes("rust-coarse-01"))).toBe(false);
  });

  it("maps authored facade families to an accepted major wall surface", () => {
    expect(selectFacadePbrFamily("plaster-gable")).toBe("plaster");
    expect(selectFacadePbrFamily("narrow-row")).toBe("plaster");
    expect(selectFacadePbrFamily("shopfront")).toBe("plaster");
    expect(selectFacadePbrFamily("stone-civic")).toBe("stone");
    expect(selectFacadePbrFamily("timber-front")).toBe("timber");
  });

  it("derives bounded repeats from surface scale", () => {
    expect(getScaleAwareFacadeRepeat("plaster", [6, 4])).toEqual([3, 2]);
    expect(getScaleAwareFacadeRepeat("timber", [6, 4.5])).toEqual([4, 3]);
    expect(getScaleAwareFacadeRepeat("roof", [3.6, 4])).toEqual([1, 1]);
    expect(getScaleAwareFacadeRepeat("stone", [80, 40])).toEqual([8, 8]);
    expect(getScaleAwareFacadeRepeat("stone", [0.1, 0.1])).toEqual([1, 1]);
  });

  it("renders the Classroom fallback without invoking the hook-owning texture path", () => {
    const view = render(
      <FacadeSurfaceMaterial
        color="#b9aa90"
        family="plaster"
        repeat={[3, 2]}
        textureTier="low"
      />,
    );

    expect(textureMocks.useTexture).not.toHaveBeenCalled();
    expect(
      view.container.querySelector(
        'meshstandardmaterial[name="facade-material-fallback"]',
      ),
    ).not.toBeNull();
    expect(
      view.container.querySelector(
        'meshstandardmaterial[name="facade-material-pbr"]',
      ),
    ).toBeNull();
  });

  it.each(["medium", "high"] as const)(
    "loads only the accepted family texture set for the %s tier",
    (textureTier) => {
      const sources = sourceTextures();
      textureMocks.useTexture.mockReturnValue(sources);

      const view = render(
        <FacadeSurfaceMaterial
          color="#817a70"
          family="stone"
          repeat={[3.5, 2]}
          textureTier={textureTier}
        />,
      );

      expect(textureMocks.useTexture).toHaveBeenCalledOnce();
      expect(textureMocks.useTexture).toHaveBeenCalledWith(
        FACADE_PBR_TEXTURE_URLS.stone,
      );
      expect(
        view.container.querySelector(
          'meshstandardmaterial[name="facade-material-pbr"]',
        ),
      ).not.toBeNull();
      expect(sources.map.repeat.toArray()).toEqual([1, 1]);
      expect(sources.normalMap.repeat.toArray()).toEqual([1, 1]);
      expect(sources.roughnessMap.repeat.toArray()).toEqual([1, 1]);
    },
  );

  it("ships every selected map at no more than 1K per dimension", async () => {
    for (const textureSet of Object.values(FACADE_PBR_TEXTURE_URLS)) {
      for (const url of Object.values(textureSet)) {
        const metadata = await sharp(
          join(process.cwd(), "public", url),
        ).metadata();
        expect(metadata.width).toBeLessThanOrEqual(1024);
        expect(metadata.height).toBeLessThanOrEqual(1024);
      }
    }
  });

  it("is mounted by the modular facade without importing gameplay authority", () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "components/world/environment/modular-facade.tsx",
      ),
      "utf8",
    );

    expect(source).toMatch(/<FacadeSurfaceMaterial/);
    expect(source).toMatch(/textureTier=/);
    expect(source).not.toMatch(
      /useCaseSession|issue\(|canonicalTarget|evidenceId|interactionType|RigidBody|Collider/,
    );
  });

  it("keeps the live facade on the low-tier fallback before any texture hook mounts", () => {
    const placement = DISTRICT_FACADE_PLACEMENTS[0]!;
    const sources = sourceTextures();
    textureMocks.useTexture.mockReturnValue(sources);
    const view = render(
      <ModularFacade
        castShadow={false}
        placement={placement}
        textureTier="low"
      />,
    );

    expect(textureMocks.useTexture).not.toHaveBeenCalled();

    view.rerender(
      <ModularFacade
        castShadow
        placement={placement}
        textureTier="medium"
      />,
    );

    expect(textureMocks.useTexture).toHaveBeenCalled();
    for (const [textureSet] of textureMocks.useTexture.mock.calls) {
      expect(Object.values(FACADE_PBR_TEXTURE_URLS)).toContain(textureSet);
    }
  });

  it("fails closed to the zero-texture facade when the parent omits a tier", () => {
    textureMocks.useTexture.mockReturnValue(sourceTextures());

    render(
      <ModularFacade
        castShadow
        placement={DISTRICT_FACADE_PLACEMENTS[0]!}
      />,
    );

    expect(textureMocks.useTexture).not.toHaveBeenCalled();
  });
});
