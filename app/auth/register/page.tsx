import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function RegisterPage() {
  return (
    <main className="content-wrap auth-page">
      <div className="auth-grid">
        <section className="auth-card">
          <span className="panel-kicker">Create Account</span>
          <h1 className="panel-title">Enter the arena with a real profile.</h1>
          <p className="panel-copy">
            Account identity now uses a unique username. Email stays unique for login, and display
            name is optional.
          </p>
          <AuthForm mode="register" />
          <p className="muted">
            Vec imate nalog? <Link href="/auth/login">Sign in</Link>
          </p>
        </section>

        <aside className="auth-side">
          <span className="panel-kicker">Platform goals</span>
          <ul className="list-clean">
            <li>Public i private game creation.</li>
            <li>Bullet, blitz, rapid i custom kontrole.</li>
            <li>Istorija partija i competitive systems spremni za sledece faze.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
