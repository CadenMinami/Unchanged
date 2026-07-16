"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import {
  LEARNING_SESSION_STORAGE_KEY,
  restoreLearningSession,
  serializeLearningSession,
} from "@/lib/learning-session/persistence";
import { createInitialLearningSession } from "@/lib/learning-session/state";
import {
  courseAlignmentProfileSchema,
  learningPreferencesSchema,
  type ApprovedCourseAlignment,
  type CourseAlignmentProfile,
  type LearningPreferences,
} from "@/schemas/course-alignment";
import type { ObservableLearningEvent } from "@/schemas/learning-session";

const casePackage = loadVarennesCase();

interface CourseAlignmentContextValue {
  ready: boolean;
  draft: CourseAlignmentProfile | null;
  approvedAlignment: ApprovedCourseAlignment | null;
  preferences: LearningPreferences;
  observableEvents: ObservableLearningEvent[];
  setDraft: (profile: CourseAlignmentProfile | null) => void;
  approveDraft: (profile: CourseAlignmentProfile) => void;
  clearAlignment: () => void;
  updatePreferences: (changes: Partial<LearningPreferences>) => void;
  recordObservableEvent: (
    event: Omit<ObservableLearningEvent, "eventId" | "occurredAt">,
  ) => void;
}

const CourseAlignmentContext = createContext<CourseAlignmentContextValue | null>(null);

interface CourseAlignmentProviderProps {
  children: ReactNode;
  persist?: boolean;
}

export function CourseAlignmentProvider({
  children,
  persist = true,
}: CourseAlignmentProviderProps) {
  const [session, setSession] = useState(() =>
    createInitialLearningSession(casePackage.caseId, casePackage.caseVersion),
  );
  const [draft, setDraftState] = useState<CourseAlignmentProfile | null>(null);
  const [ready, setReady] = useState(!persist);
  const hydrated = useRef(!persist);
  const eventSequence = useRef(0);

  useEffect(() => {
    if (!persist) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const restored = restoreLearningSession(
        window.localStorage.getItem(LEARNING_SESSION_STORAGE_KEY) ?? "",
        { caseId: casePackage.caseId, caseVersion: casePackage.caseVersion },
      );
      if (restored.session) {
        setSession(restored.session);
      } else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setSession((current) => ({
          ...current,
          preferences: { ...current.preferences, motionMode: "reduced" },
        }));
      }
      hydrated.current = true;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [persist]);

  useEffect(() => {
    if (!persist || !hydrated.current) return;
    window.localStorage.setItem(
      LEARNING_SESSION_STORAGE_KEY,
      serializeLearningSession(session),
    );
  }, [persist, session]);

  useEffect(() => {
    document.documentElement.dataset.readingMode = session.preferences.readingMode;
    document.documentElement.dataset.motionMode = session.preferences.motionMode;
    document.documentElement.dataset.guidanceMode = session.preferences.guidanceMode;
  }, [session.preferences]);

  const setDraft = useCallback((profile: CourseAlignmentProfile | null) => {
    if (!profile) {
      setDraftState(null);
      return;
    }
    setDraftState(
      courseAlignmentProfileSchema.parse({
        ...profile,
        reviewStatus: "pending_teacher_review",
      }),
    );
  }, []);

  const approveDraft = useCallback((profile: CourseAlignmentProfile) => {
    const approvedAt = new Date().toISOString();
    setSession((current) => {
      const approvedProfile = courseAlignmentProfileSchema.parse({
        ...profile,
        reviewStatus: "teacher_approved",
      });
      return {
        ...current,
        approvedAlignment: {
          approvedAt,
          profile: approvedProfile,
          preferences: current.preferences,
        },
      };
    });
    setDraftState(null);
  }, []);

  const clearAlignment = useCallback(() => {
    setSession((current) => ({ ...current, approvedAlignment: null }));
    setDraftState(null);
  }, []);

  const updatePreferences = useCallback((changes: Partial<LearningPreferences>) => {
    setSession((current) => {
      const preferences = learningPreferencesSchema.parse({
        ...current.preferences,
        ...changes,
      });
      return {
        ...current,
        preferences,
        approvedAlignment: current.approvedAlignment
          ? { ...current.approvedAlignment, preferences }
          : null,
      };
    });
  }, []);

  const recordObservableEvent = useCallback(
    (event: Omit<ObservableLearningEvent, "eventId" | "occurredAt">) => {
      eventSequence.current += 1;
      setSession((current) => ({
        ...current,
        observableEvents: [
          ...current.observableEvents,
          {
            ...event,
            eventId: `event-${Date.now()}-${eventSequence.current}`,
            occurredAt: new Date().toISOString(),
          },
        ].slice(-256),
      }));
    },
    [],
  );

  return (
    <CourseAlignmentContext.Provider
      value={{
        ready,
        draft,
        approvedAlignment: session.approvedAlignment,
        preferences: session.preferences,
        observableEvents: session.observableEvents,
        setDraft,
        approveDraft,
        clearAlignment,
        updatePreferences,
        recordObservableEvent,
      }}
    >
      {children}
    </CourseAlignmentContext.Provider>
  );
}

export function useCourseAlignment(): CourseAlignmentContextValue {
  const value = useContext(CourseAlignmentContext);
  if (!value) {
    throw new Error("useCourseAlignment must be used inside CourseAlignmentProvider.");
  }
  return value;
}

export function useOptionalCourseAlignment(): CourseAlignmentContextValue | null {
  return useContext(CourseAlignmentContext);
}
