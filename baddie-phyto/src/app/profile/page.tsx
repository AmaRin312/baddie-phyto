"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/common/layout/AppShell";
import { AppCard } from "@/components/common/card/AppCard";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ShortcutSettingsPanel } from "@/components/profile/ShortcutSettingsPanel";
import { getOrCreateProfile, type Profile } from "@/lib/auth/getOrCreateProfile";
import { Button } from "@/components/common/button";
import { BackButton } from "@/components/common/navigation/BackButton";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
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

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell kicker="PROFILE" title="プロフィール">
      <div className="dm-page-actions">
        <BackButton fallbackHref="/home" />
        <Button variant="danger" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      <AppCard
        title="プロフィール編集"
        description="対戦中に表示される名前を設定します。"
      >
        {loading ? (
          <p className="dm-muted-text">読み込み中...</p>
        ) : profile ? (
          <ProfileForm profile={profile} />
        ) : null}
      </AppCard>

      <AppCard
        title="ショートカット設定"
        description="Baddie Phyto専用のショートカットをユーザーごとに保存します。"
      >
        <ShortcutSettingsPanel />
      </AppCard>
    </AppShell>
  );
}
