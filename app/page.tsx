import { HomeArenaShell } from "@/components/home/home-arena-shell";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="content-wrap home-page">
      <HomeArenaShell />
    </main>
  );
}
