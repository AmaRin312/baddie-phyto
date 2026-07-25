"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { loadDecks } from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import {
  DECK_ERA_OPTIONS,
  getDeckEraLabel,
  getDeckVisibilityLabel,
  type CardRecord,
  type DeckEraKey,
  type DeckRecord,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [eraFilter, setEraFilter] = useState<DeckEraKey | "">("");
  const flagMap = useMemo(() => new Map(flags.map((flag) => [flag.id, flag])), [flags]);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const filteredDecks = useMemo(() => {
    if (!eraFilter) return decks;
    return decks.filter((deck) => deck.era_key === eraFilter);
  }, [decks, eraFilter]);

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      setCurrentUserId(profile.id);
      const [deckResult, flagResult, cardResult] = await Promise.all([
        loadDecks(),
        loadFlags(),
        loadCards()
      ]);
      if (deckResult.error || flagResult.error || cardResult.error) {
        console.error(deckResult.error ?? flagResult.error ?? cardResult.error);
        setMessage("デッキ一覧の読み込みに失敗しました。");
      } else {
        setDecks((deckResult.data ?? []) as DeckRecord[]);
        setFlags(flagResult.data ?? []);
        setCards((cardResult.data ?? []) as CardRecord[]);
      }
      setLoading(false);
    }
    void loadPage();
  }, []);

  return (
    <AppShell kicker="DECKS" title="デッキ管理">
      <div className="dm-page-actions">
        <Link href="/decks/new" className="dm-button primary">
          デッキ作成
        </Link>
      </div>
      <AppCard title="デッキ検索" description="年代でデッキ一覧を絞り込みます。">
        <label className="dm-inline-field">
          年代
          <select
            value={eraFilter}
            onChange={(event) => setEraFilter(event.target.value as DeckEraKey | "")}
          >
            <option value="">すべて</option>
            {DECK_ERA_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </AppCard>
      {message && <p className="dm-form-message">{message}</p>}
      {loading ? (
        <AppCard title="読み込み中" description="デッキを取得しています。" />
      ) : (
        <div className="dm-app-grid">
          {filteredDecks.map((deck) => {
            const flag = deck.flag_id ? flagMap.get(deck.flag_id) : null;
            const isOwnDeck = deck.owner_id === currentUserId;
            const canStartBattle = Boolean(deck.flag_id && deck.buddy_card_id);
            return (
              <AppCard
                key={deck.id}
                title={deck.name}
                description={`フラッグ：${flag?.card?.name ?? "未選択"}`}
              >
                <p>
                  バディ：
                  {deck.buddy_card_id
                    ? cardMap.get(deck.buddy_card_id)?.name ?? "不明"
                    : "未選択"}
                </p>
                <p>保存方法：{getDeckVisibilityLabel(deck.deck_visibility)}</p>
                <p>年代：{getDeckEraLabel(deck.era_key)}</p>
                <p>所有：{isOwnDeck ? "自分" : "公開デッキ"}</p>
                <div className="dm-dialog-actions">
                  <Link href={`/decks/${deck.id}`} className="dm-button secondary">
                    {isOwnDeck ? "編集" : "閲覧"}
                  </Link>
                  {canStartBattle ? (
                    <Link href={`/battle?deckId=${deck.id}`} className="dm-button primary">
                      Battle開始
                    </Link>
                  ) : (
                    <span className="dm-button secondary is-disabled" aria-disabled="true">
                      Battle開始には設定が必要
                    </span>
                  )}
                </div>
              </AppCard>
            );
          })}
          {filteredDecks.length === 0 && (
            <AppCard title="該当なし" description="条件に合うデッキがありません。" />
          )}
        </div>
      )}
    </AppShell>
  );
}
