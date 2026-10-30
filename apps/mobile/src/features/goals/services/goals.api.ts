import {
  activeStagePlanResponseSchema,
  generationResponseSchema,
  stagePlanResponseSchema,
  type RangeGeneration,
  type StagePlanGeneration,
} from "@ridepilot/contracts";
import { coachRequest } from "../../coach/services/coach.api";

export const goalsApi = {
  activeStages: async (token: string, goalId: string) =>
    (
      await coachRequest(
        `goals/${encodeURIComponent(goalId)}/stage-plan`,
        token,
        activeStagePlanResponseSchema,
      )
    ).plan,
  stagePlan: (token: string, id: string) =>
    coachRequest(
      `stage-plans/${encodeURIComponent(id)}`,
      token,
      stagePlanResponseSchema,
    ),
  generateStages: (token: string, input: StagePlanGeneration, key: string) =>
    coachRequest(
      "stage-plans/generate-proposal",
      token,
      generationResponseSchema,
      { method: "POST", body: input, idempotencyKey: key },
    ),
  activateStages: (token: string, id: string, expectedVersion: number) =>
    coachRequest(
      `stage-plans/${encodeURIComponent(id)}/activate`,
      token,
      stagePlanResponseSchema,
      { method: "POST", body: { expectedVersion } },
    ),
  generateCourses: (token: string, input: RangeGeneration, key: string) =>
    coachRequest(
      "plans/generate-range-proposal",
      token,
      generationResponseSchema,
      { method: "POST", body: input, idempotencyKey: key },
    ),
};
