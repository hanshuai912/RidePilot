import type { ManualWorkoutDraft } from "@ridepilot/contracts";

export type DraftPayload = ManualWorkoutDraft & {
  id: string;
  dayOrder: number;
};
