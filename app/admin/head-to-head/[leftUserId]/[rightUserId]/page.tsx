import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  canAccessAdmin,
  getAdminEmailHint,
  getAdminHeadToHead
} from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatResult(result: string | null) {
  if (!result) {
    return "No result";
  }

  return result.replaceAll("_", " ");
}

export default async function AdminHeadToHeadPage({
  params
}: {
  params: Promise<{ leftUserId: string; rightUserId: string }>;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  const hasAccess = canAccessAdmin(session.user.email);
  if (!hasAccess) {
    return (
      <section className="admin-surface">
        <section className="glass-panel admin-header-panel">
          <div className="panel-kicker">Admin</div>
          <h1 className="panel-title">Access restricted</h1>
          <p className="panel-copy">
            This dashboard is only available to configured admin accounts.
          </p>
          <p className="notice">{getAdminEmailHint()}</p>
        </section>
      </section>
    );
  }

  const { leftUserId, rightUserId } = await params;
  const data = await getAdminHeadToHead(leftUserId, rightUserId);

  if (!data) {
    notFound();
  }

  return (
    <div className="admin-surface admin-user-page">
      <section className="glass-panel admin-header-panel">
        <div className="detail-stack">
          <Link className="pill admin-inline-link" href="/admin">
            Back to admin
          </Link>
          <span className="pill">Signed in as {session.user.email}</span>
        </div>
        <div className="panel-kicker">Head to head</div>
        <h1 className="panel-title">
          {data.leftPlayer.name} vs {data.rightPlayer.name}
        </h1>
        <p className="panel-copy">
          {data.leftPlayer.email ?? "No email"} • {data.rightPlayer.email ?? "No email"}
        </p>
        <div className="detail-stack">
          <Link className="pill admin-inline-link" href={`/admin/users/${data.leftPlayer.id}`}>
            Open {data.leftPlayer.name}
          </Link>
          <Link className="pill admin-inline-link" href={`/admin/users/${data.rightPlayer.id}`}>
            Open {data.rightPlayer.name}
          </Link>
        </div>
      </section>

      <section className="stats-strip admin-stats-strip admin-user-stats">
        <article className="stat-card">
          <div className="stat-value">{data.summary.totalGames}</div>
          <div className="stat-label">Games</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.summary.ratedGames}</div>
          <div className="stat-label">Rated</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">
            {data.summary.leftWins} - {data.summary.rightWins}
          </div>
          <div className="stat-label">Wins</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.summary.reviewedGames}</div>
          <div className="stat-label">Reviewed</div>
        </article>
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Timeline</div>
        <h2 className="feature-title admin-panel-title">Flag and moderation timeline</h2>
        {data.timeline.length ? (
          <div className="admin-reviewed-list">
            {data.timeline.map((event) => (
              <article className="admin-suspicious-card" key={event.id}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>{event.label}</strong>
                    <div className="muted">
                      {event.actorName} • {formatDateTime(event.createdAt)}
                    </div>
                  </div>
                  <span className="pill">
                    {event.type === "game_review" ? "Review" : "Outcome"}
                  </span>
                </div>
                <p className="muted admin-suspicious-summary">{event.summary}</p>
                <div className="detail-stack">
                  {event.gameId ? (
                    <Link className="pill admin-inline-link" href={`/admin/games/${event.gameId}`}>
                      Open game
                    </Link>
                  ) : null}
                  {event.actorUserId ? (
                    <Link className="pill admin-inline-link" href={`/admin/users/${event.actorUserId}`}>
                      Open user
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No review or moderation timeline exists for this account pair yet.</p>
        )}
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">History</div>
        <h2 className="feature-title admin-panel-title">Games between these accounts</h2>
        {data.games.length ? (
          <div className="admin-reviewed-list">
            {data.games.map((game) => (
              <article className="admin-suspicious-card" key={game.id}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>
                      {data.leftPlayer.name} ({game.leftColor ?? "n/a"}) vs {data.rightPlayer.name} ({game.rightColor ?? "n/a"})
                    </strong>
                    <div className="muted">
                      {game.format} {game.control} • {game.rated ? "Rated" : "Casual"} •{" "}
                      {formatResult(game.result)}
                    </div>
                  </div>
                  <div className="detail-stack">
                    <span className="pill">{game.status}</span>
                    {game.hasReview ? <span className="pill">Has review</span> : null}
                  </div>
                </div>
                <div className="detail-stack">
                  <span className="pill">Created {formatDateTime(game.createdAt)}</span>
                  <span className="pill">Ended {formatDateTime(game.endedAt)}</span>
                  <Link className="pill admin-inline-link" href={`/admin/games/${game.id}`}>
                    Open game
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">These two accounts have not faced each other yet.</p>
        )}
      </section>
    </div>
  );
}
