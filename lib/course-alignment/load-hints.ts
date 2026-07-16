import hintsJson from "@/data/cases/varennes/hints.json";
import { authoredHintsSchema, type AuthoredHint } from "@/schemas/hints";

let cachedHints: AuthoredHint[] | null = null;

export function loadVarennesHints(): AuthoredHint[] {
  if (!cachedHints) cachedHints = authoredHintsSchema.parse(hintsJson);
  return cachedHints;
}
