"use client";

import type { FigureMotion } from "./period-figure";
import { PeriodFigure } from "./period-figure";

export function InvestigatorModel({
  motion = "idle",
  reducedMotion = false,
}: {
  motion?: FigureMotion;
  reducedMotion?: boolean;
}) {
  return (
    <group position={[0, -0.72, 0]}>
      <PeriodFigure motion={motion} reducedMotion={reducedMotion} scale={0.96} />
    </group>
  );
}
