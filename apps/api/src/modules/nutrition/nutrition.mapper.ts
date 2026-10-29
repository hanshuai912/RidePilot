import {
  NutritionItemDraft,
  NutritionPlanDraft,
  NutritionPlanResponse,
  NutritionProfileResponse,
  NutritionProposalResponse,
} from "@ridepilot/contracts";
import { dbToDate } from "../training/training.validation";

type ProfileRecord = {
  id: string;
  userId: string;
  dietStyle: string;
  habits: unknown;
  allergens: unknown;
  restrictions: unknown;
  restrictionNote: string | null;
  commonFoods: unknown;
  mealSchedule: unknown;
  version: number;
};

export function toProfileResponse(
  profile: ProfileRecord,
): NutritionProfileResponse {
  return {
    id: profile.id,
    dietStyle: profile.dietStyle as NutritionProfileResponse["dietStyle"],
    habits: profile.habits as NutritionProfileResponse["habits"],
    allergens: profile.allergens as NutritionProfileResponse["allergens"],
    restrictions:
      profile.restrictions as NutritionProfileResponse["restrictions"],
    restrictionNote: profile.restrictionNote,
    commonFoods: profile.commonFoods as string[],
    mealSchedule:
      profile.mealSchedule as NutritionProfileResponse["mealSchedule"],
    version: profile.version,
  };
}

type ItemRecord = {
  id: string;
  localDate: Date;
  mealType: string;
  scheduledLocalTime: string;
  title: string;
  foods: unknown;
  nutrients: unknown;
  nutritionSource: string;
  confidence: string;
  linkedWorkoutId: string | null;
  notes: string | null;
};

export function toItemDraft(item: ItemRecord): NutritionItemDraft {
  return {
    localDate: dbToDate(item.localDate),
    mealType: item.mealType as NutritionItemDraft["mealType"],
    scheduledLocalTime: item.scheduledLocalTime,
    title: item.title,
    foods: item.foods as NutritionItemDraft["foods"],
    nutrients: item.nutrients as NutritionItemDraft["nutrients"],
    nutritionSource:
      item.nutritionSource as NutritionItemDraft["nutritionSource"],
    confidence: item.confidence as NutritionItemDraft["confidence"],
    linkedWorkoutId: item.linkedWorkoutId,
    notes: item.notes,
  };
}

export function toPlanResponse(
  timezone: string,
  from: string,
  to: string,
  plan: {
    id: string;
    activeVersion: {
      versionNo: number;
      snapshot: unknown;
      items: ItemRecord[];
    } | null;
  } | null,
): NutritionPlanResponse {
  if (!plan?.activeVersion) {
    return {
      planId: null,
      version: 0,
      status: "NOT_GENERATED",
      timezone,
      from,
      to,
      dailyTarget: null,
      items: [],
    };
  }
  const snapshot = plan.activeVersion.snapshot as {
    dailyTarget?: unknown;
  } | null;
  return {
    planId: plan.id,
    version: plan.activeVersion.versionNo,
    status: "ACTIVE",
    timezone,
    from,
    to,
    dailyTarget: (snapshot?.dailyTarget ??
      null) as NutritionPlanResponse["dailyTarget"],
    items: plan.activeVersion.items
      .filter((item) => {
        const date = dbToDate(item.localDate);
        return date >= from && date <= to;
      })
      .map((item) => ({ id: item.id, ...toItemDraft(item), warnings: [] })),
  };
}

export function toPlanDraft(
  items: ItemRecord[],
  startDate: string,
  endDate: string,
  dailyTarget: unknown,
): NutritionPlanDraft {
  return {
    startDate,
    endDate,
    dailyTarget: dailyTarget as NutritionPlanDraft["dailyTarget"],
    items: items.map(toItemDraft),
  };
}

export function toProposalResponse(proposal: {
  id: string;
  proposalType: string;
  status: string;
  proposalVersion: number;
  draft: unknown;
  original: unknown;
  validationPassed: boolean | null;
  validationWarnings: unknown;
  validationBlockers: unknown;
  baseVersion: { versionNo: number } | null;
  metadata: unknown;
}): NutritionProposalResponse {
  const asStrings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return {
    proposalId: proposal.id,
    proposalType:
      proposal.proposalType as NutritionProposalResponse["proposalType"],
    status: proposal.status as NutritionProposalResponse["status"],
    baseNutritionVersion: proposal.baseVersion?.versionNo ?? 0,
    proposalVersion: proposal.proposalVersion,
    original: proposal.original as NutritionProposalResponse["original"],
    draft: proposal.draft as NutritionProposalResponse["draft"],
    validation: {
      passed: proposal.validationPassed ?? false,
      warnings: asStrings(proposal.validationWarnings),
      blockers: asStrings(proposal.validationBlockers),
    },
    metadata: proposal.metadata as NutritionProposalResponse["metadata"],
  };
}
