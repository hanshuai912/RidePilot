-- CreateEnum
CREATE TYPE "ExternalConnectionStatus" AS ENUM ('AUTHORIZING', 'CONNECTED', 'REAUTH_REQUIRED', 'DEGRADED', 'FAILED');

-- CreateEnum
CREATE TYPE "ExternalSyncRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'REAUTH_REQUIRED');

-- CreateTable
CREATE TABLE "external_connections" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider_key" VARCHAR(64) NOT NULL,
    "status" "ExternalConnectionStatus" NOT NULL DEFAULT 'AUTHORIZING',
    "provider_account_id" VARCHAR(128),
    "provider_account_label" VARCHAR(160),
    "scopes" JSONB,
    "access_token_ciphertext" TEXT,
    "refresh_token_ciphertext" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "last_synced_at" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_authorization_attempts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "connection_id" UUID,
    "provider_key" VARCHAR(64) NOT NULL,
    "state_hash" CHAR(64) NOT NULL,
    "code_verifier_ciphertext" TEXT NOT NULL,
    "redirect_uri" VARCHAR(500) NOT NULL,
    "app_redirect_uri" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_authorization_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_sync_runs" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "status" "ExternalSyncRunStatus" NOT NULL DEFAULT 'QUEUED',
    "requested_from" DATE,
    "requested_to" DATE,
    "items_seen" INTEGER NOT NULL DEFAULT 0,
    "items_imported" INTEGER NOT NULL DEFAULT 0,
    "items_updated" INTEGER NOT NULL DEFAULT 0,
    "items_skipped" INTEGER NOT NULL DEFAULT 0,
    "error_code" VARCHAR(64),
    "request_id" VARCHAR(64),
    "idempotency_key" VARCHAR(255) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "external_connections_user_id_provider_key_key" ON "external_connections"("user_id", "provider_key");
CREATE INDEX "external_connections_user_id_status_idx" ON "external_connections"("user_id", "status");
CREATE INDEX "external_connections_token_expires_at_idx" ON "external_connections"("token_expires_at");
CREATE UNIQUE INDEX "oauth_authorization_attempts_state_hash_key" ON "oauth_authorization_attempts"("state_hash");
CREATE INDEX "oauth_authorization_attempts_user_id_provider_key_expires_at_idx" ON "oauth_authorization_attempts"("user_id", "provider_key", "expires_at");
CREATE UNIQUE INDEX "external_sync_runs_connection_id_idempotency_key_key" ON "external_sync_runs"("connection_id", "idempotency_key");
CREATE INDEX "external_sync_runs_connection_id_created_at_idx" ON "external_sync_runs"("connection_id", "created_at");

-- AddForeignKey
ALTER TABLE "external_connections" ADD CONSTRAINT "external_connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_authorization_attempts" ADD CONSTRAINT "oauth_authorization_attempts_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "external_connections"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "external_sync_runs" ADD CONSTRAINT "external_sync_runs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "external_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
