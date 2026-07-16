import { createHash } from "node:crypto";

import { loadVarennesAlignmentCatalog } from "@/lib/course-alignment/load-catalog";
import {
  COURSE_ALIGNMENT_PROMPT_VERSION,
  COURSE_ALIGNMENT_VERSION,
  courseAlignmentPlanSchema,
  courseAlignmentProfileSchema,
  type AlignmentLimitationId,
  type CourseAlignmentPlan,
  type CourseAlignmentProfile,
  type CourseConceptId,
  type CourseObjectiveId,
  type PacketSegment,
} from "@/schemas/course-alignment";

export const MAX_PACKET_TEXT_CHARACTERS = 40_000;
export const MAX_PACKET_FILE_BYTES = 64_000;
export const SUPPORTED_PACKET_MIME_TYPES = ["text/plain", "text/markdown"] as const;

export type CoursePacketSource =
  | { kind: "sample" }
  | { kind: "text"; title: string; text: string }
  | {
      kind: "file";
      title: string;
      filename: string;
      mimeType: string;
      bytes: Uint8Array;
    };

export interface CreateCourseAlignmentProfileRequest {
  source: CoursePacketSource;
  selectedObjectiveIds: CourseObjectiveId[];
}

export interface CourseAlignmentGatewayRequest {
  segments: PacketSegment[];
  selectedObjectiveIds: CourseObjectiveId[];
}

export interface CourseAlignmentGateway {
  generatePlan(request: CourseAlignmentGatewayRequest): Promise<CourseAlignmentPlan>;
}

interface ProfileServiceDependencies {
  gateway?: CourseAlignmentGateway | null;
}

interface PreparedPacket {
  title: string;
  sourceKind: "pasted_text" | "uploaded_file";
  segments: PacketSegment[];
  digest: string;
  extractionUnavailable: boolean;
}

function digestPacket(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function cleanTitle(title: string): string {
  const cleaned = title.trim().replace(/\s+/g, " ");
  return (cleaned || "Untitled course packet").slice(0, 120);
}

function makeSegment(index: number, text: string, referenceLabel?: string): PacketSegment {
  return {
    id: `SEG-${String(index + 1).padStart(4, "0")}`,
    referenceLabel: referenceLabel ?? `Section ${index + 1}`,
    text,
  };
}

export function segmentPacketText(text: string): PacketSegment[] {
  const normalized = text.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/g)
    .flatMap((paragraph) => {
      const compact = paragraph.replace(/\s+/g, " ").trim();
      if (compact.length <= 800) return compact ? [compact] : [];
      return compact.match(/.{1,800}(?:\s|$)/g)?.map((part) => part.trim()) ?? [];
    })
    .filter(Boolean)
    .slice(0, 64);

  return paragraphs.map((paragraph, index) => makeSegment(index, paragraph));
}

function decodePacketFile(source: Extract<CoursePacketSource, { kind: "file" }>): string | null {
  if (
    !SUPPORTED_PACKET_MIME_TYPES.includes(
      source.mimeType as (typeof SUPPORTED_PACKET_MIME_TYPES)[number],
    ) ||
    source.bytes.byteLength > MAX_PACKET_FILE_BYTES
  ) {
    return null;
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
  } catch {
    return null;
  }
}

function preparePacket(source: Exclude<CoursePacketSource, { kind: "sample" }>): PreparedPacket {
  const sourceText = source.kind === "text" ? source.text : decodePacketFile(source);
  const extractionUnavailable = sourceText === null;
  const boundedText = (sourceText ?? "").slice(0, MAX_PACKET_TEXT_CHARACTERS);
  return {
    title: cleanTitle(source.title),
    sourceKind: source.kind === "text" ? "pasted_text" : "uploaded_file",
    segments: segmentPacketText(boundedText),
    digest: digestPacket(boundedText),
    extractionUnavailable,
  };
}

function exactTerm(segment: PacketSegment, term: string): string | null {
  const index = segment.text.toLocaleLowerCase().indexOf(term.toLocaleLowerCase());
  return index < 0 ? null : segment.text.slice(index, index + term.length);
}

