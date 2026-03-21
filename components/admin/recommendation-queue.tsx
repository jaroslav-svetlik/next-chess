"use client";

import { ModerationStatus } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type QueueItem = {
  userId: string;
  name: string;
  email: string | null;
  riskScore: number;
  moderationStatus: ModerationStatus;
  flaggedGames: number;
  reviewedGames: number;
  recommendation: {
    status: ModerationStatus;
    confidence: number;
    reason: string;
  };
};

function formatStatus(value: ModerationStatus) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function RecommendationQueue({ items }: { items: QueueItem[] }) {
  const router = useRouter();
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function applyRecommendation(item: QueueItem) {
    setSubmittingUserId(item.userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${item.userId}/moderation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: item.recommendation.status,
          note: `Applied system recommendation from moderation queue: ${formatStatus(item.recommendation.status)}. ${item.recommendation.reason}`
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to apply recommendation.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply recommendation.");
    } finally {
      setSubmittingUserId(null);
    }
  }

  async function dismissRecommendation(item: QueueItem) {
    setSubmittingUserId(item.userId);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${item.userId}/moderation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action: "dismiss_recommendation",
          status: item.recommendation.status,
          note: `Dismissed system recommendation from moderation queue: ${formatStatus(item.recommendation.status)}. ${item.recommendation.reason}`
        })
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to dismiss recommendation.");
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : "Failed to dismiss recommendation.");
    } finally {
      setSubmittingUserId(null);
    }
  }

  return (
    <section className="admin-list-panel admin-surface-panel">
      <div className="panel-kicker">Pending review</div>
      <h2 className="feature-title admin-panel-title">Recommendation queue</h2>
      {items.length ? (
        <div className="admin-table">
          <div className="admin-table-head admin-table-head-queue">
            <span>Account</span>
            <span>Current</span>
            <span>Suggested</span>
            <span>Risk</span>
            <span>Actions</span>
          </div>
          {items.map((item) => (
            <article className="admin-table-row admin-table-row-queue" key={item.userId}>
              <div className="admin-cell-primary">
                <strong>{item.name}</strong>
                <span>
                  {item.email ?? "No email"} • {item.reviewedGames} reviewed • {item.flaggedGames} flagged
                </span>
                <span>{item.recommendation.reason}</span>
              </div>
              <span>{formatStatus(item.moderationStatus)}</span>
              <span>
                {formatStatus(item.recommendation.status)} ({Math.round(item.recommendation.confidence * 100)}%)
              </span>
              <span className="admin-risk-inline">Risk {item.riskScore}</span>
              <div className="admin-action-row">
                <button
                  className="primary-button admin-compact-button"
                  disabled={submittingUserId === item.userId}
                  onClick={() => applyRecommendation(item)}
                  type="button"
                >
                  {submittingUserId === item.userId ? "Applying..." : "Apply"}
                </button>
                <button
                  className="secondary-button admin-compact-button"
                  disabled={submittingUserId === item.userId}
                  onClick={() => dismissRecommendation(item)}
                  type="button"
                >
                  Dismiss
                </button>
                <Link className="secondary-button admin-compact-button" href={`/admin/users/${item.userId}`}>
                  Open
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="notice">No queued recommendation currently differs from the manual moderation state.</p>
      )}
      {error ? <p className="notice danger">{error}</p> : null}
    </section>
  );
}
