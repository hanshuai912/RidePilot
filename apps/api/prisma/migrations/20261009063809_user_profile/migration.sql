-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "ViewPreference" AS ENUM ('SIMPLE', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "display_name" VARCHAR(80),
ADD COLUMN     "locale" VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
ADD COLUMN     "profile_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC';

-- CreateTable
CREATE TABLE "athlete_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "gender" "Gender",
    "age_band" VARCHAR(32),
    "height_cm" DECIMAL(5,2),
    "weight_kg" DECIMAL(6,2),
    "experience_level" VARCHAR(32),
    "training_purpose" VARCHAR(500),
    "equipment_flags" JSONB,
    "view_preference" "ViewPreference" NOT NULL DEFAULT 'SIMPLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "athlete_profiles_user_id_key" ON "athlete_profiles"("user_id");

-- AddForeignKey
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
