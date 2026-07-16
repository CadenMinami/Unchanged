import { z } from "zod";

import { courseConceptIdSchema } from "@/schemas/course-alignment";

export const authoredHintSchema = z
  .object({
    id: z.string().regex(/^HINT-ROUTE-0[1-4]$/),
    tier: z.number().int().min(1).max(4),
    conceptId: courseConceptIdSchema,
    standardText: z.string().trim().min(1).max(360),
    reducedText: z.string().trim().min(1).max(220),
    alignmentPrefix: z.string().trim().min(1).max(180),
  })
  .strict();

export const authoredHintsSchema = z.array(authoredHintSchema).length(4);

export type AuthoredHint = z.infer<typeof authoredHintSchema>;
