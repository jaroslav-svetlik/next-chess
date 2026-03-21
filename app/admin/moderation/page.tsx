import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AdminAccessRestricted,
  formatAdminFlaggedAt,
  normalizeAdminPeriod
} from "@/components/admin/admin-primitives";
import { RecommendationQueue } from "@/components/admin/recommendation-queue";
import { canAccessAdmin, getAdminDashboardData, getAdminEmailHint } from "@/lib/admin";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage({
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
        <div className="panel-kicker">Moderation</div>
        <h1 className="panel-title">Risk and outcome workflow</h1>
        <p className="panel-copy">Review queue, active cases and outcome counts.</p>
      </section>

      <section className="admin-grid admin-grid-wide">
        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">High-risk accounts</div>
          <h2 className="feature-title admin-panel-title">Priority review list</h2>
          {data.riskyAccounts.length ? (
            <div className="admin-table">
              <div className="admin-table-head admin-table-head-moderation">
                <span>Account</span>
                <span>Current</span>
                <span>Suggested</span>
                <span>Risk</span>
                <span>Last flagged</span>
              </div>
              {data.riskyAccounts.map((profile) => (
                <Link className="admin-table-row admin-table-row-moderation" href={`/admin/users/${profile.userId}`} key={profile.userId}>
                  <div className="admin-cell-primary">
                    <strong>{profile.name}</strong>
                    <span>
                      {profile.email ?? "No email"} • {profile.reviewedGames} reviewed • {profile.flaggedGames} flagged
                    </span>
                  </div>
                  <span>{profile.moderationStatus}</span>
                  <span>{profile.recommendation.status}</span>
                  <span>{profile.severity} {profile.riskScore}</span>
                  <span>{formatAdminFlaggedAt(profile.lastFlaggedAt)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="notice">No account-level profile has crossed the watch threshold yet.</p>
          )}
        </section>

        <RecommendationQueue items={data.recommendationQueue} />
      </section>

      <section className="admin-grid admin-grid-two">
        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Funnel</div>
          <h2 className="feature-title admin-panel-title">Case flow</h2>
          <div className="admin-simple-list">
            <div className="admin-simple-row">
              <strong>Flagged accounts</strong>
              <span>{data.moderationFunnel.flaggedAccounts}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Queued recommendations</strong>
              <span>{data.moderationFunnel.queuedRecommendations}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Observe</strong>
              <span>{data.moderationFunnel.observeAccounts}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Watch / Review</strong>
              <span>{data.moderationFunnel.watchOrReviewAccounts}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Restricted</strong>
              <span>{data.moderationFunnel.restrictedAccounts}</span>
            </div>
          </div>
        </section>

        <section className="admin-list-panel admin-surface-panel">
          <div className="panel-kicker">Outcomes</div>
          <h2 className="feature-title admin-panel-title">Selected period</h2>
          <div className="admin-simple-list">
            <div className="admin-simple-row">
              <strong>Cleared</strong>
              <span>{data.moderationFunnel.clearedOutcomes30d}</span>
            </div>
            <div className="admin-simple-row">
              <strong>False positives</strong>
              <span>{data.moderationFunnel.falsePositiveOutcomes30d}</span>
            </div>
            <div className="admin-simple-row">
              <strong>Confirmed cheat</strong>
              <span>{data.moderationFunnel.confirmedCheatOutcomes30d}</span>
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
