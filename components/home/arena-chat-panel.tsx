"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { buildDemoHeaders, buildDemoUrl, type DemoIdentity } from "@/lib/dev-auth";
import { useRealtimeChannel } from "@/lib/use-realtime-channel";

type ArenaChatMessage = {
  id: string;
  actorId: string;
  actorType: "user" | "guest";
  name: string;
  username: string | null;
  text: string;
  createdAt: string;
};

type ArenaChatPanelProps = {
  actorId: string | null;
  actorName: string | null;
  actorType: "user" | "guest" | null;
  identity: DemoIdentity;
};

function formatChatTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getChatInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function ArenaChatPanel({ actorId, actorName, actorType, identity }: ArenaChatPanelProps) {
  const [messages, setMessages] = useState<ArenaChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [guestPostingEnabled, setGuestPostingEnabled] = useState(true);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownTick, setCooldownTick] = useState(0);
  const submitInFlightRef = useRef(false);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const shouldPinToBottomRef = useRef(true);

  const canPost = Boolean(actorId) && (actorType !== "guest" || guestPostingEnabled);
  const cooldownRemainingMs = Math.max(0, cooldownUntil - cooldownTick);
  const isComposerDisabled = !hasMounted || !canPost || isSending || cooldownRemainingMs > 0;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!cooldownUntil || Date.now() >= cooldownUntil) {
      setCooldownTick(Date.now());
      return;
    }

    const interval = window.setInterval(() => {
      const now = Date.now();
      setCooldownTick(now);

      if (now >= cooldownUntil) {
        setCooldownUntil(0);
      }
    }, 250);

    return () => {
      window.clearInterval(interval);
    };
  }, [cooldownUntil]);

  useEffect(() => {
    async function loadMessages() {
      try {
        const response = await fetch(buildDemoUrl("/api/chat/arena", identity), {
          cache: "no-store",
          headers: buildDemoHeaders(identity)
        });
        const payload = (await response.json()) as {
          messages?: ArenaChatMessage[];
          guestPostingEnabled?: boolean;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Arena chat is unavailable.");
        }

        setMessages(payload.messages ?? []);
        setGuestPostingEnabled(payload.guestPostingEnabled ?? true);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Arena chat is unavailable.");
      }
    }

    void loadMessages();
  }, [identity]);

  useRealtimeChannel({
    channel: "arena-chat",
    onMessage: (message) => {
      if (message.type === "arena_chat_settings") {
        const nextGuestPostingEnabled =
          typeof (message as { guestPostingEnabled?: unknown }).guestPostingEnabled === "boolean"
            ? Boolean((message as { guestPostingEnabled?: boolean }).guestPostingEnabled)
            : null;

        if (nextGuestPostingEnabled !== null) {
          setGuestPostingEnabled(nextGuestPostingEnabled);
          if (actorType === "guest" && !nextGuestPostingEnabled) {
            setError("Guest posting is currently disabled by admin.");
          }
          if (nextGuestPostingEnabled) {
            setError((current) =>
              current === "Guest posting is currently disabled by admin." ? null : current
            );
          }
        }

        return;
      }

      const incomingMessage = (message as { message?: ArenaChatMessage }).message;
      if (message.type !== "arena_chat" || !incomingMessage) {
        return;
      }

      setMessages((current) => [...current, incomingMessage].slice(-80));
    }
  });

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || messages.length === 0) {
      return;
    }

    const latestMessage = messages[messages.length - 1];
    if (!shouldPinToBottomRef.current && latestMessage?.actorId !== actorId) {
      return;
    }

    feed.scrollTop = feed.scrollHeight;
  }, [actorId, messages]);

  function handleFeedScroll() {
    const feed = feedRef.current;
    if (!feed) {
      return;
    }

    shouldPinToBottomRef.current =
      feed.scrollHeight - feed.scrollTop - feed.clientHeight < 28;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canPost || !draft.trim() || cooldownRemainingMs > 0 || submitInFlightRef.current) {
      return;
    }

    setError(null);
    setIsSending(true);
    submitInFlightRef.current = true;

    try {
      const response = await fetch(buildDemoUrl("/api/chat/arena", identity), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...buildDemoHeaders(identity)
        },
        body: JSON.stringify({
          text: draft
        })
      });
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send message.");
      }

      setDraft("");
      setCooldownUntil(Date.now() + 2_000);
    } catch (submissionError) {
      const nextError =
        submissionError instanceof Error ? submissionError.message : "Unable to send message.";

      if (nextError === "Guest posting is currently disabled in arena chat.") {
        setGuestPostingEnabled(false);
      }

      setError(nextError);
    } finally {
      setIsSending(false);
      submitInFlightRef.current = false;
    }
  }

  return (
    <aside className="home-chat-shell glass-panel">
      <div className="home-chat-head">
        <div className="home-chat-headline">
          <div className="home-chat-title-row">
            <span className="panel-kicker">Live chat</span>
            <span className="home-chat-presence">
              <span className={`home-chat-presence-dot${canPost ? " live" : ""}`} />
              {canPost ? "Live" : "Read only"}
            </span>
          </div>
          <h2 className="home-chat-title">Arena</h2>
        </div>
        <span className="home-chat-count">{messages.length}</span>
      </div>

      <div className="home-chat-status">
        <strong>{actorName ?? "Spectator mode"}</strong>
        <span>
          {canPost
            ? "Instant updates for everyone in the arena."
            : actorType === "guest" && !guestPostingEnabled
              ? "Guest posting is currently disabled by admin."
              : "Join with a guest or account identity to post."}
        </span>
      </div>

      <div
        aria-live="polite"
        className="home-chat-feed"
        onScroll={handleFeedScroll}
        ref={feedRef}
      >
        {messages.length ? (
          messages.map((message) => {
            const isOwn = actorId === message.actorId;

            return (
              <article className={`home-chat-message${isOwn ? " own" : ""}`} key={message.id}>
                <span className="home-chat-avatar" aria-hidden="true">
                  {getChatInitials(message.name)}
                </span>
                <div className="home-chat-bubble">
                  <div className="home-chat-meta">
                    {message.actorType === "user" ? (
                      <Link
                        className="home-chat-author-link"
                        href={`/players/${message.username ?? message.actorId}`}
                      >
                        {message.name}
                      </Link>
                    ) : (
                      <strong>{message.name}</strong>
                    )}
                    <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
                  </div>
                  <p>{message.text}</p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="home-chat-empty">
            <strong>Empty room.</strong>
            <span>First message starts the thread.</span>
          </div>
        )}
      </div>

      <form className="home-chat-form" onSubmit={handleSubmit}>
        <div className="home-chat-composer">
          <textarea
            className="home-chat-input"
            disabled={isComposerDisabled}
            maxLength={220}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={canPost ? "Write a message..." : "Read only"}
            rows={2}
            value={draft}
          />
          <button
            className="home-chat-send"
            disabled={isComposerDisabled || !draft.trim()}
            type="submit"
          >
            {isSending ? "..." : "Send"}
          </button>
        </div>
        <div className="home-chat-actions">
          <span>
            {cooldownRemainingMs > 0
              ? `Cooldown ${Math.ceil(cooldownRemainingMs / 1000)}s`
              : `${draft.trim().length}/220`}
          </span>
          {error ? <span className="home-chat-feedback error">{error}</span> : null}
        </div>
      </form>
    </aside>
  );
}
