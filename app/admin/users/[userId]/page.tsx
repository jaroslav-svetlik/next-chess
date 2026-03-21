import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PlayerColor } from "@prisma/client";

import { ModerationControls } from "@/components/admin/moderation-controls";
import { canAccessAdmin, getAdminEmailHint, getAdminUserDetail } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

function formatSeverity(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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

function formatModerationEventTitle(type: string) {
  if (type === "status_updated") {
    return "Status updated";
  }

  if (type === "note_added") {
    return "Admin note";
  }

  if (type === "recommendation_dismissed") {
    return "Recommendation dismissed";
  }

  if (type === "system_auto_raised") {
    return "System auto-observe";
  }

  if (type === "account_cleared") {
    return "Account cleared";
  }

  if (type === "false_positive_marked") {
    return "False positive";
  }

  if (type === "cheat_confirmed") {
    return "Cheat confirmed";
  }

  return type.replaceAll("_", " ");
}

export default async function AdminUserDetailPage({
  params
}: {
  params: Promise<{ userId: string }>;
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

  const { userId } = await params;
  const data = await getAdminUserDetail(userId);

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
        <div className="panel-kicker">User moderation</div>
        <h1 className="panel-title">{data.user.name}</h1>
        <p className="panel-copy">
          {data.user.email} • joined {formatDateTime(data.user.createdAt)}
        </p>
        <div className="detail-stack">
          <span className={`admin-risk-badge ${data.profile.severity}`}>
            {formatSeverity(data.profile.severity)} {data.profile.riskScore}
          </span>
          <span className="pill">Moderation {data.user.moderationStatus}</span>
          <span className="pill">
            Recommended {data.profile.recommendation.status}
          </span>
          <span className="pill">{data.profile.reviewedGames} reviewed games</span>
          <span className="pill">{data.profile.flaggedGames} flagged games</span>
          <span className="pill">{data.profile.recentRatedGames} rated games</span>
        </div>
      </section>

      <section className="stats-strip admin-stats-strip admin-user-stats">
        <article className="stat-card">
          <div className="stat-value">{data.user.ratings.bullet}</div>
          <div className="stat-label">Bullet</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.user.ratings.blitz}</div>
          <div className="stat-label">Blitz</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.user.ratings.rapid}</div>
          <div className="stat-label">Rapid</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{formatDateTime(data.profile.lastFlaggedAt)}</div>
          <div className="stat-label">Last flagged</div>
        </article>
      </section>

      <section className="admin-grid admin-user-grid">
        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">Risk trend</div>
          <h2 className="feature-title admin-panel-title">Recent reviewed games</h2>
          {data.trend.length ? (
            <div className="admin-trend-list">
              {data.trend.map((entry) => (
                <div className="admin-trend-row" key={`${entry.gameId}-${entry.label}`}>
                  <strong>{entry.label}</strong>
                  <div className="admin-trend-bars">
                    <div className="admin-trend-bar-shell">
                      <span className="admin-trend-label">Risk</span>
                      <div className="admin-trend-bar admin-trend-bar-danger">
                        <span style={{ width: `${Math.min(100, entry.riskScore)}%` }} />
                      </div>
                      <span className="admin-trend-value">{entry.riskScore}</span>
                    </div>
                  </div>
                  <div className={`admin-risk-badge ${entry.severity}`}>
                    {formatSeverity(entry.severity)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="notice">This account has not produced enough reviewed games for a trend yet.</p>
          )}
        </section>

        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">Profile</div>
          <h2 className="feature-title admin-panel-title">Moderation summary</h2>
          <div className="admin-simple-list">
            <div className="admin-simple-row">
              <strong>Account risk</strong>
              <span>{data.profile.riskScore}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Severity</strong>
              <span>{formatSeverity(data.profile.severity)}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Reviewed games</strong>
              <span>{data.profile.reviewedGames}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Flagged games</strong>
              <span>{data.profile.flaggedGames}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Rated games</strong>
              <span>{data.profile.recentRatedGames}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Manual status</strong>
              <span>{data.user.moderationStatus}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Suggested status</strong>
              <span>{data.profile.recommendation.status}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Confidence</strong>
              <span>{Math.round(data.profile.recommendation.confidence * 100)}%</span>
            </div>
            <div className="admin-simple-row">
              <strong>Updated by</strong>
              <span>{data.user.moderationUpdatedByEmail ?? "Not set"}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Updated at</strong>
              <span>{formatDateTime(data.user.moderationUpdatedAt)}</span>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Recommendation</div>
        <h2 className="feature-title admin-panel-title">System recommendation</h2>
        <p className="notice">
          <strong>{data.profile.recommendation.status}</strong> recommended with{" "}
          {Math.round(data.profile.recommendation.confidence * 100)}% confidence.
          {" "}
          {data.profile.recommendation.reason}
        </p>
        {data.profile.recommendation.dismissed ? (
          <p className="notice">
            This recommendation is currently muted by a recent moderator outcome. It will return only if newer flagged signals arrive.
          </p>
        ) : null}
      </section>

      <ModerationControls
        initialStatus={data.user.moderationStatus}
        recommendationReason={data.profile.recommendation.reason}
        recommendedStatus={data.profile.recommendation.status}
        userId={data.user.id}
      />

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Audit trail</div>
        <h2 className="feature-title admin-panel-title">Moderation history</h2>
        {data.moderationEvents.length ? (
          <div className="admin-reviewed-list">
            {data.moderationEvents.map((event) => (
              <article className="admin-suspicious-card" key={event.id}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>{formatModerationEventTitle(event.type)}</strong>
                    <div className="muted">{event.createdByEmail}</div>
                  </div>
                  <span className="pill">{formatDateTime(event.createdAt)}</span>
                </div>
                <div className="detail-stack">
                  <span className="pill">From {event.fromStatus ?? "n/a"}</span>
                  <span className="pill">To {event.toStatus ?? "n/a"}</span>
                </div>
                {event.note ? <p className="muted admin-suspicious-summary">{event.note}</p> : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No manual moderation actions have been recorded for this account yet.</p>
        )}
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Reviewed history</div>
        <h2 className="feature-title admin-panel-title">Game-by-game anti-cheat history</h2>
        {data.reviewedGames.length ? (
          <div className="admin-reviewed-list">
            {data.reviewedGames.map((game) => (
              <article className="admin-suspicious-card" key={`${game.gameId}-${game.generatedAt}`}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>
                      {game.side === PlayerColor.WHITE ? "White" : "Black"} vs {game.opponentName}
                    </strong>
                    <div className="muted">
                      {game.format} {game.control} • {game.rated ? "Rated" : "Casual"} •{" "}
                      {game.source === "combined"
                        ? "Combined review"
                        : game.source === "engine"
                          ? "Engine review"
                          : "Telemetry review"}
                    </div>
                  </div>
                  <div className={`admin-risk-badge ${game.severity}`}>
                    {formatSeverity(game.severity)} {game.riskScore}
                  </div>
                </div>
                <p className="muted admin-suspicious-summary">{game.summary}</p>
                <div className="detail-stack">
                  <span className="pill">{formatResult(game.result)}</span>
                  <span className="pill">Telemetry {game.telemetryRisk ?? "n/a"}</span>
                  <span className="pill">Engine {game.engineRisk ?? "n/a"}</span>
                  <span className="pill">{formatDateTime(game.generatedAt)}</span>
                  {game.opponentId ? (
                    <Link className="pill admin-inline-link" href={`/admin/users/${game.opponentId}`}>
                      Open opponent
                    </Link>
                  ) : null}
                  {game.opponentId ? (
                    <Link
                      className="pill admin-inline-link"
                      href={`/admin/head-to-head/${data.user.id}/${game.opponentId}`}
                    >
                      Head to head
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No anti-cheat review history exists for this account yet.</p>
        )}
      </section>
    </div>
  );
}
