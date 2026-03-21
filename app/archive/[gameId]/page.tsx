import { notFound } from "next/navigation";

import { GameReplayShell } from "@/components/game/game-replay-shell";
import { getPublicGameReplayData } from "@/lib/public";

export const dynamic = "force-dynamic";

export default async function ArchiveGamePage({
  params
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const game = await getPublicGameReplayData(gameId);

  if (!game) {
    notFound();
  }

  return (
    <main className="content-wrap archive-game-page">
      <section className="glass-panel archive-game-header">
        <div className="panel-kicker">Game Archive</div>
        <h1 className="panel-title">
          {game.format} {game.control}
        </h1>
        <p className="panel-copy">
          Step through the moves exactly like a replay board and inspect the final result move by move.
        </p>
      </section>

      <GameReplayShell game={game} />
    </main>
  );
}
