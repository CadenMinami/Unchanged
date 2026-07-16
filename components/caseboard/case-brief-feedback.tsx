"use client";

import { AlertTriangle, BrainCircuit, LoaderCircle, Quote, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { AIRequestCoordinator } from "@/lib/openai/ai-request-coordinator";
import { buildAIRequestMetadata } from "@/lib/openai/request-metadata";
import {
  CASE_BRIEF_PROMPT_VERSION,
  caseBriefFeedbackRequestSchema,
  caseBriefFeedbackResponseSchema,
  type CaseBriefFeedbackResponse,
} from "@/schemas/ai-contracts";

import styles from "./case-brief-feedback.module.css";

const casePackage = loadVarennesCase();

const rubricLabels = {
  sourcing: "Sourcing and perspective",
  corroboration: "Corroboration",
  causalReasoning: "Causal reasoning",
  claimEvidenceFit: "Claim and evidence fit",
  uncertainty: "Alternatives and uncertainty",
} as const;

type RubricCriterion = keyof typeof rubricLabels;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function CaseBriefFeedback() {
  const { state } = useCaseSession();
  const courseAlignment = useOptionalCourseAlignment();
  const coordinatorRef = useRef(new AIRequestCoordinator());
  const [result, setResult] = useState<{
    stateRevision: number;
    response: CaseBriefFeedbackResponse;
  } | null>(null);
  const [operationalIssue, setOperationalIssue] = useState<{
    stateRevision: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    coordinator.invalidate();

    if (!state.caseBrief.submitted) {
      return () => coordinator.invalidate();
    }

    const metadata = buildAIRequestMetadata(casePackage, state, CASE_BRIEF_PROMPT_VERSION);
    const request = caseBriefFeedbackRequestSchema.parse({
      ...metadata,
      caseState: state,
      readingMode: courseAlignment?.preferences.readingMode ?? "standard",
    });
    const { signal } = coordinator.begin(metadata);

    void (async () => {
      try {
        const result = await fetch("/api/ai/case-brief-feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal,
        });
        const payload: unknown = await result.json();
        const parsed = caseBriefFeedbackResponseSchema.safeParse(payload);

        if (!parsed.success || !coordinator.isCurrent(parsed.data)) {
          if (coordinator.isCurrent(metadata)) {
            setOperationalIssue({
              stateRevision: state.revision,
              message:
                "The feedback response could not be validated. Your submitted Case Brief is preserved.",
            });
          }
          return;
        }

        setResult({ stateRevision: state.revision, response: parsed.data });
      } catch (error) {
        if (!isAbortError(error) && coordinator.isCurrent(metadata)) {
          setOperationalIssue({
            stateRevision: state.revision,
            message:
              "AI-assisted feedback is temporarily unavailable. Your Case Brief and deterministic repair status are unchanged.",
          });
        }
      }
    })();

    return () => coordinator.invalidate();
  }, [courseAlignment?.preferences.readingMode, state]);

  if (!state.caseBrief.submitted) return null;

  const response = result?.stateRevision === state.revision ? result.response : null;
  const operationalMessage =
    operationalIssue?.stateRevision === state.revision ? operationalIssue.message : null;
  const pending = !response && !operationalMessage;

  return (
    <section className={styles.feedbackBand} aria-labelledby="formative-feedback-heading">
      <div className={styles.heading}>
        <div className={styles.headingIcon}>
          <BrainCircuit aria-hidden="true" />
        </div>
        <div>
          <p>GPT-5.6 reasoning review</p>
          <h2 id="formative-feedback-heading">AI-assisted formative feedback</h2>
          <span>Advisory only. The deterministic repair status below is independent.</span>
        </div>
      </div>

      {pending ? (
        <div className={styles.pending} role="status">
          <LoaderCircle aria-hidden="true" />
          Evaluating the committed Case Brief snapshot
        </div>
      ) : null}

      {operationalMessage ? (
        <div className={styles.fallback} role="status">
          <AlertTriangle aria-hidden="true" />
          <p>{operationalMessage}</p>
        </div>
      ) : null}

      {response?.status === "fallback" ? (
        <div className={styles.fallback} role="status">
          <AlertTriangle aria-hidden="true" />
          <div>
            <strong>Authored fallback</strong>
            <p>{response.displayMessage}</p>
          </div>
        </div>
      ) : null}

      {response?.status === "ok" ? (
        <div className={styles.feedbackBody}>
          <div className={styles.summary}>
            <Sparkles aria-hidden="true" />
            <div>
              <span>{response.feedback.formativeStatus.replaceAll("_", " ")}</span>
              <p>{response.feedback.summary}</p>
              <strong>{response.feedback.revisionPrompt}</strong>
            </div>
          </div>

          {response.feedback.evidenceClaimLinks.length > 0 ? (
            <section className={styles.evidenceLinks} aria-labelledby="feedback-evidence-heading">
              <h3 id="feedback-evidence-heading">Claim-to-evidence checks</h3>
              <ul>
                {response.feedback.evidenceClaimLinks.map((link, index) => (
                  <li key={`${link.evidenceId}-${index}`}>
                    <Quote aria-hidden="true" />
                    <q>{link.studentSpan}</q>
                    <span>{link.evidenceId}</span>
                    <b>{link.fit}</b>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {response.feedback.concerns.length > 0 ? (
            <section className={styles.concerns} aria-labelledby="feedback-concerns-heading">
              <h3 id="feedback-concerns-heading">Language to reconsider</h3>
              {response.feedback.concerns.map((concern, index) => (
                <div key={`${concern.kind}-${index}`}>
                  <q>{concern.studentSpan}</q>
                  <p>{concern.explanation}</p>
                </div>
              ))}
            </section>
          ) : null}

          <section className={styles.rubric} aria-labelledby="feedback-rubric-heading">
            <h3 id="feedback-rubric-heading">Reasoning rubric</h3>
            <ol>
              {(Object.keys(rubricLabels) as RubricCriterion[]).map((criterion) => (
                <li key={criterion}>
                  <div>
                    <span>{rubricLabels[criterion]}</span>
                    <b>{response.feedback.rubricScores[criterion]} / 4</b>
                  </div>
                  <p>{response.feedback.rubricReasons[criterion]}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : null}
    </section>
  );
}
