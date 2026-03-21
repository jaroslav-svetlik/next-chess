import { publishArenaChatRealtime } from "@/lib/arena-chat-realtime";
import type { RequestActor } from "@/lib/request-actor";

export type ArenaChatMessage = {
  id: string;
  actorId: string;
  actorType: "user" | "guest";
  name: string;
  username: string | null;
  text: string;
  createdAt: string;
};

type ArenaChatState = {
  messages: ArenaChatMessage[];
  inFlightActorIds: Set<string>;
  actorGuard: Map<
    string,
    {
      lastAcceptedAt: number;
      recentAcceptedAt: number[];
      lastMessageText: string;
      lastMessageAt: number;
    }
  >;
};

declare global {
  var __grandmateArenaChatState: ArenaChatState | undefined;
}

const MAX_MESSAGES = 80;
const MAX_MESSAGE_LENGTH = 220;
const CHAT_COOLDOWN_MS = 2_000;
const CHAT_BURST_WINDOW_MS = 20_000;
const CHAT_BURST_LIMIT = 5;
const DUPLICATE_MESSAGE_WINDOW_MS = 12_000;
const URL_PATTERN =
  /\b(?:https?:\/\/|www\.|discord\.gg\/|t\.me\/|[a-z0-9-]+\.(?:com|net|org|gg|io|rs|me|co|app|dev|xyz|ly|tv|ru|de|uk|fr|it|es|nl|info|biz)(?:\/\S*)?)\b/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const MARKDOWN_LINK_PATTERN = /\[[^\]]{1,80}\]\((?:[^)]+)\)/;
const HTML_TAG_PATTERN = /<[^>]+>/;
const MARKDOWN_FORMAT_PATTERN = /```|`[^`]+`|\*\*|__|~~/;
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/;
const LETTER_OR_NUMBER_PATTERN = /[\p{L}\p{N}]/u;

function getArenaChatState() {
  globalThis.__grandmateArenaChatState ??= {
    messages: [],
    inFlightActorIds: new Set(),
    actorGuard: new Map()
  };

  return globalThis.__grandmateArenaChatState;
}

function normalizeMessageText(value: string) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_MESSAGE_LENGTH);
}

function rejectUnsafeContent(text: string) {
  if (!LETTER_OR_NUMBER_PATTERN.test(text)) {
    throw new Error("PLAIN_TEXT_ONLY");
  }

  if (CONTROL_CHAR_PATTERN.test(text)) {
    throw new Error("PLAIN_TEXT_ONLY");
  }

  if (
    URL_PATTERN.test(text) ||
    EMAIL_PATTERN.test(text) ||
    MARKDOWN_LINK_PATTERN.test(text) ||
    HTML_TAG_PATTERN.test(text) ||
    MARKDOWN_FORMAT_PATTERN.test(text)
  ) {
    throw new Error("LINKS_BLOCKED");
  }
}

function enforceChatGuards(actor: RequestActor, text: string) {
  const now = Date.now();
  const state = getArenaChatState();
  const currentGuard = state.actorGuard.get(actor.id) ?? {
    lastAcceptedAt: 0,
    recentAcceptedAt: [],
    lastMessageText: "",
    lastMessageAt: 0
  };

  if (now - currentGuard.lastAcceptedAt < CHAT_COOLDOWN_MS) {
    throw new Error("RATE_LIMITED");
  }

  const recentAcceptedAt = currentGuard.recentAcceptedAt.filter(
    (entry) => now - entry < CHAT_BURST_WINDOW_MS
  );
  if (recentAcceptedAt.length >= CHAT_BURST_LIMIT) {
    throw new Error("SPAM_BLOCKED");
  }

  if (
    currentGuard.lastMessageText === text &&
    now - currentGuard.lastMessageAt < DUPLICATE_MESSAGE_WINDOW_MS
  ) {
    throw new Error("DUPLICATE_MESSAGE");
  }

  state.actorGuard.set(actor.id, {
    lastAcceptedAt: now,
    recentAcceptedAt: [...recentAcceptedAt, now],
    lastMessageText: text,
    lastMessageAt: now
  });
}

export function listArenaChatMessages() {
  return getArenaChatState().messages;
}

export async function postArenaChatMessage(actor: RequestActor, text: string) {
  const normalizedText = normalizeMessageText(text);
  if (!normalizedText) {
    throw new Error("EMPTY_MESSAGE");
  }

  if (actor.moderationStatus === "RESTRICTED") {
    throw new Error("ACCOUNT_RESTRICTED");
  }

  rejectUnsafeContent(normalizedText);

  const state = getArenaChatState();
  if (state.inFlightActorIds.has(actor.id)) {
    throw new Error("REQUEST_IN_FLIGHT");
  }

  enforceChatGuards(actor, normalizedText);
  state.inFlightActorIds.add(actor.id);

  try {
    const message: ArenaChatMessage = {
      id: crypto.randomUUID(),
      actorId: actor.id,
      actorType: actor.actorType,
      name: actor.name,
      username: actor.username,
      text: normalizedText,
      createdAt: new Date().toISOString()
    };

    state.messages = [...state.messages, message].slice(-MAX_MESSAGES);

    await publishArenaChatRealtime({
      type: "arena_chat",
      message
    });

    return message;
  } finally {
    state.inFlightActorIds.delete(actor.id);
  }
}
