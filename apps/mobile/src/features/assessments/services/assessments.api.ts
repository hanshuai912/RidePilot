import { z } from "zod";
import {
  assessmentSchema,
  assessmentReviewSchema,
  assessmentPreviewSchema,
  type AssessmentInput,
  type AssessmentPatch,
  type AssessmentPreviewInput,
  type AssessmentFtpInput,
} from "@ridepilot/contracts";
import { coachRequest } from "../../coach/services/coach.api";

export const assessmentsApi = {
  list: (
    token: string,
    query: { goalId?: string; from?: string; to?: string } = {},
  ) =>
    coachRequest(
      `assessments?${Object.entries(query)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")}`,
      token,
      z.array(assessmentSchema),
    ),
  get: (token: string, id: string) =>
    coachRequest(
      `assessments/${encodeURIComponent(id)}`,
      token,
      assessmentSchema,
    ),
  review: (token: string, id: string) =>
    coachRequest(
      `assessments/${encodeURIComponent(id)}/review`,
      token,
      assessmentReviewSchema,
    ),
  preview: (token: string, input: AssessmentPreviewInput) =>
    coachRequest(
      "assessments/schedule-preview",
      token,
      assessmentPreviewSchema,
      { method: "POST", body: input },
    ),
  create: (token: string, input: AssessmentInput, key: string) =>
    coachRequest("assessments", token, assessmentSchema, {
      method: "POST",
      body: input,
      idempotencyKey: key,
    }),
  patch: (token: string, id: string, input: AssessmentPatch, key: string) =>
    coachRequest(
      `assessments/${encodeURIComponent(id)}`,
      token,
      assessmentSchema,
      { method: "PATCH", body: input, idempotencyKey: key },
    ),
  confirmFtp: (
    token: string,
    id: string,
    input: AssessmentFtpInput,
    key: string,
  ) =>
    coachRequest(
      `assessments/${encodeURIComponent(id)}/ftp-confirmation`,
      token,
      assessmentSchema,
      { method: "POST", body: input, idempotencyKey: key },
    ),
};
