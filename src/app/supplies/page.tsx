"use client";

import Link from "next/link";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";

export default function SuppliesPage() {
  return (
    <AppShell>
      <div className="dm-page-actions">
        <Link href="/decks" className="dm-button secondary">
          デッキ管理へ
        </Link>
        <Link href="/battle" className="dm-button primary">
          対戦画面へ
        </Link>
      </div>

      <div className="dm-stack">
        <AppCard
          title="サプライ設定"
          description="現在のサプライ設定は、デッキ編集画面と対戦画面を中心に使う構成です。"
        >
          <p className="dm-muted-text">
            スリーブやプレイマットは、各デッキに紐づく形で保存・確認できます。
          </p>
        </AppCard>

        <AppCard
          title="今できること"
          description="運用中のフローを崩さずに、必要な入口だけを残しています。"
        >
          <ul>
            <li>デッキ編集画面でスリーブとプレイマットを選ぶ</li>
            <li>対戦画面で選択済みサプライを確認する</li>
            <li>今後ここにサプライ専用管理UIを集約できる状態にしてあります</li>
          </ul>
        </AppCard>
      </div>
    </AppShell>
  );
}
