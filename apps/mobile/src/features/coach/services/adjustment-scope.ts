import type { WeekGenerationInput } from "@ridepilot/contracts";
import { trainingApi } from "../../training/services/training.api";
import { addDays, nextMonday } from "../model/plan-dates";

export type PlanningScope =
  "NEXT_WORKOUT" | "THIS_WEEK" | "NEXT_WEEK" | "CYCLE";
export type AdjustmentScope = {
  mode: WeekGenerationInput["mode"];
  weekStartDate: string;
  targetWorkoutId?: string;
  expectedPlanVersion?: number;
};

export async function resolveAdjustmentScope(
  token: string,
  scope: PlanningScope,
  today: string,
): Promise<AdjustmentScope> {
  if (scope === "CYCLE")
    throw new Error(
      "整个训练周期调整暂未开放，请选择下一节、本周剩余或下周训练",
    );
  if (scope === "NEXT_WORKOUT") {
    const workout = await trainingApi.getNextWorkout(token);
    if (!workout)
      throw new Error("暂无可调整的后续训练，请选择规划下周或先手动创建课程");
    if (
      workout.editable === false ||
      workout.activity ||
      workout.scheduledDate < today
    )
      throw new Error("下一节训练状态已变化，请刷新后重试");
    const weekday = new Date(
      `${workout.scheduledDate}T12:00:00.000Z`,
    ).getUTCDay();
    return {
      mode: "replace_workout",
      weekStartDate: addDays(workout.scheduledDate, -((weekday + 6) % 7)),
      targetWorkoutId: workout.id,
      expectedPlanVersion: workout.planVersion,
    };
  }
  const weekStartDate =
    scope === "THIS_WEEK" ? addDays(nextMonday(today), -7) : nextMonday(today);
  const calendar = await trainingApi.getCalendar(
    token,
    weekStartDate,
    addDays(weekStartDate, 6),
  );
  const editable = calendar.items.filter(
    (item) =>
      item.scheduledDate >= today && !item.activity && item.editable !== false,
  );
  return {
    mode: editable.length ? "replace_week" : "empty_week",
    weekStartDate,
    ...(calendar.items[0]
      ? { expectedPlanVersion: calendar.items[0].planVersion }
      : {}),
  };
}
