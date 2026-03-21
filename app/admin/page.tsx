import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  AdminStatCard
} from "@/components/admin/admin-primitives";
import { GuestChatControls } from "@/components/admin/guest-chat-controls";
import { canAccessAdmin, getAdminDashboardData, getAdminEmailHint } from "@/lib/admin";
import { getArenaChatGuestPostingEnabled } from "@/lib/site-settings";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function OverviewTrend({ data }: { data: Awaited<ReturnType<typeof getAdminDashboardData>>["trend"] }) {
  return (
    <section className="admin-list-panel admin-surface-panel">
      <div className="panel-kicker">Trend</div>
      <h2 className="feature-title admin-panel-title">Registrations vs finished</h2>
      <div className="admin-trend-list">
        {data.map((entry) => (
          <div className="admin-trend-row" key={entry.day}>
            <strong>{entry.day}</strong>
            <div className="admin-trend-bars">
              <div className="admin-trend-bar-shell">
                <span className="admin-trend-label">Users</span>
                <div className="admin-trend-bar">
                  <span style={{ width: `${Math.min(100, entry.users * 12)}%` }} />
                </div>
                <span className="admin-trend-value">{entry.users}</span>
              </div>
              <div className="admin-trend-bar-shell">
                <span className="admin-trend-label">Finished</span>
                <div className="admin-trend-bar games">
                  <span style={{ width: `${Math.min(100, entry.finishedGames * 8)}%` }} />
                </div>
                <span className="admin-trend-value">{entry.finishedGames}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAdmin(session.user.email)) {
    return <AdminAccessRestricted hint={getAdminEmailHint()} />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawPeriod = Array.isArray(resolvedSearchParams?.period)
    ? resolvedSearchParams?.period[0]
    : resolvedSearchParams?.period;
  const periodDays = rawPeriod === "7" || rawPeriod === "90" ? Number(rawPeriod) : 30;
  const data = await getAdminDashboardData(periodDays);
  const guestChatEnabled = await getArenaChatGuestPostingEnabled();

  return (
    <div className="admin-surface">
      <section className="admin-header-panel admin-surface-panel admin-toolbar-panel">
        <div className="panel-kicker">Overview</div>
        <h1 className="panel-title">Admin overview</h1>
        <p className="panel-copy">Platform health, queue pressure and growth at a glance.</p>
        <div className="detail-stack admin-toolbar-actions">
          <span className="pill">Signed in as {session.user.email}</span>
          {[7, 30, 90].map((period) => (
            <Link
              className={`pill admin-inline-link admin-period-pill ${
                data.selectedPeriodDays === period ? "is-active" : ""
              }`}
              href={`/admin?period=${period}`}
              key={period}
            >
              {period}d
            </Link>
          ))}
        </div>
      </section>

      <section className="stats-strip admin-stats-strip">
        <AdminStatCard label="Users" meta="Registered accounts" value={data.overview.totalUsers} />
        <AdminStatCard label="Active games" meta="Currently in progress" value={data.overview.activeGames} />
        <AdminStatCard label="Waiting games" meta="Open tables and queue rooms" value={data.overview.waitingGames} />
        <AdminStatCard label={`Finished (${data.selectedPeriodDays}d)`} meta="Completed games" value={data.overview.finishedGamesWindow} />
      </section>

      <section className="admin-grid admin-grid-two">
        <OverviewTrend data={data.trend} />

        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Shortcuts</div>
          <h2 className="feature-title admin-panel-title">Workspaces</h2>
          <div className="admin-simple-list">
            <Link className="admin-simple-row admin-panel-link" href="/admin/search">
              <strong>Search</strong>
              <span>Accounts, games, invite codes</span>
            </Link>
            <Link className="admin-simple-row admin-panel-link" href="/admin/competitive">
              <strong>Competitive</strong>
              <span>Leaderboards and format mix</span>
            </Link>
            <Link className="admin-simple-row admin-panel-link" href="/admin/moderation">
              <strong>Moderation</strong>
              <span>Priority queue and outcomes</span>
            </Link>
            <Link className="admin-simple-row admin-panel-link" href="/admin/anti-cheat">
              <strong>Anti-cheat</strong>
              <span>Signals and repeated pairs</span>
            </Link>
            <Link className="admin-simple-row admin-panel-link" href="/admin/activity">
              <strong>Activity</strong>
              <span>Recent games and moderator actions</span>
            </Link>
          </div>
        </section>
      </section>

      <section className="admin-grid admin-grid-two">
        <GuestChatControls initialEnabled={guestChatEnabled} />
        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Policy</div>
          <h2 className="feature-title admin-panel-title">Anonymous access</h2>
          <div className="admin-simple-list">
            <div className="admin-simple-row">
              <strong>Guest matchmaking</strong>
              <span>Enabled in production through `GuestIdentity` guest sessions.</span>
            </div>
            <div className="admin-simple-row">
              <strong>Guest arena chat</strong>
              <span>
                Keep this enabled during alpha for easier onboarding, then lock it down when moderation pressure rises.
              </span>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
