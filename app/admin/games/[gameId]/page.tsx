import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  canAccessAdmin,
  getAdminEmailHint,
  getAdminGameDetail
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

function formatDurationMs(value: number | null) {
  if (value === null) {
    return "n/a";
  }

  return `${(value / 1000).toFixed(1)}s`;
}

export default async function AdminGameDetailPage({
  params
}: {
  params: Promise<{ gameId: string }>;
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

  const { gameId } = await params;
  const data = await getAdminGameDetail(gameId);

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
        <div className="panel-kicker">Game explorer</div>
        <h1 className="panel-title">
          Game {data.game.id.slice(0, 8).toUpperCase()}
        </h1>
        <p className="panel-copy">
          {data.game.format} {data.game.control} • {data.game.rated ? "Rated" : "Casual"} •{" "}
          {data.game.visibility}
        </p>
        <div className="detail-stack">
          <span className="pill">{data.game.status}</span>
          <span className="pill">{formatResult(data.game.result)}</span>
          <span className="pill">Host {data.game.hostName}</span>
          {data.game.inviteCode ? <span className="pill">Invite {data.game.inviteCode}</span> : null}
        </div>
      </section>

      <section className="admin-grid admin-user-grid">
        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">Players</div>
          <h2 className="feature-title admin-panel-title">Seats and ratings</h2>
          {data.players.length === 2 ? (
            <div className="detail-stack">
              <Link
                className="pill admin-inline-link"
                href={`/admin/head-to-head/${data.players[0].userId}/${data.players[1].userId}`}
              >
                Open head to head
              </Link>
            </div>
          ) : null}
          <div className="admin-reviewed-list">
            {data.players.map((player) => (
              <article className="admin-suspicious-card" key={player.userId}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>{player.name}</strong>
                    <div className="muted">{player.email ?? "No email"}</div>
                  </div>
                  <span className="pill">{player.color}</span>
                </div>
                <div className="detail-stack">
                  <span className="pill">Rating {player.rating ?? "n/a"}</span>
                  <span className="pill">Clock {formatDurationMs(player.timeRemainingMs)}</span>
                  <span className="pill">{player.isConnected ? "Connected" : "Disconnected"}</span>
                  <Link className="pill admin-inline-link" href={`/admin/users/${player.userId}`}>
                    Open user
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">Metadata</div>
          <h2 className="feature-title admin-panel-title">Timing and outcome</h2>
          <div className="admin-simple-list">
            <div className="admin-simple-row">
              <strong>Created</strong>
              <span>{formatDateTime(data.game.createdAt)}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Started</strong>
              <span>{formatDateTime(data.game.startedAt)}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Ended</strong>
              <span>{formatDateTime(data.game.endedAt)}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Result</strong>
              <span>{formatResult(data.game.result)}</span>
            </div>
            <div className="admin-simple-row">
              <strong>FEN</strong>
              <span>{data.game.fen}</span>
            </div>
          </div>
        </section>
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Events</div>
        <h2 className="feature-title admin-panel-title">Recent game and review events</h2>
        {data.events.length ? (
          <div className="admin-reviewed-list">
            {data.events.map((event) => (
              <article className="admin-suspicious-card" key={event.id}>
                <div className="admin-suspicious-head">
                  <div>
                    <strong>{event.type.replaceAll("_", " ")}</strong>
                    <div className="muted">{formatDateTime(event.createdAt)}</div>
                  </div>
                  <span className="pill">{event.id.slice(0, 8).toUpperCase()}</span>
                </div>
                <p className="muted admin-suspicious-summary">{event.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="notice">No game events recorded for this game.</p>
        )}
      </section>

      <section className="glass-panel admin-list-panel">
        <div className="panel-kicker">Moves</div>
        <h2 className="feature-title admin-panel-title">Move list and telemetry</h2>
        {data.moves.length ? (
          <div className="admin-games-table">
            <div className="admin-games-head admin-moves-head">
              <span>Ply</span>
              <span>Move</span>
              <span>UCI</span>
              <span>Think</span>
              <span>Blur</span>
              <span>Focus loss</span>
            </div>
            {data.moves.map((move) => (
              <div className="admin-games-row admin-moves-row" key={move.id}>
                <span>{move.ply}</span>
                <span>
                  <strong>{move.san}</strong>
                </span>
                <span>{move.uci}</span>
                <span>{formatDurationMs(move.clientThinkTimeMs ?? move.spentTimeMs)}</span>
                <span>{move.turnBlurCount}</span>
                <span>{formatDurationMs(move.focusLossDurationMs)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="notice">No moves have been stored for this game.</p>
        )}
      </section>

      {data.game.pgn ? (
        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">PGN</div>
          <h2 className="feature-title admin-panel-title">Stored PGN</h2>
          <pre className="admin-code-block">{data.game.pgn}</pre>
        </section>
      ) : null}
    </div>
  );
}
