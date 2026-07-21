"use client";

import { ExternalLink, X } from "lucide-react";
import type { RefObject } from "react";
import { useEffect, useRef } from "react";

import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";

import styles from "./focus-overlay-host.module.css";

const casePackage = loadVarennesCase();
const alignmentCatalog = loadVarennesAlignmentCatalog();

interface FocusOverlayHostProps {
  evidenceId: string;
  invokerRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

function provenanceLabel(provenance: string): string {
  if (provenance === "verified_historical_record") return "Verified historical record";
  return "Cited historical reconstruction";
}

function evidenceSurfaceLabel(provenance: string): string {
  return provenance === "verified_historical_record"
    ? "Archive record"
    : "Evidence item";
}

export function FocusOverlayHost({
  evidenceId,
  invokerRef,
  onClose,
}: FocusOverlayHostProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const courseAlignment = useOptionalCourseAlignment();
  const evidence = casePackage.evidence.find((item) => item.id === evidenceId);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!evidence) return null;
  const sources = evidence.sourceIds.flatMap((sourceId) => {
    const source = casePackage.sources.find((item) => item.id === sourceId);
    return source ? [source] : [];
  });
  const reducedReading = courseAlignment?.preferences.readingMode === "reduced";
  const classConnections = courseAlignment?.approvedAlignment
    ? courseAlignment.approvedAlignment.profile.conceptMappings.filter((mapping) => {
        const concept = alignmentCatalog.concepts.find(
          (candidate) => candidate.id === mapping.conceptId,
        );
        return concept?.caseFactIds.some((factId) => evidence.factIds.includes(factId));
      })
    : [];

  function close() {
    onClose();
    queueMicrotask(() => invokerRef.current?.focus());
  }

  return (
    <div className={styles.scrim}>
      <section
        aria-labelledby="world-evidence-heading"
        aria-modal="true"
        className={styles.dialog}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
          if (event.key !== "Tab") return;

          const focusable = Array.from(
            dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not([disabled]), a[href]',
            ) ?? [],
          );
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        ref={dialogRef}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <p>{provenanceLabel(evidence.provenance)}</p>
            <span>{evidence.id} / {evidence.sourceType}</span>
          </div>
          <button aria-label="Close evidence" onClick={close} ref={closeRef} type="button">
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.body}>
          <div className={styles.record}>
            <p className={styles.eyebrow}>
              {evidenceSurfaceLabel(evidence.provenance)}
            </p>
            <h2 id="world-evidence-heading">{evidence.title}</h2>
            <blockquote>{evidence.studentExcerpt}</blockquote>
            {reducedReading ? (
              <details className={styles.sourceLimit}>
                <summary>Source limit</summary>
                <p>{evidence.description}</p>
              </details>
            ) : (
              <p>{evidence.description}</p>
            )}
            {classConnections.length > 0 ? (
              <aside className={styles.classConnection} aria-label="Class material connection">
                <strong>Class material</strong>
                {classConnections.slice(0, 2).map((mapping) => (
                  <span key={`${evidence.id}-${mapping.conceptId}`}>
                    {mapping.packetTerm} / {mapping.referenceLabel}
                  </span>
                ))}
              </aside>
            ) : null}
          </div>
          <aside className={styles.sources} aria-label="Source metadata">
            <p className={styles.eyebrow}>Source basis</p>
            {sources.map((source) => (
              <article key={source.id}>
                <span>{source.id} / {source.sourceType}</span>
                <h3>{source.title}</h3>
                <p>{source.citation}</p>
                <p><strong>Limit:</strong> {source.limitations}</p>
                <a href={source.citationUrl} rel="noreferrer" target="_blank">
                  Open catalog record
                  <ExternalLink aria-hidden="true" />
                </a>
              </article>
            ))}
          </aside>
        </div>
        <footer>
          <p>
            The 3D table is a schematic navigation object. Only this reviewed DOM record counts as evidence.
          </p>
        </footer>
      </section>
    </div>
  );
}
