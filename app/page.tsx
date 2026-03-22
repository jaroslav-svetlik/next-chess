import { HomeArenaShell } from "@/components/home/home-arena-shell";
import { HomeTechFooter } from "@/components/home/home-tech-footer";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="content-wrap home-page">
      <HomeArenaShell />
      <HomeTechFooter />
    </main>
  );
}
