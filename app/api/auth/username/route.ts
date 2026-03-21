import { db } from "@/lib/db";
import { normalizeUsername, validateUsername } from "@/lib/username";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get("username") ?? "");
  const validationError = validateUsername(username);

  if (validationError) {
    return Response.json(
      {
        available: false,
        error: validationError
      },
      {
        status: 400
      }
    );
  }

  const existing = await db.user.findUnique({
    where: {
      username
    },
    select: {
      id: true
    }
  });

  return Response.json({
    available: !existing,
    username,
    error: existing ? "That username is already taken. Choose another one." : null
  });
}
