"use client";

import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import { useCaseSession } from "@/components/case-session/case-session-provider";
import type { ReducerResult } from "@/lib/case-engine/reducer";
import {
  authorizeWorldInteraction,
  type InteractionRejectionReason,
} from "@/lib/world/interaction-policy";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import type { WorldInteractionRequest } from "@/schemas/world-manifest";

const manifest = loadVarennesSceneManifest();
let preparedInteractionSequence = 0;

export type AuthorizedWorldInteractionTarget =
  | Readonly<{ targetType: "evidence"; evidenceId: string }>
  | Readonly<{ targetType: "station"; stationId: string }>
  | Readonly<{ targetType: "case_surface"; surfaceId: "journal" }>;

export type AuthorizedWorldInteractionRequest = Readonly<
  Omit<WorldInteractionRequest, "canonicalTarget"> & {
    canonicalTarget: AuthorizedWorldInteractionTarget;
  }
>;

export type PreparedWorldInteraction = Readonly<{
  preparedId: string;
  target: AuthorizedWorldInteractionTarget;
  request: AuthorizedWorldInteractionRequest;
}>;

export type PrepareWorldInteractionOutcome =
  | Readonly<{
      status: "prepared";
      prepared: PreparedWorldInteraction;
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | InteractionRejectionReason
        | "unsupported_target"
        | "adapter_inactive";
    }>;

type PendingInteractionRejection = Readonly<{
  status: "rejected";
  reason:
    | "stale_or_unknown_prepared_interaction"
    | "prepared_interaction_mismatch"
    | "invalid_prepared_interaction"
    | "adapter_inactive";
}>;

type PendingInteractionVerification =
  | PendingInteractionRejection
  | Readonly<{
      status: "verified";
      prepared: PreparedWorldInteraction;
    }>;

interface AdapterLifecycle {
  active: boolean;
  generation: number;
}

interface PendingWorldInteraction {
  generation: number;
  prepared: PreparedWorldInteraction;
}

export type CommitPreparedWorldInteractionOutcome =
  | Readonly<{
      status: "opened";
      target: AuthorizedWorldInteractionTarget;
      reducerResult: ReducerResult | null;
    }>
  | PendingInteractionRejection
  | Readonly<{
      status: "rejected";
      reason: "case_reducer_rejected";
      reducerResult: ReducerResult;
    }>;

export type CancelPreparedWorldInteractionOutcome =
  | Readonly<{ status: "cancelled" }>
  | PendingInteractionRejection;

export interface WorldInteractionAdapter {
  prepareWorldInteraction(request: unknown): PrepareWorldInteractionOutcome;
  commitPreparedWorldInteraction(
    prepared: unknown,
  ): CommitPreparedWorldInteractionOutcome;
  cancelPreparedWorldInteraction(
    prepared: unknown,
  ): CancelPreparedWorldInteractionOutcome;
}

function isAuthorizedTarget(
  target: WorldInteractionRequest["canonicalTarget"],
): target is AuthorizedWorldInteractionTarget {
  return (
    target.targetType === "evidence" ||
    target.targetType === "station" ||
    (target.targetType === "case_surface" && target.surfaceId === "journal")
  );
}

function freezeAuthorizedRequest(
  request: WorldInteractionRequest,
): AuthorizedWorldInteractionRequest {
  if (!isAuthorizedTarget(request.canonicalTarget)) {
    throw new Error("Cannot prepare an unsupported world interaction target.");
  }

  const canonicalTarget = Object.freeze({ ...request.canonicalTarget });
  return Object.freeze({ ...request, canonicalTarget });
}

function nextPreparedInteractionId(): string {
  preparedInteractionSequence += 1;
  return `world-interaction-${preparedInteractionSequence}`;
}

function verifyPendingInteraction(
  pending: ReadonlyMap<string, PendingWorldInteraction>,
  candidate: unknown,
  generation: number,
): PendingInteractionVerification {
  let preparedId: unknown;
  try {
    preparedId =
      typeof candidate === "object" && candidate !== null
        ? Reflect.get(candidate, "preparedId")
        : undefined;
  } catch {
    return { status: "rejected", reason: "invalid_prepared_interaction" };
  }
  if (typeof preparedId !== "string") {
    return { status: "rejected", reason: "invalid_prepared_interaction" };
  }

  const registered = pending.get(preparedId);
  if (!registered || registered.generation !== generation) {
    return {
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    };
  }
  if (registered.prepared !== candidate) {
    return { status: "rejected", reason: "prepared_interaction_mismatch" };
  }
  return { status: "verified", prepared: registered.prepared };
}

