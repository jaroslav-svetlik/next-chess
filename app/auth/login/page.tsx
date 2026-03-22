import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getSession();

  if (session?.user) {
    redirect("/lobby");
  }

  return (
    <main className="content-wrap auth-page">
      <div className="auth-grid">
        <section className="auth-card">
          <span className="panel-kicker">Sign In</span>
          <h1 className="panel-title">Return to the board.</h1>
          <p className="panel-copy">
            Email/password auth is wired to the Better Auth client API and ready for the backend
            session flow once the environment and database are configured.
          </p>
          <AuthForm mode="login" />
          <p className="muted">
            Don't have an account? <Link href="/auth/register">Create account</Link>
          </p>
        </section>

        <aside className="auth-side">
          <span className="panel-kicker">Why this matters</span>
          <ul className="list-clean">
            <li>Sessions keep access to the lobby and game actions stable.</li>
            <li>Profiles, history, and invite ownership all depend on a stable user model.</li>
            <li>The auth foundation comes before the realtime layer so security is not bolted on later.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
