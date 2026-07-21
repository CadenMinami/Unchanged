import { act, createRef, forwardRef, useImperativeHandle } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  CaseSessionProvider,
  useCaseSession,
} from "@/components/case-session/case-session-provider";
import {
  type PreparedWorldInteraction,
  type WorldInteractionAdapter,
  useWorldInteractionAdapter,
} from "@/components/world/interaction-adapter";
import { loadVarennesCase } from "@/lib/case-engine/load-case";
import type { ReducerResult } from "@/lib/case-engine/reducer";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { loadVarennesSceneManifest } from "@/lib/world/scene-manifest";
import type { CaseState } from "@/schemas/case-state";

const casePackage = loadVarennesCase();
const manifest = loadVarennesSceneManifest();

function interactionRequest(
  predicate: (interactable: (typeof manifest.interactables)[number]) => boolean,
) {
  const interactable = manifest.interactables.find(predicate);
  if (!interactable) throw new Error("Required world interactable is missing.");

  return {
    interactableId: interactable.interactableId,
    zoneId: interactable.zoneId,
    interactionType: interactable.interactionType,
    canonicalTarget: interactable.canonicalTarget,
  };
}

const evidenceRequest = interactionRequest(
  (interactable) =>
    interactable.canonicalTarget.targetType === "evidence" &&
    interactable.canonicalTarget.evidenceId === "E3",
);
const stationRequest = interactionRequest(
  (interactable) =>
    interactable.canonicalTarget.targetType === "station" &&
    interactable.canonicalTarget.stationId === "CHAR-DROUET",
);
const journalRequest = interactionRequest(
  (interactable) =>
    interactable.canonicalTarget.targetType === "case_surface" &&
    interactable.canonicalTarget.surfaceId === "journal",
);

interface AdapterHarnessHandle extends WorldInteractionAdapter {
  inspectExternally(itemId: string): ReducerResult;
  resetCase(): void;
}

const AdapterHarness = forwardRef<AdapterHarnessHandle>(
  function AdapterHarness(_props, forwardedRef) {
    const adapter = useWorldInteractionAdapter();
    const { issue, reset, state } = useCaseSession();

    useImperativeHandle(
      forwardedRef,
      () => ({
        ...adapter,
        inspectExternally: (itemId: string) =>
          issue({ type: "inspect_item", itemId }),
        resetCase: reset,
      }),
      [adapter, issue, reset],
    );

    return (
      <>
        <output data-testid="revision">{state.revision}</output>
        <output data-testid="inspected-items">
          {state.inspectedItemIds.join(",")}
        </output>
      </>
    );
  },
);

function CaseStateOutput() {
  const { state } = useCaseSession();

  return <output data-testid="retained-revision">{state.revision}</output>;
}

function investigationState(overrides: Partial<CaseState> = {}): CaseState {
  return {
    ...createInitialCaseState(casePackage),
    phase: "investigation",
    ...overrides,
  };
}

function renderAdapter(initialState: CaseState = investigationState()) {
  const adapterRef = createRef<AdapterHarnessHandle>();
  const view = render(
    <CaseSessionProvider initialState={initialState} persist={false}>
      <AdapterHarness ref={adapterRef} />
    </CaseSessionProvider>,
  );
  if (!adapterRef.current) throw new Error("Interaction adapter did not mount.");

  return { adapterRef, ...view };
}

function prepare(
  adapter: WorldInteractionAdapter,
  request: unknown = evidenceRequest,
): PreparedWorldInteraction {
  const outcome = adapter.prepareWorldInteraction(request);
  if (outcome.status === "rejected") {
    throw new Error(`Expected preparation, received ${outcome.reason}.`);
  }
  return outcome.prepared;
}

