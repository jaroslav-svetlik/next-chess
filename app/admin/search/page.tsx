import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  formatAdminDateTime,
  formatAdminResultLabel,
  normalizeAdminPeriod
} from "@/components/admin/admin-primitives";
import {
  canAccessAdmin,
  getAdminDashboardData,
  getAdminEmailHint,
  getAdminSearchData
} from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminSearchPage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string | string[]; q?: string | string[] }>;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAdmin(session.user.email)) {
    return <AdminAccessRestricted hint={getAdminEmailHint()} />;
  }

  const resolved = searchParams ? await searchParams : undefined;
  const period = normalizeAdminPeriod(resolved?.period);
  const rawQuery = Array.isArray(resolved?.q) ? resolved?.q[0] : resolved?.q;
  const query = rawQuery?.trim() ?? "";
  const [dashboard, search] = await Promise.all([
    getAdminDashboardData(period),
    getAdminSearchData(query)
  ]);

  return (
    <div className="admin-surface">
      <section className="admin-header-panel admin-surface-panel admin-toolbar-panel">
        <div className="panel-kicker">Search</div>
        <h1 className="panel-title">Admin search</h1>
        <p className="panel-copy">Direct lookup for accounts, games and invite codes.</p>
        <div className="detail-stack admin-toolbar-actions">
          <span className="pill">Signed in as {session.user.email}</span>
          <Link
            className="pill admin-inline-link"
            href={`/api/admin/export/moderation?type=flagged_accounts&period=${dashboard.selectedPeriodDays}`}
          >
            Export flagged CSV
          </Link>
          <Link
            className="pill admin-inline-link"
            href={`/api/admin/export/moderation?type=outcomes&period=${dashboard.selectedPeriodDays}`}
          >
            Export outcomes CSV
          </Link>
        </div>
        <form action="/admin/search" className="admin-search-form" method="get">
          <input name="period" type="hidden" value={String(dashboard.selectedPeriodDays)} />
          <label className="admin-form-field">
            <span className="admin-form-label">Search users or games</span>
            <div className="admin-search-row">
              <input
                className="admin-input"
                defaultValue={query}
                name="q"
                placeholder="Email, name, user ID, game ID, invite code or result"
                type="search"
              />
              <button className="secondary-button" type="submit">
                Search
              </button>
              {query ? (
                <Link className="secondary-button" href={`/admin/search?period=${dashboard.selectedPeriodDays}`}>
                  Clear
                </Link>
              ) : null}
            </div>
          </label>
        </form>
      </section>

      {!search ? (
        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Ready</div>
          <h2 className="feature-title admin-panel-title">No query yet</h2>
          <p className="notice">Start with an email, name, game ID or invite code.</p>
        </section>
      ) : (
        <section className="admin-grid admin-grid-two">
          <section className="admin-list-panel admin-surface-panel">
            <div className="panel-kicker">Users</div>
            <h2 className="feature-title admin-panel-title">Matches for “{search.query}”</h2>
            {search.users.length ? (
              <div className="admin-table">
                <div className="admin-table-head admin-table-head-users">
                  <span>Account</span>
                  <span>Status</span>
                  <span>Ratings</span>
                  <span>Created</span>
                </div>
                {search.users.map((user) => (
                  <Link className="admin-table-row admin-table-row-users" href={`/admin/users/${user.id}`} key={user.id}>
                    <div className="admin-cell-primary">
                      <strong>{user.name}</strong>
                      <span>{user.email ?? "No email"}</span>
                    </div>
                    <span>{user.moderationStatus}</span>
                    <span>B {user.ratings.bullet} • Z {user.ratings.blitz} • R {user.ratings.rapid}</span>
                    <span>{formatAdminDateTime(user.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="notice">No user matched that query.</p>
            )}
          </section>

          <section className="admin-list-panel admin-surface-panel">
            <div className="panel-kicker">Games</div>
            <h2 className="feature-title admin-panel-title">Game matches</h2>
            {search.games.length ? (
              <div className="admin-table">
                <div className="admin-table-head admin-table-head-games">
                  <span>Game</span>
                  <span>Status</span>
                  <span>Result</span>
                  <span>Open</span>
                </div>
                {search.games.map((game) => (
                  <div className="admin-table-row admin-table-row-games" key={game.id}>
                    <div className="admin-cell-primary">
                      <strong>
                        {game.players.white} vs {game.players.black}
                      </strong>
                      <span>
                        {game.format} {game.control} • {game.rated ? "Rated" : "Casual"}
                      </span>
                    </div>
                    <span>{game.status}</span>
                    <span>{formatAdminResultLabel(game.result)}</span>
                    <span>
                      <Link className="admin-inline-link" href={`/admin/games/${game.id}`}>
                        Open
                      </Link>
                      {game.inviteCode ? ` • ${game.inviteCode}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="notice">No game matched that query.</p>
            )}
          </section>
        </section>
      )}
    </div>
  );
}
