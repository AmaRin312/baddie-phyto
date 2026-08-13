"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { ShortcutSettingsPanel } from "@/components/profile/ShortcutSettingsPanel";
import { getOrCreateProfile, type Profile } from "@/lib/auth/getOrCreateProfile";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/home" />
        <Button variant="danger" onClick={handleLogout}>
          ログアウト
        </Button>
      </div>

      <AppCard title="プロフィール設定" description="表示名や設定を編集します。">
        {loading ? (
          <p className="dm-muted-text">読み込み中...</p>
        ) : profile ? (
          <ProfileForm profile={profile} />
        ) : null}
      </AppCard>

      <AppCard
        title="ショートカット設定"
        description="Baddie Phyto 内で使うショートカットを設定します。"
      >
        <ShortcutSettingsPanel />
      </AppCard>
    </AppShell>
  );
}
