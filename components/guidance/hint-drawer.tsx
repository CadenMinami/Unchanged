"use client";

import { Lightbulb, X } from "lucide-react";
import { useState } from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import {
  renderAlignedHint,
  selectInvestigationHint,
} from "@/lib/course-alignment/hint-selection";
import { loadVarennesHints } from "@/lib/course-alignment/load-hints";

import styles from "./hint-drawer.module.css";

const hints = loadVarennesHints();

export function HintDrawer() {
  const { state } = useCaseSession();
  const courseAlignment = useOptionalCourseAlignment();
  const hint = selectInvestigationHint(state, hints);
  const [visibleHintId, setVisibleHintId] = useState<string | null>(null);

  if (!hint) return null;

  const alignmentMapping = courseAlignment?.approvedAlignment?.profile.conceptMappings.find(
    (mapping) => mapping.conceptId === hint.conceptId,
  );
  const text = renderAlignedHint(
    hint,
    courseAlignment?.preferences.readingMode ?? "standard",
    alignmentMapping?.packetTerm,
  );
  const visible = visibleHintId === hint.id;

  return (
    <aside className={styles.drawer} data-guidance={courseAlignment?.preferences.guidanceMode ?? "guided"}>
      {!visible ? (
        <button
          type="button"
          onClick={() => {
            setVisibleHintId(hint.id);
            courseAlignment?.recordObservableEvent({
              type: "hint_viewed",
              subjectId: hint.id,
            });
          }}
        >
          <Lightbulb aria-hidden="true" />
          Request hint
        </button>
      ) : (
        <div role="status">
          <div>
            <span>Hint {hint.tier} / 4</span>
            {alignmentMapping ? <strong>Class-aligned wording</strong> : null}
          </div>
          <p>{text}</p>
          <button aria-label="Close hint" onClick={() => setVisibleHintId(null)} type="button">
            <X aria-hidden="true" />
          </button>
        </div>
      )}
    </aside>
  );
}
