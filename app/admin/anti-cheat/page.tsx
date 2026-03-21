import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  formatAdminDateTime,
  formatAdminSeverity,
  normalizeAdminPeriod
} from "@/components/admin/admin-primitives";
import { canAccessAdmin, getAdminDashboardData, getAdminEmailHint } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminAntiCheatPage({
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
        <div className="panel-kicker">Anti-cheat</div>
        <h1 className="panel-title">Suspicious review stream</h1>
        <p className="panel-copy">Latest review signals and repeated-pair patterns.</p>
      </section>

      <section className="admin-list-panel admin-surface-panel">
        <div className="panel-kicker">Reviewed games</div>
        <h2 className="feature-title admin-panel-title">Recent suspicious reviews</h2>
        {data.suspiciousGames.length ? (
          <div className="admin-table">
            <div className="admin-table-head admin-table-head-signals">
              <span>Game</span>
              <span>Severity</span>
              <span>Generated</span>
              <span>Open</span>
            </div>
            {data.suspiciousGames.map((game) => (
              <article className="admin-table-row admin-table-row-signals" key={`${game.id}-${game.generatedAt}`}>
                <div className="admin-cell-primary">
                  <strong>
                    {game.players.white} vs {game.players.black}
                  </strong>
                  <span>
                    {game.format} {game.control} • {game.rated ? "Rated" : "Casual"}
                  </span>
                  <span>{game.summary}</span>
                </div>
                <span className={`admin-risk-inline ${game.severity}`}>
                  {formatAdminSeverity(game.severity)} {game.riskScore}
                </span>
                <span>{formatAdminDateTime(game.generatedAt)}</span>
                <div className="admin-action-row">
                  <Link className="pill admin-inline-link" href={`/admin/games/${game.id}`}>
                    Open game
                  </Link>
                  {game.primaryPlayerId ? (
                    <Link className="pill admin-inline-link" href={`/admin/users/${game.primaryPlayerId}`}>
                      Review {game.primaryPlayerName}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No games have crossed the anti-cheat watch threshold yet.</p>
        )}
      </section>

      <section className="admin-list-panel admin-surface-panel">
        <div className="panel-kicker">Patterns</div>
        <h2 className="feature-title admin-panel-title">Repeated pairs and fast rematches</h2>
        {data.pairPatterns.length ? (
          <div className="admin-table">
            <div className="admin-table-head admin-table-head-pairs">
              <span>Pair</span>
              <span>Games</span>
              <span>Risk</span>
              <span>Open</span>
            </div>
            {data.pairPatterns.map((pair) => (
              <article className="admin-table-row admin-table-row-pairs" key={`${pair.leftUserId}-${pair.rightUserId}`}>
                <div className="admin-cell-primary">
                  <strong>
                    {pair.leftName} vs {pair.rightName}
                  </strong>
                  <span>{pair.summary}</span>
                </div>
                <span>{pair.totalGames} total • {pair.ratedGames} rated • {pair.fastRematches} rematches</span>
                <span className="admin-risk-inline watch">Risk {pair.riskScore}</span>
                <div className="admin-action-row">
                  <Link
                    className="pill admin-inline-link"
                    href={`/admin/head-to-head/${pair.leftUserId}/${pair.rightUserId}`}
                  >
                    Open pair
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No repeated or suspicious pair pattern crossed the current threshold.</p>
        )}
      </section>
    </div>
  );
}
