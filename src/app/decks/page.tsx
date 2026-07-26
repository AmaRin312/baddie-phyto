"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { loadAllDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadCardImages } from "@/lib/storage/cardImageStorage";
import {
  DECK_ERA_OPTIONS,
  getDeckEraLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckEraKey,
  type DeckRecord,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

type DeckSection = {
  key: string;
  title: string;
  description: string;
  decks: DeckRecord[];
};

function findDisplayImageId(
  imagesByCard: Map<string, CardImageRecord[]>,
  cardId: string | null | undefined,
  selectedImageId: string | null | undefined
) {
  if (!cardId) return null;
  const images = imagesByCard.get(cardId) ?? [];
  if (selectedImageId && images.some((image) => image.id === selectedImageId)) {
    return selectedImageId;
  }
  return images.find((image) => image.is_default)?.id ?? null;
}

export default function DecksPage() {
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardRecord[]>([]);
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [eraFilter, setEraFilter] = useState<DeckEraKey | "">("");

  const flagMap = useMemo(() => new Map(flags.map((flag) => [flag.id, flag])), [flags]);
  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const deckCardMap = useMemo(() => {
    const map = new Map<string, DeckCardRecord[]>();
    deckCards.forEach((deckCard) => {
      map.set(deckCard.deck_id, [...(map.get(deckCard.deck_id) ?? []), deckCard]);
    });
    return map;
  }, [deckCards]);
  const imagesByCard = useMemo(() => {
    const map = new Map<string, CardImageRecord[]>();
    images.forEach((image) => {
      map.set(image.card_id, [...(map.get(image.card_id) ?? []), image]);
    });
    return map;
  }, [images]);

  const eraFilteredDecks = useMemo(() => {
    if (!eraFilter) return decks;
    return decks.filter((deck) => deck.era_key === eraFilter);
  }, [decks, eraFilter]);

  const sections: DeckSection[] = useMemo(
    () => [
      {
        key: "own",
        title: "作成したデッキ",
        description: "自分が作成したデッキです。",
        decks: eraFilteredDecks.filter((deck) => deck.owner_id === currentUserId)
      },
      {
        key: "public",
        title: "共有デッキ",
        description: "他ユーザーにも公開されている自作デッキです。",
        decks: eraFilteredDecks.filter(
          (deck) => deck.deck_visibility === "public" && deck.owner_id !== currentUserId
        )
      },
      {
        key: "default",
        title: "サンプルデッキ",
        description: "基礎デッキとして公開されているデッキです。",
        decks: eraFilteredDecks.filter((deck) => deck.deck_visibility === "default")
      }
    ],
    [currentUserId, eraFilteredDecks]
  );

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      setCurrentUserId(profile.id);
      const [deckResult, deckCardResult, flagResult, cardResult, imageResult] =
        await Promise.all([
          loadDecks(),
          loadAllDeckCards(),
          loadFlags(),
          loadCards(),
          loadCardImages()
        ]);
      if (
        deckResult.error ||
        deckCardResult.error ||
        flagResult.error ||
        cardResult.error ||
        imageResult.error
      ) {
        console.error(
          deckResult.error ??
            deckCardResult.error ??
            flagResult.error ??
            cardResult.error ??
            imageResult.error
        );
        setMessage("デッキ一覧の読み込みに失敗しました。");
      } else {
        setDecks((deckResult.data ?? []) as DeckRecord[]);
        setDeckCards(deckCardResult.data ?? []);
        setFlags(flagResult.data ?? []);
        setCards((cardResult.data ?? []) as CardRecord[]);
        setImages(imageResult.data ?? []);
      }
      setLoading(false);
    }
    void loadPage();
  }, []);

  function renderDeckCard(deck: DeckRecord) {
    const flag = deck.flag_id ? flagMap.get(deck.flag_id) : null;
    const flagCard = flag?.card ?? null;
    const buddyCard = deck.buddy_card_id ? cardMap.get(deck.buddy_card_id) ?? null : null;
    const buddyDeckCard = (deckCardMap.get(deck.id) ?? []).find(
      (deckCard) => deckCard.card_id === deck.buddy_card_id
    );
    const flagImageId = findDisplayImageId(
      imagesByCard,
      flagCard?.id,
      deck.selected_flag_image_id
    );
    const buddyImageId = findDisplayImageId(
      imagesByCard,
      buddyCard?.id,
      deck.selected_buddy_image_id ?? buddyDeckCard?.selected_image_id
    );
    const canStartBattle = Boolean(deck.flag_id && deck.buddy_card_id);
    const isOwnDeck = deck.owner_id === currentUserId;

    return (
      <AppCard key={deck.id} title={deck.name}>
        <div className="dm-deck-management-card">
          <div className="dm-deck-management-images">
            <div>
              <span>ワールド</span>
              {flagCard ? (
                <CardViewer
                  card={flagCard}
                  images={imagesByCard.get(flagCard.id) ?? []}
                  selectedImageId={flagImageId}
                  variant="compact"
                />
              ) : (
                <span className="dm-deck-management-empty">未選択</span>
              )}
            </div>
            <div>
              <span>バディ</span>
              {buddyCard ? (
                <CardViewer
                  card={buddyCard}
                  images={imagesByCard.get(buddyCard.id) ?? []}
                  selectedImageId={buddyImageId}
                  variant="compact"
                />
              ) : (
                <span className="dm-deck-management-empty">未選択</span>
              )}
            </div>
          </div>
          <p className="dm-muted-text">年代：{getDeckEraLabel(deck.era_key)}</p>
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
                Battle開始不可
              </span>
            )}
          </div>
        </div>
      </AppCard>
    );
  }

  return (
    <AppShell kicker="DECKS" title="デッキ管理">
      <div className="dm-page-actions">
        <Link href="/decks/new" className="dm-button primary">
          デッキ作成
        </Link>
      </div>

      <AppCard title="デッキ検索">
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
        <div className="dm-deck-management-sections">
          {sections.map((section) => (
            <section key={section.key} className="dm-deck-management-section">
              <div className="dm-section-heading">
                <div>
                  <h2>{section.title}</h2>
                  <p>{section.description}</p>
                </div>
                <span>{section.decks.length}件</span>
              </div>
              <div className="dm-app-grid">
                {section.decks.map(renderDeckCard)}
                {section.decks.length === 0 && (
                  <AppCard title="該当なし" description="条件に合うデッキがありません。" />
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
