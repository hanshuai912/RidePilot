-- CreateTable
CREATE TABLE "training_stage_plans" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "goal_version" INTEGER NOT NULL,
    "ftp_measurement_id" UUID NOT NULL,
    "availability_version" INTEGER NOT NULL,
    "profile_version" INTEGER NOT NULL,
    "base_stage_plan_id" UUID,
    "generation_id" UUID NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "summary" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "skill_version" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_stage_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_stages" (
    "id" UUID NOT NULL,
    "stage_plan_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "purpose" VARCHAR(300) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "assessment_suggestion" VARCHAR(300) NOT NULL,

    CONSTRAINT "training_stages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "training_stage_plans_generation_id_key" ON "training_stage_plans"("generation_id");

-- CreateIndex
CREATE INDEX "training_stage_plans_user_id_goal_id_status_idx" ON "training_stage_plans"("user_id", "goal_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "training_stages_stage_plan_id_position_key" ON "training_stages"("stage_plan_id", "position");

-- AddForeignKey
ALTER TABLE "training_stage_plans" ADD CONSTRAINT "training_stage_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_stage_plans" ADD CONSTRAINT "training_stage_plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "training_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_stages" ADD CONSTRAINT "training_stages_stage_plan_id_fkey" FOREIGN KEY ("stage_plan_id") REFERENCES "training_stage_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "training_stage_plans_active_goal" ON "training_stage_plans"("goal_id") WHERE "status" = 'ACTIVE';
