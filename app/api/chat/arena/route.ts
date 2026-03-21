import { listArenaChatMessages, postArenaChatMessage } from "@/lib/arena-chat";
import { getRequestActor } from "@/lib/request-actor";
import { getArenaChatGuestPostingEnabled } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

function getArenaChatErrorStatus(code: string) {
  switch (code) {
    case "EMPTY_MESSAGE":
    case "LINKS_BLOCKED":
    case "PLAIN_TEXT_ONLY":
      return 400;
    case "ACCOUNT_RESTRICTED":
    case "GUEST_CHAT_DISABLED":
      return 403;
    case "RATE_LIMITED":
    case "SPAM_BLOCKED":
    case "DUPLICATE_MESSAGE":
    case "REQUEST_IN_FLIGHT":
      return 429;
    default:
      return 500;
  }
}

function getArenaChatErrorMessage(code: string) {
  switch (code) {
    case "EMPTY_MESSAGE":
      return "Message cannot be empty.";
    case "LINKS_BLOCKED":
      return "Links, emails and formatted content are blocked in arena chat.";
    case "PLAIN_TEXT_ONLY":
      return "Arena chat accepts only ordinary plain text.";
    case "ACCOUNT_RESTRICTED":
      return "This account is restricted from posting in chat.";
    case "GUEST_CHAT_DISABLED":
      return "Guest posting is currently disabled in arena chat.";
    case "RATE_LIMITED":
      return "You can send one message every 2 seconds.";
    case "SPAM_BLOCKED":
      return "Too many messages in a short period. Slow down.";
    case "DUPLICATE_MESSAGE":
      return "Do not repeat the same message.";
    case "REQUEST_IN_FLIGHT":
      return "Previous chat request is still being processed.";
    default:
      return "Chat message could not be sent.";
  }
}

export async function GET() {
  const guestPostingEnabled = await getArenaChatGuestPostingEnabled();
  const messages = await listArenaChatMessages();

  return Response.json({
    messages,
    guestPostingEnabled
  });
}

export async function POST(request: Request) {
  try {
    const actor = await getRequestActor(request);
    if (!actor) {
      return Response.json(
        {
          error: "Sign in is required to post in arena chat."
        },
        {
          status: 401
        }
      );
    }

    if (actor.actorType === "guest" && !(await getArenaChatGuestPostingEnabled())) {
      return Response.json(
        {
          error: "Guest posting is currently disabled in arena chat."
        },
        {
          status: 403
        }
      );
    }

    const payload = (await request.json()) as {
      text?: string;
    };

    const message = await postArenaChatMessage(actor, payload.text ?? "");

    return Response.json({
      message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    return Response.json(
      {
        error: getArenaChatErrorMessage(message)
      },
      {
        status: getArenaChatErrorStatus(message)
      }
    );
  }
}
