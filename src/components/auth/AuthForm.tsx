"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";

type AuthFormProps = {
  mode: AuthMode;
  initialMessage?: string;
};

const MODE_TEXT: Record<AuthMode, { button: string; helper: string }> = {
  login: {
    button: "Discordでログイン",
    helper: "Discordアカウントでログインします。"
  },
  signup: {
    button: "Discordで登録",
    helper: "Discordアカウントでアカウント登録します。"
  }
};

export function AuthForm({ mode, initialMessage = "" }: AuthFormProps) {
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  async function handleDiscordLogin() {
    setLoading(true);
    setMessage("");

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/auth/callback`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo
      }
    });

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    if (data?.url && typeof window !== "undefined") {
      window.location.assign(data.url);
      return;
    }

    setLoading(false);
    setMessage("DiscordログインURLを取得できませんでした。Supabase の Discord Provider 設定を確認してください。");
  }

  return (
    <div className="dm-auth-form">
      <p className="dm-muted-text">{MODE_TEXT[mode].helper}</p>

      <button
        className="dm-button primary"
        type="button"
        disabled={loading}
        onClick={handleDiscordLogin}
      >
        {loading ? "Discordへ移動中..." : MODE_TEXT[mode].button}
      </button>

      {message && <p className="dm-form-message">{message}</p>}
    </div>
  );
}
