"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";

export function GuestChatControls({
  initialEnabled
}: {
  initialEnabled: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle(nextValue: boolean) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/settings/guest-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          enabled: nextValue
        })
      });
      const payload = (await response.json().catch(() => null)) as
        | { enabled?: boolean; error?: string }
        | null;

      if (!response.ok || typeof payload?.enabled !== "boolean") {
        throw new Error(payload?.error ?? "Guest chat setting update failed.");
      }

      setEnabled(payload.enabled);
      startTransition(() => {
        router.refresh();
      });
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Guest chat setting update failed."
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="admin-list-panel admin-surface-panel">
      <div className="panel-kicker">Chat controls</div>
      <h2 className="feature-title admin-panel-title">Guest arena chat</h2>
      <div className="admin-simple-list">
        <div className="admin-simple-row">
          <strong>Status</strong>
          <span>{enabled ? "Guests can post in arena chat." : "Guest posting is disabled."}</span>
        </div>
      </div>
      <div className="detail-stack admin-toolbar-actions">
        <button
          className="primary-button"
          disabled={isSaving || enabled}
          onClick={() => void handleToggle(true)}
          type="button"
        >
          {isSaving && !enabled ? "Saving..." : "Enable guest chat"}
        </button>
        <button
          className="secondary-button"
          disabled={isSaving || !enabled}
          onClick={() => void handleToggle(false)}
          type="button"
        >
          {isSaving && enabled ? "Saving..." : "Disable guest chat"}
        </button>
      </div>
      {error ? <p className="notice danger">{error}</p> : null}
    </section>
  );
}
