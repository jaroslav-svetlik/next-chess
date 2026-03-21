export type DemoIdentity = {
  id: string;
  name: string;
  email: string;
};

const ANONYMOUS_NAME = "Anonymous";

export const DEMO_IDENTITY_STORAGE_KEY = "grandmate-demo-identity";

function createDemoIdentity(): DemoIdentity {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);

  return {
    id,
    name: ANONYMOUS_NAME,
    email: `guest-${id}@grandmate.local`
  };
}

export const DEFAULT_DEMO_IDENTITY: DemoIdentity = {
  id: "anonymous",
  name: ANONYMOUS_NAME,
  email: "guest-anonymous@grandmate.local"
};

export function buildDemoHeaders(identity: DemoIdentity) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    headers["x-demo-id"] = identity.id;
    headers["x-demo-name"] = identity.name;
    headers["x-demo-email"] = identity.email;
  }

  return headers;
}

export function buildDemoQuery(identity: DemoIdentity) {
  const searchParams = new URLSearchParams();

  if (process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true") {
    searchParams.set("demoId", identity.id);
    searchParams.set("demoName", identity.name);
    searchParams.set("demoEmail", identity.email);
  }

  return searchParams.toString();
}

export function loadStoredDemoIdentity() {
  if (typeof window === "undefined") {
    return DEFAULT_DEMO_IDENTITY;
  }

  const storedValue = window.sessionStorage.getItem(DEMO_IDENTITY_STORAGE_KEY);
  if (!storedValue) {
    const nextIdentity = createDemoIdentity();
    window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
    return nextIdentity;
  }

  try {
    const parsed = JSON.parse(storedValue) as DemoIdentity;
    if (parsed.id && parsed.name && parsed.email) {
      return parsed;
    }
  } catch {
    window.sessionStorage.removeItem(DEMO_IDENTITY_STORAGE_KEY);
  }

  const nextIdentity = createDemoIdentity();
  window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
  return nextIdentity;
}
