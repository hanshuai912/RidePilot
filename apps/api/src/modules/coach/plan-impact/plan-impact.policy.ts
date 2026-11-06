import type { PlanImpactItem, WorkoutSegment } from "@ridepilot/contracts";
import { generationFingerprint } from "../../../infra/prisma/generation-candidates";
import { activityWorkoutId } from "../../training/workout-activity";
import type { TrainingInputSnapshot } from "../../training/training-input-snapshot";
import type {
  TrainingGoal,
  TrainingStagePlan,
} from "../../../generated/prisma/client";

const goalTypeLabels: Record<string, string> = {
  FTP: "提升 FTP",
  ENDURANCE: "提升耐力",
  CLIMBING: "提升爬坡",
  RACE: "准备比赛",
  CUSTOM: "自定义目标",
};

export function stageImpactMessage(
  stage: Pick<
    TrainingStagePlan,
    | "goalVersion"
    | "ftpMeasurementId"
    | "availabilityVersion"
    | "profileVersion"
  > & {
    goal: Pick<TrainingGoal, "description" | "type" | "status" | "version">;
  },
  inputs: TrainingInputSnapshot,
  profileVersion: number,
): string | null {
  const changes: string[] = [];
  if (stage.goal.status !== "ACTIVE") changes.push("目标状态");
  else if (stage.goalVersion !== stage.goal.version) changes.push("训练目标");
  if (stage.ftpMeasurementId !== inputs.ftp?.id) changes.push("FTP");
  if (stage.availabilityVersion !== inputs.availability?.version)
    changes.push("可训练时间");
  if (stage.profileVersion !== profileVersion) changes.push("运动资料");
  if (!changes.length) return null;
  const title =
    stage.goal.description?.trim() ||
    goalTypeLabels[stage.goal.type] ||
    "训练目标";
  return `${title}：阶段依据已变化（${changes.join("、")}），请到训练目标复评或重新生成阶段。阶段测试须单独核对。`;
}

export function impactWorkoutKey(workout: {
  id: string;
  structure: unknown;
  scheduledDate: Date;
  title: string | null;
  purpose: string | null;
}) {
  return generationFingerprint({
    identity: activityWorkoutId(workout),
    date: workout.scheduledDate,
    title: workout.title,
    purpose: workout.purpose,
    segments: (workout.structure as { segments: unknown }).segments,
  });
}

export function changedInputs(
  original: TrainingInputSnapshot | null,
  current: TrainingInputSnapshot,
  acknowledged: TrainingInputSnapshot[],
): PlanImpactItem["issues"] {
  const pairs = [
    ["FTP", "ftp"],
    ["AVAILABILITY", "availability"],
    ["GOAL", "goals"],
  ] as const;
  return pairs.flatMap(([issue, key]) => {
    const target = generationFingerprint(current[key]);
    const matches = [original, ...acknowledged].some(
      (s) => s && key in s && generationFingerprint(s[key]) === target,
    );
    return matches ? [] : [issue];
  });
}

export function powerComparison(
  segments: WorkoutSegment[],
  before: number | null,
  after: number | null,
) {
  const power = (segment: WorkoutSegment, ftp: number | null) => {
    const i = segment.intensity;
    if (i.kind === "power_watt") return `${i.min}–${i.max} W（绝对功率保持）`;
    const percent = `${i.min}–${i.max}% FTP`;
    return ftp
      ? `${percent} · ${Math.round((ftp * i.min) / 100)}–${Math.round((ftp * i.max) / 100)} W`
      : `${percent} · 缺少 FTP 快照`;
  };
  return segments.map((s) => ({
    before: power(s, before),
    after: power(s, after),
  }));
}
