"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveAuthState() {
      const code = searchParams.get("code");
      const errorDescription = searchParams.get("error_description");
      const errorCode = searchParams.get("error");
      const nextPath = searchParams.get("next") || "/home";

      if (errorCode || errorDescription) {
        if (!mounted) return;
        setMessage(errorDescription ?? "Discordログインに失敗しました。");
        return;
      }

      if (code) {
        router.replace(`/auth/callback?${searchParams.toString()}`);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) {
        router.replace(nextPath);
      }
    }

    void resolveAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session) {
        router.replace("/home");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, searchParams]);

  async function handleDiscordLogin() {
    setLoading(true);
    setMessage("");

    const redirectTo =
      typeof window === "undefined"
        ? undefined
        : `${window.location.origin}/auth/callback?next=${encodeURIComponent("/home")}`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo,
        scopes: "identify email"
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
