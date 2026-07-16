import type { CaseState } from "@/schemas/case-state";

export type CaseResumeRoute =
  | "/play"
  | "/play/caseboard"
  | "/play/repair"
  | "/play/debrief";

const resumeRouteByPhase: Record<CaseState["phase"], CaseResumeRoute> = {
  primer: "/play",
  fracture: "/play",
  investigation: "/play",
  case_brief: "/play/caseboard",
  repair: "/play/repair",
  debrief: "/play/debrief",
};

export function getCaseResumeRoute(state: Pick<CaseState, "phase">): CaseResumeRoute {
  return resumeRouteByPhase[state.phase];
}
