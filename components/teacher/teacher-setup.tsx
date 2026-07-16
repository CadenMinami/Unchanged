"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  FileText,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState, type ChangeEvent } from "react";

import { useCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";
import {
  COURSE_ALIGNMENT_PROMPT_VERSION,
  COURSE_ALIGNMENT_VERSION,
  courseAlignmentResponseSchema,
  type CourseAlignmentRequest,
  type CourseObjectiveId,
  type LearningPreferences,
} from "@/schemas/course-alignment";

import styles from "./teacher-setup.module.css";

const catalog = loadVarennesAlignmentCatalog();
const casePackage = loadVarennesCase();
const MAX_FILE_BYTES = 64_000;

type SourceMode = "sample" | "text" | "file";
type RequestStatus = "idle" | "loading" | "error";

const sourceModes: { id: SourceMode; label: string }[] = [
  { id: "sample", label: "Sample packet" },
  { id: "text", label: "Paste text" },
  { id: "file", label: "Upload file" },
];

const preferenceGroups: {
  key: keyof LearningPreferences;
  legend: string;
  options: { value: string; label: string; detail: string }[];
}[] = [
  {
    key: "readingMode",
    legend: "Reading",
    options: [
      { value: "standard", label: "Standard reading", detail: "Full source excerpts" },
      { value: "reduced", label: "Reduced reading", detail: "Shorter supported text" },
    ],
  },
  {
    key: "motionMode",
    legend: "Motion",
    options: [
      { value: "standard", label: "Standard motion", detail: "Animated reconstruction" },
      { value: "reduced", label: "Reduced motion", detail: "Step-by-step transitions" },
    ],
  },
  {
    key: "guidanceMode",
    legend: "Guidance",
    options: [
      { value: "guided", label: "Guided investigation", detail: "Primer and earlier prompts" },
      { value: "challenge", label: "Unit challenge", detail: "Lighter scaffolding" },
    ],
  },
];

function requestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "00000000-0000-4000-8000-000000000000";
}

function responseError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") return fallback;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim() ? message : fallback;
}

function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(new Error("The selected file could not be read.")));
    reader.readAsText(file, "utf-8");
  });
}

