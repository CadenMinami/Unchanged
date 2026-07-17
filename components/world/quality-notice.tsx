"use client";

import { Gauge } from "lucide-react";

import { InvestigationModeLink } from "@/components/investigation-mode/investigation-mode-link";

import styles from "./world-shell.module.css";

interface QualityBadgeProps {
  tier: "high" | "balanced" | "classroom";
}

export function QualityBadge({ tier }: QualityBadgeProps) {
  return (
    <div className={styles.quality} aria-label={`Graphics quality: ${tier}`}>
      <Gauge aria-hidden="true" />
      <span>{tier}</span>
    </div>
  );
}

export function PerformanceNotice() {
  return (
    <aside className={styles.performanceOffer} role="status">
      <strong>This device is struggling with the 3D reconstruction.</strong>
      <span>Your evidence and repair requirements stay the same.</span>
      <InvestigationModeLink href="/play/investigate" mode="non_spatial">
        Switch to non-spatial investigation
      </InvestigationModeLink>
    </aside>
  );
}
