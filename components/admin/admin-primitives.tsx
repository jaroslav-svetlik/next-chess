import type { Route } from "next";
import Link from "next/link";

export function formatAdminDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatAdminResultLabel(result: string | null) {
  if (!result) {
    return "No result";
  }

  return result.replaceAll("_", " ");
}

export function formatAdminSeverity(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatAdminFlaggedAt(value: string | null) {
  if (!value) {
    return "No flagged games yet";
  }

  return formatAdminDateTime(value);
}

export function formatModerationEventLabel(value: string) {
  if (value === "system_auto_raised") {
    return "System auto-observe";
  }

  if (value === "account_cleared") {
    return "Account cleared";
  }

  if (value === "false_positive_marked") {
    return "False positive";
  }

  if (value === "cheat_confirmed") {
    return "Cheat confirmed";
  }

  return value.replaceAll("_", " ");
}

export function normalizeAdminPeriod(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);

  if (parsed === 7 || parsed === 90) {
    return parsed;
  }

  return 30;
}

export function AdminAccessRestricted({ hint }: { hint: string }) {
  return (
    <section className="admin-surface">
      <section className="admin-header-panel admin-surface-panel">
        <div className="panel-kicker">Admin</div>
        <h1 className="panel-title">Access restricted</h1>
        <p className="panel-copy">
          This dashboard is only available to configured admin accounts.
        </p>
        <p className="notice">{hint}</p>
      </section>
    </section>
  );
}

export function AdminStatCard({
  label,
  value,
  meta
}: {
  label: string;
  value: string | number;
  meta?: string;
}) {
  return (
    <article className="stat-card admin-kpi-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {meta ? <div className="admin-stat-meta">{meta}</div> : null}
    </article>
  );
}

export function AdminTopPlayerList({
  title,
  players
}: {
  title: string;
  players: Array<{ id: string; name: string; rating: number }>;
}) {
  return (
    <section className="admin-list-panel admin-surface-panel">
      <div className="panel-kicker">Leaderboard</div>
      <h2 className="feature-title admin-panel-title">{title}</h2>
      <div className="admin-dense-table">
        {players.map((player, index) => (
          <Link className="admin-dense-row admin-dense-row-tight" href={`/admin/users/${player.id}` as Route} key={player.id}>
            <div className="admin-dense-main admin-dense-main-inline">
              <span className="admin-rank-index">{index + 1}</span>
              <strong>{player.name}</strong>
            </div>
            <div className="admin-dense-meta">
              <span className="admin-rank-score">{player.rating}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
