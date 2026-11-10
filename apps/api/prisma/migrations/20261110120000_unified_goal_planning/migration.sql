-- Keep existing single-goal roadmaps and evidence readable. NULL explicitly
-- means legacy; only a user-confirmed unified draft replaces active roadmaps.
ALTER TABLE "training_stage_plans" ADD COLUMN "goals_snapshot" JSONB;
CREATE UNIQUE INDEX "training_stage_plans_one_unified_active_per_user"
  ON "training_stage_plans" ("user_id")
  WHERE "status" = 'ACTIVE' AND "goals_snapshot" IS NOT NULL;
