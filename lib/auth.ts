import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";

import { db } from "@/lib/db";
import { MIN_STRONG_PASSWORD_LENGTH, validateStrongPassword } from "@/lib/password";

const DEFAULT_AUTH_TRUSTED_ORIGINS = [
  "http://127.0.0.1:3000",
  "http://localhost:3000",
  "https://nextchess.org",
  "https://www.nextchess.org"
];

function normalizeOrigin(value: string | undefined | null) {
  const raw = value?.trim();
  if (!raw) {
    return null;
  }

  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function getAuthTrustedOrigins() {
  const configuredOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));

  return Array.from(
    new Set(
      [
        ...DEFAULT_AUTH_TRUSTED_ORIGINS,
        process.env.BETTER_AUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.APP_URL,
        ...configuredOrigins
      ]
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql"
  }),
  trustedOrigins: getAuthTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_STRONG_PASSWORD_LENGTH
  },
  user: {
    modelName: "User",
    additionalFields: {
      username: {
        type: "string",
        required: false,
        unique: true
      },
      displayName: {
        type: "string",
        required: false
      },
      avatarUrl: {
        type: "string",
        required: false
      }
    }
  },
  session: {
    modelName: "Session"
  },
  account: {
    modelName: "Account"
  },
  verification: {
    modelName: "Verification"
  },
  advanced: {
    database: {
      generateId: false
    }
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") {
        return;
      }

      const password = typeof ctx.body.password === "string" ? ctx.body.password : "";
      const passwordError = validateStrongPassword(password);

      if (passwordError) {
        throw APIError.from("BAD_REQUEST", {
          code: "WEAK_PASSWORD",
          message: passwordError
        });
      }
    })
  }
});
