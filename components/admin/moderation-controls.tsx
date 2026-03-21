"use client";

import { ModerationStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

const STATUS_OPTIONS: ModerationStatus[] = [
  ModerationStatus.CLEAN,
  ModerationStatus.OBSERVE,
  ModerationStatus.WATCH,
  ModerationStatus.REVIEW,
  ModerationStatus.RESTRICTED
];

function formatStatus(value: ModerationStatus) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function ModerationControls({
  userId,
  initialStatus,
  recommendedStatus,
  recommendationReason
}: {
  userId: string;
  initialStatus: ModerationStatus;
  recommendedStatus: ModerationStatus;
  recommendationReason: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ModerationStatus>(initialStatus);
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(
    action:
      | "update"
      | "clear_account"
      | "mark_false_positive"
      | "confirm_cheat" = "update",
    forcedStatus?: ModerationStatus,
    fallbackNote?: string
  ) {
    setIsSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const nextStatus = forcedStatus ?? status;
      const nextNote = note.trim().length ? note : fallbackNote ?? "";

      const response = await fetch(`/api/admin/users/${userId}/moderation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          status: nextStatus,
          note: nextNote
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            enforcement?: {
              cancelledWaitingGameIds?: string[];
              forfeitedActiveGameIds?: string[];
            };
          }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error ?? "Moderation action failed.");
      }

      setStatus(nextStatus);
      setNote("");
      const cancelledCount = payload?.enforcement?.cancelledWaitingGameIds?.length ?? 0;
      const forfeitedCount = payload?.enforcement?.forfeitedActiveGameIds?.length ?? 0;
      setSuccess(
        cancelledCount || forfeitedCount
          ? `Saved. Enforced on ${cancelledCount} waiting and ${forfeitedCount} active games.`
          : "Saved."
      );
      startTransition(() => {
        router.refresh();
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Moderation action failed."
      );
    } finally {
      setIsSaving(false);
    }
  }

  function applyRecommendation() {
    setStatus(recommendedStatus);
    setNote((current) =>
      current.trim().length
        ? current
        : `Applied system recommendation: ${formatStatus(recommendedStatus)}. ${recommendationReason}`
    );
    setSuccess(null);
    setError(null);
  }

  function clearAccount() {
    void submit(
      "clear_account",
      ModerationStatus.CLEAN,
      "Moderator reviewed the account and cleared it."
    );
  }

  function markFalsePositive() {
    void submit(
      "mark_false_positive",
      ModerationStatus.CLEAN,
      "Moderator marked prior anti-cheat suspicion as a false positive."
    );
  }

  function confirmCheat() {
    void submit(
      "confirm_cheat",
      ModerationStatus.RESTRICTED,
      "Moderator confirmed cheating and restricted this account."
    );
  }

  return (
    <section className="glass-panel admin-list-panel">
      <div className="panel-kicker">Admin action</div>
      <h2 className="feature-title admin-panel-title">Status and notes</h2>
      <p className="notice">
        Suggested status: <strong>{formatStatus(recommendedStatus)}</strong>. {recommendationReason}
      </p>
      <div className="admin-moderation-controls">
        <label className="admin-form-field">
          <span className="admin-form-label">Moderation status</span>
          <select
            className="admin-input"
            disabled={isSaving}
            onChange={(event) => setStatus(event.target.value as ModerationStatus)}
            value={status}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatStatus(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-form-field">
          <span className="admin-form-label">Admin note</span>
          <textarea
            className="admin-textarea"
            disabled={isSaving}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Add context for the next moderator pass."
            rows={5}
            value={note}
          />
        </label>
        <div className="detail-stack">
          <button
            className="secondary-button"
            disabled={isSaving || status === recommendedStatus}
            onClick={applyRecommendation}
            type="button"
          >
            Use recommendation
          </button>
          <button
            className="primary-button"
            disabled={isSaving}
            onClick={() => void submit()}
            type="button"
          >
            {isSaving ? "Saving..." : "Save moderation action"}
          </button>
          {success ? <span className="pill">{success}</span> : null}
        </div>
        <div className="detail-stack">
          <button
            className="secondary-button"
            disabled={isSaving || status === ModerationStatus.CLEAN}
            onClick={clearAccount}
            type="button"
          >
            Clear account
          </button>
          <button
            className="secondary-button"
            disabled={isSaving}
            onClick={markFalsePositive}
            type="button"
          >
            Mark false positive
          </button>
          <button
            className="secondary-button danger-button"
            disabled={isSaving || status === ModerationStatus.RESTRICTED}
            onClick={confirmCheat}
            type="button"
          >
            Confirm cheat
          </button>
        </div>
        {error ? <p className="notice danger">{error}</p> : null}
      </div>
    </section>
  );
}
