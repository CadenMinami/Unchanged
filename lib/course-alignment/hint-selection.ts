import type { CaseState } from "@/schemas/case-state";
import type { AuthoredHint } from "@/schemas/hints";

const routeFindingItems = ["E6B", "FO1", "FO2", "FO3", "E3", "E4", "E5"];

export function selectInvestigationHint(
  state: CaseState,
  hints: AuthoredHint[],
): AuthoredHint | null {
  if (state.completedComparisonIds.includes("CMP-SUPPORT-E6B")) return null;

  let tier = 1;
  if (state.inspectedItemIds.includes("E3")) tier = 2;
  if (
    state.inspectedItemIds.includes("E3") &&
    state.inspectedItemIds.includes("E6B")
  ) {
    tier = 3;
  }
  if (routeFindingItems.every((id) => state.inspectedItemIds.includes(id))) tier = 4;

  return hints.find((hint) => hint.tier === tier) ?? null;
}

export function renderAlignedHint(
  hint: AuthoredHint,
  readingMode: "standard" | "reduced",
  packetTerm?: string,
): string {
  const hintText = readingMode === "reduced" ? hint.reducedText : hint.standardText;
  if (!packetTerm) return hintText;
  return `${hint.alignmentPrefix.replace("{packetTerm}", packetTerm)} ${hintText}`;
}
