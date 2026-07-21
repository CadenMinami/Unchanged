import { describe, expect, it, vi } from "vitest";

import { BoundedJsonError, readBoundedJson } from "@/lib/http/bounded-json";

function streamedJsonRequest(body: ReadableStream<Uint8Array>, signal?: AbortSignal): Request {
  return new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
    signal,
  } as RequestInit & { duplex: "half" });
}

describe("readBoundedJson", () => {
  it("preserves payload_too_large when stream cancellation rejects", async () => {
    const decode = vi.spyOn(TextDecoder.prototype, "decode");
    const cancel = vi.fn().mockRejectedValue(new Error("cancel failed"));
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          controller.enqueue(pulls === 0 ? new TextEncoder().encode("{}") : new Uint8Array([1]));
          pulls += 1;
        },
        cancel,
      },
      { highWaterMark: 0 },
    );

    let thrown: unknown;
    try {
      await readBoundedJson(streamedJsonRequest(body), 2);
    } catch (error) {
      thrown = error;
    }

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(decode).not.toHaveBeenCalled();
    decode.mockRestore();
    expect(thrown).toBeInstanceOf(BoundedJsonError);
    expect(thrown).toMatchObject({ reason: "payload_too_large" });
  });

  it("keeps malformed JSON classified as invalid_request", async () => {
    await expect(
      readBoundedJson(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"incomplete":',
        }),
        1_024,
      ),
    ).rejects.toMatchObject({ reason: "invalid_request" });
  });

  it("keeps an aborted request classified as aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const body = new ReadableStream<Uint8Array>(
      {
        pull(streamController) {
          streamController.enqueue(new TextEncoder().encode("{}"));
        },
      },
      { highWaterMark: 0 },
    );

    await expect(
      readBoundedJson(streamedJsonRequest(body, controller.signal), 1_024),
    ).rejects.toMatchObject({ reason: "aborted" });
  });
});
