"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DebugStatus =
  | { state: "loading"; message: string; detail?: never }
  | { state: "success"; message: string; detail: string }
  | { state: "error"; message: string; detail: string };

type DebugCard = {
  id: string;
  name: string | null;
};

export default function SupabaseDebugPage() {
  const [status, setStatus] = useState<DebugStatus>({
    state: "loading",
    message: "Supabase接続を確認しています。"
  });

  useEffect(() => {
    async function checkSupabaseConnection() {
      console.log("[debug/supabase] connection check started");

      const authResult = await supabase.auth.getUser();
      console.log("[debug/supabase] auth user result", authResult);

      const cardsResult = await supabase
        .from("cards")
        .select("id,name")
        .limit(1)
        .maybeSingle<DebugCard>();

      if (cardsResult.error) {
        console.log("[debug/supabase] cards query failed", cardsResult.error);
        setStatus({
          state: "error",
          message: "Supabase接続またはcards取得に失敗しました。",
          detail: [
            `Auth: ${authResult.data.user ? "ログイン済み" : "未ログイン"}`,
            `Auth error: ${authResult.error?.message ?? "なし"}`,
            `Cards error: ${cardsResult.error.message}`
          ].join("\n")
        });
        return;
      }

      console.log("[debug/supabase] cards query succeeded", cardsResult.data);
      setStatus({
        state: "success",
        message: "Supabase接続に成功しました。",
        detail: [
          `Auth: ${authResult.data.user ? "ログイン済み" : "未ログイン"}`,
          `Auth user id: ${authResult.data.user?.id ?? "-"}`,
          cardsResult.data
            ? `cardsから1件取得: ${cardsResult.data.name ?? "(no name)"} / ${cardsResult.data.id}`
            : "cardsテーブルは取得できましたが、レコードは0件です。"
        ].join("\n")
      });
    }

    void checkSupabaseConnection();
  }, []);

  return (
    <main className="debug-supabase-page">
      <section className={`debug-supabase-card ${status.state}`}>
        <p className="debug-supabase-kicker">DEBUG / SUPABASE</p>
        <h1>Supabase接続確認</h1>
        <p>{status.message}</p>
        {status.state !== "loading" && <pre>{status.detail}</pre>}
      </section>

      <style jsx>{`
        .debug-supabase-page {
          min-height: 100vh;
          padding: 32px;
          display: grid;
          place-items: center;
          color: #172554;
          background:
            radial-gradient(circle at 18% 18%, rgba(191, 219, 254, 0.72), transparent 30%),
            linear-gradient(180deg, #f8fbff, #eef6ff);
          font-family:
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;
        }

        .debug-supabase-card {
          width: min(720px, 100%);
          border: 1px solid rgba(147, 197, 253, 0.9);
          border-radius: 24px;
          padding: 28px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 18px 44px rgba(59, 130, 246, 0.12);
        }

        .debug-supabase-card.success {
          border-color: rgba(34, 197, 94, 0.72);
        }

        .debug-supabase-card.error {
          border-color: rgba(239, 68, 68, 0.72);
        }

        .debug-supabase-kicker {
          margin: 0 0 8px;
          color: #7c3aed;
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.14em;
        }

        h1 {
          margin: 0 0 12px;
          color: #2563eb;
          font-size: clamp(32px, 5vw, 52px);
          line-height: 1;
        }

        p {
          margin: 0;
          color: #334155;
          line-height: 1.7;
        }

        pre {
          margin: 18px 0 0;
          overflow: auto;
          border-radius: 14px;
          padding: 14px;
          color: #e2e8f0;
          background: #0f172a;
          white-space: pre-wrap;
        }
      `}</style>
    </main>
  );
}
