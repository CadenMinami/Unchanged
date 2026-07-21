"use client";

import { Effects } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import { Vector2 } from "three";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

import type { GraphicsProfile } from "@/lib/world/graphics-profile";

export type WorldPostProcessingConfig = Readonly<{
  bloomRadius: number;
  bloomStrength: number;
  bloomThreshold: number;
  multisampling: number;
}>;

export function selectWorldPostProcessingConfig(
  profile: GraphicsProfile,
): WorldPostProcessingConfig | null {
  if (
    profile.tier === "classroom" ||
    !profile.postProcessingAllowed ||
    !profile.effects.bloom
  ) {
    return null;
  }

  return {
    bloomRadius: profile.tier === "high" ? 0.16 : 0.1,
    bloomStrength: Math.min(profile.effects.bloomStrength, 0.22),
    bloomThreshold: profile.tier === "high" ? 0.92 : 0.94,
    multisampling: Math.min(profile.effects.multisampling, 2),
  };
}

function EnhancedPostProcessing({
  config,
}: {
  config: WorldPostProcessingConfig;
}) {
  const bloomPass = useMemo(
    () =>
      new UnrealBloomPass(
        new Vector2(1, 1),
        config.bloomStrength,
        config.bloomRadius,
        config.bloomThreshold,
      ),
    [
      config.bloomRadius,
      config.bloomStrength,
      config.bloomThreshold,
    ],
  );

  useEffect(() => () => bloomPass.dispose(), [bloomPass]);

  return (
    <Effects
      depthBuffer={false}
      disableGamma
      multisamping={config.multisampling}
      stencilBuffer={false}
    >
      <primitive object={bloomPass} />
    </Effects>
  );
}

export function WorldPostProcessing({
  profile,
}: {
  profile: GraphicsProfile;
}) {
  const config = selectWorldPostProcessingConfig(profile);

  if (config === null) return null;

  return <EnhancedPostProcessing config={config} />;
}
