import { coachApi } from "../../coach/services/coach.api";
import { nutritionApi } from "../../nutrition/services/nutrition.api";

function shiftDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function createRaceNutritionDraft(
  token: string,
  raceId: string,
  forceRegenerate = false,
) {
  if (!forceRegenerate) {
    const existing = await nutritionApi.raceState(token, raceId);
    if (existing.generation || existing.proposal) return existing;
  }
  const race = await coachApi.race(token, raceId);
  const plan = await nutritionApi.getPlan(token, race.localDate);
  const generation = await nutritionApi.generate(token, {
    startDate: shiftDate(race.localDate, -2),
    endDate: shiftDate(race.localDate, 2),
    mode: "RACE_LINKED",
    expectedNutritionVersion: plan.version,
    raceId: race.id,
    notes: "请提供赛前、比赛中和赛后恢复期的补给建议，并标明估算依据。",
    ...(forceRegenerate ? { forceRegenerate: true } : {}),
  });
  return { generation, proposal: null };
}
