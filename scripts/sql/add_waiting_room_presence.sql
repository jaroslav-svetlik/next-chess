ALTER TABLE "GamePlayer"
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "game_player_presence_idx"
  ON "GamePlayer" ("gameId", "isConnected", "lastSeenAt");
