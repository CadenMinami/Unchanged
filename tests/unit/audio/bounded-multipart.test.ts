import { describe, expect, it, vi } from "vitest";

import {
  BoundedMultipartError,
  MAX_MULTIPART_BODY_BYTES,
  MAX_MULTIPART_OVERHEAD_BYTES,
  parseBoundedMultipartFormData,
} from "@/lib/audio/bounded-multipart";
import { MAX_AUDIO_BYTES } from "@/schemas/media-contracts";

function streamedRequest(
  body: ReadableStream<Uint8Array>,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Request {
  return new Request("http://localhost/api/ai/transcribe", {
    method: "POST",
    headers,
    body,
    signal,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded multipart parsing", () => {
  it("rejects an oversized declared Content-Length before reading the body", async () => {
    expect(MAX_MULTIPART_OVERHEAD_BYTES).toBe(16_384);
    expect(MAX_MULTIPART_BODY_BYTES).toBe(MAX_AUDIO_BYTES + 16_384);
    const pull = vi.fn();
    const body = new ReadableStream<Uint8Array>({ pull }, { highWaterMark: 0 });
    const request = streamedRequest(body, {
      "content-length": String(MAX_MULTIPART_BODY_BYTES + 1),
      "content-type": "multipart/form-data; boundary=bounded",
    });

    await expect(parseBoundedMultipartFormData(request)).rejects.toMatchObject({
      reason: "payload_too_large",
    });
    expect(request.bodyUsed).toBe(false);
    expect(pull).not.toHaveBeenCalled();
  });

  it("cancels an absent-length or chunked body as soon as the streamed cap is crossed", async () => {
    const cancel = vi.fn();
    const first = new Uint8Array(MAX_MULTIPART_BODY_BYTES);
    const overflow = new Uint8Array([1]);
    let readCount = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (readCount === 0) controller.enqueue(first);
        else if (readCount === 1) controller.enqueue(overflow);
        else controller.close();
        readCount += 1;
      },
      cancel,
    });
    const request = streamedRequest(body, {
      "content-type": "multipart/form-data; boundary=bounded",
      "transfer-encoding": "chunked",
    });

    await expect(parseBoundedMultipartFormData(request)).rejects.toMatchObject({
      reason: "payload_too_large",
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(first.every((byte) => byte === 0)).toBe(true);
    expect(overflow.every((byte) => byte === 0)).toBe(true);
  });

  it("classifies malformed multipart without returning parser details", async () => {
    const bytes = new TextEncoder().encode("not multipart data");
    let sent = false;
    const request = streamedRequest(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent) return;
          sent = true;
          controller.enqueue(bytes);
          controller.close();
        },
      }, { highWaterMark: 0 }),
      { "content-type": "multipart/form-data; boundary=bounded" },
    );

    await expect(parseBoundedMultipartFormData(request)).rejects.toEqual(
      new BoundedMultipartError("invalid_request"),
    );
    expect(bytes.every((byte) => byte === 0)).toBe(true);
  });

  it("cancels a pending body read and releases buffered chunks when the request aborts", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const first = new Uint8Array([1, 2, 3, 4]);
    let sent = false;
    const pull = vi.fn((streamController: ReadableStreamDefaultController<Uint8Array>) => {
      if (sent) return;
      sent = true;
      streamController.enqueue(first);
    });
    const request = streamedRequest(
      new ReadableStream<Uint8Array>({
        pull,
        cancel,
      }, { highWaterMark: 0 }),
      { "content-type": "multipart/form-data; boundary=bounded" },
      controller.signal,
    );

    const parsing = parseBoundedMultipartFormData(request);
    await vi.waitFor(() => expect(pull).toHaveBeenCalledTimes(2));
    controller.abort();

    await expect(parsing).rejects.toEqual(new BoundedMultipartError("aborted"));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(first.every((byte) => byte === 0)).toBe(true);
  });

  it("cancels the reader and releases buffered chunks when abort occurs during a read", async () => {
    const controller = new AbortController();
    const first = new Uint8Array([1, 2, 3, 4]);
    let finishPendingRead: () => void = () => undefined;
    const cancel = vi.fn(async () => undefined);
    const read = vi
      .fn()
      .mockResolvedValueOnce({ done: false, value: first })
      .mockImplementationOnce(
        () =>
          new Promise<{ done: true; value: undefined }>((resolve) => {
            finishPendingRead = () => resolve({ done: true, value: undefined });
          }),
      );
    const request = {
      body: {
        getReader: () => ({ cancel, read, releaseLock: vi.fn() }),
      },
      headers: new Headers({ "content-type": "multipart/form-data; boundary=bounded" }),
      method: "POST",
      signal: controller.signal,
      url: "http://localhost/api/ai/transcribe",
    } as unknown as Request;

    const parsing = parseBoundedMultipartFormData(request);
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    controller.abort();
    finishPendingRead();

    await expect(parsing).rejects.toEqual(new BoundedMultipartError("aborted"));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(first.every((byte) => byte === 0)).toBe(true);
  });

  it("cancels the reader and releases buffered chunks when streaming fails", async () => {
    const first = new Uint8Array([1, 2, 3, 4]);
    const cancel = vi.fn(async () => undefined);
    const request = {
      body: {
        getReader: () => ({
          cancel,
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: first })
            .mockRejectedValueOnce(new Error("private stream failure")),
          releaseLock: vi.fn(),
        }),
      },
      headers: new Headers({ "content-type": "multipart/form-data; boundary=bounded" }),
      method: "POST",
      signal: new AbortController().signal,
      url: "http://localhost/api/ai/transcribe",
    } as unknown as Request;

    await expect(parseBoundedMultipartFormData(request)).rejects.toEqual(
      new BoundedMultipartError("invalid_request"),
    );
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(first.every((byte) => byte === 0)).toBe(true);
  });

  it("parses the bounded owned buffer without an extra Uint8Array clone", async () => {
    const boundary = "bounded";
    const encoded = new TextEncoder().encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{"caseId":"varennes"}\r\n--${boundary}--\r\n`,
    );
    let sent = false;
    const request = streamedRequest(
      new ReadableStream<Uint8Array>({
        pull(controller) {
          if (sent) return;
          sent = true;
          controller.enqueue(encoded);
          controller.close();
        },
      }, { highWaterMark: 0 }),
      { "content-type": `multipart/form-data; boundary=${boundary}` },
    );

    const sliceSpy = vi.spyOn(Uint8Array.prototype, "slice");
    try {
      const formData = await parseBoundedMultipartFormData(request);

      expect(formData.get("metadata")).toBe('{"caseId":"varennes"}');
      expect(encoded.every((byte) => byte === 0)).toBe(true);
      expect(sliceSpy).not.toHaveBeenCalled();
    } finally {
      sliceSpy.mockRestore();
    }
  });
});
