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

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo
      }
    });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
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
