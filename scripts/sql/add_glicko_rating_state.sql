ALTER TABLE "User"
  ALTER COLUMN "ratingRapid" SET DEFAULT 1500,
  ALTER COLUMN "ratingBlitz" SET DEFAULT 1500,
  ALTER COLUMN "ratingBullet" SET DEFAULT 1500;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "ratingRapidDeviation" DOUBLE PRECISION NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS "ratingRapidVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  ADD COLUMN IF NOT EXISTS "ratingRapidLastRatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ratingBlitzDeviation" DOUBLE PRECISION NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS "ratingBlitzVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  ADD COLUMN IF NOT EXISTS "ratingBlitzLastRatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "ratingBulletDeviation" DOUBLE PRECISION NOT NULL DEFAULT 250,
  ADD COLUMN IF NOT EXISTS "ratingBulletVolatility" DOUBLE PRECISION NOT NULL DEFAULT 0.06,
  ADD COLUMN IF NOT EXISTS "ratingBulletLastRatedAt" TIMESTAMP(3);

WITH bullet_stats AS (
  SELECT
    gp."userId" AS user_id,
    COUNT(*)::INT AS rated_games,
    MAX(g."endedAt") AS last_rated_at
  FROM "GamePlayer" gp
  JOIN "Game" g ON g.id = gp."gameId"
  WHERE
    gp."userId" IS NOT NULL
    AND g.status = 'FINISHED'
    AND g.rated = TRUE
    AND g."timeCategory" = 'BULLET'
  GROUP BY gp."userId"
),
bullet_init AS (
  SELECT
    u.id,
    COALESCE(bs.rated_games, 0) AS rated_games,
    bs.last_rated_at
  FROM "User" u
  LEFT JOIN bullet_stats bs ON bs.user_id = u.id
)
UPDATE "User" u
SET
  "ratingBullet" = CASE
    WHEN bi.rated_games = 0 AND u."ratingBullet" = 1200 THEN 1500
    ELSE u."ratingBullet"
  END,
  "ratingBulletDeviation" = CASE
    WHEN u."ratingBulletLastRatedAt" IS NOT NULL THEN u."ratingBulletDeviation"
    WHEN bi.rated_games = 0 THEN 250
    WHEN bi.rated_games <= 2 THEN 220
    WHEN bi.rated_games <= 7 THEN 170
    WHEN bi.rated_games <= 19 THEN 110
    ELSE 75
  END,
  "ratingBulletVolatility" = CASE
    WHEN u."ratingBulletLastRatedAt" IS NOT NULL THEN u."ratingBulletVolatility"
    ELSE 0.06
  END,
  "ratingBulletLastRatedAt" = COALESCE(u."ratingBulletLastRatedAt", bi.last_rated_at)
FROM bullet_init bi
WHERE
  u.id = bi.id
  AND (
    u."ratingBulletLastRatedAt" IS NULL
    OR (bi.rated_games = 0 AND u."ratingBullet" = 1200)
  );

WITH blitz_stats AS (
  SELECT
    gp."userId" AS user_id,
    COUNT(*)::INT AS rated_games,
    MAX(g."endedAt") AS last_rated_at
  FROM "GamePlayer" gp
  JOIN "Game" g ON g.id = gp."gameId"
  WHERE
    gp."userId" IS NOT NULL
    AND g.status = 'FINISHED'
    AND g.rated = TRUE
    AND g."timeCategory" = 'BLITZ'
  GROUP BY gp."userId"
),
blitz_init AS (
  SELECT
    u.id,
    COALESCE(bs.rated_games, 0) AS rated_games,
    bs.last_rated_at
  FROM "User" u
  LEFT JOIN blitz_stats bs ON bs.user_id = u.id
)
UPDATE "User" u
SET
  "ratingBlitz" = CASE
    WHEN bi.rated_games = 0 AND u."ratingBlitz" = 1200 THEN 1500
    ELSE u."ratingBlitz"
  END,
  "ratingBlitzDeviation" = CASE
    WHEN u."ratingBlitzLastRatedAt" IS NOT NULL THEN u."ratingBlitzDeviation"
    WHEN bi.rated_games = 0 THEN 250
    WHEN bi.rated_games <= 2 THEN 220
    WHEN bi.rated_games <= 7 THEN 170
    WHEN bi.rated_games <= 19 THEN 110
    ELSE 75
  END,
  "ratingBlitzVolatility" = CASE
    WHEN u."ratingBlitzLastRatedAt" IS NOT NULL THEN u."ratingBlitzVolatility"
    ELSE 0.06
  END,
  "ratingBlitzLastRatedAt" = COALESCE(u."ratingBlitzLastRatedAt", bi.last_rated_at)
FROM blitz_init bi
WHERE
  u.id = bi.id
  AND (
    u."ratingBlitzLastRatedAt" IS NULL
    OR (bi.rated_games = 0 AND u."ratingBlitz" = 1200)
  );

WITH rapid_stats AS (
  SELECT
    gp."userId" AS user_id,
    COUNT(*)::INT AS rated_games,
    MAX(g."endedAt") AS last_rated_at
  FROM "GamePlayer" gp
  JOIN "Game" g ON g.id = gp."gameId"
  WHERE
    gp."userId" IS NOT NULL
    AND g.status = 'FINISHED'
    AND g.rated = TRUE
    AND g."timeCategory" = 'RAPID'
  GROUP BY gp."userId"
),
rapid_init AS (
  SELECT
    u.id,
    COALESCE(rs.rated_games, 0) AS rated_games,
    rs.last_rated_at
  FROM "User" u
  LEFT JOIN rapid_stats rs ON rs.user_id = u.id
)
UPDATE "User" u
SET
  "ratingRapid" = CASE
    WHEN ri.rated_games = 0 AND u."ratingRapid" = 1200 THEN 1500
    ELSE u."ratingRapid"
  END,
  "ratingRapidDeviation" = CASE
    WHEN u."ratingRapidLastRatedAt" IS NOT NULL THEN u."ratingRapidDeviation"
    WHEN ri.rated_games = 0 THEN 250
    WHEN ri.rated_games <= 2 THEN 220
    WHEN ri.rated_games <= 7 THEN 170
    WHEN ri.rated_games <= 19 THEN 110
    ELSE 75
  END,
  "ratingRapidVolatility" = CASE
    WHEN u."ratingRapidLastRatedAt" IS NOT NULL THEN u."ratingRapidVolatility"
    ELSE 0.06
  END,
  "ratingRapidLastRatedAt" = COALESCE(u."ratingRapidLastRatedAt", ri.last_rated_at)
FROM rapid_init ri
WHERE
  u.id = ri.id
  AND (
    u."ratingRapidLastRatedAt" IS NULL
    OR (ri.rated_games = 0 AND u."ratingRapid" = 1200)
  );
