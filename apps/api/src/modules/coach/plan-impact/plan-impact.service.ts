import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  planImpactPreviewSchema,
  planImpactDecisionResponseSchema,
  type PlanImpactDecision,
} from "@ridepilot/contracts";
import type {
  Prisma,
  PlanInputDecision,
  Workout,
} from "../../../generated/prisma/client";
import { PrismaService } from "../../../infra/prisma/prisma.service";
import { copiedWorkoutStructure } from "../../training/workout-activity";
import { impactWorkoutKey } from "./plan-impact.policy";
import {
  assertPlanImpact,
  readPlanImpact,
  selectedImpactWorkouts,
  type ImpactDecisionSnapshot,
} from "./plan-impact.repository";

@Injectable()
export class PlanImpactService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const state = await readPlanImpact(tx, userId);
        const jobs = await tx.aiGeneration.findMany({
          where: {
            userId,
            scene: "RANGE_PLAN",
            status: { in: ["QUEUED", "RUNNING", "READY", "FAILED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        return planImpactPreviewSchema.parse({
          ...state.preview,
          generations: jobs
            .flatMap((j) => {
              const input = j.input as {
                planImpact?: { startDate: string; endDate: string };
              };
              return input.planImpact
                ? [
                    {
                      id: j.id,
                      status: j.status,
                      proposalId: j.proposalId,
                      startDate: input.planImpact.startDate,
                      endDate: input.planImpact.endDate,
                    },
                  ]
                : [];
            })
            .slice(0, 10),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }

  private assertKey(key: string) {
    if (!key || key.length > 180)
      throw new BadRequestException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "缺少有效幂等键",
      });
  }

  async decide(userId: string, input: PlanImpactDecision, key: string) {
    this.assertKey(key);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const existing = await tx.planInputDecision.findUnique({
        where: { idempotencyKey: `${userId}:${key}` },
      });
      if (existing) {
        const s = existing.snapshot as unknown as ImpactDecisionSnapshot;
        if (
          existing.action !== input.action ||
          s.reference.fingerprint !== input.fingerprint ||
          s.reference.startDate !== input.startDate ||
          s.reference.endDate !== input.endDate
        )
          throw new ConflictException({
            code: "IDEMPOTENCY_KEY_CONFLICT",
            message: "此请求已用于其他处理决定",
          });
        return this.response(existing);
      }
      const state = await assertPlanImpact(tx, userId, input);
      const selected = selectedImpactWorkouts(state.editable, input);
      const ids = new Set(selected.map((w) => w.id));
      const items = state.preview.items.filter(
        (i) => ids.has(i.workout.id) && i.issues.length,
      );
      if (!items.length)
        throw new BadRequestException({
          code: "NO_AFFECTED_WORKOUTS",
          message: "所选范围没有待处理的未来课程",
        });
      const effective =
        input.action === "KEEP"
          ? items
          : items.filter((i) => i.issues.includes("FTP"));
      if (
        !effective.length ||
        (input.action === "FTP_RECALCULATE" &&
          effective.some((i) => !i.recalculable))
      )
        throw new BadRequestException({
          code: "FTP_RECALCULATION_UNAVAILABLE",
          message:
            "所选课程缺少旧 FTP 依据或当前 FTP，无法直接重算；请选择其他日期、保留安排或重新规划",
        });
      const snapshot: ImpactDecisionSnapshot = {
        reference: {
          fingerprint: input.fingerprint,
          startDate: input.startDate,
          endDate: input.endDate,
        },
        currentInputs: state.inputs,
        keys: selected
          .filter((w) => effective.some((i) => i.workout.id === w.id))
          .map(impactWorkoutKey),
        items: effective,
        basePlanVersion: state.preview.basePlanVersion,
      };
      const decision = await tx.planInputDecision.create({
        data: {
          userId,
          action: input.action,
          status: input.action === "KEEP" ? "APPLIED" : "DRAFT",
          snapshot: snapshot as unknown as Prisma.InputJsonValue,
          idempotencyKey: `${userId}:${key}`,
        },
      });
      return this.response(decision);
    });
  }

  async get(userId: string, id: string) {
    return this.response(await this.find(this.prisma, userId, id));
  }

  async apply(userId: string, id: string, key: string) {
    this.assertKey(key);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
      const decision = await this.find(tx, userId, id);
      if (decision.status === "APPLIED") return this.response(decision);
      if (decision.action !== "FTP_RECALCULATE")
        throw new ConflictException("此处理无需发布计划");
      const used = await tx.planInputDecision.findFirst({
        where: {
          userId,
          id: { not: id },
          result: { path: ["applyKey"], equals: key },
        },
      });
      if (used)
        throw new ConflictException({
          code: "IDEMPOTENCY_KEY_CONFLICT",
          message: "幂等键已用于其他 FTP 重算",
        });
      const snapshot = decision.snapshot as unknown as ImpactDecisionSnapshot;
      const state = await assertPlanImpact(tx, userId, snapshot.reference);
      const base = state.plan?.activeVersion;
      if (!base || !state.inputs.ftp)
        throw new ConflictException("正式计划或 FTP 已变化");
      const targets = new Set(snapshot.items.map((i) => i.workout.id));
      const version = await tx.planVersion.create({
        data: {
          planId: state.plan!.id,
          versionNo: base.versionNo + 1,
          baseVersionId: base.id,
          changeReason: "FTP_RECALCULATE",
          appliedAt: new Date(),
        },
      });
      const planItems = await tx.planItem.findMany({
        where: { planVersionId: base.id },
      });
      for (const item of planItems.filter((i) => !i.workoutId)) {
        const { id: _id, ...fields } = item;
        await tx.planItem.create({
          data: { ...fields, planVersionId: version.id },
        });
      }
      for (const old of base.workouts) {
        let structure = copiedWorkoutStructure(old);
        if (targets.has(old.id)) {
          const original = structure.inputSnapshot as
            Prisma.InputJsonObject | undefined;
          structure = {
            ...structure,
            inputSnapshot: {
              ...original,
              ftp: { ...state.inputs.ftp },
            },
            ftpSnapshotWatts: state.inputs.ftp.valueWatts,
          };
        }
        const created = await this.copy(tx, version.id, old, structure);
        const item = planItems.find((i) => i.workoutId === old.id);
        if (item) {
          await tx.planItem.update({
            where: { workoutId: created.id },
            data: {
              scheduledStart: item.scheduledStart,
              referenceId: item.referenceId,
              status: item.status,
            },
          });
        }
      }
      await tx.trainingPlan.update({
        where: { id: state.plan!.id },
        data: { activeVersionId: version.id },
      });
      const updated = await tx.planInputDecision.update({
        where: { id },
        data: {
          status: "APPLIED",
          result: { newPlanVersion: version.versionNo, applyKey: key },
        },
      });
      return this.response(updated);
    });
  }

  private async copy(
    tx: Prisma.TransactionClient,
    planVersionId: string,
    old: Workout,
    structure: Prisma.InputJsonObject,
  ) {
    const {
      id: _id,
      createdAt: _created,
      updatedAt: _updated,
      ...fields
    } = old;
    const workout = await tx.workout.create({
      data: { ...fields, planVersionId, structure },
    });
    await tx.planItem.create({
      data: {
        planVersionId,
        workoutId: workout.id,
        scheduledDate: workout.scheduledDate,
        dayOrder: workout.dayOrder,
        eventType: "WORKOUT",
      },
    });
    return workout;
  }

  private async find(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    id: string,
  ) {
    const decision = await db.planInputDecision.findFirst({
      where: { id, userId },
    });
    if (!decision)
      throw new NotFoundException({
        code: "PLAN_INPUT_DECISION_NOT_FOUND",
        message: "处理记录不存在",
      });
    return decision;
  }

  private response(decision: PlanInputDecision) {
    const s = decision.snapshot as unknown as ImpactDecisionSnapshot;
    const result = decision.result as { newPlanVersion?: number } | null;
    return planImpactDecisionResponseSchema.parse({
      id: decision.id,
      action: decision.action,
      status: decision.status,
      startDate: s.reference.startDate,
      endDate: s.reference.endDate,
      basePlanVersion: s.basePlanVersion,
      items: s.items,
      newPlanVersion: result?.newPlanVersion ?? null,
    });
  }
}
