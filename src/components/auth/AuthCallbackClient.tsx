"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSessionReady() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) return true;

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (!userError && userData.user) return true;

    if (attempt < 9) {
      await wait(250);
    }
  }

  return false;
}

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackStarted = useRef(false);
  const [message, setMessage] = useState("Discordログインを確認しています...");

  useEffect(() => {
    if (callbackStarted.current) return;
    callbackStarted.current = true;

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
        const sessionReady = await waitForSessionReady();
        if (sessionReady) {
          window.location.replace(nextPath);
          return;
        }

        router.replace(
          `/login?message=${encodeURIComponent("Discordログイン情報を取得できませんでした。")}`
        );
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        router.replace(`/login?message=${encodeURIComponent(error.message)}`);
        return;
      }
      setMessage("ログインに成功しました。ホームへ移動します...");
      window.location.replace(nextPath);
    }

    void handleCallback();
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
