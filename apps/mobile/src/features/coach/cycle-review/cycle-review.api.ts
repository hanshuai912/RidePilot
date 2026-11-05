import {
  cycleReviewSnapshotSchema,
  cycleReviewHistorySchema,
  generationResponseSchema,
  type CycleReviewGeneration,
} from "@ridepilot/contracts";
import { coachRequest } from "../services/coach.api";

export const cycleReviewApi = {
  get: (token: string, range?: { startDate: string; endDate: string }) =>
    coachRequest(
      `ai-coach/cycle-review${range ? `?startDate=${encodeURIComponent(range.startDate)}&endDate=${encodeURIComponent(range.endDate)}` : ""}`,
      token,
      cycleReviewSnapshotSchema,
    ),
  history: (token: string) =>
    coachRequest(
      "ai-coach/cycle-review/history",
      token,
      cycleReviewHistorySchema,
    ),
  generate: (
    token: string,
    body: CycleReviewGeneration,
    idempotencyKey: string,
  ) =>
    coachRequest(
      "ai-coach/cycle-review/generate-proposal",
      token,
      generationResponseSchema,
      { method: "POST", body, idempotencyKey },
    ),
};
