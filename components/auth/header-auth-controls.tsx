"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { authClient } from "@/lib/auth-client";

const GITHUB_REPO_URL = "https://github.com/jaroslav-svetlik/next-chess";

type NavLinkItem = {
  href: Route;
  label: string;
  description: string;
};

const sharedLinks: NavLinkItem[] = [
  {
    href: "/",
    label: "Home",
    description: "Arena overview and featured play"
  },
  {
    href: "/lobby",
    label: "Lobby",
    description: "Open games, quick pair and invites"
  },
  {
    href: "/leaderboard",
    label: "Leaderboard",
    description: "Public bullet, blitz and rapid ladders"
  }
];

function buildInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "GM";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function isRouteActive(pathname: string, href: Route) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function UserAvatar({
  name,
  initials,
  src,
  large = false
}: {
  name: string;
  initials: string;
  src?: string | null;
  large?: boolean;
}) {
  const [hasImageError, setHasImageError] = useState(false);
  const avatarClassName = `nav-avatar${large ? " nav-avatar-large" : ""}${src && !hasImageError ? " has-image" : ""}`;

  return (
    <span className={avatarClassName}>
      {src && !hasImageError ? (
        <img
          alt={`${name} avatar`}
          className="nav-avatar-image"
          onError={() => setHasImageError(true)}
          src={src}
        />
      ) : (
        initials
      )}
    </span>
  );
}