describe("prepared world interactions", () => {
  it("authorizes and freezes a canonical record without mutating case state", () => {
    const { adapterRef } = renderAdapter();

    let prepared: PreparedWorldInteraction | undefined;
    act(() => {
      prepared = prepare(adapterRef.current!, evidenceRequest);
    });

    expect(prepared).toEqual({
      preparedId: expect.any(String),
      target: evidenceRequest.canonicalTarget,
      request: evidenceRequest,
    });
    expect(Object.isFrozen(prepared)).toBe(true);
    expect(Object.isFrozen(prepared?.target)).toBe(true);
    expect(Object.isFrozen(prepared?.request)).toBe(true);
    expect(Object.isFrozen(prepared?.request.canonicalTarget)).toBe(true);
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
    expect(screen.getByTestId("inspected-items")).toBeEmptyDOMElement();
  });

  it("rejects unknown, copied, and changed records while preserving the genuine pending record", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);
    const unknown = {
      ...prepared,
      preparedId: "unknown-preparation",
    } as PreparedWorldInteraction;
    const copied = { ...prepared } as PreparedWorldInteraction;
    const changed = {
      ...prepared,
      target: { targetType: "evidence", evidenceId: "E4" },
    } as PreparedWorldInteraction;

    expect(adapterRef.current!.commitPreparedWorldInteraction(unknown)).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(adapterRef.current!.commitPreparedWorldInteraction(copied)).toEqual({
      status: "rejected",
      reason: "prepared_interaction_mismatch",
    });
    expect(adapterRef.current!.commitPreparedWorldInteraction(changed)).toEqual({
      status: "rejected",
      reason: "prepared_interaction_mismatch",
    });

    let committed;
    act(() => {
      committed = adapterRef.current!.commitPreparedWorldInteraction(prepared);
    });
    expect(committed).toMatchObject({ status: "opened", target: prepared.target });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
  });

  it("commits one prepared evidence interaction at most once", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);

    let firstCommit;
    act(() => {
      firstCommit = adapterRef.current!.commitPreparedWorldInteraction(prepared);
    });
    const secondCommit = adapterRef.current!.commitPreparedWorldInteraction(prepared);

    expect(firstCommit).toMatchObject({
      status: "opened",
      reducerResult: { status: "applied" },
    });
    expect(secondCommit).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
    expect(screen.getByTestId("inspected-items")).toHaveTextContent("E3");
  });

  it("issues inspect_item only once across separately prepared records", () => {
    const { adapterRef } = renderAdapter();
    const first = prepare(adapterRef.current!);
    const second = prepare(adapterRef.current!);

    let firstCommit;
    let secondCommit;
    act(() => {
      firstCommit = adapterRef.current!.commitPreparedWorldInteraction(first);
      secondCommit = adapterRef.current!.commitPreparedWorldInteraction(second);
    });

    expect(firstCommit).toMatchObject({
      status: "opened",
      reducerResult: { status: "applied" },
    });
    expect(secondCommit).toEqual({
      status: "opened",
      target: second.target,
      reducerResult: null,
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
  });

  it("uses the case-session state when evidence is inspected externally in the same tick", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);

    let externalResult;
    let commitResult;
    act(() => {
      externalResult = adapterRef.current!.inspectExternally("E3");
      commitResult =
        adapterRef.current!.commitPreparedWorldInteraction(prepared);
    });

    expect(externalResult).toMatchObject({ status: "applied" });
    expect(commitResult).toEqual({
      status: "opened",
      target: prepared.target,
      reducerResult: null,
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
  });

  it("uses the reset case-session state when committing in the same tick", () => {
    const { adapterRef } = renderAdapter(
      investigationState({ inspectedItemIds: ["E3"] }),
    );
    const prepared = prepare(adapterRef.current!);

    let commitResult;
    act(() => {
      adapterRef.current!.resetCase();
      commitResult =
        adapterRef.current!.commitPreparedWorldInteraction(prepared);
    });

    expect(commitResult).toMatchObject({
      status: "rejected",
      reason: "case_reducer_rejected",
      reducerResult: {
        status: "rejected",
        reason: "command-not-allowed-in-phase",
      },
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
    expect(screen.getByTestId("inspected-items")).toBeEmptyDOMElement();
  });

  it("does not issue inspect_item for evidence already inspected in case state", () => {
    const { adapterRef } = renderAdapter(
      investigationState({ inspectedItemIds: ["E3"] }),
    );
    const prepared = prepare(adapterRef.current!);

    const outcome = adapterRef.current!.commitPreparedWorldInteraction(prepared);

    expect(outcome).toEqual({
      status: "opened",
      target: prepared.target,
      reducerResult: null,
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
  });

  it("commits station and journal targets without mutating case state", () => {
    const { adapterRef } = renderAdapter();
    const station = prepare(adapterRef.current!, stationRequest);
    const journal = prepare(adapterRef.current!, journalRequest);

    expect(adapterRef.current!.commitPreparedWorldInteraction(station)).toEqual({
      status: "opened",
      target: station.target,
      reducerResult: null,
    });
    expect(adapterRef.current!.commitPreparedWorldInteraction(journal)).toEqual({
      status: "opened",
      target: journal.target,
      reducerResult: null,
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
  });

  it("cancels only the exact pending record without mutating case state", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);
    const copied = { ...prepared } as PreparedWorldInteraction;

    expect(adapterRef.current!.cancelPreparedWorldInteraction(copied)).toEqual({
      status: "rejected",
      reason: "prepared_interaction_mismatch",
    });
    expect(adapterRef.current!.cancelPreparedWorldInteraction(prepared)).toEqual({
      status: "cancelled",
    });
    expect(adapterRef.current!.commitPreparedWorldInteraction(prepared)).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
  });

  it("rejects malformed commit inputs without consuming the pending record", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);
    const malformed: unknown[] = [null, undefined, "invalid", 42, {}];

    for (const candidate of malformed) {
      expect(
        adapterRef.current!.commitPreparedWorldInteraction(candidate),
      ).toEqual({
        status: "rejected",
        reason: "invalid_prepared_interaction",
      });
    }
    expect(
      adapterRef.current!.commitPreparedWorldInteraction({
        preparedId: prepared.preparedId,
      }),
    ).toEqual({
      status: "rejected",
      reason: "prepared_interaction_mismatch",
    });

    let committed;
    act(() => {
      committed = adapterRef.current!.commitPreparedWorldInteraction(prepared);
    });
    expect(committed).toMatchObject({
      status: "opened",
      target: prepared.target,
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("1");
  });

  it("rejects malformed cancel inputs without consuming the pending record", () => {
    const { adapterRef } = renderAdapter();
    const prepared = prepare(adapterRef.current!);
    const malformed: unknown[] = [null, undefined, "invalid", 42, {}];

    for (const candidate of malformed) {
      expect(
        adapterRef.current!.cancelPreparedWorldInteraction(candidate),
      ).toEqual({
        status: "rejected",
        reason: "invalid_prepared_interaction",
      });
    }
    expect(
      adapterRef.current!.cancelPreparedWorldInteraction({
        preparedId: prepared.preparedId,
      }),
    ).toEqual({
      status: "rejected",
      reason: "prepared_interaction_mismatch",
    });

    expect(adapterRef.current!.cancelPreparedWorldInteraction(prepared)).toEqual({
      status: "cancelled",
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
  });

  it("consumes a prepared record when the reducer rejects and never reports an opened overlay", () => {
    const { adapterRef } = renderAdapter(
      investigationState({ phase: "primer" }),
    );
    const prepared = prepare(adapterRef.current!);

    const firstCommit = adapterRef.current!.commitPreparedWorldInteraction(prepared);
    const secondCommit = adapterRef.current!.commitPreparedWorldInteraction(prepared);

    expect(firstCommit).toMatchObject({
      status: "rejected",
      reason: "case_reducer_rejected",
      reducerResult: {
        status: "rejected",
        reason: "command-not-allowed-in-phase",
      },
    });
    expect(secondCommit).toEqual({
      status: "rejected",
      reason: "stale_or_unknown_prepared_interaction",
    });
    expect(screen.getByTestId("revision")).toHaveTextContent("0");
  });

  it("permanently deactivates retained callbacks when the adapter unmounts", () => {
    const adapterRef = createRef<AdapterHarnessHandle>();
    const initialState = investigationState();
    const renderLifecycle = (mounted: boolean) => (
      <CaseSessionProvider initialState={initialState} persist={false}>
        {mounted ? <AdapterHarness ref={adapterRef} /> : <CaseStateOutput />}
      </CaseSessionProvider>
    );
    const view = render(renderLifecycle(true));
    if (!adapterRef.current) throw new Error("Interaction adapter did not mount.");
    const adapter = adapterRef.current!;
    const prepared = prepare(adapter);
    const {
      cancelPreparedWorldInteraction,
      commitPreparedWorldInteraction,
      prepareWorldInteraction,
    } = adapter;

    view.rerender(renderLifecycle(false));

    expect(prepareWorldInteraction(evidenceRequest)).toEqual({
      status: "rejected",
      reason: "adapter_inactive",
    });
    expect(commitPreparedWorldInteraction(prepared)).toEqual({
      status: "rejected",
      reason: "adapter_inactive",
    });
    expect(cancelPreparedWorldInteraction(prepared)).toEqual({
      status: "rejected",
      reason: "adapter_inactive",
    });

    expect(screen.getByTestId("retained-revision")).toHaveTextContent("0");
  });
});
