-- Retain historical values while allowing goals without achievement deadlines.
ALTER TABLE "training_goals" ALTER COLUMN "target_date" DROP NOT NULL;
