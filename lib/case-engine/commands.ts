import { z } from "zod";

import { repairActionIdSchema, repairStepIdSchema } from "@/schemas/reconstruction";
import { CASE_BRIEF_ARGUMENT_MAX_LENGTH } from "@/schemas/case-state";

const commandBase = {
  commandId: z.string().min(1),
  expectedRevision: z.number().int().nonnegative(),
};

export const caseCommandSchema = z.discriminatedUnion("type", [
  z.object({ ...commandBase, type: z.literal("inspect_item"), itemId: z.string().min(1) }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("record_comparison"),
      comparisonId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("reject_anomaly"),
      anomalyId: z.enum(["E6A", "E6B", "E6C"]),
    })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("select_active_anomaly"),
      anomalyId: z.enum(["E6A", "E6B", "E6C"]),
    })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("pin_evidence"), evidenceId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("unpin_evidence"), evidenceId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("select_condition"), conditionId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("unselect_condition"), conditionId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("place_causal_node"), nodeId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("remove_causal_node"), nodeId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("connect_causal_edge"), edgeId: z.string().min(1) })
    .strict(),
  z
    .object({ ...commandBase, type: z.literal("disconnect_causal_edge"), edgeId: z.string().min(1) })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("update_case_brief"),
      argument: z.string().max(CASE_BRIEF_ARGUMENT_MAX_LENGTH),
      selectedConsequenceId: z.string().min(1).nullable(),
      selectedUncertaintyIds: z.array(z.string().min(1)),
    })
    .strict(),
  z.object({ ...commandBase, type: z.literal("submit_case_brief") }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("complete_repair_action"),
      actionId: repairActionIdSchema,
    })
    .strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("complete_repair_step"),
      stepId: repairStepIdSchema,
    })
    .strict(),
  z.object({ ...commandBase, type: z.literal("complete_repair") }).strict(),
  z
    .object({
      ...commandBase,
      type: z.literal("advance_phase"),
      phase: z.enum(["fracture", "investigation", "case_brief", "repair"]),
    })
    .strict(),
]);

export type CaseCommand = z.infer<typeof caseCommandSchema>;
