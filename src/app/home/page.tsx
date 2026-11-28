"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile, type Profile } from "@/lib/auth/getOrCreateProfile";

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let mounted = true;
    const timeout = window.setTimeout(() => {
      if (!mounted) return;
      setLoadError(true);
      setLoading(false);
    }, 15_000);

    async function loadProfile() {
      try {
        const nextProfile = await getOrCreateProfile();
        if (!mounted) return;
        if (!nextProfile) {
          window.location.href = "/login";
          return;
        }
        setProfile(nextProfile);
        setLoadError(false);
        setLoading(false);
      } catch (error) {
        console.error("Home profile could not be loaded.", error);
        if (!mounted) return;
        setLoadError(true);
        setLoading(false);
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void loadProfile();

    return () => {
      mounted = false;
      window.clearTimeout(timeout);
    };
  }, []);

  return (
    <AppShell>
      {loading ? (
        <AppCard title="読み込み中" description="ログイン状態を確認しています。" />
      ) : loadError ? (
        <AppCard
          title="ログイン状態を確認できません"
          description="通信が完了しませんでした。接続を確認して、ページを再読み込みしてください。"
        >
          <button className="dm-button primary" onClick={() => window.location.reload()}>
            再読み込み
          </button>
        </AppCard>
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
