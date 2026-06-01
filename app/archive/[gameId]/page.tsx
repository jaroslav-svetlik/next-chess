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
      <GameReplayShell game={game} />
    </main>
  );
}
