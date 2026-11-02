-- Additive: existing untyped assessments remain LEGACY and cannot update FTP.
ALTER TABLE "training_assessments"
ADD COLUMN "stage_id" UUID,
ADD COLUMN "kind" VARCHAR(24) NOT NULL DEFAULT 'LEGACY',
ADD COLUMN "actual_date" DATE,
ADD COLUMN "source" VARCHAR(24),
ADD COLUMN "rpe" INTEGER,
ADD COLUMN "duration_seconds" INTEGER,
ADD COLUMN "route_name" VARCHAR(120),
ADD COLUMN "distance_km" DECIMAL(8,3),
ADD COLUMN "notes" VARCHAR(500),
ADD COLUMN "reason" VARCHAR(200),
ADD COLUMN "comparable_conditions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "baseline_ftp_watts" DECIMAL(8,2),
ADD COLUMN "ftp_measurement_id" UUID;
ALTER TABLE "training_assessments" ADD CONSTRAINT "training_assessments_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "training_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "training_assessments_ftp_measurement_id_key" ON "training_assessments"("ftp_measurement_id");
CREATE TABLE "assessment_mutations" (
"id" UUID NOT NULL, "user_id" UUID NOT NULL, "key" VARCHAR(128) NOT NULL, "signature" VARCHAR(64) NOT NULL, "response" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "assessment_mutations_pkey" PRIMARY KEY ("id"),
CONSTRAINT "assessment_mutations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "assessment_mutations_user_id_key_key" ON "assessment_mutations"("user_id", "key");
