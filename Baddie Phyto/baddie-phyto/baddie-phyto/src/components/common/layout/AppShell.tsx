"use client";

import Link from "next/link";
import type { ReactNode } from "react";

type AppShellProps = {
  kicker: string;
  title: string;
  children: ReactNode;
};

export function AppShell({ kicker, title, children }: AppShellProps) {
  return (
    <main className="dm-app-page">
      <header className="dm-app-header">
        <Link href="/home" className="dm-app-brand">
          Baddie Phyto
        </Link>

        <nav className="dm-app-nav">
          <Link href="/home">ホーム</Link>
          <Link href="/cards">カード</Link>
          <Link href="/flags">フラッグ</Link>
          <Link href="/decks">デッキ</Link>
        </nav>
      </header>

      <section className="dm-app-main">
        <div className="dm-app-heading">
          <p className="dm-kicker">{kicker}</p>
          <h1 className="dm-app-title">{title}</h1>
        </div>
        {children}
      </section>
    </main>
  );
}
