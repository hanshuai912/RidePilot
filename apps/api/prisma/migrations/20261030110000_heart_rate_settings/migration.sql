CREATE TABLE "heart_rate_settings" (
  "user_id" UUID PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "method" VARCHAR(16) NOT NULL,
  "max_heart_rate" INTEGER,
  "resting_heart_rate" INTEGER,
  "lactate_threshold_heart_rate" INTEGER,
  "rule_version" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "heart_rate_method" CHECK ("method" IN ('MAX', 'RESERVE', 'LTHR')),
  CONSTRAINT "heart_rate_bounds" CHECK (
    ("max_heart_rate" IS NULL OR "max_heart_rate" BETWEEN 80 AND 250) AND
    ("resting_heart_rate" IS NULL OR "resting_heart_rate" BETWEEN 20 AND 120) AND
    ("lactate_threshold_heart_rate" IS NULL OR "lactate_threshold_heart_rate" BETWEEN 80 AND 250)),
  CONSTRAINT "heart_rate_required" CHECK (
    ("method" = 'MAX' AND "max_heart_rate" IS NOT NULL) OR
    ("method" = 'RESERVE' AND "max_heart_rate" IS NOT NULL AND "resting_heart_rate" IS NOT NULL) OR
    ("method" = 'LTHR' AND "lactate_threshold_heart_rate" IS NOT NULL)),
  CONSTRAINT "heart_rate_resting" CHECK ("resting_heart_rate" < "max_heart_rate"),
  CONSTRAINT "heart_rate_reserve_span" CHECK ("method" <> 'RESERVE' OR "max_heart_rate" - "resting_heart_rate" >= 10),
  CONSTRAINT "heart_rate_version" CHECK ("version" > 0 AND "rule_version" = 1)
);
