"use client";

import type { GraphicsTier } from "@/lib/world/graphics-profile";

import { ClassroomPeriodFigure } from "./classroom-period-figure";
import {
  PeriodFigure,
  type PeriodFigureProps,
} from "./period-figure";

export type PeriodCharacterProfile = Readonly<{
  tier: GraphicsTier;
}>;

export type PeriodCharacterProps = PeriodFigureProps &
  Readonly<{
    profile: PeriodCharacterProfile;
  }>;

export function PeriodCharacter({
  profile,
  ...figureProps
}: PeriodCharacterProps) {
  // Classroom avoids rich geometry while retaining the reviewed procedural silhouette.
  if (profile.tier === "classroom") {
    return <ClassroomPeriodFigure {...figureProps} />;
  }

  // A reviewed rig has not been accepted, so rich profiles remain honest fallbacks.
  return <PeriodFigure {...figureProps} />;
}
