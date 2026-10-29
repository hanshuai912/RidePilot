CREATE TABLE "nutrition_profiles" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "diet_style" VARCHAR(32) NOT NULL,
  "habits" JSONB NOT NULL,
  "allergens" JSONB NOT NULL,
  "restrictions" JSONB NOT NULL,
  "restriction_note" VARCHAR(200),
  "common_foods" JSONB NOT NULL,
  "meal_schedule" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrition_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nutrition_profiles_user_id_key" ON "nutrition_profiles"("user_id");
ALTER TABLE "nutrition_profiles" ADD CONSTRAINT "nutrition_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "nutrition_plans" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "active_version_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrition_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nutrition_plans_active_version_id_key" ON "nutrition_plans"("active_version_id");
CREATE INDEX "nutrition_plans_user_id_status_idx" ON "nutrition_plans"("user_id", "status");
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "nutrition_plan_versions" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "base_version_id" UUID,
  "source" VARCHAR(32) NOT NULL,
  "profile_version" INTEGER NOT NULL,
  "training_plan_version_no" INTEGER,
  "snapshot" JSONB,
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_plan_versions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nutrition_plan_versions_plan_id_version_no_key" ON "nutrition_plan_versions"("plan_id", "version_no");
CREATE INDEX "nutrition_plan_versions_plan_id_applied_at_idx" ON "nutrition_plan_versions"("plan_id", "applied_at");
ALTER TABLE "nutrition_plan_versions" ADD CONSTRAINT "nutrition_plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nutrition_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_plans" ADD CONSTRAINT "nutrition_plans_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "nutrition_plan_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "nutrition_items" (
  "id" UUID NOT NULL,
  "plan_version_id" UUID NOT NULL,
  "local_date" DATE NOT NULL,
  "meal_type" VARCHAR(32) NOT NULL,
  "scheduled_local_time" VARCHAR(5) NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "foods" JSONB NOT NULL,
  "nutrients" JSONB NOT NULL,
  "nutrition_source" VARCHAR(32) NOT NULL,
  "confidence" VARCHAR(16) NOT NULL,
  "linked_workout_id" UUID,
  "notes" VARCHAR(300),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nutrition_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nutrition_items_plan_version_id_local_date_meal_type_idx" ON "nutrition_items"("plan_version_id", "local_date", "meal_type");
CREATE INDEX "nutrition_items_linked_workout_id_idx" ON "nutrition_items"("linked_workout_id");
ALTER TABLE "nutrition_items" ADD CONSTRAINT "nutrition_items_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "nutrition_plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "nutrition_proposals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "plan_id" UUID,
  "base_version_id" UUID,
  "proposal_type" VARCHAR(32) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "draft" JSONB NOT NULL,
  "original" JSONB,
  "metadata" JSONB,
  "proposal_version" INTEGER NOT NULL DEFAULT 1,
  "validation_passed" BOOLEAN,
  "validation_warnings" JSONB,
  "validation_blockers" JSONB,
  "idempotency_key" VARCHAR(255),
  "apply_idempotency_key" VARCHAR(255),
  "applied_version_id" UUID,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nutrition_proposals_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "nutrition_proposals_idempotency_key_key" ON "nutrition_proposals"("idempotency_key");
CREATE UNIQUE INDEX "nutrition_proposals_apply_idempotency_key_key" ON "nutrition_proposals"("apply_idempotency_key");
CREATE INDEX "nutrition_proposals_user_id_status_idx" ON "nutrition_proposals"("user_id", "status");
CREATE INDEX "nutrition_proposals_plan_id_idx" ON "nutrition_proposals"("plan_id");
ALTER TABLE "nutrition_proposals" ADD CONSTRAINT "nutrition_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_proposals" ADD CONSTRAINT "nutrition_proposals_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "nutrition_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "nutrition_proposals" ADD CONSTRAINT "nutrition_proposals_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "nutrition_plan_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
