import { nutritionProposalMetadataSchema } from "@ridepilot/contracts";
import type { Prisma } from "../../generated/prisma/client";

// Older/manual proposals have no generation snapshot and retain their existing
// baseline and domain validation. New AI drafts also pin their input versions.
export async function nutritionGenerationStaleReason(
  db: Prisma.TransactionClient,
  userId: string,
  metadata: unknown,
): Promise<string | null> {
  const parsed = nutritionProposalMetadataSchema.safeParse(metadata);
  const snapshot = parsed.success ? parsed.data.generationContext : undefined;
  if (!snapshot) return null;
  const [user, profile, training, race] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId } }),
    db.nutritionProfile.findUnique({ where: { userId } }),
    db.trainingPlan.findFirst({ where: { userId, status: "ACTIVE" } }),
    snapshot.raceId
      ? db.trainingRace.findFirst({ where: { id: snapshot.raceId, userId } })
      : Promise.resolve(null),
  ]);
  if (user.profileVersion !== snapshot.profileVersion)
    return "基本资料已变化，请重新生成";
  if (profile?.version !== snapshot.nutritionProfileVersion)
    return "饮食档案已变化，请重新生成";
  if ((training?.activeVersionId ?? null) !== snapshot.trainingPlanVersionId)
    return "关联训练版本已变化，请重新生成";
  if (snapshot.raceId && race?.version !== snapshot.raceVersion)
    return "关联赛事已变化，请重新生成";
  return null;
}
