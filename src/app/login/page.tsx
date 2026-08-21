import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function LoginPage() {
  return (
    <main className="dm-page">
      <section className="dm-hero-card">
        <p className="dm-kicker">LOGIN</p>
        <h1 className="dm-title small">ログイン</h1>

        <Suspense fallback={<p className="dm-muted-text">ログイン状態を確認しています...</p>}>
          <AuthForm mode="login" />
        </Suspense>

        <p className="dm-link-text">
          アカウント未作成の場合は <Link href="/signup">こちら</Link>
        </p>
      </section>
    </main>
  );
}
