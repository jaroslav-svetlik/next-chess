import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  formatAdminDateTime,
  formatAdminResultLabel,
  formatModerationEventLabel,
  normalizeAdminPeriod
} from "@/components/admin/admin-primitives";
import { canAccessAdmin, getAdminDashboardData, getAdminEmailHint } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage({
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

  const resolved = searchParams ? await searchParams : undefined;
  const data = await getAdminDashboardData(normalizeAdminPeriod(resolved?.period));

  return (
    <div className="admin-surface">
      <section className="admin-header-panel admin-surface-panel">
        <div className="panel-kicker">Activity</div>
        <h1 className="panel-title">Recent operations</h1>
        <p className="panel-copy">Finished games and moderator actions in chronological order.</p>
      </section>

      <section className="admin-list-panel admin-surface-panel">
        <div className="panel-kicker">Games</div>
        <h2 className="feature-title admin-panel-title">Recent finished games</h2>
        <div className="admin-table">
          <div className="admin-games-head">
            <span>Players</span>
            <span>Format</span>
            <span>Mode</span>
            <span>Result</span>
            <span>Ended</span>
          </div>
          {data.recentFinishedGames.map((game) => (
            <div className="admin-games-row" key={game.id}>
              <span>
                <strong>{game.players.white}</strong> vs <strong>{game.players.black}</strong>
              </span>
              <span>
                {game.format} {game.control}
              </span>
              <span>{game.rated ? "Rated" : "Casual"}</span>
              <span>{formatAdminResultLabel(game.result)}</span>
              <span>
                <Link className="admin-inline-link" href={`/admin/games/${game.id}`}>
                  {formatAdminDateTime(game.endedAt)}
                </Link>
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-list-panel admin-surface-panel">
        <div className="panel-kicker">Moderator actions</div>
        <h2 className="feature-title admin-panel-title">Recent outcomes</h2>
        {data.recentModerationOutcomes.length ? (
          <div className="admin-table">
            <div className="admin-table-head admin-table-head-outcomes">
              <span>Action</span>
              <span>Transition</span>
              <span>By</span>
              <span>When</span>
              <span>Open</span>
            </div>
            {data.recentModerationOutcomes.map((event) => (
              <article className="admin-table-row admin-table-row-outcomes" key={event.id}>
                <div className="admin-cell-primary">
                  <strong>{formatModerationEventLabel(event.type)}</strong>
                  <span>
                    {event.userName} • {event.userEmail ?? "No email"}
                  </span>
                  {event.note ? <span>{event.note}</span> : null}
                </div>
                <span>
                  {event.fromStatus ?? "n/a"} → {event.toStatus ?? "n/a"}
                </span>
                <span>{event.createdByEmail}</span>
                <span>{formatAdminDateTime(event.createdAt)}</span>
                <div className="admin-action-row">
                  <Link className="pill admin-inline-link" href={`/admin/users/${event.userId}`}>
                    Open profile
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No moderator outcomes have been recorded yet.</p>
        )}
      </section>
    </div>
  );
}
