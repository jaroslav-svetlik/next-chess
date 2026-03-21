import { GameRoomShell } from "@/components/game/game-room-shell";

export default async function GamePage({
  params
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  return (
    <main className="content-wrap game-page">
      <div className="glass-panel">
        <span className="panel-kicker">Game Room</span>
        <h1 className="panel-title">Match {gameId.toUpperCase()}</h1>
        <p className="panel-copy">
          Room sada cita stvarni backend status partije. Waiting i active flow su odvojeni i spremni
          za sledeci realtime gameplay sloj.
        </p>
      </div>
      <div style={{ height: "1.5rem" }} />
      <GameRoomShell gameId={gameId} />
    </main>
  );
}
