"use client";

type LobbyGame = {
  id: string;
  host: string;
  format: string;
  control: string;
  rated: boolean;
  visibility: "PUBLIC" | "PRIVATE";
  status: "WAITING" | "ACTIVE" | "FINISHED" | "CANCELLED";
  seatsFilled: number;
  canJoin: boolean;
};

type OpenGamesListProps = {
  games: LobbyGame[];
  isPending: boolean;
  onJoin: (gameId: string) => void;
};

function getJoinButtonLabel(game: LobbyGame) {
  if (game.canJoin) {
    return "Join now";
  }

  if (game.status === "ACTIVE") {
    return "In progress";
  }

  if (game.seatsFilled >= 2) {
    return "Full";
  }

  if (game.status === "WAITING") {
    return "Your table";
  }

  return "Unavailable";
}

export function OpenGamesList({ games, isPending, onJoin }: OpenGamesListProps) {
  if (!games.length) {
    return (
      <article className="empty-state">
        <div className="panel-kicker">No Open Games</div>
        <h3 className="feature-title">The lobby is clear.</h3>
        <p className="muted">
          Create the first table and wait for someone to accept the challenge.
        </p>
      </article>
    );
  }

  return (
    <div className="lobby-list">
      {games.map((game) => (
        <article className="game-card" key={game.id}>
          <div className="game-card-header">
            <div>
              <div className="panel-kicker">{game.id.slice(0, 8).toUpperCase()}</div>
              <h3 className="feature-title">
                {game.host === "Anonymous" ? "Anonymous table is open" : `${game.host} is waiting`}
              </h3>
            </div>
            <span className="pill">{game.visibility}</span>
          </div>
          <div className="lobby-meta">
            <span className="pill">{game.rated ? "Rated" : "Casual"}</span>
            <span className="pill">{game.format}</span>
            <span className="pill">{game.control}</span>
            <span className="pill">{game.seatsFilled}/2 seated</span>
          </div>
          <div className="action-row">
            <button
              className="primary-button translucent-cta"
              disabled={!game.canJoin || isPending}
              onClick={() => onJoin(game.id)}
              type="button"
            >
              {getJoinButtonLabel(game)}
            </button>
            <a className="secondary-button" href={`/game/${game.id}`}>
              Open room
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}
