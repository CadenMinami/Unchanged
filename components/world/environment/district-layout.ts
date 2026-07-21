import type { EnvironmentDensity } from "@/lib/world/graphics-profile";

export const DISTRICT_FACADE_FAMILIES = [
  "plaster-gable",
  "timber-front",
  "stone-civic",
  "narrow-row",
  "shopfront",
] as const;

export type DistrictFacadeFamily =
  (typeof DISTRICT_FACADE_FAMILIES)[number];

export type FacadeDensity = EnvironmentDensity;

export type DistrictFacadePlacement = Readonly<{
  id: string;
  family: DistrictFacadeFamily;
  minimumDensity: FacadeDensity;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  palette: Readonly<{
    wall: string;
    roof: string;
    trim: string;
    stone: string;
    window: string;
  }>;
  litWindowIndices: readonly number[];
  presentationOnly: true;
}>;

export const DISTRICT_DRESSING_KINDS = [
  "barrel",
  "bundle",
  "cart",
  "crate",
  "post",
  "puddle",
  "smoke",
  "vegetation",
  "window-interior",
] as const;

export type DistrictDressingKind =
  (typeof DISTRICT_DRESSING_KINDS)[number];

export type DistrictDressingPlacement = Readonly<{
  id: string;
  kind: DistrictDressingKind;
  minimumDensity: EnvironmentDensity;
  position: readonly [number, number, number];
  rotationY: number;
  scale: number;
  clearanceRadius: number;
  hostFacadeId?: string;
  motionSensitive: boolean;
  presentationOnly: true;
  countsAsHistoricalEvidence: false;
}>;

const DISTRICT_DRESSING_FOOTPRINT_RADIUS = Object.freeze({
  barrel: 0.47,
  bundle: 0.63,
  cart: 2.12,
  crate: 0.64,
  post: 0.17,
  puddle: 1.22,
  smoke: 0.72,
  vegetation: 0.51,
  "window-interior": 0.34,
} satisfies Record<DistrictDressingKind, number>);

const DISTRICT_DRESSING_MESH_COUNT = Object.freeze({
  barrel: 3,
  bundle: 1,
  cart: 4,
  crate: 2,
  post: 1,
  puddle: 1,
  smoke: 3,
  vegetation: 2,
  "window-interior": 1,
} satisfies Record<DistrictDressingKind, number>);

export const DISTRICT_DRESSING_MESH_BUDGET = Object.freeze({
  low: 10,
  medium: 20,
  high: 32,
} satisfies Record<EnvironmentDensity, number>);

export function getDistrictDressingFootprintRadius(
  placement: Pick<DistrictDressingPlacement, "kind" | "scale">,
): number {
  return DISTRICT_DRESSING_FOOTPRINT_RADIUS[placement.kind] * placement.scale;
}

export function getDistrictDressingMeshCount(
  kind: DistrictDressingKind,
): number {
  return DISTRICT_DRESSING_MESH_COUNT[kind];
}

export const DISTRICT_TRAVEL_CLEARANCE = Object.freeze({
  halfWidth: 5.7,
  minX: -12,
  maxX: 84,
});

// Dressing stays close to authored facades and outside the route used by
// principal characters. The final-zone exclusion is deliberately broader
// than the E5 interaction radius because that area must remain source-safe.
export const DISTRICT_DRESSING_PRINCIPAL_PATH_HALF_WIDTH = 4.2;
export const DISTRICT_DRESSING_FINAL_ZONE_MIN_X = 66;

