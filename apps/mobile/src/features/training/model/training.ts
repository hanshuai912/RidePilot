import type {
  CalendarResponse,
  ManualWorkoutDraft,
  ProposalResponse,
} from "@ridepilot/contracts";

export type Workout = CalendarResponse["items"][number];
export type Draft = ManualWorkoutDraft & { dayOrder?: number };
export type TrainingDraftEntry = {
  draft: Draft;
  workoutId?: string;
  planVersion?: number;
  proposal?: ProposalResponse;
  hasFtp: boolean;
  dirty: boolean;
};
const pad = (value: number) => String(value).padStart(2, "0");
export const iso = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export function addDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
}
export const isTrainingDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
export const dateLabel = (value: string) => {
  if (!isTrainingDate(value)) return "请选择有效日期";
  const date = new Date(`${value}T12:00:00`);
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
};
export const weekday = (value: string) =>
  isTrainingDate(value)
    ? new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(
        new Date(`${value}T12:00:00`),
      )
    : "";
export const emptyDraft = (date: string): Draft => ({
  scheduledDate: date,
  title: "",
  purpose: "",
  segments: [],
});
