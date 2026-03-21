const previewPosition = [
  "♜",
  "♞",
  "♝",
  "♛",
  "♚",
  "♝",
  "♞",
  "♜",
  "♟",
  "♟",
  "♟",
  "♟",
  "",
  "♟",
  "♟",
  "♟",
  "",
  "",
  "",
  "",
  "♟",
  "",
  "",
  "",
  "",
  "",
  "",
  "♗",
  "",
  "",
  "",
  "",
  "",
  "",
  "♙",
  "",
  "♙",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "♘",
  "",
  "",
  "♙",
  "♙",
  "",
  "♙",
  "",
  "♙",
  "♙",
  "♙",
  "♖",
  "♘",
  "♗",
  "♕",
  "♔",
  "",
  "",
  "♖"
];

export function ChessBoardPreview() {
  return (
    <div className="hero-stage">
      <div className="board-preview">
        {previewPosition.map((piece, index) => {
          const row = Math.floor(index / 8);
          const col = index % 8;
          const isLight = (row + col) % 2 === 0;

          return (
            <div
              key={index}
              className={`board-tile ${isLight ? "light" : "dark"}`}
              aria-hidden="true"
            >
              {piece}
            </div>
          );
        })}
      </div>
      <div className="glass-panel preview-callout">
        <div className="panel-kicker">Live Match State</div>
        <h3 className="panel-title">Clocks, lobby, invites and premium board presence.</h3>
        <p className="panel-copy">
          Start public games, share private invites and keep the move stream authoritative on the
          server from day one.
        </p>
      </div>
    </div>
  );
}
