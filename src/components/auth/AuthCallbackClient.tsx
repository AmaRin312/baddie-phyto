"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Discordログインを確認しています...");

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const nextPath = searchParams.get("next") || "/home";
      const code = searchParams.get("code");
      const errorDescription = searchParams.get("error_description");
      const errorCode = searchParams.get("error");

      if (errorCode || errorDescription) {
        router.replace(
          `/login?message=${encodeURIComponent(
            errorDescription ?? "Discordログインに失敗しました。"
          )}`
        );
        return;
      }

      if (!code) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace(nextPath);
          return;
        }

        router.replace(
          `/login?message=${encodeURIComponent("Discordログイン情報を取得できませんでした。")}`
        );
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (cancelled) {
        return;
      }

      if (error) {
        router.replace(`/login?message=${encodeURIComponent(error.message)}`);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace(
          `/login?message=${encodeURIComponent("ログインセッションの取得に失敗しました。")}`
        );
        return;
      }

      setMessage("ログインに成功しました。ホームへ移動します...");
      router.replace(nextPath);
    }

    void handleCallback();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main className="dm-page">
      <section className="dm-hero-card">
        <p className="dm-kicker">DISCORD AUTH</p>
        <h1 className="dm-title small">認証中</h1>
        <p className="dm-muted-text">{message}</p>
      </section>
    </main>
  );
}
