import { NextResponse } from "next/server";

import { canAccessAdmin } from "@/lib/admin";
import { publishArenaChatRealtime } from "@/lib/arena-chat-realtime";
import {
  getArenaChatGuestPostingEnabled,
  updateArenaChatGuestPostingEnabled
} from "@/lib/site-settings";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session?.user?.email || !canAccessAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  return NextResponse.json({
    enabled: await getArenaChatGuestPostingEnabled()
  });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.email || !canAccessAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;

  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json({ error: "Boolean enabled flag is required." }, { status: 400 });
  }

  const setting = await updateArenaChatGuestPostingEnabled(body.enabled);

  await publishArenaChatRealtime({
    type: "arena_chat_settings",
    guestPostingEnabled: setting.value
  });

  return NextResponse.json({
    enabled: setting.value,
    updatedAt: setting.updatedAt
  });
}
