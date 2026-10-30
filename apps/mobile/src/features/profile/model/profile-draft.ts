import type { ProfileResponse } from "@ridepilot/contracts";

export type ProfileDraft = Pick<
  ProfileResponse,
  "gender" | "birthDate" | "experienceLevel"
> & { displayName: string; heightCm: string; weightKg: string };

export function profileDraft(profile: ProfileResponse): ProfileDraft {
  return {
    displayName: profile.displayName === "骑行者" ? "" : profile.displayName,
    gender: profile.gender,
    birthDate: profile.birthDate,
    heightCm: profile.heightCm?.toString() ?? "",
    weightKg: profile.weightKg?.toString() ?? "",
    experienceLevel: profile.experienceLevel,
  };
}

export function profileDraftChanged(
  draft: ProfileDraft,
  original: ProfileDraft,
) {
  return (Object.keys(original) as (keyof ProfileDraft)[]).some(
    (key) => draft[key] !== original[key],
  );
}

export function profileDraftPayload(draft: ProfileDraft) {
  return {
    ...draft,
    displayName: draft.displayName.trim() || null,
    heightCm: draft.heightCm.trim() ? Number(draft.heightCm) : null,
    weightKg: draft.weightKg.trim() ? Number(draft.weightKg) : null,
  };
}
