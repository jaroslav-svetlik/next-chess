import Link from "next/link";

import {
  getLeaderboardCategoryOptions,
  getLeaderboardData,
  normalizeLeaderboardCategory
} from "@/lib/public";

export const dynamic = "force-dynamic";

function formatJoinedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export default async function LeaderboardPage({
  searchParams
}: {
  searchParams?: Promise<{ category?: string | string[] }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const selectedCategory = normalizeLeaderboardCategory(resolvedSearchParams?.category);
  const [data, categories] = await Promise.all([
    getLeaderboardData(selectedCategory),
    Promise.resolve(getLeaderboardCategoryOptions())
  ]);

  return (
    <main className="content-wrap leaderboard-page">
      <section className="glass-panel leaderboard-header">
        <div className="panel-kicker">Competitive</div>
        <h1 className="panel-title">Leaderboard</h1>
        <p className="panel-copy">
          Public rating ladder for active NextChess accounts. Restricted accounts are excluded from
          the board.
        </p>
        <div className="leaderboard-filter-row">
          {categories.map((category) => (
            <Link
              className={`pill admin-inline-link admin-period-pill ${
                data.category === category.value ? "is-active" : ""
              }`}
              href={`/leaderboard?category=${category.value}`}
              key={category.value}
            >
              {category.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="leaderboard-grid">
        <section className="glass-panel leaderboard-main-panel">
          <div className="panel-kicker">{data.label}</div>
          <h2 className="feature-title admin-panel-title">{data.description}</h2>
          <div className="leaderboard-table-shell">
            <div className="leaderboard-table">
              <div className="leaderboard-head">
                <span>Rank</span>
                <span>Player</span>
                <span>Rating</span>
                <span>Bullet</span>
                <span>Blitz</span>
                <span>Rapid</span>
              </div>
              {data.players.map((player) => (
                <Link
                  className="leaderboard-row"
                  href={`/players/${player.slug}`}
                  key={player.id}
                >
                  <span className="leaderboard-rank">{player.rank}</span>
                  <span className="leaderboard-player-name">{player.name}</span>
                  <strong className="leaderboard-primary-rating">{player.rating}</strong>
                  <span>{player.ratings.bullet}</span>
                  <span>{player.ratings.blitz}</span>
                  <span>{player.ratings.rapid}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="leaderboard-side-stack">
          <section className="glass-panel admin-list-panel">
            <div className="panel-kicker">Top 3</div>
            <h2 className="feature-title admin-panel-title">Podium snapshot</h2>
            <div className="leaderboard-podium">
              {data.players.slice(0, 3).map((player) => (
                <Link className="leaderboard-podium-card" href={`/players/${player.slug}`} key={player.id}>
                  <span className="leaderboard-podium-rank">#{player.rank}</span>
                  <strong>{player.name}</strong>
                  <span className="leaderboard-podium-rating">{player.rating}</span>
                  <small>Joined {formatJoinedAt(player.joinedAt)}</small>
                </Link>
              ))}
            </div>
          </section>

          <section className="glass-panel admin-list-panel">
            <div className="panel-kicker">Routing</div>
            <h2 className="feature-title admin-panel-title">Public player pages</h2>
            <p className="notice">
              Every leaderboard row links into a public player card with rating snapshot and recent
              finished games.
            </p>
          </section>
        </section>
      </section>
    </main>
  );
}
