import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  SphereGeometry,
} from "three";

export type FigurePalette = Readonly<{
  skin: string;
  coat: string;
  waistcoat: string;
  breeches: string;
  stockings: string;
  shoes: string;
  hair: string;
  hat: string;
}>;

export const PERIOD_FIGURE_GEOMETRIES = Object.freeze({
  upperLeg: new CylinderGeometry(0.085, 0.105, 0.66, 12),
  lowerLeg: new CylinderGeometry(0.06, 0.075, 0.48, 12),
  shoe: new BoxGeometry(0.16, 0.1, 0.3),
  torso: new CylinderGeometry(0.235, 0.29, 0.82, 12),
  waistcoat: new BoxGeometry(0.25, 0.56, 0.045),
  coatTail: new ConeGeometry(0.2, 0.58, 5),
  shoulders: new SphereGeometry(0.29, 16, 10),
  cravat: new BoxGeometry(0.31, 0.14, 0.07),
  arm: new CylinderGeometry(0.075, 0.1, 0.7, 12),
  hand: new SphereGeometry(0.078, 14, 12),
  head: new SphereGeometry(0.18, 20, 18),
  hair: new SphereGeometry(
    0.18,
    18,
    16,
    0,
    Math.PI * 2,
    0,
    Math.PI * 0.58,
  ),
  hatBrim: new CylinderGeometry(0.22, 0.24, 0.045, 16),
  hatCrown: new CylinderGeometry(0.135, 0.17, 0.13, 14),
});
