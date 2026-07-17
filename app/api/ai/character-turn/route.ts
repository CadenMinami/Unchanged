import { handleCharacterTurnRequest } from "@/lib/openai/route-handlers";

export const runtime = "nodejs";
export const maxDuration = 40;

export async function POST(request: Request): Promise<Response> {
  return handleCharacterTurnRequest(request);
}
