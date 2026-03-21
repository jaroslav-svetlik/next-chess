import { LobbyShell } from "@/components/lobby/lobby-shell";

export const dynamic = "force-dynamic";

export default function LobbyPage() {
  return (
    <main className="content-wrap lobby-page">
      <LobbyShell />
    </main>
  );
}
