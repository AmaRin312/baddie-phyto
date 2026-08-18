import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  return (
    <main className="dm-page">
      <section className="dm-hero-card">
        <p className="dm-kicker">LOGIN</p>
        <h1 className="dm-title small">ログイン</h1>

        <AuthForm mode="login" initialMessage={resolvedSearchParams?.message ?? ""} />

        <p className="dm-link-text">
          アカウントをお持ちでない方は <Link href="/signup">こちら</Link>
        </p>
      </section>
    </main>
  );
}