export const DISTRICT_DRESSING_PLACEMENTS: readonly DistrictDressingPlacement[] = [
  {
    id: "west-crate-stack",
    kind: "crate",
    minimumDensity: "low",
    position: [-8, 0, -5.2],
    rotationY: 0.18,
    scale: 0.9,
    clearanceRadius: 0.65,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "archive-bundle",
    kind: "bundle",
    minimumDensity: "low",
    position: [7, 0, 5.2],
    rotationY: -0.32,
    scale: 0.88,
    clearanceRadius: 0.6,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "post-road-marker",
    kind: "post",
    minimumDensity: "low",
    position: [16, 0, -5.1],
    rotationY: 0,
    scale: 0.9,
    clearanceRadius: 0.25,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "mid-road-bundle",
    kind: "bundle",
    minimumDensity: "low",
    position: [32, 0, 5.2],
    rotationY: 0.46,
    scale: 0.96,
    clearanceRadius: 0.65,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "civic-crate",
    kind: "crate",
    minimumDensity: "low",
    position: [40, 0, -5.2],
    rotationY: -0.12,
    scale: 0.82,
    clearanceRadius: 0.6,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "east-drainage-puddle",
    kind: "puddle",
    minimumDensity: "low",
    position: [58, 0.13, 5.6],
    rotationY: 0.4,
    scale: 1,
    clearanceRadius: 1.25,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "archive-edge-post",
    kind: "post",
    minimumDensity: "medium",
    position: [-1.4, 0, 5.2],
    rotationY: 0,
    scale: 0.84,
    clearanceRadius: 0.25,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "west-handcart",
    kind: "cart",
    minimumDensity: "medium",
    position: [11, 0, -6.5],
    rotationY: -0.16,
    scale: 0.9,
    clearanceRadius: 2.15,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "post-road-shrub",
    kind: "vegetation",
    minimumDensity: "medium",
    position: [24, 0, 6],
    rotationY: 0.3,
    scale: 0.88,
    clearanceRadius: 0.5,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "mid-window-glow",
    kind: "window-interior",
    minimumDensity: "medium",
    position: [41.4, 2.6, -5.91],
    rotationY: 0,
    scale: 0.9,
    clearanceRadius: 0.35,
    hostFacadeId: "civic-south",
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "civic-north-crate",
    kind: "crate",
    minimumDensity: "medium",
    position: [48, 0, 5.2],
    rotationY: 0.24,
    scale: 0.78,
    clearanceRadius: 0.55,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "archive-barrel",
    kind: "barrel",
    minimumDensity: "high",
    position: [3, 0, -5.2],
    rotationY: 0.22,
    scale: 0.84,
    clearanceRadius: 0.5,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "post-road-swaying-shrub",
    kind: "vegetation",
    minimumDensity: "high",
    position: [20, 0, 6],
    rotationY: -0.28,
    scale: 0.92,
    clearanceRadius: 0.6,
    motionSensitive: true,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "post-road-chimney-smoke",
    kind: "smoke",
    minimumDensity: "high",
    position: [27, 4.8, -7.4],
    rotationY: 0,
    scale: 1,
    clearanceRadius: 0.75,
    motionSensitive: true,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "civic-window-glow",
    kind: "window-interior",
    minimumDensity: "high",
    position: [29.4, 2.5, -6.06],
    rotationY: 0,
    scale: 0.92,
    clearanceRadius: 0.35,
    hostFacadeId: "post-south-2",
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
  {
    id: "east-static-shrub",
    kind: "vegetation",
    minimumDensity: "high",
    position: [62, 0, -5.4],
    rotationY: 0.5,
    scale: 0.82,
    clearanceRadius: 0.5,
    motionSensitive: false,
    presentationOnly: true,
    countsAsHistoricalEvidence: false,
  },
] as const;

export const DISTRICT_FACADE_PLACEMENTS: readonly DistrictFacadePlacement[] = [
  {
    id: "archive-west",
    family: "plaster-gable",
    minimumDensity: "low",
    position: [-5.5, 0, -7.8],
    size: [5.2, 3.6, 3.7],
    palette: { wall: "#b9aa90", roof: "#5c3431", trim: "#263f3b", stone: "#77736c", window: "#dba85b" },
    litWindowIndices: [1],
    presentationOnly: true,
  },
  {
    id: "archive-east",
    family: "timber-front",
    minimumDensity: "low",
    position: [5.8, 0, -8.1],
    size: [5.8, 4.1, 3.9],
    palette: { wall: "#9fa69b", roof: "#474c51", trim: "#3d352e", stone: "#686963", window: "#dca75b" },
    litWindowIndices: [0, 2],
    presentationOnly: true,
  },
  {
    id: "archive-north",
    family: "narrow-row",
    minimumDensity: "medium",
    position: [-4.7, 0, 8.2],
    size: [4.7, 3.2, 3.5],
    palette: { wall: "#b8b6a8", roof: "#613d36", trim: "#34494a", stone: "#74726c", window: "#b9955b" },
    litWindowIndices: [],
    presentationOnly: true,
  },
  {
    id: "post-south-1",
    family: "shopfront",
    minimumDensity: "low",
    position: [15, 0, -8],
    size: [5.4, 3.5, 3.8],
    palette: { wall: "#a9a18f", roof: "#513b37", trim: "#27413a", stone: "#6f6a61", window: "#d8a259" },
    litWindowIndices: [0],
    presentationOnly: true,
  },
  {
    id: "post-north-1",
    family: "narrow-row",
    minimumDensity: "low",
    position: [20.5, 0, 8.2],
    size: [5.8, 4.2, 4],
    palette: { wall: "#b7a98e", roof: "#4d5155", trim: "#3a322d", stone: "#79746a", window: "#d0a064" },
    litWindowIndices: [1, 2],
    presentationOnly: true,
  },
  {
    id: "post-south-2",
    family: "timber-front",
    minimumDensity: "high",
    position: [28, 0, -8.2],
    size: [6.1, 4.5, 4.1],
    palette: { wall: "#9ca99f", roof: "#623b34", trim: "#293d42", stone: "#666c68", window: "#d5a25e" },
    litWindowIndices: [1],
    presentationOnly: true,
  },
  {
    id: "mid-north",
    family: "plaster-gable",
    minimumDensity: "medium",
    position: [34.5, 0, 8],
    size: [6.4, 3.8, 3.8],
    palette: { wall: "#b2ad9f", roof: "#44484c", trim: "#39462f", stone: "#77736d", window: "#c99d62" },
    litWindowIndices: [0, 2],
    presentationOnly: true,
  },
  {
    id: "civic-south",
    family: "stone-civic",
    minimumDensity: "low",
    position: [43, 0, -8.1],
    size: [7.2, 4.8, 4.2],
    palette: { wall: "#b5a17f", roof: "#523430", trim: "#284144", stone: "#817a70", window: "#e0aa60" },
    litWindowIndices: [1, 2],
    presentationOnly: true,
  },
  {
    id: "civic-north",
    family: "plaster-gable",
    minimumDensity: "low",
    position: [49.5, 0, 8.2],
    size: [6.6, 4.4, 4],
    palette: { wall: "#9ca4a0", roof: "#3f474e", trim: "#46382f", stone: "#696e6d", window: "#d5a163" },
    litWindowIndices: [0],
    presentationOnly: true,
  },
  {
    id: "east-south",
    family: "timber-front",
    minimumDensity: "low",
    position: [56.5, 0, -8],
    size: [5.5, 3.6, 3.7],
    palette: { wall: "#b9b2a0", roof: "#663d36", trim: "#31453a", stone: "#747069", window: "#d0a05e" },
    litWindowIndices: [1],
    presentationOnly: true,
  },
  {
    id: "east-north",
    family: "shopfront",
    minimumDensity: "high",
    position: [61.5, 0, 8.1],
    size: [5.8, 4, 3.9],
    palette: { wall: "#a8a18e", roof: "#414951", trim: "#3e352f", stone: "#6d6961", window: "#bd955f" },
    litWindowIndices: [],
    presentationOnly: true,
  },
] as const;

const DENSITY_RANK: Readonly<Record<FacadeDensity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function selectDistrictFacadePlacements(
  density: FacadeDensity,
): readonly DistrictFacadePlacement[] {
  const requestedRank = DENSITY_RANK[density];
  return DISTRICT_FACADE_PLACEMENTS.filter(
    ({ minimumDensity }) => DENSITY_RANK[minimumDensity] <= requestedRank,
  );
}

export function selectDistrictDressingPlacements(
  density: EnvironmentDensity,
  reducedMotion: boolean,
): readonly DistrictDressingPlacement[] {
  const requestedRank = DENSITY_RANK[density];
  return DISTRICT_DRESSING_PLACEMENTS.filter(
    ({ minimumDensity, motionSensitive }) =>
      DENSITY_RANK[minimumDensity] <= requestedRank &&
      !(reducedMotion && motionSensitive),
  );
}
