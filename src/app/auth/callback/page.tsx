import { Suspense } from "react";
import { AuthCallbackClient } from "@/components/auth/AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="dm-page">
          <section className="dm-hero-card">
            <p className="dm-kicker">DISCORD AUTH</p>
            <h1 className="dm-title small">認証中</h1>
            <p className="dm-muted-text">Discordログインを確認しています...</p>
          </section>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
