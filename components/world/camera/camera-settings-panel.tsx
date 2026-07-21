"use client";

import { X } from "lucide-react";
import {
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import { CAMERA_CONFIG } from "@/lib/world/camera-config";
import type { CameraPreferences } from "@/lib/world/camera-preferences";

import styles from "./camera-settings-panel.module.css";

interface CameraSettingsPanelProps {
  onChange: (preferences: CameraPreferences) => void;
  onClose: () => void;
  preferences: CameraPreferences;
}

export function CameraSettingsPanel({
  onChange,
  onClose,
  preferences,
}: CameraSettingsPanelProps) {
  const headingId = useId();
  const sensitivityId = useId();
  const invertYId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sensitivityRef = useRef<HTMLInputElement>(null);
  const invertYRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const containFocus = (event: FocusEvent) => {
      const panel = panelRef.current;
      if (panel && event.target instanceof Node && !panel.contains(event.target)) {
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    return () => document.removeEventListener("focusin", containFocus);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [
      closeButtonRef.current,
      sensitivityRef.current,
      invertYRef.current,
    ].filter(
      (element): element is HTMLButtonElement | HTMLInputElement =>
        element !== null,
    );
    if (focusable.length === 0) return;

    const activeIndex = focusable.indexOf(
      document.activeElement as HTMLButtonElement | HTMLInputElement,
    );
    if (event.shiftKey && activeIndex <= 0) {
      event.preventDefault();
      focusable.at(-1)?.focus();
    } else if (!event.shiftKey && activeIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0]?.focus();
    }
  };

  const changeSensitivity = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...preferences,
      sensitivity: Number(event.currentTarget.value),
    });
  };

  const changeInvertY = (event: ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...preferences,
      invertY: event.currentTarget.checked,
    });
  };

  return (
    <section
      aria-labelledby={headingId}
      aria-modal="true"
      className={styles.panel}
      onKeyDown={handleKeyDown}
      ref={panelRef}
      role="dialog"
    >
      <header className={styles.header}>
        <div>
          <p>View controls</p>
          <h2 id={headingId}>Camera settings</h2>
        </div>
        <button
          aria-label="Close camera settings"
          className={styles.closeButton}
          onClick={onClose}
          ref={closeButtonRef}
          title="Close camera settings"
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </header>

      <div className={styles.field}>
        <div className={styles.fieldLabel}>
          <label htmlFor={sensitivityId}>Look sensitivity</label>
          <span className={styles.value}>
            {preferences.sensitivity.toFixed(1)}x
          </span>
        </div>
        <input
          id={sensitivityId}
          max={CAMERA_CONFIG.sensitivity.max}
          min={CAMERA_CONFIG.sensitivity.min}
          onChange={changeSensitivity}
          ref={sensitivityRef}
          step={CAMERA_CONFIG.sensitivity.step}
          type="range"
          value={preferences.sensitivity}
        />
      </div>

      <label className={styles.checkboxField} htmlFor={invertYId}>
        <span>
          <strong>Invert vertical look</strong>
          <small>Reverse vertical camera movement.</small>
        </span>
        <input
          checked={preferences.invertY}
          id={invertYId}
          onChange={changeInvertY}
          ref={invertYRef}
          type="checkbox"
        />
      </label>
    </section>
  );
}
