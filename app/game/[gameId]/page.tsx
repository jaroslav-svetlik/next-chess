import { GameRoomShell } from "@/components/game/game-room-shell";

export default async function GamePage({
  params
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;

  return (
    <main className="content-wrap game-page">
      <GameRoomShell gameId={gameId} />
    </main>
  );
}
