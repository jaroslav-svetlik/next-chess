import { listArenaChatMessages, postArenaChatMessage } from "@/lib/arena-chat";
import { getRequestActor } from "@/lib/request-actor";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    messages: listArenaChatMessages()
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

    const payload = (await request.json()) as {
      text?: string;
    };

    const message = await postArenaChatMessage(actor, payload.text ?? "");

    return Response.json({
      message
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const status =
      message === "EMPTY_MESSAGE" ||
      message === "LINKS_BLOCKED" ||
      message === "PLAIN_TEXT_ONLY"
        ? 400
        : message === "ACCOUNT_RESTRICTED"
          ? 403
          : message === "RATE_LIMITED" ||
              message === "SPAM_BLOCKED" ||
              message === "DUPLICATE_MESSAGE" ||
              message === "REQUEST_IN_FLIGHT"
            ? 429
            : 500;

    return Response.json(
      {
        error:
          message === "EMPTY_MESSAGE"
            ? "Message cannot be empty."
            : message === "LINKS_BLOCKED"
              ? "Links, emails and formatted content are blocked in arena chat."
              : message === "PLAIN_TEXT_ONLY"
                ? "Arena chat accepts only ordinary plain text."
            : message === "ACCOUNT_RESTRICTED"
              ? "This account is restricted from posting in chat."
              : message === "RATE_LIMITED"
                ? "You can send one message every 2 seconds."
                : message === "SPAM_BLOCKED"
                  ? "Too many messages in a short period. Slow down."
                  : message === "DUPLICATE_MESSAGE"
                    ? "Do not repeat the same message."
                    : message === "REQUEST_IN_FLIGHT"
                      ? "Previous chat request is still being processed."
              : "Chat message could not be sent."
      },
      {
        status
      }
    );
  }
}
