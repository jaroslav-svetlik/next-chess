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

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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

  const ratingRows = [
    {
      key: "bullet",
      label: "Bullet",
      rating: data.user.ratings.bullet,
      provisional: data.user.provisionalRatings.bullet,
      rank: data.user.ranks.bullet
    },
    {
      key: "blitz",
      label: "Blitz",
      rating: data.user.ratings.blitz,
      provisional: data.user.provisionalRatings.blitz,
      rank: data.user.ranks.blitz
    },
    {
      key: "rapid",
      label: "Rapid",
      rating: data.user.ratings.rapid,
      provisional: data.user.provisionalRatings.rapid,
      rank: data.user.ranks.rapid
    }
  ];

  const recordRows = [
    { label: "Games", value: data.overview.totalGames },
    { label: "Win rate", value: `${data.overview.winRate}%` },
    { label: "Rated", value: data.overview.ratedGames },
    {
      label: "W-D-L",
      value: `${data.overview.wins}-${data.overview.draws}-${data.overview.losses}`
    }
  ];

  return (
    <main className="content-wrap player-profile-page">
      <section className="player-profile-shell">
        <aside className="player-profile-sidebar" aria-label="Player summary">
          <section className="player-profile-card player-profile-identity">
            <div className="player-profile-avatar" aria-hidden="true">
              {getInitials(data.user.name) || "NC"}
            </div>
            <div className="player-profile-heading">
              <h1>{data.user.name}</h1>
              {data.user.username ? <p>@{data.user.username}</p> : null}
            </div>
            <div className="player-profile-meta-list">
              <span>Joined {formatJoinedAt(data.user.createdAt)}</span>
              <Link className="player-profile-text-link" href="/leaderboard">
                Leaderboard
              </Link>
            </div>
          </section>

          <section className="player-profile-card">
            <div className="player-profile-section-head">
              <h2>Ratings</h2>
              <span>Current</span>
            </div>
            <div className="player-rating-list">
              {ratingRows.map((rating) => (
                <div className="player-rating-row" key={rating.key}>
                  <div>
                    <strong>{rating.label}</strong>
                    <span>
                      {rating.provisional
                        ? "Provisional"
                        : rating.rank
                          ? `#${rating.rank}`
                          : "Unranked"}
                    </span>
                  </div>
                  <strong>{formatRating(rating.rating, rating.provisional)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="player-profile-card">
            <div className="player-profile-section-head">
              <h2>Record</h2>
              <span>Finished</span>
            </div>
            <div className="player-record-grid">
              {recordRows.map((item) => (
                <div className="player-record-cell" key={item.label}>
                  <strong>{item.value}</strong>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="player-profile-main-panel">
          <div className="player-profile-main-head">
            <div>
              <h2>Games</h2>
              <p>Finished-game archive</p>
            </div>
            <span>{data.history.totalGames} total</span>
          </div>

          <div className="player-profile-filter-block">
            <div className="player-profile-filter-row" aria-label="Game format filter">
              {categoryOptions.map((option) => (
                <Link
                  className={`player-profile-tab${data.history.category === option.value ? " active" : ""}`}
                  href={buildHistoryHref({ category: option.value, page: 1 }) as Route}
                  key={option.value}
                >
                  {option.label}
                </Link>
              ))}
            </div>
            <div className="player-profile-filter-row" aria-label="Game mode filter">
              {modeOptions.map((option) => (
                <Link
                  className={`player-profile-tab${data.history.mode === option.value ? " active" : ""}`}
                  href={buildHistoryHref({ mode: option.value, page: 1 }) as Route}
                  key={option.value}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          {data.history.games.length ? (
            <div className="player-history-table">
              <div className="player-history-table-head">
                <span>Result</span>
                <span>Opponent</span>
                <span>Control</span>
                <span>Date</span>
                <span>Moves</span>
                <span>Game</span>
              </div>
              {data.history.games.map((game) => (
                <article className="player-history-row" key={game.id}>
                  <span className={`player-outcome-pill ${game.outcome}`}>
                    {formatOutcome(game.outcome)}
                  </span>
                  <div className="player-history-opponent">
                    <strong>
                      {game.opponentId ? (
                        <Link className="player-profile-text-link" href={`/players/${game.opponentId}`}>
                          {game.opponentName}
                        </Link>
                      ) : (
                        game.opponentName
                      )}
                    </strong>
                    <span>{game.color === "WHITE" ? "White" : "Black"} side</span>
                  </div>
                  <div className="player-history-control">
                    <strong>{game.control}</strong>
                    <span>
                      {game.format} {game.rated ? "rated" : "casual"}
                    </span>
                  </div>
                  <span className="player-history-date">{formatEndedAt(game.endedAt)}</span>
                  <span className="player-history-moves">
                    {game.movesCount !== null ? game.movesCount : "-"}
                  </span>
                  <Link className="player-history-review" href={`/archive/${game.id}`}>
                    Review
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="player-profile-empty">No finished games yet for this account.</div>
          )}

          {data.history.totalPages > 1 ? (
            <div className="history-pagination player-history-pagination">
              <Link
                aria-disabled={data.history.page <= 1}
                className={`secondary-button${data.history.page <= 1 ? " disabled" : ""}`}
                href={buildHistoryHref({ page: Math.max(1, data.history.page - 1) }) as Route}
              >
                Previous
              </Link>
              <span>
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
