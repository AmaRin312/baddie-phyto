import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="dm-page">
      <section className="dm-hero-card">
        <p className="dm-kicker">FUTURE CARD BUDDYFIGHT</p>
        <h1 className="dm-title">Baddie Phyto</h1>
        <p className="dm-subtitle">Build your deck. Choose your buddy.</p>

        <div className="dm-actions">
          <Link href="/login" className="dm-button primary">
            ログイン
          </Link>
          <Link href="/signup" className="dm-button secondary">
            アカウント作成
          </Link>
        </div>
      </section>
    </main>
  );
}
