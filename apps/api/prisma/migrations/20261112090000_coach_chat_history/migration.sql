CREATE TYPE "CoachChatTurnStatus" AS ENUM ('PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE "coach_chat_turns" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "client_message_id" VARCHAR(100) NOT NULL,
    "question" VARCHAR(500) NOT NULL,
    "answer" TEXT,
    "status" "CoachChatTurnStatus" NOT NULL DEFAULT 'PROCESSING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "attempt_id" UUID NOT NULL,
    "lease_expires_at" TIMESTAMP(3) NOT NULL,
    "error_message" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coach_chat_turns_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coach_chat_turns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "coach_chat_turns_user_id_client_message_id_key" ON "coach_chat_turns"("user_id", "client_message_id");
CREATE INDEX "coach_chat_turns_user_id_created_at_id_idx" ON "coach_chat_turns"("user_id", "created_at", "id");
