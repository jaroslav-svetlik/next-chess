import { prismaAdapter } from "@better-auth/prisma-adapter";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth";

import { db } from "@/lib/db";
import { MIN_STRONG_PASSWORD_LENGTH, validateStrongPassword } from "@/lib/password";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql"
  }),
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
