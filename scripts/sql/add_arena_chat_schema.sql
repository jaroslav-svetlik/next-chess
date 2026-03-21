CREATE TABLE IF NOT EXISTS "ArenaChatMessage" (
  "id" TEXT PRIMARY KEY,
  "actorId" TEXT NOT NULL,
  "actorType" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "username" TEXT,
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "arena_chat_message_created_at_idx"
  ON "ArenaChatMessage" ("createdAt");

CREATE INDEX IF NOT EXISTS "arena_chat_message_actor_created_at_idx"
  ON "ArenaChatMessage" ("actorId", "createdAt");
