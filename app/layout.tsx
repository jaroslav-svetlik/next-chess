import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HeaderAuthControls } from "@/components/auth/header-auth-controls";
import "./globals.css";

const HEADER_LINKS = [
  { href: "/#play-now", label: "Play" },
  { href: "/#practice", label: "Puzzles" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/#tournaments", label: "Tournaments" },
  { href: "/#how-it-works", label: "Learn" }
] as const;

export const metadata: Metadata = {
  title: "NextChess",
  description: "Premium multiplayer chess for players who want real-time serious games."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div className="page-shell">
          <header className="site-header">
            <div className="site-header-shell">
              <Link href="/" className="brand-mark">
                <span className="brand-mark-logo" aria-hidden="true">
                  <Image
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 640px) 170px, 220px"
                    src="/branding/nextchess-logo.png"
                  />
                </span>
                <span className="brand-mark-label">NextChess</span>
              </Link>

              <nav className="site-nav-links" aria-label="Primary">
                {HEADER_LINKS.map((link) => (
                  <Link className="site-nav-link" href={link.href} key={link.href}>
                    {link.label}
                  </Link>
                ))}
              </nav>

              <div className="main-nav">
                <HeaderAuthControls />
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
