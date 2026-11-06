-- AlterTable
ALTER TABLE "training_goals" ADD COLUMN     "closure_reason" VARCHAR(16),
ADD COLUMN     "success_criteria" VARCHAR(300),
ADD COLUMN     "target_ftp_watts" INTEGER;

-- AlterTable
ALTER TABLE "training_stage_plans" ADD COLUMN     "review_evidence" JSONB;

-- AlterTable
ALTER TABLE "training_stages" ADD COLUMN     "criteria" VARCHAR(300),
ADD COLUMN     "criteria_version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "goal_mutations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "goal_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_mutations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_stage_reviews" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stage_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "outcome" VARCHAR(16) NOT NULL,
    "decision" VARCHAR(16) NOT NULL,
    "rationale" VARCHAR(500) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "training_stage_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "goal_mutations_goal_id_created_at_idx" ON "goal_mutations"("goal_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "goal_mutations_user_id_idempotency_key_key" ON "goal_mutations"("user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "training_stage_reviews_stage_id_created_at_idx" ON "training_stage_reviews"("stage_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "training_stage_reviews_user_id_idempotency_key_key" ON "training_stage_reviews"("user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "goal_mutations" ADD CONSTRAINT "goal_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_mutations" ADD CONSTRAINT "goal_mutations_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "training_goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_stage_reviews" ADD CONSTRAINT "training_stage_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "training_stage_reviews" ADD CONSTRAINT "training_stage_reviews_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "training_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
