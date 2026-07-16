"use client";

import { Crown, LoaderCircle, Send, UserRoundSearch } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import { useOptionalCourseAlignment } from "@/components/course-alignment/course-alignment-provider";
import { PushToTalkControl } from "@/components/world/dialogue/push-to-talk-control";
import {
  VoicedResponse,
  type ProviderAudioAdapter,
} from "@/components/world/dialogue/voiced-response";
import { createBoundedAudioRecorder } from "@/lib/audio/recorder";
import { AIRequestCoordinator } from "@/lib/openai/ai-request-coordinator";
import { buildAIRequestMetadata } from "@/lib/openai/request-metadata";
import {
  createBrowserSpeechAdapter,
  type BrowserSpeechAdapter,
} from "@/lib/voice/browser-speech";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import {
  CHARACTER_PROMPT_VERSION,
  characterTurnRequestSchema,
  characterTurnResponseSchema,
  type CharacterTurnResponse,
} from "@/schemas/ai-contracts";

import styles from "./character-interview.module.css";

const casePackage = loadVarennesCase();

export type StationId = "CHAR-DROUET" | "CHAR-LOUIS";

const stationDetails: Record<
  StationId,
  {
    name: string;
    boundary: string;
    icon: typeof UserRoundSearch;
    allowedEvidenceIds: readonly string[];
  }
> = {
  "CHAR-DROUET": {
    name: "Drouet station",
    boundary: "Fictional branch perspective",
    icon: UserRoundSearch,
    allowedEvidenceIds: ["E3", "E4", "E5"],
  },
  "CHAR-LOUIS": {
    name: "Louis XVI station",
    boundary:
      "Louis's stated declaration; it cannot establish his complete private motive",
    icon: Crown,
    allowedEvidenceIds: ["E1"],
  },
};

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

interface CharacterInterviewProps {
  lockedStationId?: StationId;
  speechAdapterFactory?: () => BrowserSpeechAdapter;
  providerAudioFactory?: () => ProviderAudioAdapter;
  recorderFactory?: typeof createBoundedAudioRecorder;
}

