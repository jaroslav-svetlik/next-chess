"use client";

import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";
import {
  MIN_STRONG_PASSWORD_LENGTH,
  generateStrongPassword,
  getPasswordStrength,
  validateStrongPassword
} from "@/lib/password";
import { normalizeUsername, validateUsername } from "@/lib/username";

type AuthMode = "login" | "register";

type AuthFormProps = {
  mode: AuthMode;
};

type RegisterPayload = {
  email: string;
  name: string;
  password: string;
  username: string;
};

function getCurrentOriginLabel() {
  if (typeof window === "undefined") {
    return "this site";
  }

  return window.location.origin;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [generatedPasswordNotice, setGeneratedPasswordNotice] = useState<string | null>(null);
  const [pendingRegistration, setPendingRegistration] = useState<RegisterPayload | null>(null);
  const [confirmedSavedPassword, setConfirmedSavedPassword] = useState<string | null>(null);

  function mapAuthError(message: string | undefined, email: string, username?: string) {
    const normalized = message?.toLowerCase() ?? "";

    if (normalized.includes("invalid origin") || normalized.includes("invalid_origin")) {
      return `This auth request came from ${getCurrentOriginLabel()}, but the auth server does not trust that origin yet. Open NextChess directly on its main domain and try again. If this domain or port is intentional, add it to BETTER_AUTH_TRUSTED_ORIGINS on the server.`;
    }

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

  async function submitRegistration({ email, name, password, username }: RegisterPayload) {
    setError(null);
    setIsPending(true);

    try {
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
        return;
      }

      router.push("/lobby");
      router.refresh();
    } catch {
      setError("Unexpected auth error. Check Better Auth env and database setup.");
    } finally {
      setIsPending(false);
    }
  }

  async function submitLogin(email: string, password: string) {
    setError(null);
    setIsPending(true);

    try {
      const result = await authClient.signIn.email({
        email,
        password
      });

      if (result.error) {
        setError(mapAuthError(result.error.message, email));
        return;
      }

      router.push("/lobby");
      router.refresh();
    } catch {
      setError("Unexpected auth error. Check Better Auth env and database setup.");
    } finally {
      setIsPending(false);
    }
  }

  async function handleSavedPasswordConfirmation() {
    if (!pendingRegistration) {
      return;
    }

    setConfirmedSavedPassword(pendingRegistration.password);
    setPendingRegistration(null);
    await submitRegistration(pendingRegistration);
  }

  async function handleSubmit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const rawUsername = String(formData.get("username") ?? "");
    const username = normalizeUsername(rawUsername);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (mode === "register") {
      const usernameValidationError = validateUsername(username);
      if (usernameValidationError) {
        setError(usernameValidationError);
        setPendingRegistration(null);
        return;
      }

      const passwordValidationError = validateStrongPassword(password);
      if (passwordValidationError) {
        setError(passwordValidationError);
        setPendingRegistration(null);
        return;
      }

      const registrationPayload = {
        email,
        name,
        password,
        username
      };

      if (confirmedSavedPassword !== password) {
        setError("Save the password first, then confirm that it is stored.");
        setPendingRegistration(registrationPayload);
        return;
      }

      setPendingRegistration(null);
      await submitRegistration(registrationPayload);
      return;
    }

    await submitLogin(email, password);
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleSubmit(new FormData(event.currentTarget));
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPasswordValue(event.target.value);
    setGeneratedPasswordNotice(null);

    if (confirmedSavedPassword !== null) {
      setConfirmedSavedPassword(null);
    }

    if (pendingRegistration) {
      setPendingRegistration(null);
    }
  }

  function handleFormChange(event: ChangeEvent<HTMLFormElement>) {
    if (mode !== "register") {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name === "password") {
      return;
    }

    if (pendingRegistration) {
      setPendingRegistration(null);
    }
  }

  function handleGeneratePassword() {
    setPasswordValue(generateStrongPassword());
    setIsPasswordVisible(true);
    setGeneratedPasswordNotice("Strong password inserted. Save it before creating the account.");
    setConfirmedSavedPassword(null);
    setPendingRegistration(null);
    setError(null);
  }

  const passwordValidationMessage =
    mode === "register" && passwordValue ? validateStrongPassword(passwordValue) : null;
  const passwordStrength = mode === "register" ? getPasswordStrength(passwordValue) : null;
  const isRegister = mode === "register";

  return (
    <form
      className={`field-grid${isRegister ? " auth-form-register" : ""}`}
      onChange={handleFormChange}
      onSubmit={handleFormSubmit}
    >
      {isRegister ? (
        <section className="auth-form-section">
          <div className="auth-form-section-head">
            <span className="auth-form-step">01</span>
            <div className="auth-form-section-copy">
              <h2 className="auth-form-section-title">Public profile</h2>
              <p>Choose how players will recognize you across the site.</p>
            </div>
          </div>
          <div className="auth-register-fields-grid">
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
              <p className="field-hint">
                Unique public handle. Use lowercase letters, numbers and underscores only.
              </p>
            </div>
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
          </div>
        </section>
      ) : null}

      <section className={`auth-form-section${isRegister ? "" : " auth-form-section-compact"}`}>
        {isRegister ? (
          <div className="auth-form-section-head">
            <span className="auth-form-step">02</span>
            <div className="auth-form-section-copy">
              <h2 className="auth-form-section-title">Sign-in details</h2>
              <p>Use an email you control. It stays private and is only used to access the account.</p>
            </div>
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
          {isRegister ? <p className="field-hint">Your email is not shown as your public identity.</p> : null}
        </div>
      </section>

      <section className={`auth-form-section auth-form-section-security${isRegister ? "" : " auth-form-section-compact"}`}>
        {isRegister ? (
          <div className="auth-form-section-head">
            <span className="auth-form-step">03</span>
            <div className="auth-form-section-copy">
              <h2 className="auth-form-section-title">Security</h2>
              <p>Create a strong password and save it before completing registration.</p>
            </div>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="password">Password</label>
          <div className="auth-password-row">
            <input
              autoComplete={isRegister ? "new-password" : "current-password"}
              id="password"
              minLength={isRegister ? MIN_STRONG_PASSWORD_LENGTH : 8}
              name="password"
              onChange={handlePasswordChange}
              placeholder={
                isRegister
                  ? `At least ${MIN_STRONG_PASSWORD_LENGTH} characters`
                  : "At least 8 characters"
              }
              required
              spellCheck={false}
              type={isRegister && isPasswordVisible ? "text" : "password"}
              value={passwordValue}
            />
            {isRegister ? (
              <button
                className="secondary-button auth-inline-button"
                onClick={() => setIsPasswordVisible((currentValue) => !currentValue)}
                type="button"
              >
                {isPasswordVisible ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
          {isRegister ? (
            <div className="auth-inline-actions">
              <button
                className="secondary-button auth-inline-button"
                onClick={handleGeneratePassword}
                type="button"
              >
                Generate strong password
              </button>
            </div>
          ) : null}
          {isRegister ? (
            <p className="field-hint">
              Use at least {MIN_STRONG_PASSWORD_LENGTH} characters with uppercase, lowercase,
              number, and symbol.
            </p>
          ) : null}
          {isRegister && passwordStrength ? (
            <div
              className={`password-strength-meter strength-${passwordStrength.score}`}
              aria-live="polite"
            >
              <div className="password-strength-meter-header">
                <p className="field-hint password-strength-meter-title">Password strength</p>
                <span className="password-strength-meter-badge">{passwordStrength.label}</span>
              </div>
              <div className="password-strength-meter-track" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <span
                    className={`password-strength-meter-bar${index < passwordStrength.score ? " active" : ""}`}
                    key={index}
                  />
                ))}
              </div>
              <p className="field-hint password-strength-meter-label">
                {passwordStrength.score <= 2
                  ? "Too predictable. Add length, mixed case, numbers, and symbols."
                  : passwordStrength.score === 3
                    ? "Decent start. More length or uniqueness would make it stronger."
                    : "This password is in strong shape. Save it before creating the account."}
              </p>
            </div>
          ) : null}
          {passwordValidationMessage ? (
            <p className="field-hint field-hint-error">{passwordValidationMessage}</p>
          ) : null}
          {generatedPasswordNotice ? <p className="field-hint">{generatedPasswordNotice}</p> : null}
        </div>
      </section>

      {error ? <p className="notice danger auth-form-notice">{error}</p> : null}
      {isRegister && pendingRegistration ? (
        <div className="auth-password-confirmation" role="alert">
          <strong>Save this password before creating the account.</strong>
          <p>Confirm only after you stored it in a password manager or another secure place.</p>
          <div className="auth-inline-actions">
            <button
              className="primary-button translucent-cta"
              disabled={isPending}
              onClick={() => void handleSavedPasswordConfirmation()}
              type="button"
            >
              {isPending ? "Working..." : "I saved it, create account"}
            </button>
            <button
              className="secondary-button auth-inline-button"
              disabled={isPending}
              onClick={() => {
                setPendingRegistration(null);
                setError(null);
              }}
              type="button"
            >
              Not yet
            </button>
          </div>
        </div>
      ) : null}
      <div className="auth-submit-stack">
        {isRegister ? (
          <p className="field-hint auth-submit-copy">
            Finish only after you saved your password somewhere secure.
          </p>
        ) : null}
        <button
          className="primary-button translucent-cta"
          disabled={isPending || (isRegister && pendingRegistration !== null)}
          type="submit"
        >
          {isPending
            ? "Working..."
            : isRegister && pendingRegistration
              ? "Confirm saved password below"
              : isRegister
                ? "Create account"
                : "Sign in"}
        </button>
      </div>
    </form>
  );
}
