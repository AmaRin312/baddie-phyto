import { Suspense } from "react";
import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

export default function SignupPage() {
  return (
    <main className="dm-page">
      <section className="dm-hero-card">
        <p className="dm-kicker">SIGN UP</p>
        <h1 className="dm-title small">アカウント作成</h1>

        <Suspense fallback={<p className="dm-muted-text">ログイン状態を確認しています...</p>}>
          <AuthForm mode="signup" />
        </Suspense>

        <p className="dm-link-text">
          すでにアカウントがある場合は <Link href="/login">こちら</Link>
        </p>
      </section>
    </main>
  );
}