export function CharacterInterview({
  lockedStationId,
  providerAudioFactory,
  recorderFactory,
  speechAdapterFactory = createBrowserSpeechAdapter,
}: CharacterInterviewProps = {}) {
  const { state } = useCaseSession();
  const courseAlignment = useOptionalCourseAlignment();
  const coordinatorRef = useRef(new AIRequestCoordinator());
  const [selectedStationId, setSelectedStationId] = useState<StationId>("CHAR-DROUET");
  const stationId = lockedStationId ?? selectedStationId;
  const [question, setQuestion] = useState("");
  const [questionRevision, setQuestionRevision] = useState(0);
  const questionRevisionRef = useRef(0);
  const [evidenceId, setEvidenceId] = useState("");
  const [result, setResult] = useState<{
    stateRevision: number;
    stationId: StationId;
    response: CharacterTurnResponse;
  } | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{
    requestId: string;
    stateRevision: number;
    stationId: StationId;
  } | null>(null);
  const [operationalIssue, setOperationalIssue] = useState<{
    stateRevision: number;
    stationId: StationId;
    message: string;
  } | null>(null);

  const inspectedEvidence = casePackage.evidence.filter(
    (item) =>
      state.inspectedItemIds.includes(item.id) &&
      stationDetails[stationId].allowedEvidenceIds.includes(item.id),
  );

  useEffect(() => {
    const coordinator = coordinatorRef.current;
    return () => {
      coordinator.invalidate();
    };
  }, [state.revision, stationId]);

  function invalidateDraftResponse() {
    coordinatorRef.current.invalidate();
    setResult(null);
    setPendingRequest(null);
    setOperationalIssue(null);
  }

  function chooseStation(nextStationId: StationId) {
    invalidateDraftResponse();
    setSelectedStationId(nextStationId);
    setEvidenceId("");
  }

  async function askSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const metadata = buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION);
    const request = characterTurnRequestSchema.parse({
      ...metadata,
      stationId,
      playerMessage: question,
      inspectedEvidenceIds: inspectedEvidence.map((item) => item.id),
      presentedEvidenceIds: evidenceId ? [evidenceId] : [],
      readingMode: courseAlignment?.preferences.readingMode ?? "standard",
    });
    const { signal } = coordinatorRef.current.begin(metadata);

    setResult(null);
    setPendingRequest({ requestId: metadata.requestId, stateRevision: state.revision, stationId });
    setOperationalIssue(null);

    try {
      const result = await fetch("/api/ai/character-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal,
      });
      const payload: unknown = await result.json();
      const parsed = characterTurnResponseSchema.safeParse(payload);

      if (!parsed.success || !coordinatorRef.current.isCurrent(parsed.data)) {
        if (coordinatorRef.current.isCurrent(metadata)) {
          setOperationalIssue({
            stateRevision: state.revision,
            stationId,
            message:
              "The source station could not validate that response. Your question is still here.",
          });
        }
        return;
      }

      setResult({ stateRevision: state.revision, stationId, response: parsed.data });
    } catch (error) {
      if (!isAbortError(error) && coordinatorRef.current.isCurrent(metadata)) {
        setOperationalIssue({
          stateRevision: state.revision,
          stationId,
          message:
            "The source station is temporarily unavailable. Your question and evidence selection were preserved.",
        });
      }
    } finally {
      if (coordinatorRef.current.isCurrent(metadata)) setPendingRequest(null);
    }
  }

  const response =
    result?.stateRevision === state.revision && result.stationId === stationId
      ? result.response
      : null;
  const pending =
    pendingRequest?.stateRevision === state.revision && pendingRequest.stationId === stationId;
  const operationalMessage =
    operationalIssue?.stateRevision === state.revision && operationalIssue.stationId === stationId
      ? operationalIssue.message
      : null;
  const activeDetails = stationDetails[stationId];
  const ActiveIcon = activeDetails.icon;
  const responseDetails = response ? stationDetails[stationId] : null;

  return (
    <section className={styles.interview} aria-labelledby="character-interview-heading">
      <div className={styles.heading}>
        <div>
          <p>Bounded source exchange</p>
          <h3 id="character-interview-heading">Test a source claim</h3>
        </div>
        <span>Not historical evidence</span>
      </div>

      {lockedStationId ? null : (
        <div className={styles.stationPicker} aria-label="Choose source station">
          {(Object.keys(stationDetails) as StationId[]).map((candidateId) => {
            const details = stationDetails[candidateId];
            const Icon = details.icon;
            return (
              <button
                aria-pressed={stationId === candidateId}
                key={candidateId}
                onClick={() => chooseStation(candidateId)}
                type="button"
              >
                <Icon aria-hidden="true" />
                {details.name}
              </button>
            );
          })}
        </div>
      )}

      <p className={styles.boundary}>
        <ActiveIcon aria-hidden="true" />
        {activeDetails.boundary}
      </p>

      <form className={styles.form} onSubmit={askSource}>
        <label htmlFor="presented-evidence">Present inspected evidence</label>
        <select
          id="presented-evidence"
          onChange={(event) => {
            invalidateDraftResponse();
            setEvidenceId(event.target.value);
          }}
          value={evidenceId}
        >
          <option value="">No evidence presented</option>
          {inspectedEvidence.map((evidence) => (
            <option key={evidence.id} value={evidence.id}>
              {evidence.id} / {evidence.shortTitle}
            </option>
          ))}
        </select>

        <label htmlFor="source-question">Question for the source station</label>
        <textarea
          id="source-question"
          maxLength={600}
          onChange={(event) => {
            invalidateDraftResponse();
            questionRevisionRef.current += 1;
            setQuestionRevision(questionRevisionRef.current);
            setQuestion(event.target.value);
          }}
          placeholder="Ask what this station observed, inferred, or cannot know."
          rows={4}
          value={question}
        />

        <PushToTalkControl
          caseId={casePackage.caseId}
          className={styles.pushToTalk}
          draftRevision={questionRevision}
          disabled={pending}
          onTranscript={(transcript, startingDraftRevision) => {
            if (startingDraftRevision !== questionRevisionRef.current) return;
            invalidateDraftResponse();
            setQuestion(transcript);
          }}
          recorderFactory={recorderFactory}
          stateRevision={state.revision}
          stationId={stationId}
        />

        <button disabled={pending || question.trim().length === 0} type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className={styles.spinner} /> : <Send aria-hidden="true" />}
          {pending ? "Checking source bounds" : "Ask source"}
        </button>
      </form>

      {operationalMessage ? (
        <p className={styles.operational} role="status">
          {operationalMessage}
        </p>
      ) : null}

      {response && responseDetails ? (
        <div
          aria-label="Source response"
          aria-live="polite"
          className={styles.response}
          role="article"
        >
          <div className={styles.responseMeta}>
            <span>{responseDetails.boundary}</span>
            <span>{response.status === "ok" ? "GPT-5.6 directed" : "Authored fallback"}</span>
          </div>
          <blockquote>{response.turn.spokenResponse}</blockquote>
          <VoicedResponse
            authorization={response.speechAuthorization}
            caption={response.turn.spokenResponse}
            className={styles.speechControls}
            correlation={{
              mediaVersion: "1.0.0",
              caseId: response.caseId,
              stationId,
              requestId: response.requestId,
              stateRevision: response.stateRevision,
            }}
            disclosureClassName={styles.speechDisclosure}
            providerAudioFactory={providerAudioFactory}
            speakerName={activeDetails.name.replace(" station", "")}
            speechAdapterFactory={speechAdapterFactory}
          />
          {response.turn.followUpQuestion ? <p>{response.turn.followUpQuestion}</p> : null}
          <dl>
            <div>
              <dt>Evidence referenced</dt>
              <dd>{response.turn.evidenceIdsReferenced.join(", ") || "None"}</dd>
            </div>
            <div>
              <dt>Epistemic status</dt>
              <dd>{response.turn.epistemicStatus}</dd>
            </div>
          </dl>
          <small>AI-directed dramatization. This response cannot be pinned or scored as evidence.</small>
        </div>
      ) : null}
    </section>
  );
}