function createDeterministicPlan(segments: PacketSegment[]): CourseAlignmentPlan {
  const catalog = loadVarennesAlignmentCatalog();
  const conceptMappings: CourseAlignmentPlan["conceptMappings"] = [];

  for (const concept of catalog.concepts) {
    let found: CourseAlignmentPlan["conceptMappings"][number] | null = null;
    for (const segment of segments) {
      for (const matchTerm of concept.matchTerms) {
        const packetTerm = exactTerm(segment, matchTerm);
        if (!packetTerm) continue;
        found = {
          conceptId: concept.id,
          segmentId: segment.id,
          packetTerm,
          confidence: packetTerm.toLocaleLowerCase() === matchTerm.toLocaleLowerCase()
            ? "strong"
            : "partial",
        };
        break;
      }
      if (found) break;
    }
    if (found) conceptMappings.push(found);
  }

  const mappedConceptIds = new Set(conceptMappings.map((mapping) => mapping.conceptId));
  const objectiveMappings: CourseAlignmentPlan["objectiveMappings"] = [];
  const firstSegmentId = segments[0]?.id;
  const objectiveConcepts: Record<CourseObjectiveId, CourseConceptId[]> = {
    "OBJ-SOURCE-CORROBORATION": ["CONCEPT-SOURCE-RELIABILITY"],
    "OBJ-CAUSAL-REASONING": [
      "CONCEPT-ROUTE-INFORMATION",
      "CONCEPT-COLLECTIVE-LOCAL-ACTION",
      "CONCEPT-MULTICAUSALITY",
    ],
    "OBJ-UNCERTAINTY-MULTICAUSALITY": [
      "CONCEPT-MULTICAUSALITY",
      "CONCEPT-POLITICAL-TRUST",
    ],
  };
  for (const [objectiveId, conceptIds] of Object.entries(objectiveConcepts) as [
    CourseObjectiveId,
    CourseConceptId[],
  ][]) {
    const mapping = conceptMappings.find((entry) => conceptIds.includes(entry.conceptId));
    const segmentId = mapping?.segmentId ?? firstSegmentId;
    if (segmentId && conceptIds.some((id) => mappedConceptIds.has(id))) {
      objectiveMappings.push({ objectiveId, segmentId });
    }
  }

  const conflictCandidates: CourseAlignmentPlan["conflictCandidates"] = [];
  const injectionCandidates: CourseAlignmentPlan["injectionCandidates"] = [];
  for (const segment of segments) {
    if (/\b(only|sole|single) cause\b|\b(single-handedly|inevitable|guaranteed)\b/i.test(segment.text)) {
      conflictCandidates.push({
        boundaryId: "BOUNDARY-NOT-SOLE-CAUSE",
        segmentId: segment.id,
      });
    }
    if (/\b(ignore (all |the )?(previous|system)|reveal the answer|system prompt)\b/i.test(segment.text)) {
      injectionCandidates.push({ kind: "instruction_like_text", segmentId: segment.id });
    }
    if (/\b(mark|treat|score)\b.{0,30}\b(correct|true|passing)\b/i.test(segment.text)) {
      injectionCandidates.push({ kind: "authority_escalation", segmentId: segment.id });
    }
  }

  const limitationIds: AlignmentLimitationId[] = [
    "LIMITATION-NO-MODEL",
    "LIMITATION-EXCERPTS-ONLY",
  ];
  if (conceptMappings.length < 2) limitationIds.push("LIMITATION-LOW-COVERAGE");
  if (injectionCandidates.length > 0) {
    limitationIds.push("LIMITATION-INSTRUCTION-LIKE-TEXT");
  }
  if (conflictCandidates.length > 0) limitationIds.push("LIMITATION-CONFLICT-REVIEW");

  return courseAlignmentPlanSchema.parse({
    planVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
    objectiveMappings,
    conceptMappings,
    conflictCandidates,
    injectionCandidates,
    readingSupport: "standard",
    limitationIds: [...new Set(limitationIds)],
  });
}

function excerptFor(segment: PacketSegment, packetTerm?: string, maxLength = 480): string {
  if (!packetTerm) return segment.text.slice(0, maxLength).trim();
  const termIndex = segment.text.indexOf(packetTerm);
  if (termIndex < 0) return segment.text.slice(0, maxLength).trim();
  const sentenceStart = Math.max(
    segment.text.lastIndexOf(". ", termIndex) + 2,
    segment.text.lastIndexOf("? ", termIndex) + 2,
  );
  const nextPeriod = segment.text.indexOf(". ", termIndex + packetTerm.length);
  const sentenceEnd = nextPeriod < 0 ? segment.text.length : nextPeriod + 1;
  return segment.text.slice(sentenceStart, sentenceEnd).slice(0, maxLength).trim();
}

