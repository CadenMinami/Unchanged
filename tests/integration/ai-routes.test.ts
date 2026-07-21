import { describe, expect, it, vi } from "vitest";

import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { createInitialCaseState } from "@/lib/case-engine/state";
import { verifySpeechAuthorization } from "@/lib/audio/speech-ticket";
import {
  handleCaseBriefFeedbackRequest,
  handleCharacterTurnRequest,
  MAX_CASE_BRIEF_FEEDBACK_BODY_BYTES,
  MAX_CHARACTER_TURN_BODY_BYTES,
} from "@/lib/openai/route-handlers";
import { buildAIRequestMetadata } from "@/lib/openai/request-metadata";
import {
  AI_CONTRACT_VERSION,
  CASE_BRIEF_PROMPT_VERSION,
  CHARACTER_PROMPT_VERSION,
} from "@/schemas/ai-contracts";

const SPEECH_SECRET = "0123456789abcdef0123456789abcdef";
const NOW_SECONDS = 1_800_000_000;

function jsonRequest(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function characterTurnBody() {
  const casePackage = loadVarennesCase();
  const state = createInitialCaseState(casePackage);
  return {
    ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
      "00000000-0000-4000-8000-000000000031",
    ),
    stationId: "CHAR-DROUET",
    playerMessage: "What did you observe?",
    inspectedEvidenceIds: [],
    presentedEvidenceIds: [],
    readingMode: "standard",
  };
}

function caseBriefFeedbackBody() {
  const casePackage = loadVarennesCase();
  const state = createInitialCaseState(casePackage);
  return {
    ...buildAIRequestMetadata(casePackage, state, CASE_BRIEF_PROMPT_VERSION, () =>
      "00000000-0000-4000-8000-000000000032",
    ),
    caseState: state,
  };
}

const modelRouteCases = [
  {
    name: "character-turn",
    path: "/api/ai/character-turn",
    maxBodyBytes: MAX_CHARACTER_TURN_BODY_BYTES,
    handler: handleCharacterTurnRequest,
    body: characterTurnBody,
  },
  {
    name: "case-brief-feedback",
    path: "/api/ai/case-brief-feedback",
    maxBodyBytes: MAX_CASE_BRIEF_FEEDBACK_BODY_BYTES,
    handler: handleCaseBriefFeedbackRequest,
    body: caseBriefFeedbackBody,
  },
] as const;

