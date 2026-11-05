import { cycleReviewStaleReason } from "./cycle-review/cycle-review.evidence";
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  coachSuggestionsSchema,
  type CoachSuggestion,
  type DismissCoachSuggestion,
} from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";
import { supersededReason } from "../../infra/prisma/generation-candidates";
import { PrismaService } from "../../infra/prisma/prisma.service";

import {
  CoachSuggestionsRepository,
  pendingCoachStatuses as pendingStatuses,
  coachTrainingTypes as trainingTypes,
} from "./coach-suggestions.repository";
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

@Injectable()
export class CoachSuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: CoachSuggestionsRepository,
  ) {}

  async list(userId: string) {
    const {
      plan,
      nutrition,
      user,
      availability,
      ftp,
      goals,
      training,
      food,
      stages,
      jobs,
      races,
      assessments,
      nutritionProfile,
      cycleReviewStale,
    } = await this.repository.read(userId);
    const now = new Date();
    const superseded = (value: unknown) =>
      Array.isArray(value) && value.includes(supersededReason);
    const contextReason = (draft: Record<string, unknown>) => {
      if (
        draft.profileVersion !== undefined &&
        draft.profileVersion !== user.profileVersion
      )
        return "基本资料已变化，请重新生成";
      if (
        draft.availabilityVersion !== undefined &&
        draft.availabilityVersion !== availability?.version
      )
        return "可训练时间已变化，请重新生成";
      if (
        draft.ftpMeasurementId !== undefined &&
        draft.ftpMeasurementId !== ftp?.id
      )
        return "FTP 已变化，请重新生成";
      if (
        draft.goalId &&
        !goals.some(
          (g) => g.id === draft.goalId && g.version === draft.goalVersion,
        )
      )
        return "目标已变化，请重新生成";
      if (draft.relatedId && draft.relatedVersion !== undefined) {
        const related = draft.scene === "RACE_REPLAN" ? races : assessments;
        if (
          !related.some(
            (event) =>
              event.id === draft.relatedId &&
              event.version === draft.relatedVersion,
          )
        )
          return "关联赛事或测试结果已变化，请重新生成";
      }
      return null;
    };
    const items: CoachSuggestion[] = training.map((p) => {
      const draft = object(p.draft);
      return {
        id: p.id,
        kind: "TRAINING",
        title: draft.cycleReview
          ? "周期复盘训练建议"
          : p.proposalType === "AI_RACE_REPLAN"
            ? "赛事训练建议"
            : p.proposalType === "AI_ASSESSMENT_REVIEW"
              ? "测试复评建议"
              : "训练调整建议",
        summary:
          typeof draft.summary === "string"
            ? draft.summary
            : "查看课程及变化范围",
        status: p.status,
        version: p.proposalVersion,
        createdAt: p.createdAt.toISOString(),
        goalId: null,
        staleReason: superseded(p.validationBlockers)
          ? supersededReason
          : p.status === "EXPIRED" || (p.expiresAt && p.expiresAt <= now)
            ? "草稿已过期，请重新生成"
            : (p.baseVersionId ?? null) !== (plan?.activeVersionId ?? null)
              ? "正式训练版本已变化，请重新生成"
              : cycleReviewStale?.[p.id]
                ? cycleReviewStaleReason
                : contextReason(draft),
      };
    });
    items.push(
      ...food.map((p): CoachSuggestion => {
        const metadata = object(p.metadata);
        const context = object(metadata.trainingContext);
        const generated = object(metadata.generationContext);
        return {
          id: p.id,
          kind: "NUTRITION",
          title: "饮食与赛事补给建议",
          summary:
            typeof metadata.summary === "string"
              ? metadata.summary
              : "查看餐食、训练及补给安排",
          status: p.status,
          version: p.proposalVersion,
          createdAt: p.createdAt.toISOString(),
          goalId: null,
          staleReason: superseded(p.validationBlockers)
            ? supersededReason
            : p.status === "EXPIRED" || (p.expiresAt && p.expiresAt <= now)
              ? "草稿已过期，请重新生成"
              : (p.baseVersionId ?? null) !==
                  (nutrition?.activeVersionId ?? null)
                ? "正式饮食版本已变化，请重新生成"
                : context.planVersionId !== undefined &&
                    context.planVersionId !== (plan?.activeVersionId ?? null)
                  ? "关联训练版本已变化，请重新生成"
                  : generated.profileVersion !== undefined &&
                      generated.profileVersion !== user.profileVersion
                    ? "基本资料已变化，请重新生成"
                    : generated.nutritionProfileVersion !== undefined &&
                        generated.nutritionProfileVersion !==
                          nutritionProfile?.version
                      ? "饮食档案已变化，请重新生成"
                      : generated.trainingPlanVersionId !== undefined &&
                          generated.trainingPlanVersionId !==
                            (plan?.activeVersionId ?? null)
                        ? "关联训练版本已变化，请重新生成"
                        : generated.raceId &&
                            !races.some(
                              (race) =>
                                race.id === generated.raceId &&
                                race.version === generated.raceVersion,
                            )
                          ? "关联赛事已变化，请重新生成"
                          : null,
        };
      }),
    );
    items.push(
      ...stages.map((p): CoachSuggestion => ({
        id: p.id,
        kind: "STAGE",
        title: "目标阶段安排",
        summary: p.summary,
        status: p.status,
        version: p.version,
        createdAt: p.createdAt.toISOString(),
        goalId: p.goalId,
        staleReason:
          contextReason({
            goalId: p.goalId,
            goalVersion: p.goalVersion,
            profileVersion: p.profileVersion,
            availabilityVersion: p.availabilityVersion,
            ftpMeasurementId: p.ftpMeasurementId,
          }) ??
          (p.status === "DRAFT" &&
          (stages.find((s) => s.goalId === p.goalId && s.status === "ACTIVE")
            ?.id ?? null) !== p.baseStagePlanId
            ? "正式阶段安排已变化，请重新生成"
            : null),
      })),
    );
    items.push(
      ...jobs.map((j): CoachSuggestion => ({
        id: j.id,
        kind: "GENERATION",
        title:
          j.scene === "STAGE_PLAN"
            ? "阶段安排生成任务"
            : j.scene.startsWith("NUTRITION")
              ? "补给生成任务"
              : "训练建议生成任务",
        summary:
          j.status === "FAILED"
            ? j.errorCode?.toUpperCase() === "INSUFFICIENT_RECOVERY"
              ? "草稿包含连续高强度训练，恢复不足。请返回原入口重新生成，正式计划没有变化"
              : "生成未完成，请返回原入口检查资料和范围后重试；正式计划没有变化"
            : "正在生成，可稍后返回查看；不会自动应用",
        status: j.status,
        version: j.attempts + 1,
        createdAt: j.createdAt.toISOString(),
        staleReason: null,
        goalId: null,
      })),
    );
    const isPending = (i: CoachSuggestion) =>
      [...pendingStatuses, "QUEUED", "RUNNING"].includes(i.status);
    const invalid: CoachSuggestion[] = [];
    const terminal: CoachSuggestion[] = [];
    const pending: CoachSuggestion[] = [];
    for (const item of items) {
      if (isPending(item) && item.staleReason) {
        invalid.push({
          ...item,
          status:
            item.staleReason === supersededReason ? "SUPERSEDED" : "EXPIRED",
        });
      } else if (isPending(item)) pending.push(item);
      else
        terminal.push({
          ...item,
          status:
            item.status === "EXPIRED" && item.staleReason === supersededReason
              ? "SUPERSEDED"
              : item.status,
          staleReason:
            item.status === "SUPERSEDED"
              ? supersededReason
              : item.status === "EXPIRED"
                ? item.staleReason
                : null,
        });
    }
    const newest = (a: CoachSuggestion, b: CoachSuggestion) =>
      b.createdAt.localeCompare(a.createdAt);
    return coachSuggestionsSchema.parse({
      pending: pending.sort(newest),
      // Include every currently invalid draft, even if newer completed records
      // would otherwise push it out of the recent ten. Reads remain read-only.
      recent: [...invalid, ...terminal.sort(newest).slice(0, 10)].sort(newest),
    });
  }

  async dismiss(userId: string, id: string, input: DismissCoachSuggestion) {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const row =
        input.kind === "TRAINING"
          ? await tx.changeProposal.findFirst({
              where: { id, userId, proposalType: { in: [...trainingTypes] } },
            })
          : input.kind === "NUTRITION"
            ? await tx.nutritionProposal.findFirst({ where: { id, userId } })
            : await tx.trainingStagePlan.findFirst({ where: { id, userId } });
      if (!row)
        throw new NotFoundException({
          code: "SUGGESTION_NOT_FOUND",
          message: "建议不存在",
        });
      const version =
        "proposalVersion" in row ? row.proposalVersion : row.version;
      const dismissedStatus = input.kind === "STAGE" ? "ARCHIVED" : "REJECTED";
      if (
        row.status === dismissedStatus &&
        version === input.expectedVersion + 1
      )
        return;
      const allowed: readonly string[] =
        input.kind === "STAGE" ? ["DRAFT"] : pendingStatuses;
      if (!allowed.includes(row.status) || version !== input.expectedVersion)
        throw new ConflictException({
          code: "SUGGESTION_VERSION_CONFLICT",
          message: "建议已变化，请刷新后再操作",
        });
      const result =
        input.kind === "TRAINING"
          ? await tx.changeProposal.updateMany({
              where: {
                id,
                userId,
                proposalVersion: version,
                status: { in: [...pendingStatuses] },
              },
              data: { status: "REJECTED", proposalVersion: { increment: 1 } },
            })
          : input.kind === "NUTRITION"
            ? await tx.nutritionProposal.updateMany({
                where: {
                  id,
                  userId,
                  proposalVersion: version,
                  status: { in: [...pendingStatuses] },
                },
                data: { status: "REJECTED", proposalVersion: { increment: 1 } },
              })
            : await tx.trainingStagePlan.updateMany({
                where: { id, userId, version, status: "DRAFT" },
                data: { status: "ARCHIVED", version: { increment: 1 } },
              });
      if (!result.count)
        throw new ConflictException({
          code: "SUGGESTION_VERSION_CONFLICT",
          message: "建议已变化，请刷新后再操作",
        });
    });
    return { dismissed: true as const };
  }
}
