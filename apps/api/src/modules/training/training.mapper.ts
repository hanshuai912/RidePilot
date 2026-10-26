import {
  proposalResponseSchema,
  type ProposalResponse,
} from "@ridepilot/contracts";
import type { ChangeProposal } from "../../generated/prisma/client";
import type { DraftPayload } from "./training.types";
import { dbToDate } from "./training.validation";

export function toDraft(workout: {
  id: string;
  title: string | null;
  purpose: string | null;
  scheduledDate: Date;
  dayOrder: number;
  structure: unknown;
}): DraftPayload {
  const structure = workout.structure as {
    segments: DraftPayload["segments"];
  };
  return {
    id: workout.id,
    title: workout.title,
    purpose: workout.purpose,
    scheduledDate: dbToDate(workout.scheduledDate),
    dayOrder: workout.dayOrder,
    segments: structure.segments,
  };
}

export function toSummary(workout: {
  id: string;
  title: string | null;
  purpose: string | null;
  scheduledDate: Date;
  dayOrder: number;
  source: string;
  timeTargetMin: unknown;
  distanceTargetKm: unknown;
  structure: unknown;
  planVersion?: { versionNo: number };
}) {
  const structure = workout.structure as {
    segments: DraftPayload["segments"];
  };
  return {
    id: workout.id,
    planVersion: workout.planVersion?.versionNo ?? 1,
    sportType: "cycling" as const,
    source: workout.source === "ai" ? ("ai" as const) : ("manual" as const),
    title: workout.title,
    purpose: workout.purpose,
    scheduledDate: dbToDate(workout.scheduledDate),
    dayOrder: workout.dayOrder,
    timeTargetMinutes:
      workout.timeTargetMin === null ? null : Number(workout.timeTargetMin),
    distanceTargetKm:
      workout.distanceTargetKm === null
        ? null
        : Number(workout.distanceTargetKm),
    segments: structure.segments,
  };
}

export function toProposalResponse(
  proposal: ChangeProposal,
  original: unknown,
  draft: DraftPayload,
  versionNo: number,
): ProposalResponse {
  const time =
    draft.segments
      .filter((s) => s.target.kind === "duration")
      .reduce((sum, s) => sum + s.target.value * (s.repeatCount ?? 1), 0) ||
    null;
  const distance =
    draft.segments
      .filter((s) => s.target.kind === "distance")
      .reduce((sum, s) => sum + s.target.value * (s.repeatCount ?? 1), 0) ||
    null;
  return proposalResponseSchema.parse({
    proposalId: proposal.id,
    proposalType: proposal.proposalType,
    status: proposal.status,
    basePlanVersion: versionNo,
    proposalVersion: proposal.proposalVersion,
    originalWorkout: original
      ? {
          ...original,
          planVersion: versionNo,
          sportType: "cycling",
          source: "manual",
          timeTargetMinutes: null,
          distanceTargetKm: null,
        }
      : null,
    draftWorkout: {
      id: draft.id,
      planVersion: versionNo || 1,
      sportType: "cycling",
      source: "manual",
      title: draft.title ?? null,
      purpose: draft.purpose ?? null,
      scheduledDate: draft.scheduledDate,
      dayOrder: draft.dayOrder,
      timeTargetMinutes: time,
      distanceTargetKm: distance,
      segments: draft.segments,
    },
    validation: {
      passed: proposal.validationPassed ?? null,
      warnings: (proposal.validationWarnings as string[] | null) ?? [],
      blockers: (proposal.validationBlockers as string[] | null) ?? [],
    },
  });
}
