import { Prisma } from "@prisma/client";

import { db } from "./db.ts";
import { logError, logInfo, logWarn } from "./observability.ts";

export const BACKGROUND_JOB_TYPES = {
  gameDeadline: "game_deadline",
  engineReview: "engine_review",
  waitingRoomExpiry: "waiting_room_expiry"
} as const;

export type BackgroundJobType =
  (typeof BACKGROUND_JOB_TYPES)[keyof typeof BACKGROUND_JOB_TYPES];

export type ScheduleBackgroundJobInput = {
  type: BackgroundJobType;
  key: string;
  payload?: Prisma.InputJsonValue;
  runAt: Date;
  maxAttempts?: number;
};

export type BackgroundJobRecord = {
  id: string;
  type: string;
  key: string | null;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  payload: Prisma.JsonValue | null;
  runAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function scheduleBackgroundJob(input: ScheduleBackgroundJobInput) {
  const jobId = crypto.randomUUID().replace(/-/g, "");
  const jobRows = await db.$queryRaw<BackgroundJobRecord[]>`
    INSERT INTO "BackgroundJob" (
      "id",
      "type",
      "key",
      "status",
      "payload",
      "runAt",
      "maxAttempts",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${jobId},
      ${input.type},
      ${input.key},
      'PENDING',
      ${input.payload ? JSON.stringify(input.payload) : null}::jsonb,
      ${input.runAt},
      ${input.maxAttempts ?? 5},
      NOW(),
      NOW()
    )
    ON CONFLICT ("key") DO UPDATE SET
      "type" = EXCLUDED."type",
      "status" = 'PENDING',
      "payload" = EXCLUDED."payload",
      "runAt" = EXCLUDED."runAt",
      "maxAttempts" = EXCLUDED."maxAttempts",
      "startedAt" = NULL,
      "finishedAt" = NULL,
      "lastError" = NULL,
      "updatedAt" = NOW()
    RETURNING *
  `;
  const job = jobRows[0];

  logInfo("jobs.scheduled", {
    jobId: job.id,
    type: job.type,
    key: job.key,
    runAt: job.runAt.toISOString()
  });

  return job;
}

export async function cancelBackgroundJob(key: string) {
  const result = await db.$executeRaw`
    UPDATE "BackgroundJob"
    SET
      "status" = 'CANCELLED',
      "finishedAt" = NOW(),
      "lastError" = NULL,
      "updatedAt" = NOW()
    WHERE "key" = ${key}
      AND "status" IN ('PENDING', 'RUNNING')
  `;

  if (result) {
    logInfo("jobs.cancelled", {
      key,
      count: result
    });
  }

  return result;
}

export async function claimNextBackgroundJob(): Promise<BackgroundJobRecord | null> {
  const claimed = await db.$queryRaw<BackgroundJobRecord[]>`
    UPDATE "BackgroundJob"
    SET
      "status" = 'RUNNING',
      "startedAt" = NOW(),
      "attempts" = "attempts" + 1,
      "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id"
      FROM "BackgroundJob"
      WHERE "status" = 'PENDING'
        AND "runAt" <= NOW()
      ORDER BY "runAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `;

  const job = claimed[0] ?? null;

  if (job) {
    logInfo("jobs.claimed", {
      jobId: job.id,
      type: job.type,
      key: job.key,
      attempts: job.attempts
    });
  }

  return job;
}

export async function markBackgroundJobCompleted(jobId: string) {
  await db.$executeRaw`
    UPDATE "BackgroundJob"
    SET
      "status" = 'COMPLETED',
      "finishedAt" = NOW(),
      "lastError" = NULL,
      "updatedAt" = NOW()
    WHERE "id" = ${jobId}
  `;

  logInfo("jobs.completed", {
    jobId
  });
}

export async function rescheduleRunningJob(jobId: string, runAt: Date, reason: string) {
  await db.$executeRaw`
    UPDATE "BackgroundJob"
    SET
      "status" = 'PENDING',
      "runAt" = ${runAt},
      "startedAt" = NULL,
      "finishedAt" = NULL,
      "lastError" = ${reason},
      "updatedAt" = NOW()
    WHERE "id" = ${jobId}
  `;

  logInfo("jobs.rescheduled", {
    jobId,
    runAt: runAt.toISOString(),
    reason
  });
}

export async function markBackgroundJobFailed(job: Pick<BackgroundJobRecord, "id" | "attempts" | "maxAttempts" | "type" | "key">, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown background job failure.";
  const shouldRetry = job.attempts < job.maxAttempts;

  if (shouldRetry) {
    await db.$executeRaw`
      UPDATE "BackgroundJob"
      SET
        "status" = 'PENDING',
        "startedAt" = NULL,
        "finishedAt" = NULL,
        "lastError" = ${message},
        "runAt" = ${new Date(Date.now() + Math.min(job.attempts, 5) * 5_000 + 5_000)},
        "updatedAt" = NOW()
      WHERE "id" = ${job.id}
    `;
  } else {
    await db.$executeRaw`
      UPDATE "BackgroundJob"
      SET
        "status" = 'FAILED',
        "finishedAt" = NOW(),
        "lastError" = ${message},
        "updatedAt" = NOW()
      WHERE "id" = ${job.id}
    `;
  }

  if (shouldRetry) {
    logWarn("jobs.retry_scheduled", {
      jobId: job.id,
      type: job.type,
      key: job.key,
      attempts: job.attempts,
      message
    });
    return;
  }

  logError("jobs.failed", {
    jobId: job.id,
    type: job.type,
    key: job.key,
    attempts: job.attempts,
    message
  });
}

export function getGameDeadlineJobKey(gameId: string) {
  return `game-deadline:${gameId}`;
}

export function getEngineReviewJobKey(gameId: string) {
  return `engine-review:${gameId}`;
}

export function getWaitingRoomJobKey(gameId: string) {
  return `waiting-room:${gameId}`;
}
