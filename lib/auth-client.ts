"use client";

import { createAuthClient } from "better-auth/react";

const baseURL =
  typeof window !== "undefined" ? window.location.origin : undefined;

export const authClient = createAuthClient({
  baseURL
});
