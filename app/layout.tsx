import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { HeaderAuthControls } from "@/components/auth/header-auth-controls";
import "./globals.css";

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
      <body>
        <div className="page-shell">
          <header className="site-header">
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
            <nav className="main-nav">
              <HeaderAuthControls />
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
