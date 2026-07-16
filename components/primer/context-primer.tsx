"use client";

import {
  ArrowRight,
  BookOpen,
  Building2,
  Crown,
  Landmark,
  MoonStar,
  Scale,
  ScrollText,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { ProvenanceBadge } from "@/components/provenance/provenance-badge";
import type { ContextPrimer, PrimerCard } from "@/schemas/context-primer";

import styles from "./context-primer.module.css";

const visualIcons = {
  revolution: Landmark,
  crown: Crown,
  constitution: ScrollText,
  tuileries: Building2,
  contested: Scale,
  departure: MoonStar,
};

interface ContextPrimerViewProps {
  primer: ContextPrimer;
  onComplete: () => void;
}

function ContextVisual({ card }: { card: PrimerCard }) {
  const Icon = visualIcons[card.visual];
  return (
    <div className={styles.visual} data-visual={card.visual} aria-hidden="true">
      <div className={styles.visualIndex}>{String(card.sequence).padStart(2, "0")}</div>
      <Icon />
      <div className={styles.visualRule} />
      <span>FRANCE / 1791</span>
    </div>
  );
}

export function ContextPrimerView({ primer, onComplete }: ContextPrimerViewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [localReducedReading, setLocalReducedReading] = useState(false);
  const courseAlignment = useOptionalCourseAlignment();
  const reducedReading = courseAlignment
    ? courseAlignment.preferences.readingMode === "reduced"
    : localReducedReading;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const card = primer.cards[activeIndex];
  const lastCard = activeIndex === primer.cards.length - 1;

  useEffect(() => {
    if (activeIndex > 0) {
      titleRef.current?.focus();
    }
  }, [activeIndex]);

  return (
    <main className={styles.primer}>
      <header className={styles.masthead}>
        <span className={styles.wordmark}>History Unbroken</span>
        <span className={styles.caseCode}>CASE 01 / CONTEXT</span>
      </header>

      <section className={styles.frame} aria-labelledby="primer-title">
        <div className={styles.progressRail} aria-label={`Context step ${card.sequence} of 6`}>
          <span>{card.sequence} of 6</span>
          <div>
            {primer.cards.map((item) => (
              <i className={item.sequence <= card.sequence ? styles.progressDone : ""} key={item.id} />
            ))}
          </div>
        </div>

        <ContextVisual card={card} />

        <article className={styles.copy}>
          <ProvenanceBadge kind={card.classification} />
          <p className={styles.eyebrow}>Minimum context / {card.id}</p>
          <h1 id="primer-title" ref={titleRef} tabIndex={-1}>
            {card.title}
          </h1>
          <p className={styles.explanation}>
            {reducedReading ? card.reducedText : card.standardText}
          </p>

          {card.glossary ? (
            <aside className={styles.glossary} aria-label={`Glossary: ${card.glossary.term}`}>
              <BookOpen aria-hidden="true" />
              <div>
                <strong>{card.glossary.term}</strong>
                <p>{card.glossary.definition}</p>
              </div>
            </aside>
          ) : null}

          {card.closingPrompt ? <p className={styles.closing}>{card.closingPrompt}</p> : null}

          <div className={styles.controls}>
            <label>
              <input
                checked={reducedReading}
                onChange={(event) => {
                  if (courseAlignment) {
                    courseAlignment.updatePreferences({
                      readingMode: event.target.checked ? "reduced" : "standard",
                    });
                  } else {
                    setLocalReducedReading(event.target.checked);
                  }
                }}
                type="checkbox"
              />
              Reduced reading
            </label>
            {lastCard ? (
              <button onClick={onComplete} type="button">
                Open temporal fracture
                <ArrowRight aria-hidden="true" />
              </button>
            ) : (
              <button
                onClick={() => setActiveIndex((current) => Math.min(current + 1, 5))}
                type="button"
              >
                Continue context
                <ArrowRight aria-hidden="true" />
              </button>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
