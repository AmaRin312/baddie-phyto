"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { isBattleAbilityId } from "@/lib/battle/abilities/abilityTypes";
import { loadCardAbilityBehaviorKeyMap } from "@/lib/cards/cardAbilityActions";
import { searchCardRecords, setCardActive } from "@/lib/cards/cardActions";
import { getCardTypeLabel, type CardRecord } from "@/types/baddiePhyto";

export default function CardsPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [abilityKeyMap, setAbilityKeyMap] = useState<Map<string, string[]>>(
    () => new Map()
  );
  const [keyword, setKeyword] = useState("");
  const [includeInactive, setIncludeInactive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [deactivatingId, setDeactivatingId] = useState("");
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
      setAbilityKeyMap(new Map());
      setLoading(false);
      return;
    }

    const nextCards = data ?? [];
    setCards(nextCards);

    const abilityResult = await loadCardAbilityBehaviorKeyMap(
      nextCards.map((card) => card.id)
    );

    if (abilityResult.error) {
      console.error(abilityResult.error);
      setMessage(`Ability 情報の読み込みに失敗しました。${abilityResult.error.message}`);
      setAbilityKeyMap(new Map());
    } else {
      setAbilityKeyMap(abilityResult.data);
    }

    setLoading(false);
  }, [includeInactive, keyword]);

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
        return;
      }

      await reload();
    }

    void loadPage();
  }, [reload, router]);

  async function handleDeactivate(card: CardRecord) {
    if (!window.confirm(`「${card.name}」を無効化しますか？`)) return;

    setDeactivatingId(card.id);
    setMessage("");

    const { error } = await setCardActive(card.id, false);
    setDeactivatingId("");

    if (error) {
      console.error(error);
      setMessage(`カードの無効化に失敗しました。${error.message}`);
      return;
    }

    await reload();
  }

  function renderAbilityKeys(cardId: string) {
    const abilityKeys = abilityKeyMap.get(cardId) ?? [];
    if (abilityKeys.length === 0) return "-";

    return (
      <span className="dm-ability-key-list">
        {abilityKeys.map((abilityKey) => {
          const isSupported = isBattleAbilityId(abilityKey);
          return (
            <span
              key={abilityKey}
              className={
                isSupported
                  ? "dm-ability-key supported"
                  : "dm-ability-key unsupported"
              }
              title={isSupported ? "Battle 対応 Ability" : "Battle 未対応 Ability"}
            >
              {abilityKey}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <Link href="/cards/new" className="dm-button primary">
          カード新規登録
        </Link>
        <Link href="/cards/import" className="dm-button secondary">
          登録方法一覧
        </Link>
        <Link href="/cards/import/excel-zip" className="dm-button secondary">
          Excel・画像 ZIP
        </Link>
        <Link href="/cards/export" className="dm-button secondary">
          CSV エクスポート
        </Link>
        <Link href="/cards/import/history" className="dm-button secondary">
          インポート履歴
        </Link>
      </div>

      <AppCard
        title="カード検索"
        description="カード名と有効・無効表示を使って一覧を絞り込みます。"
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

      {message ? <p className="dm-form-message">{message}</p> : null}

      <AppCard title="カード一覧" description={`表示件数: ${cards.length} 件`}>
        {loading ? (
          <p className="dm-muted-text">カードを読み込み中です。</p>
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
              <span>Ability</span>
              <span>状態</span>
              <span>操作</span>
            </div>

            {cards.map((card) => (
              <div key={card.id} className="dm-card-admin-row">
                <span>
                  <b>{card.name}</b>
                  {card.is_original ? (
                    <em className="dm-card-mini-badge">オリカ</em>
                  ) : null}
                </span>
                <span>{getCardTypeLabel(card.card_type)}</span>
                <span>{card.size ?? "-"}</span>
                <span>{card.worlds.join(", ") || "-"}</span>
                <span>{card.races.join(", ") || "-"}</span>
                <span>{renderAbilityKeys(card.id)}</span>
                <span>{card.is_active ? "有効" : "無効"}</span>
                <span className="dm-card-admin-actions">
                  <Link href={`/cards/${card.id}`} className="dm-button secondary">
                    編集
                  </Link>
                  {card.is_active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deactivatingId === card.id}
                      onClick={() => handleDeactivate(card)}
                    >
                      無効化
                    </Button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
