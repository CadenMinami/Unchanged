"use client";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

import type { FigureMotion } from "./figure-motion";
import { PeriodCharacter } from "./period-character";

export function InvestigatorModel({
  motion = "idle",
  profile,
  reducedMotion = false,
}: {
  motion?: FigureMotion;
  profile: GraphicsProfile;
  reducedMotion?: boolean;
}) {
  return (
    <group name="principal-character-investigator" position={[0, -0.72, 0]}>
      <PeriodCharacter
        motion={motion}
        profile={profile}
        reducedMotion={reducedMotion}
        scale={0.96}
      />
    </group>
  );
}
