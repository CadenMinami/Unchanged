"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import { persistInvestigationMode } from "@/lib/world/spatial-session";
import type { InvestigationMode } from "@/schemas/spatial-session";

const manifest = loadVarennesSceneManifest();

type InvestigationModeLinkProps = ComponentProps<typeof Link> & {
  mode: InvestigationMode;
};

export function InvestigationModeLink({
  mode,
  onClick,
  ...props
}: InvestigationModeLinkProps) {
  function rememberMode(event: MouseEvent<HTMLAnchorElement>) {
    try {
      persistInvestigationMode(window.localStorage, manifest, mode);
    } catch {
      // Route navigation remains available when browser storage is unavailable.
    }
    onClick?.(event);
  }

  return <Link {...props} onClick={rememberMode} />;
}
