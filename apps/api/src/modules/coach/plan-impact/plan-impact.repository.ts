import { ConflictException } from "@nestjs/common";
import type {
  PlanImpactPreview,
  PlanImpactReference,
} from "@ridepilot/contracts";
import { Prisma, type Workout } from "../../../generated/prisma/client";
import type { PrismaService } from "../../../infra/prisma/prisma.service";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import {
  trainingInputSnapshot,
  type TrainingInputSnapshot,
} from "../../training/training-input-snapshot";
import { workoutActivities } from "../../training/workout-activity";
import { toSummary } from "../../training/training.mapper";
import { dbToDate } from "../../training/training.validation";
import {
  changedInputs,
  impactWorkoutKey,
  powerComparison,
  stageImpactMessage,
} from "./plan-impact.policy";

export type ImpactDb = Prisma.TransactionClient | PrismaService;
export interface ImpactDecisionSnapshot {
  reference: PlanImpactReference;
  currentInputs: TrainingInputSnapshot;
  keys: string[];
  items: PlanImpactPreview["items"];
  basePlanVersion: number;
}

export async function readPlanImpact(db: ImpactDb, userId: string) {
  const [
    inputs,
    user,
    plan,
    availability,
    goals,
    stages,
    assessments,
    races,
    decisions,
    activities,
  ] = await Promise.all([
    trainingInputSnapshot(db, userId),
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { timezone: true, profileVersion: true },
    }),
    db.trainingPlan.findFirst({
      where: { userId, status: "ACTIVE" },
      include: {
        activeVersion: {
          include: {
            planItems: { orderBy: { id: "asc" } },
            workouts: {
              orderBy: [{ scheduledDate: "asc" }, { dayOrder: "asc" }],
            },
          },
        },
      },
    }),
    db.trainingAvailability.findUnique({ where: { userId } }),
    db.trainingGoal.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    }),
    db.trainingStagePlan.findMany({
      where: { userId, status: "ACTIVE" },
      orderBy: { id: "asc" },
      include: { goal: true, stages: { orderBy: { id: "asc" } } },
    }),
    db.trainingAssessment.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: { id: true, version: true, localDate: true, status: true },
    }),
    db.trainingRace.findMany({
      where: { userId },
      orderBy: { id: "asc" },
      select: { id: true, version: true, localDate: true, status: true },
    }),
    db.planInputDecision.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    db.trainingActivity.findMany({ where: { userId }, orderBy: { id: "asc" } }),
  ]);
  const localDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: user.timezone,
  }).format(new Date());
  const workouts = plan?.activeVersion?.workouts ?? [];
  const recorded = await workoutActivities(db, userId, workouts);
  const editable = workouts.filter(
    (w) => dbToDate(w.scheduledDate) >= localDate && !recorded.has(w.id),
  );
  const keep = decisions.filter(
    (d) => d.action === "KEEP" && d.status === "APPLIED",
  );
  const slots = (availability?.weekdays ?? []) as {
    weekday: number;
    availableMinutes: number;
  }[];
  const totals = new Map<string, number>();
  for (const w of workouts) {
    const date = dbToDate(w.scheduledDate);
    totals.set(date, (totals.get(date) ?? 0) + Number(w.timeTargetMin ?? 0));
  }
  const items = editable.map((w) => {
    const structure = w.structure as unknown as {
      segments: Parameters<typeof powerComparison>[0];
      inputSnapshot?: TrainingInputSnapshot;
      ftpSnapshotWatts?: number;
    };
    const original = structure.inputSnapshot ?? null;
    const acknowledged = keep.flatMap((d) => {
      const s = d.snapshot as unknown as ImpactDecisionSnapshot;
      return s.keys.includes(impactWorkoutKey(w)) ? [s.currentInputs] : [];
    });
    const issues = changedInputs(original, inputs, acknowledged);
    const oldFtpWatts =
      original?.ftp?.valueWatts ?? structure.ftpSnapshotWatts ?? null;
    const messages: string[] = [];
    if (issues.includes("FTP"))
      messages.push(
        oldFtpWatts
          ? `课程按 ${oldFtpWatts} W FTP 快照执行，当前 FTP ${inputs.ftp?.valueWatts ?? "未设置"} W`
          : "旧课程缺少 FTP 快照，不能直接重算；可保留或重新规划",
      );
    if (issues.includes("GOAL"))
      messages.push(
        original
          ? "目标或目标状态已变化，请复核课程目的及阶段安排"
          : "旧课程缺少目标依据，请复核是否继续保留",
      );
    if (issues.includes("AVAILABILITY")) {
      messages.push(
        original
          ? "可训练时间已变化，请复核日期与时长"
          : "旧课程缺少时间依据，请复核日期与时长",
      );
      const slot = slots.find((s) => s.weekday === w.scheduledDate.getUTCDay());
      if (!slot || slot.availableMinutes === 0)
        messages.push("当前日期不可训练");
      else if (
        (totals.get(dbToDate(w.scheduledDate)) ?? 0) > slot.availableMinutes
      )
        messages.push(
          `当天训练总时长超过 ${slot.availableMinutes} 分钟可用时间`,
        );
      if (
        availability &&
        Number(w.timeTargetMin ?? 0) > availability.maxSessionMinutes
      )
        messages.push(
          `单次时长超过 ${availability.maxSessionMinutes} 分钟上限`,
        );
      if (structure.segments.some((s) => s.target.kind === "distance"))
        messages.push("距离课程无法确定时长，请核对时间或重新规划");
    }
    return {
      workout: {
        ...toSummary({
          ...w,
          planVersion: { versionNo: plan!.activeVersion!.versionNo },
        }),
        ftpSnapshotWatts: oldFtpWatts,
      },
      issues,
      messages,
      oldFtpWatts,
      recalculable: !!oldFtpWatts && !!inputs.ftp && issues.includes("FTP"),
      power: powerComparison(
        structure.segments,
        oldFtpWatts,
        inputs.ftp?.valueWatts ?? null,
      ),
    };
  });
  const stageMessages = stages.flatMap((s) => {
    const message = stageImpactMessage(s, inputs, user.profileVersion);
    return message ? [message] : [];
  });
  const fingerprint = generationFingerprint({
    inputs,
    user,
    localDate,
    version: plan?.activeVersionId,
    planItems: plan?.activeVersion?.planItems,
    workouts,
    activities,
    stages,
    assessments,
    races,
    keep: keep.map((d) => d.id),
  });
  const goal = goals.find((g) => g.priority === "PRIMARY") ?? goals[0];
  const preview: Omit<PlanImpactPreview, "generations"> = {
    fingerprint,
    localDate,
    basePlanVersion: plan?.activeVersion?.versionNo ?? 0,
    currentFtpWatts: inputs.ftp?.valueWatts ?? null,
    goalId: goal?.id ?? null,
    goalDescription: goal?.description ?? null,
    goalTargetDate: goal ? dbToDate(goal.targetDate) : null,
    items,
    stageMessages,
    protectedCount: workouts.length - editable.length,
    pendingCount: items.filter((i) => i.issues.length).length,
    decisions: decisions.slice(0, 20).map((d) => {
      const snapshot = d.snapshot as unknown as ImpactDecisionSnapshot;
      return {
        id: d.id,
        action: d.action as "KEEP" | "FTP_RECALCULATE",
        status: d.status as "DRAFT" | "APPLIED",
        startDate: snapshot.reference.startDate,
        endDate: snapshot.reference.endDate,
        createdAt: d.createdAt.toISOString(),
      };
    }),
  };
  return { preview, inputs, plan, editable };
}

export async function assertPlanImpact(
  db: ImpactDb,
  userId: string,
  reference: PlanImpactReference,
) {
  const state = await readPlanImpact(db, userId);
  if (state.preview.fingerprint !== reference.fingerprint)
    throw new ConflictException({
      code: "PLAN_INPUTS_STALE",
      message: "训练资料、反馈或处理决定已变化，请重新查看影响并生成草稿",
    });
  if (
    reference.startDate < state.preview.localDate ||
    reference.endDate < reference.startDate ||
    Date.parse(reference.endDate) - Date.parse(reference.startDate) >
      83 * 86400000
  )
    throw new ConflictException({
      code: "INVALID_IMPACT_RANGE",
      message: "请选择今天或未来的日期范围，每次最多 84 天",
    });
  return state;
}

export function selectedImpactWorkouts(
  workouts: Workout[],
  reference: PlanImpactReference,
) {
  return workouts.filter(
    (w) =>
      dbToDate(w.scheduledDate) >= reference.startDate &&
      dbToDate(w.scheduledDate) <= reference.endDate,
  );
}
