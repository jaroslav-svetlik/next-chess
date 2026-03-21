CREATE TABLE IF NOT EXISTS "GuestIdentity" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "guest_identity_created_at_idx" ON "GuestIdentity" ("createdAt");

ALTER TABLE "Game"
  ALTER COLUMN "createdByUserId" DROP NOT NULL;

ALTER TABLE "Game"
  ADD COLUMN IF NOT EXISTS "createdByGuestId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Game_createdByGuestId_fkey'
      AND table_name = 'Game'
  ) THEN
    ALTER TABLE "Game"
      ADD CONSTRAINT "Game_createdByGuestId_fkey"
      FOREIGN KEY ("createdByGuestId") REFERENCES "GuestIdentity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "game_guest_creator_waiting_idx"
  ON "Game" ("createdByGuestId", "status", "rated", "timeCategory", "initialTimeMs", "incrementMs", "createdAt");

ALTER TABLE "GamePlayer"
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "GamePlayer"
  ADD COLUMN IF NOT EXISTS "guestIdentityId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'GamePlayer_guestIdentityId_fkey'
      AND table_name = 'GamePlayer'
  ) THEN
    ALTER TABLE "GamePlayer"
      ADD CONSTRAINT "GamePlayer_guestIdentityId_fkey"
      FOREIGN KEY ("guestIdentityId") REFERENCES "GuestIdentity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "GamePlayer_gameId_guestIdentityId_key"
  ON "GamePlayer" ("gameId", "guestIdentityId");

CREATE INDEX IF NOT EXISTS "game_player_guest_joined_idx"
  ON "GamePlayer" ("guestIdentityId", "joinedAt");

ALTER TABLE "Move"
  ALTER COLUMN "movedByUserId" DROP NOT NULL;

ALTER TABLE "Move"
  ADD COLUMN IF NOT EXISTS "movedByGuestIdentityId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Move_movedByGuestIdentityId_fkey'
      AND table_name = 'Move'
  ) THEN
    ALTER TABLE "Move"
      ADD CONSTRAINT "Move_movedByGuestIdentityId_fkey"
      FOREIGN KEY ("movedByGuestIdentityId") REFERENCES "GuestIdentity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "move_guest_created_idx"
  ON "Move" ("movedByGuestIdentityId", "createdAt");
