import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { render } from "@testing-library/react";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

const characterBoundaryMocks = vi.hoisted(() => ({
  classroomPeriodFigure: vi.fn(),
  periodFigure: vi.fn(),
  useFrame: vi.fn(),
}));

vi.mock("@react-three/fiber", () => ({
  useFrame: characterBoundaryMocks.useFrame,
}));

vi.mock("@/components/world/character/period-figure", () => ({
  PeriodFigure: (props: unknown) => {
    characterBoundaryMocks.periodFigure(props);
    return null;
  },
}));

vi.mock("@/components/world/character/classroom-period-figure", () => ({
  ClassroomPeriodFigure: (props: unknown) => {
    characterBoundaryMocks.classroomPeriodFigure(props);
    return null;
  },
}));

import { PeriodCharacter } from "@/components/world/character/period-character";
import { InvestigatorModel } from "@/components/world/character/investigator-model";
import { AmbientResidents } from "@/components/world/ambient/ambient-residents";
import { CivicZone } from "@/components/world/zones/civic-zone";
import { PostRoadZone } from "@/components/world/zones/post-road-zone";
import { GRAPHICS_PROFILES } from "@/lib/world/graphics-profile";
import {
  loadVarennesAmbientLines,
  loadVarennesSceneManifest,
} from "@/lib/world/scene-manifest";

const DETAIL_BOUNDARY_NAME = "period-character-detail-boundary";
const PERIOD_CHARACTER_SOURCE_PATH = resolve(
  process.cwd(),
  "components/world/character/period-character.tsx",
);
const periodCharacterSource = readFileSync(
  PERIOD_CHARACTER_SOURCE_PATH,
  "utf8",
);
const periodCharacterSourceFile = ts.createSourceFile(
  PERIOD_CHARACTER_SOURCE_PATH,
  periodCharacterSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);

afterEach(() => {
  vi.clearAllMocks();
});

describe("PeriodCharacter", () => {
  it("uses the low-draw procedural fallback only for Classroom hardware", () => {
    const view = render(
      <PeriodCharacter
        motion="walk"
        profile={{ tier: "classroom" }}
        reducedMotion
        scale={0.92}
      />,
    );

    expect(
      view.container.querySelector(`group[name="${DETAIL_BOUNDARY_NAME}"]`),
    ).toBeNull();
    expect(characterBoundaryMocks.periodFigure).not.toHaveBeenCalled();
    expect(characterBoundaryMocks.classroomPeriodFigure).toHaveBeenCalledOnce();
    expect(characterBoundaryMocks.classroomPeriodFigure).toHaveBeenCalledWith({
      motion: "walk",
      reducedMotion: true,
      scale: 0.92,
    });

    for (const tier of ["high", "balanced"] as const) {
      characterBoundaryMocks.periodFigure.mockClear();
      characterBoundaryMocks.classroomPeriodFigure.mockClear();
      view.rerender(<PeriodCharacter motion="idle" profile={{ tier }} />);

      const detailBoundary = view.container.querySelector(
        `group[name="${DETAIL_BOUNDARY_NAME}"]`,
      );
      expect(detailBoundary).toBeNull();
      expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledOnce();
      expect(characterBoundaryMocks.classroomPeriodFigure).not.toHaveBeenCalled();
      expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledWith({
        motion: "idle",
      });
    }
  });

  it("imports only the approved profile and procedural figure modules", () => {
    const staticImports = periodCharacterSourceFile.statements
      .filter(ts.isImportDeclaration)
      .map((declaration) => {
        expect(ts.isStringLiteral(declaration.moduleSpecifier)).toBe(true);
        return ts.isStringLiteral(declaration.moduleSpecifier)
          ? declaration.moduleSpecifier.text
          : "";
      });
    const runtimeModuleCalls: string[] = [];
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        runtimeModuleCalls.push(node.getText(periodCharacterSourceFile));
      }
      ts.forEachChild(node, visit);
    };
    visit(periodCharacterSourceFile);

    expect(staticImports).toEqual([
      "@/lib/world/graphics-profile",
      "./classroom-period-figure",
      "./period-figure",
    ]);
    expect(runtimeModuleCalls).toEqual([]);
  });

  it("contains no loader, preload, or model URL surface", () => {
    expect(periodCharacterSource).not.toMatch(
      /@react-three\/drei|useGLTF|useAnimations|preload|https?:\/\/|\/world\/models\/|\.(?:glb|gltf)\b/i,
    );
  });
});

describe("world character role integration", () => {
  it("routes investigator locomotion through the selected character profile", () => {
    const view = render(
      <InvestigatorModel
        motion="run"
        profile={GRAPHICS_PROFILES.high}
        reducedMotion
      />,
    );

    expect(
      view.container.querySelector(`group[name="${DETAIL_BOUNDARY_NAME}"]`),
    ).toBeNull();
    expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledWith({
      motion: "run",
      reducedMotion: true,
      scale: 0.96,
    });
  });

  it("keeps Drouet idle while routing him through the selected profile", () => {
    const view = render(
      <PostRoadZone
        profile={GRAPHICS_PROFILES.balanced}
        reducedMotion={false}
      />,
    );

    expect(
      view.container.querySelectorAll(
        `group[name="${DETAIL_BOUNDARY_NAME}"]`,
      ),
    ).toHaveLength(0);
    expect(
      view.container.querySelector('group[name="principal-character-drouet"]'),
    ).not.toBeNull();
    expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledWith(
      expect.objectContaining({
        motion: "idle",
        reducedMotion: false,
        palette: expect.objectContaining({
          coat: "#684437",
          waistcoat: "#9b8053",
        }),
      }),
    );
  });

  it("keeps Louis idle without promoting civic dossier figures to likenesses", () => {
    const view = render(
      <CivicZone profile={GRAPHICS_PROFILES.high} reducedMotion={false} />,
    );

    expect(
      view.container.querySelectorAll(
        `group[name="${DETAIL_BOUNDARY_NAME}"]`,
      ),
    ).toHaveLength(0);
    expect(
      view.container.querySelector('group[name="principal-character-louis"]'),
    ).not.toBeNull();
    expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledWith(
      expect.objectContaining({
        motion: "idle",
        reducedMotion: false,
        palette: expect.objectContaining({
          coat: "#3c4c5a",
          waistcoat: "#c2ab74",
        }),
      }),
    );
  });

  it("uses only walking motion for profile-aware ambient residents", () => {
    const manifest = loadVarennesSceneManifest();
    const ambientLines = loadVarennesAmbientLines();
    const view = render(
      <AmbientResidents
        ambientLines={ambientLines}
        count={3}
        manifest={manifest}
        profile={GRAPHICS_PROFILES.balanced}
      />,
    );

    expect(
      view.container.querySelectorAll(
        `group[name="${DETAIL_BOUNDARY_NAME}"]`,
      ),
    ).toHaveLength(0);
    expect(characterBoundaryMocks.periodFigure).toHaveBeenCalledTimes(3);
    for (const [props] of characterBoundaryMocks.periodFigure.mock.calls) {
      expect(props).toEqual(
        expect.objectContaining({
          motion: "walk",
        }),
      );
      expect(props.motion).not.toBe("run");
      expect(props.motion).not.toBe("talk");
      expect(props.motion).not.toBe("interact");
    }
  });
});
