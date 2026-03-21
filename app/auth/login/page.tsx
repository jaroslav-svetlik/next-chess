import Link from "next/link";

import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <main className="content-wrap auth-page">
      <div className="auth-grid">
        <section className="auth-card">
          <span className="panel-kicker">Sign In</span>
          <h1 className="panel-title">Return to the board.</h1>
          <p className="panel-copy">
            Email/password auth je povezan na Better Auth client API, spreman za backend session
            flow kada se env i baza podignu.
          </p>
          <AuthForm mode="login" />
          <p className="muted">
            Nemate nalog? <Link href="/auth/register">Create account</Link>
          </p>
        </section>

        <aside className="auth-side">
          <span className="panel-kicker">Why this matters</span>
          <ul className="list-clean">
            <li>Sessions ce cuvati pristup lobby-u i game akcijama.</li>
            <li>Profile, istorija i invite ownership polaze od stabilnog user modela.</li>
            <li>Auth foundation ide pre realtime sloja da ne jurimo security rupe kasnije.</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
