"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  updateCachedProfileNickname,
  type Profile
} from "@/lib/auth/getOrCreateProfile";

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
    let timeoutId: number | undefined;

    try {
      const update = supabase
        .from("profiles")
        .update({
          nickname: nickname.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(
          () => reject(new Error("保存の応答がありません。再読み込みして結果を確認してください。")),
          12_000
        );
      });
      const { data, error } = await Promise.race([update, timeout]);

      if (error) {
        console.error(error);
        setMessage(`ニックネームを保存できませんでした: ${error.message}`);
        return;
      }
      if (!data) {
        setMessage("プロフィールが見つからず保存されませんでした。再読み込みしてください。");
        return;
      }

      const nextNickname = nickname.trim() || null;
      updateCachedProfileNickname(profile.id, nextNickname);
      setMessage("プロフィールを保存しました。");
    } catch (error) {
      console.error("Profile nickname save failed.", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "ニックネームを保存できませんでした。"
      );
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      setSaving(false);
    }
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
