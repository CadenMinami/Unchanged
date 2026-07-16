import { loadVarennesCase } from "@/lib/case-engine/load-case";
import { ModelBackedCourseAlignmentGateway } from "@/lib/course-alignment/model-gateway";
import {
  createCourseAlignmentProfile,
  type CourseAlignmentGateway,
} from "@/lib/course-alignment/profile-service";
import { BoundedJsonError, readBoundedJson } from "@/lib/http/bounded-json";
import { createServerModelGateway } from "@/lib/openai/create-server-gateway";
import {
  aiRequestRateLimiter,
  type RequestRateLimiter,
} from "@/lib/openai/request-rate-limit";
import {
  COURSE_ALIGNMENT_VERSION,
  courseAlignmentRequestSchema,
  courseAlignmentResponseSchema,
} from "@/schemas/course-alignment";

export const MAX_COURSE_ALIGNMENT_BODY_BYTES = 96_000;

interface CourseAlignmentHandlerDependencies {
  gateway?: CourseAlignmentGateway | null;
  rateLimiter?: RequestRateLimiter | null;
}

function json(body: unknown, status = 200, retryAfter = false): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      ...(retryAfter ? { "retry-after": "60" } : {}),
    },
  });
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `course-alignment:${forwarded || "unknown-client"}`;
}

function createDefaultGateway(): CourseAlignmentGateway | null {
  const gateway = createServerModelGateway();
  return gateway ? new ModelBackedCourseAlignmentGateway(gateway) : null;
}

export async function handleCourseAlignmentRequest(
  request: Request,
  dependencies: CourseAlignmentHandlerDependencies = {},
): Promise<Response> {
  const rateLimiter =
    dependencies.rateLimiter === undefined ? aiRequestRateLimiter : dependencies.rateLimiter;
  if (rateLimiter && !rateLimiter.allow(clientKey(request))) {
    return json(
      {
        error: {
          code: "rate_limited",
          message: "Too many alignment requests. Wait a moment and try again.",
        },
      },
      429,
      true,
    );
  }

  let body: unknown;
  try {
    body = await readBoundedJson(request, MAX_COURSE_ALIGNMENT_BODY_BYTES);
  } catch (error) {
    if (error instanceof BoundedJsonError && error.reason === "payload_too_large") {
      return json(
        { error: { code: "payload_too_large", message: "The course packet is too large." } },
        413,
      );
    }
    return json(
      { error: { code: "invalid_request", message: "The alignment request was invalid." } },
      400,
    );
  }

  const parsed = courseAlignmentRequestSchema.safeParse(body);
  if (!parsed.success) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const casePackage = loadVarennesCase();
    const versionMismatch =
      (record.contractVersion !== undefined &&
        record.contractVersion !== COURSE_ALIGNMENT_VERSION) ||
      (record.catalogVersion !== undefined &&
        record.catalogVersion !== COURSE_ALIGNMENT_VERSION) ||
      (record.caseId !== undefined && record.caseId !== casePackage.caseId) ||
      (record.caseVersion !== undefined && record.caseVersion !== casePackage.caseVersion);
    return json(
      {
        error: {
          code: versionMismatch ? "version_mismatch" : "invalid_request",
          message: versionMismatch
            ? "The case or alignment catalog changed before processing."
            : "The alignment request was invalid.",
        },
      },
      versionMismatch ? 409 : 400,
    );
  }

  const casePackage = loadVarennesCase();
  if (
    parsed.data.caseId !== casePackage.caseId ||
    parsed.data.caseVersion !== casePackage.caseVersion
  ) {
    return json(
      {
        error: {
          code: "version_mismatch",
          message: "The case changed before processing.",
        },
      },
      409,
    );
  }

  const source =
    parsed.data.source.kind === "file"
      ? {
          kind: "file" as const,
          title: parsed.data.source.title,
          filename: parsed.data.source.filename,
          mimeType: parsed.data.source.mimeType,
          bytes: new TextEncoder().encode(parsed.data.source.text),
        }
      : parsed.data.source;
  const gateway =
    dependencies.gateway === undefined ? createDefaultGateway() : dependencies.gateway;
  const profile = await createCourseAlignmentProfile(
    {
      source,
      selectedObjectiveIds: parsed.data.selectedObjectiveIds,
    },
    { gateway },
  );

  return json(
    courseAlignmentResponseSchema.parse({
      status: "ok",
      contractVersion: COURSE_ALIGNMENT_VERSION,
      requestId: parsed.data.requestId,
      profile,
    }),
  );
}
