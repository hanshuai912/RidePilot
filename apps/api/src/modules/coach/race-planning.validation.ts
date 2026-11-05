import { ConflictException } from "@nestjs/common";
import type { RacePlanningPhase } from "@ridepilot/contracts";

export function addRaceDays(date: string, days: number) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function racePlanningWindow(
  race: { status: string; localDate: Date },
  today: string,
  requested?: RacePlanningPhase,
) {
  const raceDate = race.localDate.toISOString().slice(0, 10);
  const phase =
    requested ??
    (race.status === "CANCELLED"
      ? "RETURN_TO_GOAL"
      : race.status === "COMPLETED" || raceDate < today
        ? "RECOVERY"
        : "PREPARATION");
  if (
    (phase === "PREPARATION" &&
      (race.status !== "CONFIRMED" || raceDate < today)) ||
    (phase === "RECOVERY" &&
      (race.status === "CANCELLED" ||
        (race.status !== "COMPLETED" && raceDate > today))) ||
    (phase === "RETURN_TO_GOAL" && race.status !== "CANCELLED")
  )
    throw new ConflictException({
      code: "RACE_PHASE_CONFLICT",
      message:
        "赛事状态已变化，请返回赛事详情选择备赛、赛后恢复或取消后重新规划",
    });
  const startDate =
    phase === "PREPARATION"
      ? [today, addRaceDays(raceDate, -7)].sort().at(-1)!
      : today;
  return {
    phase,
    today,
    startDate,
    endDate:
      phase === "PREPARATION"
        ? addRaceDays(raceDate, 7)
        : addRaceDays(today, 13),
  };
}