function streamedRequestOverCap(path: string, body: unknown, maxBodyBytes: number): Request {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(body));
  if (jsonBytes.byteLength >= maxBodyBytes) {
    throw new Error("The valid test request must fit below its route cap.");
  }

  const firstChunk = new Uint8Array(maxBodyBytes).fill(0x20);
  firstChunk.set(jsonBytes);
  let pulls = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulls === 0) {
        controller.enqueue(firstChunk);
      } else if (pulls === 1) {
        controller.enqueue(new Uint8Array([0x20]));
      } else {
        controller.close();
      }
      pulls += 1;
    },
    cancel() {
      return Promise.reject(new Error("cancel failed"));
    },
  });

  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("AI route handlers", () => {
  it.each(modelRouteCases)(
    "rate limits $name before consuming JSON or resolving provider dependencies",
    async ({ name, path, handler }) => {
      const pull = vi.fn(() => {
        throw new Error("A rate-limited request must not read its body.");
      });
      const gatewayResolved = vi.fn();
      const inputSafetyResolved = vi.fn();
      const allow = vi.fn(() => false);
      const request = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.8, 10.0.0.1",
        },
        body: new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 }),
        duplex: "half",
      } as RequestInit & { duplex: "half" });
      const dependencies = {
        rateLimiter: { allow },
        get gateway() {
          gatewayResolved();
          return null;
        },
        get inputSafety() {
          inputSafetyResolved();
          return null;
        },
      } as Parameters<typeof handleCharacterTurnRequest>[1];

      const response = await handler(request, dependencies);

      expect(response.status).toBe(429);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("retry-after")).toBe("60");
      expect(await response.json()).toMatchObject({ error: { code: "rate_limited" } });
      expect(allow).toHaveBeenCalledWith(`${name}:203.0.113.8`);
      expect(request.bodyUsed).toBe(false);
      expect(pull).not.toHaveBeenCalled();
      expect(gatewayResolved).not.toHaveBeenCalled();
      expect(inputSafetyResolved).not.toHaveBeenCalled();
    },
  );

  it.each(modelRouteCases)(
    "rejects a declared $name body over its cap before moderation or model invocation",
    async ({ path, maxBodyBytes, handler, body }) => {
      const request = jsonRequest(path, body());
      request.headers.set("content-length", String(maxBodyBytes + 1));
      const check = vi.fn().mockResolvedValue({ flagged: false, categories: [] });
      const generateStructured = vi.fn();

      const response = await handler(request, {
        gateway: { generateStructured },
        inputSafety: { check },
        rateLimiter: { allow: () => true },
      });

      expect(response.status).toBe(413);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ error: { code: "payload_too_large" } });
      expect(check).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
    },
  );

  it.each(modelRouteCases)(
    "rejects a streamed $name body over its cap when cancellation fails",
    async ({ path, maxBodyBytes, handler, body }) => {
      const check = vi.fn().mockResolvedValue({ flagged: false, categories: [] });
      const generateStructured = vi.fn();

      const response = await handler(streamedRequestOverCap(path, body(), maxBodyBytes), {
        gateway: { generateStructured },
        inputSafety: { check },
        rateLimiter: { allow: () => true },
      });

      expect(response.status).toBe(413);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ error: { code: "payload_too_large" } });
      expect(check).not.toHaveBeenCalled();
      expect(generateStructured).not.toHaveBeenCalled();
    },
  );

  it.each(modelRouteCases)("keeps malformed $name JSON on the invalid-request contract", async ({
    path,
    handler,
  }) => {
    const response = await handler(
      new Request(`http://localhost${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"incomplete":',
      }),
      {
        gateway: null,
        inputSafety: null,
        rateLimiter: { allow: () => true },
      },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("validates character input and returns a strict rendered response", async () => {
    const casePackage = loadVarennesCase();
    const state = { ...createInitialCaseState(casePackage), revision: 3 };
    const body = {
      ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
        "00000000-0000-4000-8000-000000000001",
      ),
      stationId: "CHAR-DROUET",
      playerMessage: "What did you observe?",
      inspectedEvidenceIds: [],
      presentedEvidenceIds: [],
      readingMode: "standard",
    };
    const gateway = {
      generateStructured: vi.fn().mockResolvedValue({
        claimUnitIds: ["CLAIM-DROUET-BRANCH-SUSPICION"],
        evidenceReactionUnitId: null,
        followUpQuestionUnitId: "FOLLOWUP-DROUET-CORROBORATE",
        refusalUnitId: null,
      }),
    };

    const response = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", body),
      { gateway, inputSafety: null, speechAuthorizationSecret: null },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      source: "model",
      authority: "formative_only",
      mutatesCaseState: false,
      speechAuthorization: null,
    });
  });

  it("rejects old AI contracts on both current routes before provider invocation", async () => {
    expect(AI_CONTRACT_VERSION).toBe("1.1.0");
    const casePackage = loadVarennesCase();
    const state = createInitialCaseState(casePackage);
    const characterGateway = {
      generateStructured: vi.fn().mockResolvedValue({
        claimUnitIds: ["CLAIM-DROUET-BRANCH-SUSPICION"],
        evidenceReactionUnitId: null,
        followUpQuestionUnitId: null,
        refusalUnitId: null,
      }),
    };
    const feedbackGateway = { generateStructured: vi.fn() };

    const characterResponse = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", {
        ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
          "00000000-0000-4000-8000-000000000011",
        ),
        contractVersion: "1.0.0",
        stationId: "CHAR-DROUET",
        playerMessage: "What did you observe?",
        inspectedEvidenceIds: [],
        presentedEvidenceIds: [],
        readingMode: "standard",
      }),
      { gateway: characterGateway, inputSafety: null },
    );
    const feedbackResponse = await handleCaseBriefFeedbackRequest(
      jsonRequest("/api/ai/case-brief-feedback", {
        ...buildAIRequestMetadata(casePackage, state, CASE_BRIEF_PROMPT_VERSION, () =>
          "00000000-0000-4000-8000-000000000012",
        ),
        contractVersion: "1.0.0",
        caseState: state,
      }),
      { gateway: feedbackGateway, inputSafety: null },
    );

    expect(characterResponse.status).toBe(409);
    expect(feedbackResponse.status).toBe(409);
    expect(await characterResponse.json()).toMatchObject({
      error: { code: "version_mismatch" },
    });
    expect(await feedbackResponse.json()).toMatchObject({
      error: { code: "version_mismatch" },
    });
    expect(characterGateway.generateStructured).not.toHaveBeenCalled();
    expect(feedbackGateway.generateStructured).not.toHaveBeenCalled();
  });

  it("mints speech authorization for an authorized model caption", async () => {
    const casePackage = loadVarennesCase();
    const state = { ...createInitialCaseState(casePackage), revision: 4 };
    const body = {
      ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
        "00000000-0000-4000-8000-000000000021",
      ),
      stationId: "CHAR-DROUET",
      playerMessage: "What did you observe?",
      inspectedEvidenceIds: [],
      presentedEvidenceIds: [],
      readingMode: "standard",
    };
    const response = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", body),
      {
        gateway: {
          generateStructured: vi.fn().mockResolvedValue({
            claimUnitIds: ["CLAIM-DROUET-BRANCH-SUSPICION"],
            evidenceReactionUnitId: null,
            followUpQuestionUnitId: null,
            refusalUnitId: null,
          }),
        },
        inputSafety: null,
        speechAuthorizationSecret: SPEECH_SECRET,
        nowEpochSeconds: () => NOW_SECONDS,
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "ok",
      speechAuthorization: {
        mediaVersion: "1.0.0",
        caseId: "varennes",
        stationId: "CHAR-DROUET",
        requestId: body.requestId,
        stateRevision: 4,
        voiceId: "drouet-source-v1",
        expiresAt: NOW_SECONDS + 120,
      },
    });
    expect(payload.speechAuthorization.signature).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(
      verifySpeechAuthorization(
        {
          caption: payload.turn.spokenResponse,
          authorization: payload.speechAuthorization,
        },
        SPEECH_SECRET,
        NOW_SECONDS,
      ),
    ).toEqual({ ok: true });
  });

  it("mints speech authorization for an authored fallback caption", async () => {
    const casePackage = loadVarennesCase();
    const state = createInitialCaseState(casePackage);
    const body = {
      ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
        "00000000-0000-4000-8000-000000000022",
      ),
      stationId: "CHAR-LOUIS",
      playerMessage: "Why did you leave?",
      inspectedEvidenceIds: [],
      presentedEvidenceIds: [],
      readingMode: "standard",
    };
    const response = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", body),
      {
        gateway: null,
        inputSafety: null,
        speechAuthorizationSecret: SPEECH_SECRET,
        nowEpochSeconds: () => NOW_SECONDS,
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "fallback",
      reason: "missing_api_key",
      speechAuthorization: {
        stationId: "CHAR-LOUIS",
        voiceId: "louis-source-v1",
      },
    });
  });

  it("returns 400 for malformed input and 409 for stale package versions", async () => {
    const malformed = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", { playerMessage: "hello" }),
      { gateway: null, inputSafety: null },
    );

    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toMatchObject({ error: { code: "invalid_request" } });

    const casePackage = loadVarennesCase();
    const state = createInitialCaseState(casePackage);
    const stale = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", {
        ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
          "00000000-0000-4000-8000-000000000001",
        ),
        caseVersion: "0.9.0",
        stationId: "CHAR-DROUET",
        playerMessage: "hello",
        inspectedEvidenceIds: [],
        presentedEvidenceIds: [],
        readingMode: "standard",
      }),
      { gateway: null, inputSafety: null },
    );

    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ error: { code: "version_mismatch" } });
  });

  it("rate limits public model calls before invoking the provider", async () => {
    const casePackage = loadVarennesCase();
    const state = createInitialCaseState(casePackage);
    const body = {
      ...buildAIRequestMetadata(casePackage, state, CHARACTER_PROMPT_VERSION, () =>
        "00000000-0000-4000-8000-000000000003",
      ),
      stationId: "CHAR-DROUET",
      playerMessage: "What did you observe?",
      inspectedEvidenceIds: [],
      presentedEvidenceIds: [],
      readingMode: "standard",
    };
    const generateStructured = vi.fn();

    const response = await handleCharacterTurnRequest(
      jsonRequest("/api/ai/character-turn", body),
      {
        gateway: { generateStructured },
        inputSafety: null,
        rateLimiter: { allow: () => false },
      },
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(generateStructured).not.toHaveBeenCalled();
  });

  it("evaluates only a committed CaseState snapshot and falls back without a key", async () => {
    const casePackage = loadVarennesCase();
    const state = {
      ...createInitialCaseState(casePackage),
      revision: 7,
      phase: "case_brief" as const,
      caseBrief: {
        argument: "The route information mattered, but local action was also necessary.",
        selectedConsequenceId: "CONS-REACTION-CONTINUITY",
        selectedUncertaintyIds: ["UNC-NOT-INEVITABLE"],
        submitted: true,
      },
    };
    const body = {
      ...buildAIRequestMetadata(casePackage, state, CASE_BRIEF_PROMPT_VERSION, () =>
        "00000000-0000-4000-8000-000000000002",
      ),
      caseState: state,
    };

    const response = await handleCaseBriefFeedbackRequest(
      jsonRequest("/api/ai/case-brief-feedback", body),
      { gateway: null, inputSafety: null },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "fallback",
      reason: "missing_api_key",
      mutatesCaseState: false,
    });
  });
});
