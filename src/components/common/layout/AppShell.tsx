"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/home", label: "ホーム" },
  { href: "/cards", label: "登録" },
  { href: "/decks", label: "デッキ" },
  { href: "/supplies", label: "サプライ" },
  { href: "/battle", label: "対戦" }
] as const;

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="dm-app-page">
      <header className="dm-app-header">
        <Link href="/home" className="dm-app-brand">
          Baddie Phyto
        </Link>

        <nav className="dm-app-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="dm-app-main">{children}</section>
    </main>
  );
}
