export type BoundedJsonFailureReason =
  | "payload_too_large"
  | "invalid_request"
  | "aborted";

export class BoundedJsonError extends Error {
  readonly reason: BoundedJsonFailureReason;

  constructor(reason: BoundedJsonFailureReason) {
    super("The bounded JSON request could not be processed.");
    this.name = "BoundedJsonError";
    this.reason = reason;
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

export async function readBoundedJson(
  request: Request,
  maxBodyBytes: number,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new BoundedJsonError("invalid_request");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new BoundedJsonError("invalid_request");
    if (Number(declaredLength) > maxBodyBytes) {
      throw new BoundedJsonError("payload_too_large");
    }
  }
  if (!request.body) throw new BoundedJsonError("invalid_request");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      if (request.signal.aborted) throw new BoundedJsonError("aborted");
      const { done, value } = await reader.read();
      if (done) break;
      if (byteLength + value.byteLength > maxBodyBytes) {
        void reader.cancel().catch(() => undefined);
        throw new BoundedJsonError("payload_too_large");
      }
      chunks.push(value);
      byteLength += value.byteLength;
    }
  } catch (error) {
    if (error instanceof BoundedJsonError) throw error;
    if (request.signal.aborted || isAbortError(error)) {
      throw new BoundedJsonError("aborted");
    }
    throw new BoundedJsonError("invalid_request");
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    chunk.fill(0);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    throw new BoundedJsonError("invalid_request");
  } finally {
    bytes.fill(0);
  }
}
