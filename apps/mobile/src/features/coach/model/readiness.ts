import { readinessSchema } from "@ridepilot/contracts";

type MissingField = ReturnType<
  typeof readinessSchema.parse
>["missingFields"][number];

const labels: Record<MissingField, string> = {
  ftp: "FTP",
  goal: "训练目标",
  availability: "每周可训练时间",
  experienceLevel: "训练经验",
  weightKg: "体重",
};

export function missingTrainingData(fields: MissingField[]): string {
  return fields.map((field) => labels[field]).join("、");
}

export function firstMissingStep(
  fields: MissingField[],
): "basics" | "goal" | "schedule" {
  if (
    fields.includes("ftp") ||
    fields.includes("weightKg") ||
    fields.includes("experienceLevel")
  )
    return "basics";
  if (fields.includes("goal")) return "goal";
  return "schedule";
}
