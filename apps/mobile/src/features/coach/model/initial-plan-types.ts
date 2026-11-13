import type { GoalInput, ProfileResponse } from "@ridepilot/contracts";

export type Experience = NonNullable<ProfileResponse["experienceLevel"]>;
export type GoalType = GoalInput["type"];
export type BodyStatus = "READY" | "TIRED" | "RECOVERY";
export type SymptomFlag = "CHEST_PAIN" | "FAINTING" | "SEVERE_ILLNESS";
export type TrainingStatusProps = {
  bodyStatus: BodyStatus;
  setBodyStatus: (value: BodyStatus) => void;
  bodyNote: string;
  setBodyNote: (value: string) => void;
  symptomFlags: SymptomFlag[];
  setSymptomFlags: (value: SymptomFlag[]) => void;
  disabled?: boolean;
};
