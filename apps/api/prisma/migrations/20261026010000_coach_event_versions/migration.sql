CREATE UNIQUE INDEX "training_activities_user_id_workout_id_key" ON "training_activities"("user_id", "workout_id");
ALTER TABLE "training_assessments" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "training_races" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