export function useWorldInteractionAdapter(): WorldInteractionAdapter {
  const { issue } = useCaseSession();
  const pendingInteractionsRef = useRef(
    new Map<string, PendingWorldInteraction>(),
  );
  const lifecycleRef = useRef<AdapterLifecycle>({ active: false, generation: 0 });

  useLayoutEffect(() => {
    const pendingInteractions = pendingInteractionsRef.current;
    const generation = lifecycleRef.current.generation + 1;
    lifecycleRef.current = { active: true, generation };

    return () => {
      if (lifecycleRef.current.generation !== generation) return;
      lifecycleRef.current = { active: false, generation: generation + 1 };
      pendingInteractions.clear();
    };
  }, []);

  const prepareWorldInteraction = useCallback(
    (request: unknown): PrepareWorldInteractionOutcome => {
      const lifecycle = lifecycleRef.current;
      if (!lifecycle.active) {
        return { status: "rejected", reason: "adapter_inactive" };
      }

      const decision = authorizeWorldInteraction(manifest, request);
      if (decision.status === "rejected") return decision;
      if (!isAuthorizedTarget(decision.request.canonicalTarget)) {
        return { status: "rejected", reason: "unsupported_target" };
      }

      const authorizedRequest = freezeAuthorizedRequest(decision.request);
      const prepared = Object.freeze({
        preparedId: nextPreparedInteractionId(),
        target: authorizedRequest.canonicalTarget,
        request: authorizedRequest,
      });
      pendingInteractionsRef.current.set(prepared.preparedId, {
        generation: lifecycle.generation,
        prepared,
      });

      return { status: "prepared", prepared };
    },
    [],
  );

  const commitPreparedWorldInteraction = useCallback(
    (candidate: unknown): CommitPreparedWorldInteractionOutcome => {
      const lifecycle = lifecycleRef.current;
      if (!lifecycle.active) {
        return { status: "rejected", reason: "adapter_inactive" };
      }

      const pending = pendingInteractionsRef.current;
      const verification = verifyPendingInteraction(
        pending,
        candidate,
        lifecycle.generation,
      );
      if (verification.status === "rejected") return verification;

      const { prepared } = verification;
      pending.delete(prepared.preparedId);
      if (prepared.target.targetType !== "evidence") {
        return {
          status: "opened",
          target: prepared.target,
          reducerResult: null,
        };
      }

      const reducerResult = issue({
        type: "inspect_item",
        itemId: prepared.target.evidenceId,
      });
      if (reducerResult.status === "duplicate") {
        return {
          status: "opened",
          target: prepared.target,
          reducerResult: null,
        };
      }
      if (reducerResult.status !== "applied") {
        return {
          status: "rejected",
          reason: "case_reducer_rejected",
          reducerResult,
        };
      }

      return {
        status: "opened",
        target: prepared.target,
        reducerResult,
      };
    },
    [issue],
  );

  const cancelPreparedWorldInteraction = useCallback(
    (candidate: unknown): CancelPreparedWorldInteractionOutcome => {
      const lifecycle = lifecycleRef.current;
      if (!lifecycle.active) {
        return { status: "rejected", reason: "adapter_inactive" };
      }

      const pending = pendingInteractionsRef.current;
      const verification = verifyPendingInteraction(
        pending,
        candidate,
        lifecycle.generation,
      );
      if (verification.status === "rejected") return verification;

      const { prepared } = verification;
      pending.delete(prepared.preparedId);
      return { status: "cancelled" };
    },
    [],
  );

  return useMemo(
    () => ({
      prepareWorldInteraction,
      commitPreparedWorldInteraction,
      cancelPreparedWorldInteraction,
    }),
    [
      cancelPreparedWorldInteraction,
      commitPreparedWorldInteraction,
      prepareWorldInteraction,
    ],
  );
}
