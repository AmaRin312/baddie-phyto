"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Profile } from "@/lib/auth/getOrCreateProfile";

type ProfileFormProps = {
  profile: Profile;
};

export function ProfileForm({ profile }: ProfileFormProps) {
  const [nickname, setNickname] = useState(profile.nickname ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("profiles")
      .update({
        nickname: nickname.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);

    setSaving(false);

    if (error) {
      console.error(error);
      setMessage("保存に失敗しました。");
      return;
    }

    setMessage("プロフィールを保存しました。");
  }

  return (
    <form className="dm-auth-form" onSubmit={handleSave}>
      <label>
        ニックネーム
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="表示名を入力"
          maxLength={24}
        />
      </label>

      <button className="dm-button primary" type="submit" disabled={saving}>
        {saving ? "保存中..." : "保存"}
      </button>

      {message && <p className="dm-form-message">{message}</p>}
    </form>
  );
}