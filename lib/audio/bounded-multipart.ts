import { MAX_AUDIO_BYTES } from "@/schemas/media-contracts";

// This allowance covers multipart boundaries, one small metadata field, and one file header.
// It is intentionally too small to conceal another audio-sized field.
export const MAX_MULTIPART_OVERHEAD_BYTES = 16_384;
export const MAX_MULTIPART_BODY_BYTES = MAX_AUDIO_BYTES + MAX_MULTIPART_OVERHEAD_BYTES;

export type BoundedMultipartFailureReason =
  | "payload_too_large"
  | "invalid_request"
  | "aborted";

export class BoundedMultipartError extends Error {
  readonly reason: BoundedMultipartFailureReason;

  constructor(reason: BoundedMultipartFailureReason) {
    super("The multipart media request could not be processed.");
    this.name = "BoundedMultipartError";
    this.reason = reason;
  }
}

function releaseChunks(chunks: Uint8Array[]): void {
  for (const chunk of chunks) chunk.fill(0);
  chunks.length = 0;
}

function validateMultipartHeaders(request: Request): void {
  const contentType = request.headers.get("content-type");
  if (!contentType || !/^multipart\/form-data\s*;.*\bboundary=/i.test(contentType)) {
    throw new BoundedMultipartError("invalid_request");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength === null) return;
  if (!/^\d+$/.test(declaredLength)) {
    throw new BoundedMultipartError("invalid_request");
  }
  if (Number(declaredLength) > MAX_MULTIPART_BODY_BYTES) {
    throw new BoundedMultipartError("payload_too_large");
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    String((error as { name: unknown }).name) === "AbortError"
  );
}

export async function parseBoundedMultipartFormData(request: Request): Promise<FormData> {
  validateMultipartHeaders(request);
  if (!request.body) throw new BoundedMultipartError("invalid_request");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let readerCancellation: Promise<void> | null = null;

  function cancelReader(): Promise<void> {
    readerCancellation ??= (async () => {
      try {
        await reader.cancel();
      } catch {
        // Preserve the classified media failure instead of exposing stream details.
      }
    })();
    return readerCancellation;
  }

  const cancelReaderOnAbort = () => {
    void cancelReader();
  };
  request.signal.addEventListener("abort", cancelReaderOnAbort, { once: true });

  try {
    while (true) {
      if (request.signal.aborted) throw new BoundedMultipartError("aborted");
      const { done, value } = await reader.read();
      if (request.signal.aborted) throw new BoundedMultipartError("aborted");
      if (done) break;
      if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== 1) {
        throw new BoundedMultipartError("invalid_request");
      }
      const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      if (byteLength + chunk.byteLength > MAX_MULTIPART_BODY_BYTES) {
        chunk.fill(0);
        releaseChunks(chunks);
        await cancelReader();
        throw new BoundedMultipartError("payload_too_large");
      }
      chunks.push(chunk);
      byteLength += chunk.byteLength;
    }
  } catch (error) {
    releaseChunks(chunks);
    await cancelReader();
    if (error instanceof BoundedMultipartError) throw error;
    if (request.signal.aborted || isAbortError(error)) {
      throw new BoundedMultipartError("aborted");
    }
    throw new BoundedMultipartError("invalid_request");
  } finally {
    request.signal.removeEventListener("abort", cancelReaderOnAbort);
    reader.releaseLock();
  }

  const reconstructedBytes = new Uint8Array(byteLength);
  try {
    let offset = 0;
    for (const chunk of chunks) {
      reconstructedBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } finally {
    releaseChunks(chunks);
  }

  const headers = new Headers(request.headers);
  headers.delete("content-length");
  headers.delete("transfer-encoding");

  try {
    const boundedRequest = new Request(request.url, {
      method: request.method,
      headers,
      body: reconstructedBytes,
      signal: request.signal,
    });
    return await boundedRequest.formData();
  } catch (error) {
    if (request.signal.aborted || isAbortError(error)) {
      throw new BoundedMultipartError("aborted");
    }
    throw new BoundedMultipartError("invalid_request");
  } finally {
    reconstructedBytes.fill(0);
  }
}
