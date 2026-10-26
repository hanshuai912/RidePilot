ALTER TYPE "ProposalType" ADD VALUE 'AI_WEEK_PLAN';
ALTER TYPE "ProposalType" ADD VALUE 'AI_WORKOUT_ADJUST';
ALTER TYPE "ProposalType" ADD VALUE 'AI_PLAN_ADJUST';
ALTER TYPE "ProposalType" ADD VALUE 'AI_ASSESSMENT_REVIEW';
ALTER TYPE "ProposalType" ADD VALUE 'AI_RACE_REPLAN';
ALTER TYPE "ProposalType" ADD VALUE 'PLAN_RESTORE';

CREATE TABLE "training_goals" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "description" VARCHAR(200),
  "target_date" DATE NOT NULL,
  "priority" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_goals_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_goals_user_id_status_idx" ON "training_goals"("user_id", "status");
ALTER TABLE "training_goals" ADD CONSTRAINT "training_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_availability" (
  "user_id" UUID NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "weekdays" JSONB NOT NULL,
  "max_session_minutes" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_availability_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "training_availability" ADD CONSTRAINT "training_availability_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_activities" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "workout_id" UUID,
  "local_date" DATE NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "duration_min" INTEGER,
  "rpe" INTEGER,
  "fatigue" INTEGER,
  "notes" VARCHAR(200),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "training_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_activities_user_id_local_date_idx" ON "training_activities"("user_id", "local_date");
ALTER TABLE "training_activities" ADD CONSTRAINT "training_activities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_assessments" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "goal_id" UUID,
  "local_date" DATE NOT NULL,
  "protocol" VARCHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED',
  "result_watts" DECIMAL(8,2),
  "conditions" VARCHAR(200),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_assessments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_assessments_user_id_local_date_idx" ON "training_assessments"("user_id", "local_date");
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "training_races" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "local_date" DATE NOT NULL,
  "timezone" VARCHAR(64) NOT NULL,
  "distance_km" DECIMAL(8,2) NOT NULL,
  "priority" VARCHAR(1) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'CONFIRMED',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_races_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "training_races_user_id_local_date_idx" ON "training_races"("user_id", "local_date");
ALTER TABLE "training_races" ADD CONSTRAINT "training_races_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ai_generations" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "scene" VARCHAR(40) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "proposal_id" UUID,
  "error_code" VARCHAR(64),
  "request_id" VARCHAR(64),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lease_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_generations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ai_generations_user_id_idempotency_key_key" ON "ai_generations"("user_id", "idempotency_key");
CREATE INDEX "ai_generations_status_lease_until_idx" ON "ai_generations"("status", "lease_until");
CREATE INDEX "ai_generations_user_id_created_at_idx" ON "ai_generations"("user_id", "created_at");
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