function GitHubMark() {
  return (
    <svg
      aria-hidden="true"
      className="nav-button-icon"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.5 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.9 1.57 2.36 1.12 2.94.86.09-.67.35-1.12.63-1.38-2.22-.26-4.56-1.15-4.56-5.1 0-1.13.39-2.05 1.03-2.77-.1-.26-.45-1.31.1-2.72 0 0 .84-.28 2.75 1.06A9.32 9.32 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.91-1.34 2.75-1.06 2.75-1.06.55 1.41.2 2.46.1 2.72.64.72 1.03 1.64 1.03 2.77 0 3.96-2.35 4.84-4.59 5.09.36.32.68.95.68 1.92 0 1.39-.01 2.51-.01 2.85 0 .28.18.61.69.5A10.25 10.25 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}

function GitHubButton({ className }: { className: string }) {
  return (
    <a
      className={className}
      href={GITHUB_REPO_URL}
      rel="noreferrer"
      target="_blank"
    >
      <GitHubMark />
      <span>GitHub</span>
    </a>
  );
}

export function HeaderAuthControls() {
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showPendingFallback, setShowPendingFallback] = useState(false);
  const { data: session, isPending } = authClient.useSession();

  const user = session?.user;
  const username = (user as { username?: string | null } | undefined)?.username ?? null;
  const displayName = user?.name?.trim() || "NextChess Player";
  const email = user?.email ?? null;
  const avatarSrc =
    ((user as { avatarUrl?: string | null; image?: string | null } | undefined)?.avatarUrl ??
      (user as { avatarUrl?: string | null; image?: string | null } | undefined)?.image) ||
    null;
  const initials = useMemo(() => buildInitials(displayName), [displayName]);
  const guestInitials = "GU";
  const profileHref = user?.id ? (`/players/${username ?? user.id}` as Route) : null;
  const navItems = useMemo(
    () =>
      sharedLinks.map((item) => ({
        ...item,
        isActive: isRouteActive(pathname, item.href)
      })),
    [pathname]
  );

  useEffect(() => {
    setIsDesktopMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isPending) {
      setShowPendingFallback(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setShowPendingFallback(true);
    }, 1500);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isPending]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsDesktopMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsDesktopMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  async function handleSignOut() {
    await authClient.signOut();
    setIsDesktopMenuOpen(false);
    setIsMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  if (isPending && !showPendingFallback) {
    return <div className="nav-session-shell muted">Checking session...</div>;
  }

  return (
    <div className="nav-shell" ref={containerRef}>
      <div className="nav-session-shell nav-session-shell-desktop">
        {user ? (
          <div className="nav-user-menu-shell">
            <button
              aria-expanded={isDesktopMenuOpen}
              aria-haspopup="menu"
              className="nav-user-menu-trigger nav-user-menu-trigger-header"
              onClick={() => setIsDesktopMenuOpen((value) => !value)}
              type="button"
            >
              <UserAvatar initials={initials} name={displayName} src={avatarSrc} />
              <span className="nav-user-meta">
                <strong>{displayName}</strong>
                <span>{email ?? "Ready to play"}</span>
              </span>
              <span className={`nav-menu-chevron${isDesktopMenuOpen ? " open" : ""}`} aria-hidden="true">
                ▾
              </span>
            </button>

            {isDesktopMenuOpen ? (
              <div className="nav-user-menu-dropdown" role="menu">
                <div className="nav-user-menu-summary">
                  <UserAvatar initials={initials} large name={displayName} src={avatarSrc} />
                  <div className="nav-user-menu-copy">
                    <strong>{displayName}</strong>
                    <span>{email ?? "Authenticated account"}</span>
                  </div>
                </div>

                <div className="nav-menu-links">
                  {profileHref ? (
                    <Link
                      aria-current={isRouteActive(pathname, profileHref) ? "page" : undefined}
                      className={`nav-menu-link${isRouteActive(pathname, profileHref) ? " active" : ""}`}
                      href={profileHref}
                      role="menuitem"
                    >
                      <span>My profile</span>
                      <small>Ratings, public profile and finished games</small>
                    </Link>
                  ) : null}

                  {navItems.map((item) => (
                    <Link
                      aria-current={item.isActive ? "page" : undefined}
                      className={`nav-menu-link${item.isActive ? " active" : ""}`}
                      href={item.href}
                      key={item.href}
                      role="menuitem"
                    >
                      <span>{item.label}</span>
                      <small>{item.description}</small>
                    </Link>
                  ))}
                </div>

                <div className="nav-menu-auth-actions">
                  <Link
                    className="secondary-button nav-menu-auth-button nav-menu-auth-button-secondary"
                    href="/lobby"
                    role="menuitem"
                  >
                    Play
                  </Link>
                  <GitHubButton className="secondary-button nav-menu-auth-button nav-menu-auth-button-secondary" />
                </div>

                <button
                  className="nav-menu-signout"
                  onClick={() => void handleSignOut()}
                  role="menuitem"
                  type="button"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="nav-desktop-auth-group">
            <Link className="secondary-button nav-header-login-button" href="/auth/login">
              Login
            </Link>
            <Link className="nav-cta nav-header-register-button nav-auth-cta" href="/auth/register">
              Register
            </Link>
          </div>
        )}
      </div>

      <button
        aria-expanded={isMobileMenuOpen}
        aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        className={`nav-mobile-toggle${isMobileMenuOpen ? " open" : ""}`}
        onClick={() => setIsMobileMenuOpen((value) => !value)}
        type="button"
      >
        <span />
        <span />
        <span />
      </button>

      {isMobileMenuOpen ? (
        <button className="nav-mobile-backdrop" onClick={() => setIsMobileMenuOpen(false)} type="button" />
      ) : null}

      {isMobileMenuOpen ? (
        <div className="nav-mobile-panel">
          {user ? (
            <div className="nav-mobile-account-card">
              <UserAvatar initials={initials} large name={displayName} src={avatarSrc} />
              <div className="nav-mobile-account-copy">
                <span className="nav-user-label">Signed in</span>
                <strong>{displayName}</strong>
                <span>{email ?? "Ready to play"}</span>
              </div>
            </div>
          ) : (
            <div className="nav-mobile-account-card guest">
              <UserAvatar initials={guestInitials} large name="Guest mode" />
              <div className="nav-mobile-account-copy">
                <span className="nav-user-label">Guest mode</span>
                <strong>Anonymous play</strong>
                <span>Create an account to keep ratings and history.</span>
              </div>
            </div>
          )}

          <div className="nav-mobile-links">
            {profileHref ? (
              <Link
                aria-current={isRouteActive(pathname, profileHref) ? "page" : undefined}
                className={`nav-mobile-link${isRouteActive(pathname, profileHref) ? " active" : ""}`}
                href={profileHref}
              >
                <span>My profile</span>
                <small>Ratings, public profile and finished games</small>
              </Link>
            ) : null}

            {navItems.map((item) => (
              <Link
                aria-current={item.isActive ? "page" : undefined}
                className={`nav-mobile-link${item.isActive ? " active" : ""}`}
                href={item.href}
                key={item.href}
              >
                <span>{item.label}</span>
                <small>{item.description}</small>
              </Link>
            ))}
          </div>

          <div className="nav-mobile-actions">
            <GitHubButton className="secondary-button" />

            {user ? (
              <>
                <Link href="/lobby" className="nav-cta nav-mobile-cta nav-auth-cta">
                  Play
                </Link>
                <button className="secondary-button danger-button" onClick={() => void handleSignOut()} type="button">
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="secondary-button">
                  Login
                </Link>
                <Link href="/auth/register" className="nav-cta nav-mobile-cta nav-auth-cta">
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
