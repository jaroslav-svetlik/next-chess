import { ModerationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { applyUserModerationAction, canAccessAdmin } from "@/lib/admin";
import { getSession } from "@/lib/session";

function isModerationStatus(value: unknown): value is ModerationStatus {
  return (
    value === ModerationStatus.CLEAN ||
    value === ModerationStatus.OBSERVE ||
    value === ModerationStatus.WATCH ||
    value === ModerationStatus.REVIEW ||
    value === ModerationStatus.RESTRICTED
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const session = await getSession();

  if (!session?.user?.email || !canAccessAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const { userId } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | { action?: unknown; status?: unknown; note?: unknown }
    | null;

  const action =
    body?.action === "dismiss_recommendation" ||
    body?.action === "clear_account" ||
    body?.action === "mark_false_positive" ||
    body?.action === "confirm_cheat"
      ? body.action
      : "update";
  const status = isModerationStatus(body?.status) ? body.status : undefined;
  const note = typeof body?.note === "string" ? body.note : undefined;

  try {
    const result = await applyUserModerationAction({
      userId,
      adminEmail: session.user.email,
      action,
      status,
      note
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "MODERATION_ACTION_FAILED";

    if (message === "USER_NOT_FOUND") {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    if (message === "EMPTY_MODERATION_ACTION") {
      return NextResponse.json(
        { error: "Choose a new status or write a moderation note." },
        { status: 400 }
      );
    }

    if (message === "MISSING_RECOMMENDATION_STATUS") {
      return NextResponse.json(
        { error: "Recommendation dismissal requires a target recommended status." },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Moderation action failed." }, { status: 500 });
  }
}
