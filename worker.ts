import "dotenv/config";

import {
  BACKGROUND_JOB_TYPES,
  claimNextBackgroundJob,
  markBackgroundJobCompleted,
  markBackgroundJobFailed,
  rescheduleRunningJob,
  type BackgroundJobRecord
} from "./lib/background-jobs.ts";
import { runEngineReview } from "./lib/engine-analysis.ts";
import { runWaitingRoomExpiryJob } from "./lib/games.ts";
import { runGameDeadlineJob } from "./lib/game-deadline.ts";
import { logError, logInfo } from "./lib/observability.ts";

type JobPayload = {
  gameId?: string;
  expectedTurnStartedAt?: string | null;
};

function parsePayload(job: BackgroundJobRecord): JobPayload {
  if (!job.payload || typeof job.payload !== "object" || Array.isArray(job.payload)) {
    return {};
  }

  const payload = job.payload as Record<string, unknown>;

  return {
    gameId: typeof payload.gameId === "string" ? payload.gameId : undefined,
    expectedTurnStartedAt:
      typeof payload.expectedTurnStartedAt === "string" || payload.expectedTurnStartedAt === null
        ? (payload.expectedTurnStartedAt as string | null)
        : undefined
  };
}

async function executeJob(job: BackgroundJobRecord) {
  const payload = parsePayload(job);

  if (!payload.gameId) {
    throw new Error("Background job payload is missing gameId.");
  }

  if (job.type === BACKGROUND_JOB_TYPES.gameDeadline) {
    const outcome = await runGameDeadlineJob(payload.gameId, payload.expectedTurnStartedAt);

    if (outcome.status === "reschedule") {
      await rescheduleRunningJob(job.id, outcome.runAt, outcome.reason);
      return;
    }

    await markBackgroundJobCompleted(job.id);
    return;
  }

  if (job.type === BACKGROUND_JOB_TYPES.engineReview) {
    await runEngineReview(payload.gameId);
    await markBackgroundJobCompleted(job.id);
    return;
  }

  if (job.type === BACKGROUND_JOB_TYPES.waitingRoomExpiry) {
    const outcome = await runWaitingRoomExpiryJob(payload.gameId);

    if (outcome.status === "reschedule") {
      await rescheduleRunningJob(job.id, outcome.runAt, outcome.reason);
      return;
    }

    await markBackgroundJobCompleted(job.id);
    return;
  }

  throw new Error(`Unsupported background job type: ${job.type}`);
}

async function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runLoop() {
  logInfo("worker.started", {
    pid: process.pid
  });

  while (true) {
    const job = await claimNextBackgroundJob();

    if (!job) {
      await sleep(900);
      continue;
    }

    try {
      await executeJob(job);
    } catch (error) {
      await markBackgroundJobFailed(job, error);
    }
  }
}

process.on("SIGINT", () => {
  logInfo("worker.stopped", {
    signal: "SIGINT"
  });
  process.exit(0);
});

process.on("SIGTERM", () => {
  logInfo("worker.stopped", {
    signal: "SIGTERM"
  });
  process.exit(0);
});

void runLoop().catch((error) => {
  logError("worker.crashed", {
    message: error instanceof Error ? error.message : "Unknown worker crash."
  });
  process.exit(1);
});
