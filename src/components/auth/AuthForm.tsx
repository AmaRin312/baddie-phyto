"use client";

import { useSearchParams } from "next/navigation";
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

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function hasActiveSession() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) return true;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) return true;

    if (attempt < 2) {
      await wait(200 * (attempt + 1));
    }
  }

  return false;
}

export function AuthForm({ mode, initialMessage = "" }: AuthFormProps) {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState(initialMessage);
  const [loading, setLoading] = useState(false);
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function resolveAuthState() {
      try {
        const errorDescription = searchParams.get("error_description");
        const errorCode = searchParams.get("error");

        if (errorCode || errorDescription) {
          if (!mounted) return;
          setMessage(errorDescription ?? "Discordログインに失敗しました。");
          return;
        }

        if (!mounted) return;

        const { data: sessionData } = await supabase.auth.getSession();
        const sessionReady = sessionData.session ? true : await hasActiveSession();
        if (!mounted) return;

        if (sessionReady) {
          const { data: userData } = await supabase.auth.getUser();
          if (!mounted) return;
          setActiveAccount(
            userData.user?.user_metadata?.full_name ??
              userData.user?.user_metadata?.name ??
              userData.user?.email ??
              "ログイン中のアカウント"
          );
        }
      } catch (error) {
        if (!mounted) return;
        console.error("Login session check failed.", error);
        setMessage("ログイン状態を確認できませんでした。再読み込みしてください。");
      } finally {
        if (mounted) setCheckingSession(false);
      }
    }

    const sessionCheckTimeout = window.setTimeout(() => {
      if (!mounted) return;
      setMessage("ログイン状態の確認に時間がかかっています。再読み込みしてください。");
      setCheckingSession(false);
    }, 12_000);

    void resolveAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_IN" && session) {
        setActiveAccount(
          session.user.user_metadata?.full_name ??
            session.user.user_metadata?.name ??
            session.user.email ??
            "ログイン中のアカウント"
        );
        setCheckingSession(false);
      } else if (event === "SIGNED_OUT") {
        setActiveAccount(null);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(sessionCheckTimeout);
      subscription.unsubscribe();
    };
  }, [searchParams]);

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

  async function handleSiteSignOut() {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setActiveAccount(null);
    setMessage("サイトからログアウトしました。別のDiscordアカウントで続ける場合は、Discord側でもアカウントを切り替えてください。");
    setLoading(false);
  }

  return (
    <div className="dm-auth-form">
      <p className="dm-muted-text">{MODE_TEXT[mode].helper}</p>

      {checkingSession ? (
        <p className="dm-muted-text">ログイン状態を確認しています...</p>
      ) : activeAccount ? (
        <div className="dm-auth-account-state">
          <p className="dm-muted-text">サイトにログイン中: {activeAccount}</p>
          <button
            className="dm-button secondary"
            type="button"
            disabled={loading}
            onClick={() => void handleSiteSignOut()}
          >
            {loading ? "ログアウト中..." : "別のアカウントに切り替える"}
          </button>
          <p className="dm-muted-text">
            Discord側で別アカウントに切り替えてから、もう一度ログインしてください。
          </p>
        </div>
      ) : (

      <button
        className="dm-button primary"
        type="button"
        disabled={loading}
        onClick={handleDiscordLogin}
      >
        {loading ? "Discordへ移動中..." : MODE_TEXT[mode].button}
      </button>
      )}

      {message && <p className="dm-form-message">{message}</p>}
    </div>
  );
}
