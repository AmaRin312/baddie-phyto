"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";

export default function RegisterPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    void getOrCreateProfile().then((profile) => setIsAdmin(Boolean(profile?.is_admin)));
  }, []);

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/" />
      </div>
      <div className="dm-app-grid">
        <AppCard
          title="カード登録"
          description="カードの新規登録、編集、画像管理、インポートを行います。"
        >
          <div className="dm-dialog-actions">
            <Link href="/cards" className="dm-button primary">
              カード管理
            </Link>
            <Link href="/cards/new" className="dm-button secondary">
              新規カード
            </Link>
            <Link href="/cards/import/excel-zip" className="dm-button secondary">
              Excel＋画像ZIP
            </Link>
          </div>
        </AppCard>

        <AppCard
          title="フラッグ登録"
          description="ゲーム開始フラッグの登録、編集、画像管理を行います。"
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

        <AppCard
          title="サプライ登録"
          description="デッキや対戦画面で使うスリーブ・プレイマットを登録します。"
        >
          <Link href="/supplies" className="dm-button primary">
            サプライ登録
          </Link>
        </AppCard>

        {isAdmin && (
          <AppCard
            title="管理者設定"
            description="サイト全体で使用するデフォルトスリーブを設定します。"
          >
            <Link href="/admin" className="dm-button secondary">
              管理者画面
            </Link>
          </AppCard>
        )}
      </div>
    </AppShell>
  );
}
