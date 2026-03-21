import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";

import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql"
  }),
  emailAndPassword: {
    enabled: true
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
  }
});
