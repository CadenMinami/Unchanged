import { handleCourseAlignmentRequest } from "@/lib/course-alignment/route-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleCourseAlignmentRequest(request);
}
