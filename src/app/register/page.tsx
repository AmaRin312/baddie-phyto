"use client";

import Link from "next/link";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";

export default function RegisterPage() {
  return (
    <AppShell kicker="REGISTER" title="登録">
      <div className="dm-app-grid">
        <AppCard
          title="カード登録"
          description="カードの新規登録・編集・画像管理・インポートを行います。"
        >
          <div className="dm-dialog-actions">
            <Link href="/cards" className="dm-button primary">
              カード管理
            </Link>
            <Link href="/cards/new" className="dm-button secondary">
              新規カード
            </Link>
            <Link href="/cards/import/excel-zip" className="dm-button secondary">
              Excel+画像ZIP
            </Link>
          </div>
        </AppCard>

        <AppCard
          title="フラッグ登録"
          description="ゲーム開始フラッグの登録・編集・画像管理を行います。"
        >
          <div className="dm-dialog-actions">
            <Link href="/flags" className="dm-button primary">
              フラッグ管理
            </Link>
            <Link href="/flags/new" className="dm-button secondary">
              新規フラッグ
            </Link>
          </div>
        </AppCard>
      </div>
    </AppShell>
  );
}
