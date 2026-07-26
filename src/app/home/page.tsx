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
          <AppCard
            title="対戦"
            description="デッキを選択して、一人回しや対戦画面を開始します。"
          >
            <Link href="/battle" className="dm-button primary">
              対戦開始
            </Link>
          </AppCard>
          <AppCard
            title="登録"
            description="カード登録・画像管理・フラッグ登録をまとめて行います。"
          >
            <Link href="/register" className="dm-button secondary">
              登録メニュー
            </Link>
          </AppCard>
          <AppCard
            title="デッキ"
            description="デッキの作成・編集・共有デッキやサンプルデッキの確認を行います。"
          >
            <Link href="/decks" className="dm-button secondary">
              デッキ管理
            </Link>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
