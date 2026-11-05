ALTER TABLE "training_races"
  ADD COLUMN "type" VARCHAR(24) NOT NULL DEFAULT 'ROAD_RACE',
  ADD COLUMN "elevation_gain_m" INTEGER,
  ADD COLUMN "intent" VARCHAR(24) NOT NULL DEFAULT 'FINISH';

CREATE TABLE "training_race_results" (
  "id" UUID NOT NULL,
  "race_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "actual_date" DATE NOT NULL,
  "duration_seconds" INTEGER,
  "rpe" INTEGER,
  "fatigue" INTEGER,
  "notes" VARCHAR(500),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "training_race_results_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "training_race_results_race_id_key" UNIQUE ("race_id"),
  CONSTRAINT "training_race_results_race_id_fkey" FOREIGN KEY ("race_id") REFERENCES "training_races"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "training_race_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "training_race_results_user_id_actual_date_idx" ON "training_race_results"("user_id", "actual_date");
