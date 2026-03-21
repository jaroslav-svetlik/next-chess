"use client";

import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AdminShellProps = {
  children: React.ReactNode;
};

type AdminNavItem = {
  href: string;
  label: string;
  shortLabel?: string;
  match: (pathname: string) => boolean;
};

type AdminNavGroup = {
  title: string;
  items: AdminNavItem[];
};

const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        href: "/admin",
        label: "Overview",
        shortLabel: "Home",
        match: (pathname) => pathname === "/admin"
      },
      {
        href: "/admin/search",
        label: "Search",
        shortLabel: "Search",
        match: (pathname) => pathname === "/admin/search"
      },
      {
        href: "/admin/competitive",
        label: "Competitive",
        shortLabel: "Ladder",
        match: (pathname) => pathname === "/admin/competitive"
      }
    ]
  },
  {
    title: "Trust & Safety",
    items: [
      {
        href: "/admin/moderation",
        label: "Moderation",
        shortLabel: "Cases",
        match: (pathname) => pathname === "/admin/moderation"
      },
      {
        href: "/admin/anti-cheat",
        label: "Anti-cheat",
        shortLabel: "Signals",
        match: (pathname) => pathname === "/admin/anti-cheat"
      },
      {
        href: "/admin/activity",
        label: "Activity",
        shortLabel: "Feed",
        match: (pathname) => pathname === "/admin/activity"
      }
    ]
  }
];

function getCurrentContext(pathname: string) {
  if (pathname === "/admin/search") {
    return {
      kicker: "Admin workspace",
      title: "Search",
      copy: "Direct lookup"
    };
  }

  if (pathname === "/admin/competitive") {
    return {
      kicker: "Admin workspace",
      title: "Competitive",
      copy: "Ratings and formats"
    };
  }

  if (pathname === "/admin/moderation") {
    return {
      kicker: "Trust & Safety",
      title: "Moderation",
      copy: "Queue and outcomes"
    };
  }

  if (pathname === "/admin/anti-cheat") {
    return {
      kicker: "Trust & Safety",
      title: "Anti-cheat",
      copy: "Review stream"
    };
  }

  if (pathname === "/admin/activity") {
    return {
      kicker: "Admin workspace",
      title: "Activity",
      copy: "Recent operations"
    };
  }

  if (pathname.startsWith("/admin/users/")) {
    return {
      kicker: "Explorer",
      title: "User detail",
      copy: "Account review"
    };
  }

  if (pathname.startsWith("/admin/games/")) {
    return {
      kicker: "Explorer",
      title: "Game detail",
      copy: "Game review"
    };
  }

  if (pathname.startsWith("/admin/head-to-head/")) {
    return {
      kicker: "Explorer",
      title: "Head to head",
      copy: "Pair review"
    };
  }

  return {
    kicker: "Workspace",
    title: "Overview",
    copy: "Core metrics"
  };
}

function getResolvedHref(pathname: string, item: AdminNavItem) {
  if (item.href === "/admin/users/demo") {
    return pathname.startsWith("/admin/users/") ? pathname : "/admin";
  }

  if (item.href === "/admin/games/demo") {
    return pathname.startsWith("/admin/games/") ? pathname : "/admin";
  }

  if (item.href === "/admin/head-to-head/demo/demo") {
    return pathname.startsWith("/admin/head-to-head/") ? pathname : "/admin";
  }

  return item.href;
}

export function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const context = getCurrentContext(pathname);
  const isExplorerRoute =
    pathname.startsWith("/admin/users/") ||
    pathname.startsWith("/admin/games/") ||
    pathname.startsWith("/admin/head-to-head/");

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-eyebrow">NextChess</span>
          <h1 className="admin-sidebar-title">Admin</h1>
          <p className="admin-sidebar-copy">Clean operational workspace.</p>
        </div>

        <nav className="admin-sidebar-nav" aria-label="Admin navigation">
          {ADMIN_NAV_GROUPS.map((group) => (
            <section className="admin-sidebar-group" key={group.title}>
              <h2 className="admin-sidebar-group-title">{group.title}</h2>
              <div className="admin-sidebar-links">
                {group.items.map((item) => {
                  const href = getResolvedHref(pathname, item) as Route;
                  const isActive = item.match(pathname);

                  return (
                    <Link
                      className={`admin-sidebar-link${isActive ? " is-active" : ""}`}
                      href={href}
                      key={`${group.title}-${item.label}`}
                    >
                      <strong>{item.shortLabel ?? item.label}</strong>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        {isExplorerRoute ? (
          <div className="admin-sidebar-context">
            <span className="admin-sidebar-context-kicker">{context.kicker}</span>
            <strong>{context.title}</strong>
            <span>{context.copy}</span>
          </div>
        ) : null}
      </aside>

      <div className="admin-main">
        <div className="admin-main-shell">{children}</div>
      </div>
    </div>
  );
}
