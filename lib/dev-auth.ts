export type DemoIdentity = {
  id: string;
  name: string;
  email: string;
};

const ANONYMOUS_NAME = "Anonymous";

export const DEMO_IDENTITY_STORAGE_KEY = "nextchess-guest-identity";
const LEGACY_DEMO_IDENTITY_STORAGE_KEY = "grandmate-demo-identity";

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

  headers["x-guest-id"] = identity.id;
  headers["x-guest-name"] = identity.name;
  headers["x-guest-email"] = identity.email;

  return headers;
}

export function buildDemoQuery(identity: DemoIdentity) {
  const searchParams = new URLSearchParams();

  searchParams.set("guestId", identity.id);
  searchParams.set("guestName", identity.name);
  searchParams.set("guestEmail", identity.email);

  return searchParams.toString();
}

export function buildDemoUrl(path: string, identity: DemoIdentity) {
  const query = buildDemoQuery(identity);
  if (!query) {
    return path;
  }

  return `${path}${path.includes("?") ? "&" : "?"}${query}`;
}

export function loadStoredDemoIdentity() {
  if (typeof window === "undefined") {
    return DEFAULT_DEMO_IDENTITY;
  }

  const storedValue =
    window.sessionStorage.getItem(DEMO_IDENTITY_STORAGE_KEY) ??
    window.sessionStorage.getItem(LEGACY_DEMO_IDENTITY_STORAGE_KEY);
  if (!storedValue) {
    const nextIdentity = createDemoIdentity();
    window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
    return nextIdentity;
  }

  try {
    const parsed = JSON.parse(storedValue) as DemoIdentity;
    if (parsed.id && parsed.name && parsed.email) {
      window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(parsed));
      window.sessionStorage.removeItem(LEGACY_DEMO_IDENTITY_STORAGE_KEY);
      return parsed;
    }
  } catch {
    window.sessionStorage.removeItem(DEMO_IDENTITY_STORAGE_KEY);
    window.sessionStorage.removeItem(LEGACY_DEMO_IDENTITY_STORAGE_KEY);
  }

  const nextIdentity = createDemoIdentity();
  window.sessionStorage.setItem(DEMO_IDENTITY_STORAGE_KEY, JSON.stringify(nextIdentity));
  return nextIdentity;
}
