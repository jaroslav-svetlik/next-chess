"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import { normalizeUsername, validateUsername } from "@/lib/username";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function mapAuthError(message: string | undefined, email: string, username?: string) {
    const normalized = message?.toLowerCase() ?? "";

    if (
      normalized.includes("username") ||
      normalized.includes("unique constraint") ||
      normalized.includes("duplicate key")
    ) {
      return username
        ? `Username "${username}" is already taken. Choose another one.`
        : "That username is already taken. Choose another one.";
    }

    if (normalized.includes("use another email") || normalized.includes("already exists")) {
      return `Account for ${email} already exists. Sign in with that email or use a different one.`;
    }

    if (normalized.includes("password") && normalized.includes("short")) {
      return "Password is too short.";
    }

    if (normalized.includes("invalid email")) {
      return "Enter a valid email address.";
    }

    return message ?? (mode === "register" ? "Registration failed." : "Login failed.");
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);

    const name = String(formData.get("name") ?? "").trim();
    const rawUsername = String(formData.get("username") ?? "");
    const username = normalizeUsername(rawUsername);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    try {
      if (mode === "register") {
        const usernameValidationError = validateUsername(username);
        if (usernameValidationError) {
          setError(usernameValidationError);
          return;
        }

        const usernameCheckResponse = await fetch(
          `/api/auth/username?username=${encodeURIComponent(username)}`,
          {
            cache: "no-store"
          }
        );
        const usernameCheckPayload = (await usernameCheckResponse.json().catch(() => null)) as
          | {
              available?: boolean;
              error?: string | null;
            }
          | null;

        if (!usernameCheckResponse.ok || usernameCheckPayload?.available === false) {
          setError(
            usernameCheckPayload?.error ?? `Username "${username}" is already taken. Choose another one.`
          );
          return;
        }

        const response = await fetch("/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password,
            name: username,
            username,
            displayName: name || undefined
          })
        });
        const payload = (await response.json().catch(() => null)) as
          | {
              message?: string;
              error?: {
                message?: string;
              };
            }
          | null;

        if (!response.ok) {
          setError(mapAuthError(payload?.error?.message ?? payload?.message, email, username));
        } else {
          router.push("/lobby");
          router.refresh();
        }
      } else {
        const result = await authClient.signIn.email({
          email,
          password
        });

        if (result.error) {
          setError(mapAuthError(result.error.message, email));
        } else {
          router.push("/lobby");
          router.refresh();
        }
      }
    } catch {
      setError("Unexpected auth error. Check Better Auth env and database setup.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      className="field-grid"
      action={handleSubmit}
    >
      {mode === "register" ? (
        <div className="field">
          <label htmlFor="username">Username</label>
          <input
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            id="username"
            name="username"
            placeholder="unique_handle"
            required
          />
          <p className="field-hint">Unique public handle. Use lowercase letters, numbers and underscores only.</p>
        </div>
      ) : null}
      {mode === "register" ? (
        <div className="field">
          <label htmlFor="name">Display name</label>
          <input
            autoComplete="nickname"
            id="name"
            name="name"
            placeholder="Optional public label"
          />
          <p className="field-hint">Optional. If left empty, your username is shown publicly.</p>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          autoComplete="email"
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          required
        />
      </div>
      {error ? <p className="muted">{error}</p> : null}
      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? "Working..." : mode === "register" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
