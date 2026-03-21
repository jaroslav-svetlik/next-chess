DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ModerationStatus') THEN
    CREATE TYPE "ModerationStatus" AS ENUM ('CLEAN', 'OBSERVE', 'WATCH', 'REVIEW', 'RESTRICTED');
  END IF;
END $$;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'CLEAN';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "moderationUpdatedAt" TIMESTAMP(3);

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "moderationUpdatedByEmail" TEXT;

CREATE INDEX IF NOT EXISTS "user_moderation_status_idx"
  ON "User" ("moderationStatus", "updatedAt");

CREATE TABLE IF NOT EXISTS "UserModerationEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "fromStatus" "ModerationStatus",
  "toStatus" "ModerationStatus",
  "note" TEXT,
  "createdByEmail" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserModerationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserModerationEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_moderation_event_user_created_idx"
  ON "UserModerationEvent" ("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "user_moderation_event_type_created_idx"
  ON "UserModerationEvent" ("type", "createdAt");
