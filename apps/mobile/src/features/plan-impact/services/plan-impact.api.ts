import {
  generationResponseSchema,
  planImpactPreviewSchema,
  planImpactDecisionResponseSchema,
  type PlanImpactDecision,
  type PlanImpactReference,
} from "@ridepilot/contracts";
import { coachRequest } from "../../coach/services/coach.api";

const root = "plans/input-impact";
export const planImpactApi = {
  preview: (token: string) =>
    coachRequest(root, token, planImpactPreviewSchema),
  decide: (token: string, input: PlanImpactDecision, key: string) =>
    coachRequest(`${root}/decisions`, token, planImpactDecisionResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  decision: (token: string, id: string) =>
    coachRequest(
      `${root}/decisions/${encodeURIComponent(id)}`,
      token,
      planImpactDecisionResponseSchema,
    ),
  apply: (token: string, id: string) =>
    coachRequest(
      `${root}/decisions/${encodeURIComponent(id)}/apply`,
      token,
      planImpactDecisionResponseSchema,
      { method: "POST", idempotencyKey: `apply-ftp-${id}` },
    ),
  generate: (token: string, input: PlanImpactReference, key: string) =>
    coachRequest(`${root}/generate-proposal`, token, generationResponseSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
};
