import {
  goalOverviewSchema,
  goalCreationPreviewSchema,
  goalChangePreviewSchema,
  goalChangeResultSchema,
  stageReviewStateSchema,
  stageReviewEvidenceSchema,
  type GoalInput,
  type GoalChange,
  type StageReviewInput,
} from "@ridepilot/contracts";
import { coachRequest } from "../../coach/services/coach.api";

export const goalLifecycleApi = {
  overview: (token: string, id: string) =>
    coachRequest(
      `goals/${encodeURIComponent(id)}/overview`,
      token,
      goalOverviewSchema,
    ),
  evaluate: (token: string, input: GoalInput) =>
    coachRequest("goals/evaluate", token, goalCreationPreviewSchema, {
      method: "POST",
      body: input,
    }),
  preview: (token: string, id: string, change: GoalChange) =>
    coachRequest(
      `goals/${encodeURIComponent(id)}/change-preview`,
      token,
      goalChangePreviewSchema,
      { method: "POST", body: change },
    ),
  apply: (
    token: string,
    id: string,
    change: GoalChange,
    fingerprint: string,
    key: string,
  ) =>
    coachRequest(
      `goals/${encodeURIComponent(id)}/changes`,
      token,
      goalChangeResultSchema,
      { method: "POST", body: { change, fingerprint }, idempotencyKey: key },
    ),
  review: (token: string, id: string) =>
    coachRequest(
      `stages/${encodeURIComponent(id)}/review`,
      token,
      stageReviewStateSchema,
    ),
  criteria: (
    token: string,
    id: string,
    criteria: string,
    expectedVersion: number,
  ) =>
    coachRequest(
      `stages/${encodeURIComponent(id)}/criteria`,
      token,
      stageReviewStateSchema,
      { method: "PUT", body: { criteria, expectedVersion } },
    ),
  saveReview: (
    token: string,
    id: string,
    input: StageReviewInput,
    key: string,
  ) =>
    coachRequest(
      `stages/${encodeURIComponent(id)}/reviews`,
      token,
      stageReviewEvidenceSchema,
      { method: "POST", body: input, idempotencyKey: key },
    ),
};