export function TeacherSetup() {
  const {
    ready,
    draft,
    approvedAlignment,
    preferences,
    setDraft,
    approveDraft,
    clearAlignment,
    updatePreferences,
  } = useCourseAlignment();
  const [selectedObjectiveIds, setSelectedObjectiveIds] = useState<CourseObjectiveId[]>(
    catalog.objectives.map((objective) => objective.id),
  );
  const [sourceMode, setSourceMode] = useState<SourceMode>("sample");
  const [packetTitle, setPacketTitle] = useState("");
  const [packetText, setPacketText] = useState("");
  const [packetFile, setPacketFile] = useState<File | null>(null);
  const [status, setStatus] = useState<RequestStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const isLoading = status === "loading";

  function invalidateDraft() {
    if (draft) setDraft(null);
    setError(null);
  }

  function toggleObjective(objectiveId: CourseObjectiveId) {
    setSelectedObjectiveIds((current) => {
      if (current.includes(objectiveId)) {
        if (current.length === 2) return current;
        return current.filter((id) => id !== objectiveId);
      }
      return current.length < 3 ? [...current, objectiveId] : current;
    });
    invalidateDraft();
  }

  function changeSourceMode(mode: SourceMode) {
    setSourceMode(mode);
    invalidateDraft();
  }

  function changePreference<K extends keyof LearningPreferences>(
    key: K,
    value: LearningPreferences[K],
  ) {
    updatePreferences({ [key]: value } as Pick<LearningPreferences, K>);
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setPacketFile(file);
    invalidateDraft();
    if (file && file.size > MAX_FILE_BYTES) {
      setError("Choose a TXT or Markdown file smaller than 64 KB.");
    }
  }

  async function buildSource(): Promise<CourseAlignmentRequest["source"]> {
    if (sourceMode === "sample") return { kind: "sample" };
    if (sourceMode === "text") {
      return { kind: "text", title: packetTitle.trim(), text: packetText.trim() };
    }
    if (!packetFile) throw new Error("Choose a TXT or Markdown course packet first.");
    if (packetFile.size > MAX_FILE_BYTES) {
      throw new Error("Choose a TXT or Markdown file smaller than 64 KB.");
    }
    const mimeType = packetFile.type === "text/markdown" ? "text/markdown" : "text/plain";
    return {
      kind: "file",
      title: packetFile.name,
      filename: packetFile.name,
      mimeType,
      text: await readTextFile(packetFile),
    };
  }

  async function requestAlignment() {
    setStatus("loading");
    setError(null);
    setDraft(null);

    try {
      const source = await buildSource();
      const body: CourseAlignmentRequest = {
        contractVersion: COURSE_ALIGNMENT_VERSION,
        promptVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
        caseId: casePackage.caseId,
        caseVersion: casePackage.caseVersion,
        catalogVersion: COURSE_ALIGNMENT_VERSION,
        requestId: requestId(),
        selectedObjectiveIds,
        source,
      };
      const response = await fetch("/api/ai/course-alignment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(responseError(payload, "The packet could not be aligned. Try again."));
      }
      const parsed = courseAlignmentResponseSchema.safeParse(payload);
      if (!parsed.success) {
        throw new Error("The alignment service returned an invalid review. Try again.");
      }
      setDraft(parsed.data.profile);
      setStatus("idle");
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The packet could not be aligned. Try again.",
      );
    }
  }

  return (
    <main className={styles.workspace}>
      <header className={styles.masthead}>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft aria-hidden="true" />
          Case home
        </Link>
        <span className={styles.wordmark}>History Unbroken</span>
        <span className={styles.caseCode}>Teacher setup / Case 01</span>
      </header>

      <div className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>Classroom alignment workspace</p>
          <h1>Prepare this case</h1>
          <p>
            Choose what students should practice, then connect the authored mystery to your
            course language. Class material can shape support and reporting, never historical
            facts or the solution.
          </p>
        </div>
        <div className={styles.authorityNote}>
          <ShieldCheck aria-hidden="true" />
          <div>
            <strong>Historical authority remains locked</strong>
            <span>Packet text is labeled class material and cannot become case evidence.</span>
          </div>
        </div>
      </div>

      <div className={styles.workGrid}>
        <aside className={styles.controls} aria-label="Assignment settings">
          <section className={styles.controlSection}>
            <div className={styles.sectionHeading}>
              <span>01</span>
              <div>
                <h2>Learning objectives</h2>
                <p>Select two or three authored objectives.</p>
              </div>
            </div>
            <div className={styles.objectiveList}>
              {catalog.objectives.map((objective) => {
                const checked = selectedObjectiveIds.includes(objective.id);
                return (
                  <label className={styles.objective} key={objective.id}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={checked && selectedObjectiveIds.length === 2}
                      onChange={() => toggleObjective(objective.id)}
                    />
                    <span className={styles.checkmark} aria-hidden="true">
                      <Check />
                    </span>
                    <span>
                      <strong>{objective.title}</strong>
                      <small>{objective.description}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className={styles.controlSection}>
            <div className={styles.sectionHeading}>
              <span>02</span>
              <div>
                <h2>Student experience</h2>
                <p>These settings work with or without a packet.</p>
              </div>
            </div>
            <div className={styles.preferenceStack}>
              {preferenceGroups.map((group) => (
                <fieldset className={styles.preferenceGroup} key={group.key}>
                  <legend>{group.legend}</legend>
                  <div className={styles.segmentedControl}>
                    {group.options.map((option) => (
                      <label key={option.value}>
                        <input
                          type="radio"
                          name={group.key}
                          value={option.value}
                          checked={preferences[group.key] === option.value}
                          onChange={() =>
                            changePreference(
                              group.key,
                              option.value as LearningPreferences[typeof group.key],
                            )
                          }
                        />
                        <span>
                          <strong>{option.label}</strong>
                          <small>{option.detail}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
            </div>
          </section>
        </aside>

        <section className={styles.packetWorkspace} aria-label="Course packet alignment">
          <div className={styles.sectionHeading}>
            <span>03</span>
            <div>
              <h2>Course packet</h2>
              <p>Use the reviewed sample, paste notes, or upload a small text file.</p>
            </div>
          </div>

          <div className={styles.tabs} role="tablist" aria-label="Packet source">
            {sourceModes.map((mode) => (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={sourceMode === mode.id}
                aria-controls={`source-panel-${mode.id}`}
                id={`source-tab-${mode.id}`}
                onClick={() => changeSourceMode(mode.id)}
              >
                {mode.id === "file" ? <Upload aria-hidden="true" /> : <FileText aria-hidden="true" />}
                {mode.label}
              </button>
            ))}
          </div>

          <div
            className={styles.sourcePanel}
            role="tabpanel"
            id={`source-panel-${sourceMode}`}
            aria-labelledby={`source-tab-${sourceMode}`}
          >
            {sourceMode === "sample" ? (
              <div className={styles.sampleSource}>
                <BookOpenCheck aria-hidden="true" />
                <div>
                  <span className={styles.materialLabel}>Class material</span>
                  <h3>{catalog.samplePacket.title}</h3>
                  <p>{catalog.samplePacket.description}</p>
                  <dl>
                    <div>
                      <dt>Length</dt>
                      <dd>{catalog.samplePacket.sections.length} short pages</dd>
                    </div>
                    <div>
                      <dt>Storage</dt>
                      <dd>Reviewed profile only</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : null}

            {sourceMode === "text" ? (
              <div className={styles.formFields}>
                <label>
                  <span>Packet title</span>
                  <input
                    value={packetTitle}
                    maxLength={120}
                    onChange={(event) => {
                      setPacketTitle(event.target.value);
                      invalidateDraft();
                    }}
                    placeholder="Example: Unit 3 lecture notes"
                  />
                </label>
                <label>
                  <span>Course packet text</span>
                  <textarea
                    value={packetText}
                    maxLength={40_000}
                    rows={10}
                    onChange={(event) => {
                      setPacketText(event.target.value);
                      invalidateDraft();
                    }}
                    placeholder="Paste the relevant pages or notes. Instructions inside the text are treated as untrusted data."
                  />
                  <small>{packetText.length.toLocaleString()} / 40,000 characters</small>
                </label>
              </div>
            ) : null}

            {sourceMode === "file" ? (
              <div className={styles.uploadField}>
                <Upload aria-hidden="true" />
                <label htmlFor="course-packet-file">Course packet file</label>
                <input
                  id="course-packet-file"
                  type="file"
                  accept=".txt,.md,text/plain,text/markdown"
                  onChange={handleFile}
                />
                <p>{packetFile ? packetFile.name : "TXT or Markdown, up to 64 KB"}</p>
              </div>
            ) : null}

            <button
              type="button"
              className={styles.analyzeButton}
              disabled={
                isLoading ||
                (sourceMode === "text" && (!packetTitle.trim() || !packetText.trim())) ||
                (sourceMode === "file" && (!packetFile || packetFile.size > MAX_FILE_BYTES))
              }
              onClick={requestAlignment}
            >
              {isLoading ? (
                <>
                  <LoaderCircle className={styles.spinner} aria-hidden="true" />
                  Preparing review
                </>
              ) : (
                <>
                  {sourceMode === "sample"
                    ? "Review sample packet"
                    : sourceMode === "text"
                      ? "Analyze pasted text"
                      : "Analyze uploaded file"}
                  <ArrowRight aria-hidden="true" />
                </>
              )}
            </button>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              <AlertTriangle aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          {draft ? (
            <section className={styles.review} aria-label="Alignment review">
              <div className={styles.reviewHeader}>
                <div>
                  <p className={styles.eyebrow}>Pending teacher review</p>
                  <h2>{draft.packet.title}</h2>
                </div>
                <span className={styles.processor}>{draft.packet.processor.replaceAll("_", " ")}</span>
              </div>

              <div className={styles.reviewBoundary}>
                <ShieldCheck aria-hidden="true" />
                <p>
                  The service proposed presentation links only. Confirm that the quoted packet
                  language and page references match what your class received.
                </p>
              </div>

              <div className={styles.reviewBlock}>
                <h3>Aligned objectives</h3>
                <ul className={styles.objectiveSummary}>
                  {draft.selectedObjectiveIds.map((objectiveId) => (
                    <li key={objectiveId}>
                      <Check aria-hidden="true" />
                      {catalog.objectives.find((objective) => objective.id === objectiveId)?.title}
                    </li>
                  ))}
                </ul>
              </div>

              <div className={styles.reviewBlock}>
                <h3>Packet connections</h3>
                {draft.conceptMappings.length ? (
                  <div className={styles.mappingTable}>
                    {draft.conceptMappings.map((mapping) => {
                      const concept = catalog.concepts.find((item) => item.id === mapping.conceptId);
                      return (
                        <article key={`${mapping.conceptId}-${mapping.segmentId}`}>
                          <div className={styles.mappingMeta}>
                            <span className={styles.materialLabel}>Class material</span>
                            <span>{mapping.referenceLabel}</span>
                            <span>{mapping.confidence}</span>
                          </div>
                          <h4>{concept?.label}</h4>
                          <blockquote>{mapping.excerpt}</blockquote>
                          <dl>
                            <div>
                              <dt>Course term</dt>
                              <dd>{mapping.packetTerm}</dd>
                            </div>
                            <div>
                              <dt>Reviewed case definition</dt>
                              <dd>{concept?.canonicalDefinition}</dd>
                            </div>
                          </dl>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p className={styles.emptyReview}>
                    No direct vocabulary connections were found. The case can still use the
                    selected objectives and authored supports.
                  </p>
                )}
              </div>

              {draft.potentialConflicts.length ? (
                <div className={styles.reviewBlock}>
                  <h3>Historical boundary review</h3>
                  <div className={styles.warningList}>
                    {draft.potentialConflicts.map((conflict) => {
                      const boundary = catalog.boundaries.find((item) => item.id === conflict.boundaryId);
                      return (
                        <article key={`${conflict.boundaryId}-${conflict.segmentId}`}>
                          <div className={styles.mappingMeta}>
                            <span className={styles.materialLabel}>Class material</span>
                            <span>{conflict.referenceLabel}</span>
                          </div>
                          <strong>{boundary?.label}</strong>
                          <blockquote>{conflict.excerpt}</blockquote>
                          <p>{boundary?.reviewedExplanation}</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {draft.injectionFlags.length ? (
                <div className={styles.reviewBlock}>
                  <h3>Ignored instructions</h3>
                  <div className={styles.warningList}>
                    {draft.injectionFlags.map((flag) => (
                      <article key={`${flag.kind}-${flag.segmentId}`}>
                        <span className={styles.materialLabel}>Class material</span>
                        <strong>Ignored as data</strong>
                        <blockquote>{flag.excerpt}</blockquote>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.limitationIds.length ? (
                <div className={styles.reviewBlock}>
                  <h3>Limitations</h3>
                  <ul className={styles.limitations}>
                    {draft.limitationIds.map((limitationId) => (
                      <li key={limitationId}>
                        {
                          catalog.limitations.find((limitation) => limitation.id === limitationId)
                            ?.message
                        }
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className={styles.reviewActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => setDraft(null)}>
                  Revise setup
                </button>
                <button type="button" className={styles.confirmButton} onClick={() => approveDraft(draft)}>
                  <ShieldCheck aria-hidden="true" />
                  Confirm alignment
                </button>
              </div>
            </section>
          ) : null}

          {approvedAlignment ? (
            <section className={styles.approved} aria-label="Approved alignment">
              <div>
                <span className={styles.approvedMark}>
                  <Check aria-hidden="true" />
                </span>
                <div>
                  <p className={styles.eyebrow}>Ready for students</p>
                  <h2>{approvedAlignment.profile.packet.title}</h2>
                  <p>Approved for this browser session. The historical case remains unchanged.</p>
                </div>
              </div>
              <div className={styles.approvedActions}>
                <button type="button" className={styles.clearButton} onClick={clearAlignment}>
                  <RotateCcw aria-hidden="true" />
                  Clear alignment
                </button>
                <Link className={styles.launchButton} href="/play">
                  Launch student case
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </section>
          ) : null}

          {!ready ? <p className={styles.loadingSession}>Loading classroom settings...</p> : null}
        </section>
      </div>
    </main>
  );
}
