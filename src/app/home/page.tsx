"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile, type Profile } from "@/lib/auth/getOrCreateProfile";

export default function HomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const nextProfile = await getOrCreateProfile();
      if (!nextProfile) {
        router.replace("/login");
        return;
      }

      setProfile(nextProfile);
      setLoading(false);
    }

    void loadProfile();
  }, [router]);

  return (
    <AppShell>
      {loading ? (
        <AppCard title="読み込み中" description="プロフィールを確認しています。">
          <p className="dm-muted-text">少し待ってください。</p>
        </AppCard>
      ) : (
        <div className="dm-app-grid">
          <AppCard
            title="ようこそ"
            description={`こんにちは、${profile?.nickname ?? profile?.email ?? "Player"} さん`}
          >
            <Link href="/profile" className="dm-button secondary">
              プロフィール
            </Link>
          </AppCard>

          <AppCard
            title="登録"
            description="カードやフラッグの登録・編集を行います。"
          >
            <Link href="/cards" className="dm-button secondary">
              登録画面へ
            </Link>
          </AppCard>

          <AppCard
            title="デッキ"
            description="デッキの作成・編集・確認を行います。"
          >
            <Link href="/decks" className="dm-button secondary">
              デッキ管理へ
            </Link>
          </AppCard>

          <AppCard
            title="対戦"
            description="一人回しや対戦ルームの開始・参加を行います。"
          >
            <Link href="/battle" className="dm-button secondary">
              対戦画面へ
            </Link>
          </AppCard>
        </div>
      )}
    </AppShell>
  );
}