export function authorizeAlignmentPlan(
  plan: CourseAlignmentPlan,
  packet: PreparedPacket,
  selectedObjectiveIds: CourseObjectiveId[],
  processor: "deterministic_fallback" | "gpt_5_6",
): CourseAlignmentProfile {
  const segments = new Map(packet.segments.map((segment) => [segment.id, segment]));
  const conceptMappings = plan.conceptMappings.flatMap((mapping) => {
    const segment = segments.get(mapping.segmentId);
    if (!segment || !segment.text.includes(mapping.packetTerm)) return [];
    return [
      {
        ...mapping,
        referenceLabel: segment.referenceLabel,
        excerpt: excerptFor(segment, mapping.packetTerm),
      },
    ];
  });
  const glossaryEntries = conceptMappings.map((mapping) => ({
    conceptId: mapping.conceptId,
    segmentId: mapping.segmentId,
    packetTerm: mapping.packetTerm,
    referenceLabel: mapping.referenceLabel,
  }));
  const potentialConflicts = plan.conflictCandidates.flatMap((candidate) => {
    const segment = segments.get(candidate.segmentId);
    if (!segment) return [];
    return [
      {
        ...candidate,
        referenceLabel: segment.referenceLabel,
        excerpt: excerptFor(segment),
        requiresTeacherAttention: true as const,
      },
    ];
  });
  const injectionFlags = plan.injectionCandidates.flatMap((candidate) => {
    const segment = segments.get(candidate.segmentId);
    if (!segment) return [];
    return [
      {
        ...candidate,
        excerpt: excerptFor(segment, undefined, 240),
        disposition: "ignored_as_data" as const,
      },
    ];
  });
  const limitationIds = [...plan.limitationIds];
  if (packet.extractionUnavailable) limitationIds.push("LIMITATION-FILE-UNEXTRACTED");

  return courseAlignmentProfileSchema.parse({
    profileVersion: COURSE_ALIGNMENT_VERSION,
    catalogVersion: COURSE_ALIGNMENT_VERSION,
    promptVersion: COURSE_ALIGNMENT_PROMPT_VERSION,
    caseId: "varennes",
    packet: {
      title: packet.title,
      sourceKind: packet.sourceKind,
      processor,
      packetDigest: packet.digest,
      rawRetained: false,
    },
    selectedObjectiveIds,
    conceptMappings,
    glossaryEntries,
    potentialConflicts,
    injectionFlags,
    readingSupport: plan.readingSupport,
    limitationIds: [...new Set(limitationIds)],
    authority: "alignment_only",
    mutatesCaseState: false,
    reviewStatus: "pending_teacher_review",
  });
}

export async function createCourseAlignmentProfile(
  request: CreateCourseAlignmentProfileRequest,
  dependencies: ProfileServiceDependencies = {},
): Promise<CourseAlignmentProfile> {
  const catalog = loadVarennesAlignmentCatalog();
  if (request.source.kind === "sample") {
    const packetText = catalog.samplePacket.sections.map((section) => section.text).join("\n\n");
    return courseAlignmentProfileSchema.parse({
      ...catalog.sampleProfile,
      selectedObjectiveIds: request.selectedObjectiveIds,
      packet: {
        ...catalog.sampleProfile.packet,
        packetDigest: digestPacket(packetText),
      },
      reviewStatus: "pending_teacher_review",
    });
  }

  const packet = preparePacket(request.source);
  let plan: CourseAlignmentPlan;
  let processor: "deterministic_fallback" | "gpt_5_6" = "deterministic_fallback";
  if (dependencies.gateway && packet.segments.length > 0) {
    try {
      plan = courseAlignmentPlanSchema.parse(
        await dependencies.gateway.generatePlan({
          segments: packet.segments,
          selectedObjectiveIds: request.selectedObjectiveIds,
        }),
      );
      processor = "gpt_5_6";
    } catch {
      plan = createDeterministicPlan(packet.segments);
    }
  } else {
    plan = createDeterministicPlan(packet.segments);
  }

  return authorizeAlignmentPlan(
    plan,
    packet,
    request.selectedObjectiveIds,
    processor,
  );
}
