import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";

import {
  getPlayerHistoryCategoryOptions,
  getPlayerHistoryModeOptions,
  getPlayerProfileDataWithHistory,
  normalizeHistoryPage,
  normalizePlayerHistoryCategory,
  normalizePlayerHistoryMode
} from "@/lib/public";

export const dynamic = "force-dynamic";

function formatJoinedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatEndedAt(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatOutcome(outcome: "win" | "loss" | "draw") {
  if (outcome === "win") {
    return "Win";
  }

  if (outcome === "loss") {
    return "Loss";
  }

  return "Draw";
}

function formatRating(value: number, provisional: boolean) {
  return provisional ? `${value}?` : `${value}`;
}

export default async function PlayerProfilePage({
  params,
  searchParams
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    page?: string;
    category?: string;
    mode?: string;
  }>;
}) {
  const { userId } = await params;
  const filters = await searchParams;
  const page = normalizeHistoryPage(filters.page);
  const category = normalizePlayerHistoryCategory(filters.category);
  const mode = normalizePlayerHistoryMode(filters.mode);
  const data = await getPlayerProfileDataWithHistory(userId, {
    page,
    category,
    mode
  });

  if (!data) {
    notFound();
  }

  const categoryOptions = getPlayerHistoryCategoryOptions();
  const modeOptions = getPlayerHistoryModeOptions();
  const buildHistoryHref = (next: { page?: number; category?: string; mode?: string }) => {
    const params = new URLSearchParams();
    params.set("page", String(next.page ?? data.history.page));
    params.set("category", next.category ?? data.history.category);
    params.set("mode", next.mode ?? data.history.mode);
    return `/players/${data.user.slug}?${params.toString()}`;
  };

  return (
    <main className="content-wrap player-profile-page">
      <section className="glass-panel player-profile-header">
        <div className="panel-kicker">Player</div>
        <h1 className="panel-title">{data.user.name}</h1>
        <p className="panel-copy">
          {data.user.username ? `@${data.user.username} • ` : ""}Public rating snapshot and recent finished-game history.
        </p>
        <div className="detail-stack">
          <span className="pill">Joined {formatJoinedAt(data.user.createdAt)}</span>
          <Link className="pill admin-inline-link" href="/leaderboard">
            Open leaderboard
          </Link>
        </div>
      </section>

      <section className="stats-strip player-profile-stats">
        <article className="stat-card">
          <div className="stat-value">{data.overview.totalGames}</div>
          <div className="stat-label">Finished games</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.overview.winRate}%</div>
          <div className="stat-label">Win rate</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">{data.overview.ratedGames}</div>
          <div className="stat-label">Rated games</div>
        </article>
        <article className="stat-card">
          <div className="stat-value">
            {data.overview.wins}-{data.overview.draws}-{data.overview.losses}
          </div>
          <div className="stat-label">W-D-L</div>
        </article>
      </section>

      <section className="player-profile-grid">
        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">Ratings</div>
          <h2 className="feature-title admin-panel-title">Current ladder snapshot</h2>
          <div className="player-rating-list">
            <div className="player-rating-row">
              <div>
                <strong>Bullet</strong>
                <div className="muted">
                  {data.user.provisionalRatings.bullet
                    ? "Provisional"
                    : data.user.ranks.bullet
                      ? `Rank #${data.user.ranks.bullet}`
                      : "Hidden from board"}
                </div>
              </div>
              <span className="leaderboard-podium-rating">
                {formatRating(data.user.ratings.bullet, data.user.provisionalRatings.bullet)}
              </span>
            </div>
            <div className="player-rating-row">
              <div>
                <strong>Blitz</strong>
                <div className="muted">
                  {data.user.provisionalRatings.blitz
                    ? "Provisional"
                    : data.user.ranks.blitz
                      ? `Rank #${data.user.ranks.blitz}`
                      : "Hidden from board"}
                </div>
              </div>
              <span className="leaderboard-podium-rating">
                {formatRating(data.user.ratings.blitz, data.user.provisionalRatings.blitz)}
              </span>
            </div>
            <div className="player-rating-row">
              <div>
                <strong>Rapid</strong>
                <div className="muted">
                  {data.user.provisionalRatings.rapid
                    ? "Provisional"
                    : data.user.ranks.rapid
                      ? `Rank #${data.user.ranks.rapid}`
                      : "Hidden from board"}
                </div>
              </div>
              <span className="leaderboard-podium-rating">
                {formatRating(data.user.ratings.rapid, data.user.provisionalRatings.rapid)}
              </span>
            </div>
          </div>
        </section>

        <section className="glass-panel admin-list-panel">
          <div className="panel-kicker">History</div>
          <h2 className="feature-title admin-panel-title">Finished-game archive</h2>
          <div className="leaderboard-filter-row">
            {categoryOptions.map((option) => (
              <Link
                className={`filter-chip${data.history.category === option.value ? " active" : ""}`}
                href={buildHistoryHref({ category: option.value, page: 1 }) as Route}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
          <div className="leaderboard-filter-row">
            {modeOptions.map((option) => (
              <Link
                className={`filter-chip${data.history.mode === option.value ? " active" : ""}`}
                href={buildHistoryHref({ mode: option.value, page: 1 }) as Route}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </div>
          {data.history.games.length ? (
            <div className="player-history-list">
              {data.history.games.map((game) => (
                <article className="player-history-card" key={game.id}>
                  <div className="player-history-head">
                    <div>
                      <strong>{formatOutcome(game.outcome)}</strong>
                      <div className="muted">
                        {game.color === "WHITE" ? "White" : "Black"} vs {game.opponentId ? (
                          <Link className="admin-inline-link" href={`/players/${game.opponentId}`}>
                            {game.opponentName}
                          </Link>
                        ) : (
                          game.opponentName
                        )}
                      </div>
                    </div>
                    <span className={`pill player-outcome-pill ${game.outcome}`}>{game.resultReason}</span>
                  </div>
                  <div className="detail-stack">
                    <span className="pill">{game.format}</span>
                    <span className="pill">{game.control}</span>
                    <span className="pill">{game.rated ? "Rated" : "Casual"}</span>
                    {game.movesCount !== null ? <span className="pill">{game.movesCount} moves</span> : null}
                    <span className="pill">{formatEndedAt(game.endedAt)}</span>
                  </div>
                  <div className="action-row">
                    <Link className="secondary-button" href={`/archive/${game.id}`}>
                      Review game
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="notice">No finished games yet for this account.</p>
          )}
          {data.history.totalPages > 1 ? (
            <div className="history-pagination">
              <Link
                aria-disabled={data.history.page <= 1}
                className={`secondary-button${data.history.page <= 1 ? " disabled" : ""}`}
                href={buildHistoryHref({ page: Math.max(1, data.history.page - 1) }) as Route}
              >
                Previous
              </Link>
              <span className="pill">
                Page {data.history.page} / {data.history.totalPages}
              </span>
              <Link
                aria-disabled={data.history.page >= data.history.totalPages}
                className={`secondary-button${data.history.page >= data.history.totalPages ? " disabled" : ""}`}
                href={buildHistoryHref({
                  page: Math.min(data.history.totalPages, data.history.page + 1)
                }) as Route}
              >
                Next
              </Link>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
