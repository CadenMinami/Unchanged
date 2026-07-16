import { ArrowRight, Clock3, FileSearch2, Settings2 } from "lucide-react";
import Link from "next/link";

import styles from "@/components/teacher/teacher-setup.module.css";

export default function HomePage() {
  return (
    <main className="case-entry">
      <header className="case-entry__masthead">
        <span className="wordmark">History Unbroken</span>
        <span className="archive-code">CASE 01 / 21 JUN 1791</span>
      </header>

      <section className="case-entry__workspace" aria-labelledby="case-title">
        <div className="case-entry__route" aria-hidden="true">
          <span>PARIS</span>
          <i />
          <span>VARENNES</span>
          <b>?</b>
        </div>

        <div className="case-entry__brief">
          <p className="eyebrow">Temporal discrepancy / File opened</p>
          <h1 id="case-title">The Road That Should Have Closed</h1>
          <p className="case-entry__summary">
            Louis XVI&apos;s carriage has passed a town where the historical record says it was
            stopped. Reconstruct the evidence. Identify the altered link. Repair only what the
            record can support.
          </p>

          <dl className="case-entry__metadata">
            <div>
              <dt>
                <Clock3 aria-hidden="true" /> Runtime
              </dt>
              <dd>10-15 minutes</dd>
            </div>
            <div>
              <dt>
                <FileSearch2 aria-hidden="true" /> Prior knowledge
              </dt>
              <dd>Not required</dd>
            </div>
          </dl>

          <div>
            <Link className="primary-command" href="/play">
              Begin investigation
              <ArrowRight aria-hidden="true" />
            </Link>
            <Link className={styles.teacherEntry} href="/teacher">
              <Settings2 aria-hidden="true" />
              Teacher setup
            </Link>
          </div>
        </div>

        <aside className="case-entry__notice" aria-label="Historical authority notice">
          <strong>Source protocol</strong>
          <p>
            Historical records, contested interpretations, reconstructions, and fictional branch
            observations remain visibly separate throughout this case.
          </p>
        </aside>
      </section>
    </main>
  );
}
