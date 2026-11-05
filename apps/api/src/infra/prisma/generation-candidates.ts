import { createHash } from "node:crypto";
import type {
  AiGeneration,
  Prisma,
  ProposalStatus,
} from "../../generated/prisma/client";

export const supersededReason = "已有同一任务的新草稿，本草稿已被替代";

export function generationFingerprint(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item !== "object") return item;
    if (Array.isArray(item)) return item.map(normalize);
    if ("toJSON" in item && typeof item.toJSON === "function")
      return normalize(item.toJSON());
    return Object.fromEntries(
      Object.entries(item)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, normalize(v)]),
    );
  };
  return createHash("sha256")
    .update(JSON.stringify(normalize(value)))
    .digest("hex");
}

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

// A second click reuses only an identical request. Explicit regeneration is
// excluded from identity; it still resumes any already running identical task.
export function generationRequestKey(input: unknown) {
  const { forceRegenerate: _, ...request } = object(input);
  return generationFingerprint(request);
}

export function generationTaskKey(input: unknown) {
  const values = object(input);
  const review = object(values.cycleReview);
  return generationFingerprint({
    ...(values.cycleReview
      ? {
          cycleReview: {
            startDate: review.startDate,
            endDate: review.endDate,
            action: review.action,
          },
        }
      : {}),
    ...Object.fromEntries(
      [
        "mode",
        "goalId",
        "weekStartDate",
        "startDate",
        "endDate",
        "stageId",
        "targetWorkoutId",
        "relatedId",
        "racePhase",
        "raceId",
        "workoutId",
        "trainingProposalId",
      ].map((key) => [key, values[key]]),
    ),
  });
}

export async function reusableGeneration(
  tx: Prisma.TransactionClient,
  userId: string,
  scene: string,
  input: unknown,
  valid: (proposalId: string) => Promise<boolean>,
) {
  const jobs = await tx.aiGeneration.findMany({
    where: { userId, scene, status: { in: ["QUEUED", "RUNNING", "READY"] } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const key = generationRequestKey(input);
  for (const job of jobs) {
    if (generationRequestKey(job.input) !== key) continue;
    if (["QUEUED", "RUNNING"].includes(job.status)) return job;
    if (
      !object(input).forceRegenerate &&
      job.proposalId &&
      (await valid(job.proposalId))
    )
      return job;
  }
  return null;
}

// Call only after a valid candidate has been saved, under the user's row lock,
// in the same transaction. Failed or blocked generations never retire drafts.
// Creation order wins, so a slow older worker cannot retire a newer result.
export async function supersedeGenerationCandidates(
  tx: Prisma.TransactionClient,
  job: AiGeneration,
  proposalId: string,
  kind: "TRAINING" | "NUTRITION" | "STAGE",
  isCurrent: (id: string) => Promise<boolean>,
) {
  const jobs = await tx.aiGeneration.findMany({
    where: {
      userId: job.userId,
      scene: job.scene,
      status: "READY",
      proposalId: { not: null },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const key = generationTaskKey(job.input);
  const matching = jobs.filter((j) => generationTaskKey(j.input) === key);
  const ids = matching.flatMap((j) => (j.proposalId ? [j.proposalId] : []));
  const eligible =
    kind === "STAGE"
      ? await tx.trainingStagePlan.findMany({
          where: { userId: job.userId, id: { in: ids }, status: "DRAFT" },
          select: { id: true, status: true },
        })
      : kind === "NUTRITION"
        ? await tx.nutritionProposal.findMany({
            where: {
              userId: job.userId,
              id: { in: ids },
              status: { in: ["DRAFT", "READY", "BLOCKED"] },
            },
            select: { id: true, status: true },
          })
        : await tx.changeProposal.findMany({
            where: {
              userId: job.userId,
              id: { in: ids },
              status: { in: ["DRAFT", "READY", "BLOCKED"] },
            },
            select: { id: true, status: true },
          });
  const validIds = new Set(
    (
      await Promise.all(
        eligible.map(async (p) =>
          p.status !== "BLOCKED" && (await isCurrent(p.id)) ? p.id : null,
        ),
      )
    ).filter((id): id is string => !!id),
  );
  const candidates = [
    ...matching.filter((j) => j.proposalId && validIds.has(j.proposalId)),
    { ...job, proposalId },
  ].sort(
    (a, b) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const winner = candidates[0];
  const retired = [
    ...new Set(
      [
        ...candidates.slice(1),
        ...matching.filter(
          (j) =>
            eligible.some((p) => p.id === j.proposalId) &&
            (j.createdAt < winner.createdAt ||
              (j.createdAt.getTime() === winner.createdAt.getTime() &&
                j.id < winner.id)),
        ),
      ].flatMap((j) => (j.proposalId ? [j.proposalId] : [])),
    ),
  ];
  if (!retired.length) return;
  const where = { userId: job.userId, id: { in: retired } };
  if (kind === "STAGE") {
    await tx.trainingStagePlan.updateMany({
      where: { ...where, status: "DRAFT" },
      data: { status: "SUPERSEDED", version: { increment: 1 } },
    });
  } else {
    const update = {
      where: {
        ...where,
        status: { in: ["DRAFT", "READY", "BLOCKED"] as ProposalStatus[] },
      },
      data: {
        status: "EXPIRED" as const,
        validationPassed: false,
        validationBlockers: [supersededReason],
        proposalVersion: { increment: 1 },
      },
    };
    if (kind === "NUTRITION") await tx.nutritionProposal.updateMany(update);
    else await tx.changeProposal.updateMany(update);
  }
}
