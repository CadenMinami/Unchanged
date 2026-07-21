"use client";

import { Map, Settings, Volume2, VolumeX } from "lucide-react";
import Link from "next/link";
import type { RefObject } from "react";

import { InvestigationModeLink } from "@/components/investigation-mode/investigation-mode-link";

import type { CameraInputSnapshot } from "./camera/camera-input-boundary";
import { PerformanceNotice, QualityBadge } from "./quality-notice";
import styles from "./world-shell.module.css";

interface WorldHudProps {
  ambientCaption: string;
  cameraInputSnapshot: CameraInputSnapshot;
  cameraPointerLockIntroduced: boolean;
  cameraSettingsOpen: boolean;
  cameraSettingsButtonRef: RefObject<HTMLButtonElement | null>;
  currentZoneIndex: number;
  currentZoneLabel: string;
  ambientMuted: boolean;
  graphicsTier: "high" | "balanced" | "classroom";
  handoffHref: string;
  handoffLabel: string;
  handoffOpensCaseboard: boolean;
  offerNonSpatial: boolean;
  pendingAction: Readonly<{
    acceptedAt: number;
    kind: string;
    requestId: number;
  }> | null;
  ready: boolean;
  worldMode: string;
  interactionButtonRef: RefObject<HTMLButtonElement | null>;
  journalButtonRef: RefObject<HTMLButtonElement | null>;
  guidanceSetting: "off" | "subtle" | "guided";
  reasoningButtonRef: RefObject<HTMLButtonElement | null>;
  nearbyInteractionLabel: string | null;
  onInteract: () => void;
  onAmbientMuteChange: () => void;
  onGuidanceSettingChange: (setting: "off" | "subtle" | "guided") => void;
  onOpenCameraSettings: () => void;
  onOpenJournal: () => void;
  onOpenCaseboard: () => void;
}

function cameraStatusLine(
  ready: boolean,
  snapshot: CameraInputSnapshot,
  pointerLockIntroduced: boolean,
): string | null {
  if (!ready) return "Loading the movement controller and authored district.";
  if (snapshot.pointerLockActive) {
    return "Camera captured / Escape to release.";
  }
  if (!snapshot.pointerLockSupported) {
    return "Right-drag to look / Keyboard remains available.";
  }
  if (snapshot.captureDenied) {
    return "Capture blocked / Right-drag fallback.";
  }
  if (!pointerLockIntroduced) return "Click world to capture camera.";
  return null;
}

export function WorldHud({
  ambientCaption,
  cameraInputSnapshot,
  cameraPointerLockIntroduced,
  cameraSettingsOpen,
  cameraSettingsButtonRef,
  currentZoneIndex,
  currentZoneLabel,
  ambientMuted,
  graphicsTier,
  handoffHref,
  handoffLabel,
  handoffOpensCaseboard,
  offerNonSpatial,
  pendingAction,
  ready,
  worldMode,
  interactionButtonRef,
  journalButtonRef,
  guidanceSetting,
  reasoningButtonRef,
  nearbyInteractionLabel,
  onInteract,
  onAmbientMuteChange,
  onGuidanceSettingChange,
  onOpenCameraSettings,
  onOpenJournal,
  onOpenCaseboard,
}: WorldHudProps) {
  const cameraStatus = cameraStatusLine(
    ready,
    cameraInputSnapshot,
    cameraPointerLockIntroduced,
  );

  return (
    <>
      <header
        className={styles.masthead}
        data-camera-release-pending={cameraInputSnapshot.releasePending}
        data-pending-accepted-at={pendingAction?.acceptedAt}
        data-pending-action={pendingAction?.kind}
        data-pending-request-id={pendingAction?.requestId}
        data-testid="world-hud"
      >
        <Link data-world-route-source="brand_link" href="/">
          History Unbroken
        </Link>
        <span>VARENNES / SCHEMATIC RECONSTRUCTION</span>
        <InvestigationModeLink
          data-world-mode-after-release="non_spatial"
          data-world-route-source="non_spatial_link"
          href="/play/investigate"
          mode="non_spatial"
        >
          Use non-spatial investigation
        </InvestigationModeLink>
      </header>

      <section
        aria-busy={!ready}
        aria-live="polite"
        className={styles.status}
        data-testid="world-status"
        hidden={cameraSettingsOpen}
        role="status"
      >
        <p>Spatial archive / {worldMode}</p>
        <strong>
          {ready
            ? "Varennes reconstruction ready"
            : "Preparing Varennes reconstruction"}
        </strong>
        {cameraStatus ? (
          <span className={styles.statusLine}>{cameraStatus}</span>
        ) : null}
        <small className={styles.mobileDisclosure}>
          Authored dramatization; not testimony or evidence.
        </small>
      </section>
      <div className={styles.caseFileControl}>
        {handoffOpensCaseboard ? (
          <button
            className={styles.caseFileLink}
            disabled={pendingAction !== null}
            onClick={onOpenCaseboard}
            ref={reasoningButtonRef}
            type="button"
          >
            {handoffLabel}
          </button>
        ) : (
          <Link
            className={styles.caseFileLink}
            data-world-route-source={
              handoffHref === "/play" ? "briefing_link" : "case_handoff_link"
            }
            href={handoffHref}
          >
            {handoffLabel}
          </Link>
        )}
      </div>

      <button
        aria-label="Open route journal"
        className={styles.journalControl}
        disabled={pendingAction !== null}
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
              disabled={pendingAction !== null}
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
          disabled={pendingAction !== null}
          onClick={onAmbientMuteChange}
          title={ambientMuted ? "Enable ambient sound" : "Mute ambient sound"}
          type="button"
        >
          {ambientMuted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
        </button>
        <button
          aria-label="Open camera settings"
          className={styles.soundControl}
          data-pointer-lock-active={cameraInputSnapshot.pointerLockActive}
          disabled={pendingAction !== null}
          onClick={onOpenCameraSettings}
          ref={cameraSettingsButtonRef}
          title="Camera settings"
          type="button"
        >
          <Settings aria-hidden="true" />
        </button>
        <QualityBadge tier={graphicsTier} />
      </div>
      {offerNonSpatial ? <PerformanceNotice /> : null}
      {nearbyInteractionLabel ? (
        <button
          className={styles.interactionPrompt}
          disabled={pendingAction !== null}
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
