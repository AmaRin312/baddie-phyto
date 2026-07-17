"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile, type Profile } from "@/lib/auth/getOrCreateProfile";

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getOrCreateProfile();
      if (!nextProfile) {
        window.location.href = "/login";
        return;
      }
      setProfile(nextProfile);
      setLoading(false);
    }
    void loadProfile();
  }, []);

  return (
    <AppShell kicker="HOME" title="ホーム">
      {loading ? (
        <AppCard title="読み込み中" description="ログイン状態を確認しています。" />
      ) : (
        <div className="dm-app-grid">
          <AppCard
            title="プロフィール"
            description={`ようこそ、${profile?.nickname ?? profile?.email ?? "Player"}さん`}
          >
            <Link href="/profile" className="dm-button secondary">
              プロフィール
            </Link>
          </AppCard>
          <AppCard title="カード" description="Buddyfightカードを登録・管理します。">
            <Link href="/cards" className="dm-button secondary">カード管理</Link>
          </AppCard>
          <AppCard title="フラッグ" description="初期ライフ・手札・ゲージを管理します。">
            <Link href="/flags" className="dm-button secondary">フラッグ管理</Link>
          </AppCard>
          <AppCard title="デッキ" description="フラッグとバディを選んでデッキを作成します。">
            <Link href="/decks" className="dm-button secondary">デッキ管理</Link>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
