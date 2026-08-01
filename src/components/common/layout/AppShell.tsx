"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <main className="dm-app-page">
      <header className="dm-app-header">
        <Link href="/home" className="dm-app-brand">
          Baddie Phyto
        </Link>

        <nav className="dm-app-nav">
          <Link href="/home">ホーム</Link>
          <Link href="/register">登録</Link>
          <Link href="/decks">デッキ</Link>
          <Link href="/supplies">サプライ</Link>
          <Link href="/battle">対戦</Link>
        </nav>
      </header>

      <section className="dm-app-main">
        {children}
      </section>
    </main>
  );
}
