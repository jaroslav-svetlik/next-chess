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
          This room now reads the live backend game state. Waiting and active flows are separated
          and ready for the next realtime gameplay layer.
        </p>
      </div>
      <div style={{ height: "1.5rem" }} />
      <GameRoomShell gameId={gameId} />
    </main>
  );
}
