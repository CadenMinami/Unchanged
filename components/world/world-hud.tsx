"use client";

import { Map, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import { PerformanceNotice, QualityBadge } from "./quality-notice";
import styles from "./world-shell.module.css";

interface WorldHudProps {
  ambientCaption: string;
  currentZoneIndex: number;
  currentZoneLabel: string;
  ambientMuted: boolean;
  graphicsTier: "high" | "balanced" | "classroom";
  handoffHref: string;
  handoffLabel: string;
  handoffOpensCaseboard: boolean;
  offerNonSpatial: boolean;
  worldMode: string;
  interactionButtonRef: RefObject<HTMLButtonElement | null>;
  journalButtonRef: RefObject<HTMLButtonElement | null>;
  guidanceSetting: "off" | "subtle" | "guided";
  reasoningButtonRef: RefObject<HTMLButtonElement | null>;
  nearbyInteractionLabel: string | null;
  onInteract: () => void;
  onAmbientMuteChange: () => void;
  onGuidanceSettingChange: (setting: "off" | "subtle" | "guided") => void;
  onOpenJournal: () => void;
  onOpenCaseboard: () => void;
}

export function WorldHud({
  ambientCaption,
  currentZoneIndex,
  currentZoneLabel,
  ambientMuted,
  graphicsTier,
  handoffHref,
  handoffLabel,
  handoffOpensCaseboard,
  offerNonSpatial,
  worldMode,
  interactionButtonRef,
  journalButtonRef,
  guidanceSetting,
  reasoningButtonRef,
  nearbyInteractionLabel,
  onInteract,
  onAmbientMuteChange,
  onGuidanceSettingChange,
  onOpenJournal,
  onOpenCaseboard,
}: WorldHudProps) {
  return (
    <>
      <header className={styles.masthead}>
        <Link href="/">History Unbroken</Link>
        <span>VARENNES / SCHEMATIC RECONSTRUCTION</span>
        <Link href="/play/investigate">Use non-spatial investigation</Link>
      </header>

      <section className={styles.status} role="status" aria-live="polite">
        <p>Spatial archive / {worldMode}</p>
        <strong>Varennes reconstruction ready</strong>
        <span>Move with W A S D or arrow keys. Shift toggles a faster pace.</span>
      </section>
      <div className={styles.caseFileControl}>
        {handoffOpensCaseboard ? (
          <button
            className={styles.caseFileLink}
            onClick={onOpenCaseboard}
            ref={reasoningButtonRef}
            type="button"
          >
            {handoffLabel}
          </button>
        ) : (
          <Link className={styles.caseFileLink} href={handoffHref}>
            {handoffLabel}
          </Link>
        )}
      </div>

      <button
        aria-label="Open route journal"
        className={styles.journalControl}
        onClick={onOpenJournal}
        ref={journalButtonRef}
        title="Route journal"
        type="button"
      >
        <Map aria-hidden="true" />
        <span>Journal</span>
      </button>

      <aside
        aria-label="Ambient reconstruction caption"
        className={styles.ambientCaption}
      >
        <span>{ambientCaption}</span>
        <small>Authored dramatization; not testimony or evidence.</small>
      </aside>

      <nav
        aria-label={`Reconstruction route, stop ${currentZoneIndex + 1} of 4`}
        className={styles.routeCompass}
      >
        <ol aria-hidden="true">
          {[0, 1, 2, 3].map((index) => (
            <li data-current={index === currentZoneIndex} key={index} />
          ))}
        </ol>
        {guidanceSetting === "off" ? null : (
          <span>Objective / {handoffLabel}</span>
        )}
        {guidanceSetting === "guided" ? (
          <small className={styles.guidedHint}>
            Follow nearby prompts, then review discoveries in the journal.
          </small>
        ) : null}
        <div
          aria-label="Objective guidance"
          className={styles.guidanceControl}
          role="group"
        >
          {(["off", "subtle", "guided"] as const).map((setting) => (
            <button
              aria-label={`Guidance ${setting}`}
              aria-pressed={guidanceSetting === setting}
              key={setting}
              onClick={() => onGuidanceSettingChange(setting)}
              type="button"
            >
              {setting}
            </button>
          ))}
        </div>
      </nav>

      <aside className={styles.location} aria-label="Current reconstruction location">
        <span>{String(currentZoneIndex + 1).padStart(2, "0")}</span>
        <div>
          <p>Current district</p>
          <strong>{currentZoneLabel}</strong>
        </div>
      </aside>

      <div className={styles.topRightControls}>
        <button
          aria-label={ambientMuted ? "Enable ambient sound" : "Mute ambient sound"}
          aria-pressed={!ambientMuted}
          className={styles.soundControl}
          onClick={onAmbientMuteChange}
          title={ambientMuted ? "Enable ambient sound" : "Mute ambient sound"}
          type="button"
        >
          {ambientMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        <QualityBadge tier={graphicsTier} />
      </div>
      {offerNonSpatial ? <PerformanceNotice /> : null}
      {nearbyInteractionLabel ? (
        <button
          className={styles.interactionPrompt}
          onClick={onInteract}
          ref={interactionButtonRef}
          type="button"
        >
          <kbd>E</kbd>
          Inspect {nearbyInteractionLabel}
        </button>
      ) : null}
    </>
  );
}
