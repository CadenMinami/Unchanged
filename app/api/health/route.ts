import { NextResponse } from "next/server";

import { loadVarennesCase } from "@/lib/case-engine/load-case";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const buildIdPattern = /^[A-Za-z0-9._-]{7,64}$/;

function resolvePublicBuildId(): string | null {
  const candidate = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
  return candidate && buildIdPattern.test(candidate) ? candidate : null;
}

export async function GET(): Promise<Response> {
  const casePackage = loadVarennesCase();

  return NextResponse.json(
    {
      status: "ok",
      application: "history-unbroken",
      case: {
        id: casePackage.caseId,
        schemaVersion: casePackage.schemaVersion,
        version: casePackage.caseVersion,
      },
      build: { id: resolvePublicBuildId() },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
