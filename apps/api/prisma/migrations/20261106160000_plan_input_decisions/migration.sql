CREATE TABLE "plan_input_decisions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "result" JSONB,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plan_input_decisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "plan_input_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "plan_input_decisions_idempotency_key_key" ON "plan_input_decisions"("idempotency_key");
CREATE INDEX "plan_input_decisions_user_id_status_created_at_idx" ON "plan_input_decisions"("user_id", "status", "created_at");
