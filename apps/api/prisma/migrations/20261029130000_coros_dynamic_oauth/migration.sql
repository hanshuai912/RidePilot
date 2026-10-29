ALTER TABLE "external_connections"
  ADD COLUMN "oauth_client_id" VARCHAR(255),
  ADD COLUMN "oauth_issuer" VARCHAR(255);

ALTER TABLE "oauth_authorization_attempts"
  ADD COLUMN "oauth_client_id" VARCHAR(255),
  ADD COLUMN "oauth_issuer" VARCHAR(255);

UPDATE "oauth_authorization_attempts"
SET "oauth_client_id" = 'legacy-configured-client',
    "oauth_issuer" = 'https://mcp.coros.com'
WHERE "oauth_client_id" IS NULL;

ALTER TABLE "oauth_authorization_attempts"
  ALTER COLUMN "oauth_client_id" SET NOT NULL,
  ALTER COLUMN "oauth_issuer" SET NOT NULL;
