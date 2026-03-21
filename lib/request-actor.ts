import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ModerationStatus } from "@prisma/client";

const DEFAULT_DEMO_EMAIL = "demo@grandmate.local";
const DEFAULT_DEMO_NAME = "Anonymous";

export type RequestActor = {
  id: string;
  email: string;
  name: string;
  username: string | null;
  moderationStatus: ModerationStatus;
  isDemo: boolean;
  actorType: "user" | "guest";
};

function isDevBypassEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
}

function sanitizeEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return null;
  }

  return normalized.slice(0, 120);
}

function sanitizeName(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 40);
}

function getQueryParam(request: Request, key: string) {
  return new URL(request.url).searchParams.get(key);
}

function sanitizeDemoId(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 24);
}

function buildUsername(name: string, suffix?: string | null) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .concat(suffix ? `-${suffix}` : "")
    .slice(0, 24);
}

async function getDemoActor(request: Request): Promise<RequestActor | null> {
  if (!isDevBypassEnabled()) {
    return null;
  }

  const demoId =
    sanitizeDemoId(request.headers.get("x-demo-id")) ??
    sanitizeDemoId(getQueryParam(request, "demoId"));
  const email =
    (demoId ? `guest-${demoId}@grandmate.local` : null) ??
    sanitizeEmail(request.headers.get("x-demo-email")) ??
    sanitizeEmail(getQueryParam(request, "demoEmail")) ??
    sanitizeEmail(process.env.DEV_DEMO_USER_EMAIL ?? null) ??
    DEFAULT_DEMO_EMAIL;
  const name =
    sanitizeName(request.headers.get("x-demo-name")) ??
    sanitizeName(getQueryParam(request, "demoName")) ??
    sanitizeName(process.env.DEV_DEMO_USER_NAME ?? null) ??
    DEFAULT_DEMO_NAME;

  const key = `guest:${demoId ?? email}`;
  const guest = await db.guestIdentity.upsert({
    where: {
      key
    },
    update: {
      name,
      email
    },
    create: {
      key,
      name,
      email
    }
  });

  return {
    id: guest.id,
    email: guest.email ?? email,
    name: guest.name,
    username: buildUsername(name, demoId),
    moderationStatus: ModerationStatus.CLEAN,
    isDemo: true,
    actorType: "guest"
  };
}

export async function getRequestActor(request: Request): Promise<RequestActor | null> {
  const session = await auth.api.getSession({
    headers: request.headers
  });

  if (session?.user) {
    const user = await db.user.findUnique({
      where: {
        id: session.user.id
      },
      select: {
        moderationStatus: true
      }
    });

    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.displayName ?? session.user.name,
      username: session.user.username ?? null,
      moderationStatus: user?.moderationStatus ?? ModerationStatus.CLEAN,
      isDemo: false,
      actorType: "user"
    };
  }

  const demoActor = await getDemoActor(request);
  if (demoActor) {
    return demoActor;
  }

  return null;
}
