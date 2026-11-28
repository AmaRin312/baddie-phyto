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
  const [profileLoadError, setProfileLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      if (!active) return;
      setLoading(false);
      setProfileLoadError(true);
    }, 12_000);

    async function loadProfile() {
      try {
        const nextProfile = await getOrCreateProfile();
        if (!active) return;

        if (!nextProfile) {
          window.location.href = "/login";
          return;
        }
        if (nextProfile.isFallback) {
          setProfileLoadError(true);
          return;
        }

        setProfile(nextProfile);
        setProfileLoadError(false);
      } catch (error) {
        console.error("Profile page could not load the current profile.", error);
        if (active) setProfileLoadError(true);
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }

    void loadProfile();

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <AppShell>
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
        ) : profileLoadError ? (
          <div>
            <p className="dm-form-message">プロフィールをサーバーから確認できないため、編集欄を開いていません。既存のニックネームは変更していません。通信を確認して再読み込みしてください。</p>
            <button className="dm-button secondary" type="button" onClick={() => window.location.reload()}>
              再読み込み
            </button>
          </div>
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
