-- Initial manual workout proposals have no published base version.
ALTER TABLE "change_proposals" ALTER COLUMN "base_version_id" DROP NOT NULL;
