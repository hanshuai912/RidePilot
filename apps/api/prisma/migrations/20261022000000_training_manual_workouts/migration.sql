CREATE TYPE "TrainingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "PlanItemEventType" AS ENUM ('WORKOUT');
CREATE TYPE "PlanItemStatus" AS ENUM ('SCHEDULED');
CREATE TYPE "ProposalType" AS ENUM ('MANUAL_WORKOUT_CREATE', 'MANUAL_WORKOUT_EDIT');
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'PENDING_VALIDATION', 'READY', 'BLOCKED', 'APPLIED', 'REJECTED', 'EXPIRED');

CREATE TABLE "ability_measurements" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "metric_type" VARCHAR(64) NOT NULL,
  "value" DECIMAL(8,2) NOT NULL,
  "unit" VARCHAR(16) NOT NULL,
  "measured_at" TIMESTAMP(3) NOT NULL,
  "source" VARCHAR(32) NOT NULL,
  "confidence" VARCHAR(32),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ability_measurements_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "training_plans" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" "TrainingPlanStatus" NOT NULL DEFAULT 'DRAFT',
  "active_version_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_plans_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "plan_versions" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "base_version_id" UUID,
  "change_reason" VARCHAR(255),
  "snapshot" JSONB,
  "applied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "plan_versions_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "workouts" (
  "id" UUID NOT NULL,
  "plan_version_id" UUID NOT NULL,
  "sport_type" VARCHAR(32) NOT NULL,
  "purpose" VARCHAR(64),
  "title" VARCHAR(120),
  "scheduled_date" DATE NOT NULL,
  "day_order" INTEGER NOT NULL,
  "time_target_min" DECIMAL(8,2),
  "distance_target_km" DECIMAL(8,2),
  "source" VARCHAR(32) NOT NULL,
  "structure" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "plan_items" (
  "id" UUID NOT NULL,
  "plan_version_id" UUID NOT NULL,
  "event_type" "PlanItemEventType" NOT NULL,
  "scheduled_date" DATE NOT NULL,
  "scheduled_start" TIMESTAMP(3),
  "day_order" INTEGER NOT NULL,
  "reference_id" UUID,
  "workout_id" UUID,
  "status" "PlanItemStatus" NOT NULL DEFAULT 'SCHEDULED',
  CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "change_proposals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "base_version_id" UUID NOT NULL,
  "proposal_type" "ProposalType" NOT NULL,
  "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
  "target_workout_id" UUID,
  "draft" JSONB NOT NULL,
  "original" JSONB,
  "proposal_version" INTEGER NOT NULL DEFAULT 1,
  "validation_passed" BOOLEAN,
  "validation_warnings" JSONB,
  "validation_blockers" JSONB,
  "idempotency_key" VARCHAR(255),
  "applied_version_id" UUID,
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "change_proposals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "training_plans_active_version_id_key" ON "training_plans"("active_version_id");
CREATE UNIQUE INDEX "plan_versions_plan_id_version_no_key" ON "plan_versions"("plan_id", "version_no");
CREATE UNIQUE INDEX "plan_items_workout_id_key" ON "plan_items"("workout_id");
CREATE UNIQUE INDEX "change_proposals_idempotency_key_key" ON "change_proposals"("idempotency_key");
CREATE INDEX "ability_measurements_user_id_metric_type_measured_at_idx" ON "ability_measurements"("user_id", "metric_type", "measured_at");
CREATE INDEX "training_plans_user_id_status_idx" ON "training_plans"("user_id", "status");
CREATE INDEX "plan_versions_plan_id_applied_at_idx" ON "plan_versions"("plan_id", "applied_at");
CREATE INDEX "workouts_plan_version_id_scheduled_date_day_order_idx" ON "workouts"("plan_version_id", "scheduled_date", "day_order");
CREATE INDEX "plan_items_plan_version_id_scheduled_date_day_order_idx" ON "plan_items"("plan_version_id", "scheduled_date", "day_order");
CREATE INDEX "change_proposals_user_id_status_idx" ON "change_proposals"("user_id", "status");
CREATE INDEX "change_proposals_base_version_id_idx" ON "change_proposals"("base_version_id");

ALTER TABLE "ability_measurements" ADD CONSTRAINT "ability_measurements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_active_version_id_fkey" FOREIGN KEY ("active_version_id") REFERENCES "plan_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "plan_versions" ADD CONSTRAINT "plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "training_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_proposals" ADD CONSTRAINT "change_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "change_proposals" ADD CONSTRAINT "change_proposals_base_version_id_fkey" FOREIGN KEY ("base_version_id") REFERENCES "plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
