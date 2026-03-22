import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/session";

export default async function RegisterPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/lobby");
  }

  return (
    <main className="content-wrap auth-page">
      <div className="auth-grid">
        <section className="auth-card auth-card-register">
          <div className="auth-register-hero">
            <div className="auth-register-hero-copy">
              <span className="panel-kicker">Create Account</span>
              <h1 className="panel-title">Set up a profile you can keep.</h1>
              <p className="panel-copy">
                Pick a permanent username, add an optional display name, and secure the account
                with a strong password you save before finishing registration.
              </p>
            </div>
            <div className="auth-register-badges" aria-hidden="true">
              <span className="pill">Readable flow</span>
              <span className="pill">Strong password required</span>
              <span className="pill">Username-first identity</span>
            </div>
          </div>
          <AuthForm mode="register" />
          <p className="muted auth-switch-copy">
            Already have an account? <Link href="/auth/login">Sign in</Link>
          </p>
        </section>

        <aside className="auth-side auth-register-side">
          <div className="auth-side-section">
            <span className="panel-kicker">Before you start</span>
            <ul className="list-clean auth-checklist">
              <li>Choose a username you want to keep publicly.</li>
              <li>Use a password manager or secure note for the generated password.</li>
              <li>Your email is used for sign-in and account recovery, not as your public identity.</li>
            </ul>
          </div>

          <div className="auth-side-section">
            <span className="panel-kicker">What your account unlocks</span>
            <ul className="list-clean auth-checklist">
              <li>Persistent ratings, game history, and replay access.</li>
              <li>Public profile presence tied to your username.</li>
              <li>Public and private game creation across bullet, blitz, rapid, and custom time controls.</li>
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
