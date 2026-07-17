"use client";

import dynamic from "next/dynamic";
import Link from "next/link";

import { InvestigationModeLink } from "@/components/investigation-mode/investigation-mode-link";

import styles from "./world-entry.module.css";

function WorldLoadingShell() {
  return (
    <main className={styles.world} data-testid="world-canvas-shell">
      <header className={styles.masthead}>
        <Link href="/">History Unbroken</Link>
        <span>CASE 01 / SPATIAL RECONSTRUCTION</span>
      </header>
      <section className={styles.loadingStage} aria-label="Loading 3D reconstruction">
        <div className={styles.routeMark} aria-hidden="true">
          <span />
          <i />
          <b />
        </div>
        <div className={styles.loadingCopy} role="status" aria-live="polite">
          <p>World archive / Initializing</p>
          <h1>Preparing the Varennes reconstruction.</h1>
          <span>Loading the interactive district and reviewed evidence stations.</span>
        </div>
        <InvestigationModeLink
          className={styles.nonSpatialLink}
          href="/play/investigate"
          mode="non_spatial"
        >
          Use non-spatial investigation
        </InvestigationModeLink>
      </section>
    </main>
  );
}

const WorldCanvas = dynamic(
  () => import("./world-canvas").then((module) => module.WorldCanvas),
  {
    loading: WorldLoadingShell,
    ssr: false,
  },
);

export function WorldEntry() {
  return <WorldCanvas />;
}
