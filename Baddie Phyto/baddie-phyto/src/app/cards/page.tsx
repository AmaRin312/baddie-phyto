"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { searchCardRecords, setCardActive } from "@/lib/cards/cardActions";
import { getCardTypeLabel, type CardRecord } from "@/types/baddiePhyto";

export default function CardsPage() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { data, error } = await searchCardRecords({
      keyword,
      includeInactive
    });

    if (error) {
      console.error(error);
      setMessage(`カード一覧の読み込みに失敗しました。${error.message}`);
      setCards([]);
    } else {
      setCards(data ?? []);
    }
    setLoading(false);
  }, [includeInactive, keyword]);

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        window.location.href = "/login";
        return;
      }
      await reload();
    }
    void loadPage();
  }, [reload]);

  async function handleDeactivate(card: CardRecord) {
    if (!window.confirm(`「${card.name}」を無効化しますか？`)) return;
    setDeletingId(card.id);
    setMessage("");
    const { error } = await setCardActive(card.id, false);
    setDeletingId("");

    if (error) {
      console.error(error);
      setMessage(`カードの無効化に失敗しました。${error.message}`);
      return;
    }

    await reload();
  }

  return (
    <AppShell kicker="CARDS" title="カード管理">
      <div className="dm-page-actions">
        <Link href="/cards/new" className="dm-button primary">
          カード新規登録
        </Link>
        <Link href="/cards/import" className="dm-button secondary">
          CSVインポート
        </Link>
        <Link href="/cards/export" className="dm-button secondary">
          CSVエクスポート
        </Link>
        <Link href="/cards/import/history" className="dm-button secondary">
          インポート履歴
        </Link>
      </div>

      <AppCard
        title="カード検索"
        description="カード名で検索できます。画像なしカードもテキスト情報で表示します。"
      >
        <form
          className="dm-card-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            void reload();
          }}
        >
          <label>
            カード名
            <input
              value={keyword}
              placeholder="カード名を入力"
              onChange={(event) => setKeyword(event.target.value)}
            />
          </label>
          <label className="dm-settings-check-row">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            <span>無効カードも表示する</span>
          </label>
          <Button type="submit" variant="primary" loading={loading}>
            検索
          </Button>
        </form>
      </AppCard>

      {message && <p className="dm-form-message">{message}</p>}

      <AppCard
        title="カード一覧"
        description={`表示件数：${cards.length}件`}
      >
        {loading ? (
          <p className="dm-muted-text">カードを取得しています。</p>
        ) : cards.length === 0 ? (
          <p className="dm-muted-text">カードがありません。</p>
        ) : (
          <div className="dm-card-admin-list">
            <div className="dm-card-admin-row dm-card-admin-head">
              <span>カード名</span>
              <span>タイプ</span>
              <span>サイズ</span>
              <span>ワールド</span>
              <span>種族</span>
              <span>状態</span>
              <span>操作</span>
            </div>
            {cards.map((card) => (
              <div key={card.id} className="dm-card-admin-row">
                <span>
                  <b>{card.name}</b>
                </span>
                <span>{getCardTypeLabel(card.card_type)}</span>
                <span>{card.size ?? "-"}</span>
                <span>{card.worlds.join(", ") || "-"}</span>
                <span>{card.races.join(", ") || "-"}</span>
                <span>{card.is_active ? "有効" : "無効"}</span>
                <span className="dm-card-admin-actions">
                  <Link href={`/cards/${card.id}`} className="dm-button secondary">
                    編集
                  </Link>
                  {card.is_active && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deletingId === card.id}
                      onClick={() => handleDeactivate(card)}
                    >
                      無効化
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
