import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  AdminTopPlayerList,
  normalizeAdminPeriod
} from "@/components/admin/admin-primitives";
import { canAccessAdmin, getAdminDashboardData, getAdminEmailHint } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminCompetitivePage({
  searchParams
}: {
  searchParams?: Promise<{ period?: string | string[] }>;
}) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/auth/login");
  }

  if (!canAccessAdmin(session.user.email)) {
    return <AdminAccessRestricted hint={getAdminEmailHint()} />;
  }

  const resolved = searchParams ? await searchParams : undefined;
  const data = await getAdminDashboardData(normalizeAdminPeriod(resolved?.period));

  return (
    <div className="admin-surface">
      <section className="admin-header-panel admin-surface-panel">
        <div className="panel-kicker">Competitive</div>
        <h1 className="panel-title">Competitive overview</h1>
        <p className="panel-copy">Leaderboards, format split and result mix.</p>
      </section>

      <section className="admin-grid admin-leaderboards">
        <AdminTopPlayerList players={data.topPlayers.bullet} title="Top bullet" />
        <AdminTopPlayerList players={data.topPlayers.blitz} title="Top blitz" />
        <AdminTopPlayerList players={data.topPlayers.rapid} title="Top rapid" />
      </section>

      <section className="admin-grid admin-grid-two">
        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Formats</div>
          <h2 className="feature-title admin-panel-title">Game breakdown</h2>
          <div className="admin-simple-list">
            {data.formats.map((row) => (
              <div className="admin-simple-row" key={`${row.label}-${row.rated ? "rated" : "casual"}`}>
                <strong>
                  {row.label} {row.rated ? "Rated" : "Casual"}
                </strong>
                <span>{row.games}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Results</div>
          <h2 className="feature-title admin-panel-title">Outcome mix</h2>
          <div className="admin-simple-list">
            {data.results.map((row) => (
              <div className="admin-simple-row" key={row.label}>
                <strong>{row.label}</strong>
                <span>{row.games}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
