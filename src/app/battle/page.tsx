"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleController } from "@/components/battle/BattleController";
import { CardViewer } from "@/components/cards/CardViewer";
import { Button } from "@/components/common/button";
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
  type FlagWithCardRecord,
} from "@/types/baddiePhyto";

type EraFilter = "all" | DeckEraKey | "unset";

function buildImagesByCard(images: CardImageRecord[]) {
  const map = new Map<string, CardImageRecord[]>();
  for (const image of images) {
    map.set(image.card_id, [...(map.get(image.card_id) ?? []), image]);
  }
  return map;
}

function buildDeckCardsByDeck(deckCards: DeckCardRecord[]) {
  const map = new Map<string, DeckCardRecord[]>();
  for (const deckCard of deckCards) {
    map.set(deckCard.deck_id, [...(map.get(deckCard.deck_id) ?? []), deckCard]);
  }
  return map;
}

function BattleEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardRecord[]>([]);
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [eraFilter, setEraFilter] = useState<EraFilter>("all");

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(profile.id);

      const [deckResult, deckCardResult, flagResult, cardResult, imageResult] =
        await Promise.all([
          loadDecks(),
          loadAllDeckCards(),
          loadFlags(),
          loadCards(),
          loadCardImages(),
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
            imageResult.error,
        );
        setMessage("対戦開始に必要なデッキ情報の読み込みに失敗しました。");
      } else {
        setDecks(deckResult.data ?? []);
        setDeckCards(deckCardResult.data ?? []);
        setFlags(flagResult.data ?? []);
        setCards(cardResult.data ?? []);
        setImages(imageResult.data ?? []);
      }

      setLoading(false);
    }

    void loadPage();
  }, [router]);

  const cardsById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );
  const flagsById = useMemo(
    () => new Map(flags.map((flag) => [flag.id, flag])),
    [flags],
  );
  const imagesByCard = useMemo(() => buildImagesByCard(images), [images]);
  const deckCardsByDeck = useMemo(
    () => buildDeckCardsByDeck(deckCards),
    [deckCards],
  );

  const filteredDecks = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return decks.filter((deck) => {
      const eraValue = deck.era_key ?? "unset";
      if (eraFilter !== "all" && eraValue !== eraFilter) return false;
      if (!normalizedSearch) return true;
      return deck.name.toLowerCase().includes(normalizedSearch);
    });
  }, [decks, eraFilter, searchText]);

  const ownAndSharedDecks = useMemo(
    () =>
      filteredDecks.filter(
        (deck) =>
          deck.deck_visibility !== "default" && deck.owner_id === currentUserId,
      ),
    [currentUserId, filteredDecks],
  );

  const sampleDecks = useMemo(
    () => filteredDecks.filter((deck) => deck.deck_visibility === "default"),
    [filteredDecks],
  );

  const selectedDeck = selectedDeckId
    ? decks.find((deck) => deck.id === selectedDeckId) ?? null
    : null;
  const selectedFlag = selectedDeck?.flag_id
    ? flagsById.get(selectedDeck.flag_id) ?? null
    : null;
  const selectedFlagCard = selectedFlag?.card ?? null;
  const selectedBuddyCard = selectedDeck?.buddy_card_id
    ? cardsById.get(selectedDeck.buddy_card_id) ?? null
    : null;
  const selectedBuddyDeckCard =
    selectedDeck && selectedDeck.buddy_card_id
      ? deckCardsByDeck
          .get(selectedDeck.id)
          ?.find((deckCard) => deckCard.card_id === selectedDeck.buddy_card_id) ??
        null
      : null;

  function openSoloBattle() {
    if (!selectedDeck) return;
    const roomId = `solo-${selectedDeck.id}`;
    router.push(
      `/battle?deckId=${selectedDeck.id}&roomId=${roomId}&seat=player1&mode=solo`,
    );
  }

  function openBattleRoom() {
    if (!selectedDeck) return;
    const roomId = `room-${selectedDeck.id}-${Date.now()}`;
    router.push(
      `/battle?deckId=${selectedDeck.id}&roomId=${roomId}&seat=player1&mode=room`,
    );
  }

  function renderDeckCard(deck: DeckRecord) {
    const flag = deck.flag_id ? flagsById.get(deck.flag_id) ?? null : null;
    const flagCard = flag?.card ?? null;
    const buddyCard = deck.buddy_card_id
      ? cardsById.get(deck.buddy_card_id) ?? null
      : null;
    const buddyDeckCard =
      deck.buddy_card_id && deckCardsByDeck.get(deck.id)
        ? deckCardsByDeck
            .get(deck.id)
            ?.find((deckCard) => deckCard.card_id === deck.buddy_card_id) ?? null
        : null;

    return (
      <button
        key={deck.id}
        type="button"
        className={`dm-deck-library-card${
          selectedDeckId === deck.id ? " is-selected" : ""
        }`}
        onClick={() => setSelectedDeckId(deck.id)}
      >
        <span className="dm-deck-library-title">{deck.name}</span>
        <span className="dm-deck-library-images">
          <span className="dm-deck-library-image">
            {flagCard ? (
              <CardViewer
                card={flagCard}
                images={imagesByCard.get(flagCard.id) ?? []}
                selectedImageId={deck.selected_flag_image_id}
                variant="compact"
              />
            ) : (
              <span className="dm-deck-library-missing">未選択</span>
            )}
          </span>
          <span className="dm-deck-library-image">
            {buddyCard ? (
              <CardViewer
                card={buddyCard}
                images={imagesByCard.get(buddyCard.id) ?? []}
                selectedImageId={buddyDeckCard?.selected_image_id ?? null}
                variant="compact"
              />
            ) : (
              <span className="dm-deck-library-missing">未選択</span>
            )}
          </span>
        </span>
        <span className="dm-deck-library-era">{getDeckEraLabel(deck.era_key)}</span>
      </button>
    );
  }

  return (
    <AppShell>
      {message ? <p className="dm-form-message">{message}</p> : null}

      <div className="dm-battle-entry-layout">
        <AppCard title="デッキ選択">
          <div className="dm-battle-entry-filters">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="デッキ名で検索"
              className="dm-input"
            />
            <label className="dm-deck-library-filter">
              <select
                value={eraFilter}
                onChange={(event) => setEraFilter(event.target.value as EraFilter)}
                className="dm-select"
                aria-label="年代で絞り込み"
              >
                <option value="all">年代すべて</option>
                {DECK_ERA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                <option value="unset">未設定</option>
              </select>
            </label>
          </div>

          {loading ? (
            <p className="dm-muted-text">デッキを読み込み中です...</p>
          ) : (
            <div className="dm-battle-entry-sections">
              <section className="dm-deck-library-section">
                <div className="dm-deck-library-section-header">
                  <div>
                    <h2>自分のデッキ</h2>
                  </div>
                  <span className="dm-deck-library-count">
                    {ownAndSharedDecks.length}件
                  </span>
                </div>
                <div className="dm-deck-library-grid">
                  {ownAndSharedDecks.map(renderDeckCard)}
                </div>
              </section>

              <section className="dm-deck-library-section">
                <div className="dm-deck-library-section-header">
                  <div>
                    <h2>サンプルデッキ</h2>
                  </div>
                  <span className="dm-deck-library-count">
                    {sampleDecks.length}件
                  </span>
                </div>
                <div className="dm-deck-library-grid">
                  {sampleDecks.map(renderDeckCard)}
                </div>
              </section>
            </div>
          )}
        </AppCard>

        <AppCard
          title={selectedDeck ? selectedDeck.name : "デッキ未選択"}
          description={
            selectedDeck ? "対戦開始前の確認" : "左の一覧から選択してください"
          }
        >
          {selectedDeck ? (
            <div className="dm-battle-entry-preview">
              <div className="dm-battle-entry-preview-images">
                <div className="dm-deck-library-image">
                  {selectedFlagCard ? (
                    <CardViewer
                      card={selectedFlagCard}
                      images={imagesByCard.get(selectedFlagCard.id) ?? []}
                      selectedImageId={selectedDeck.selected_flag_image_id}
                      variant="compact"
                    />
                  ) : (
                    <span className="dm-deck-library-missing">未選択</span>
                  )}
                </div>
                <div className="dm-deck-library-image">
                  {selectedBuddyCard ? (
                    <CardViewer
                      card={selectedBuddyCard}
                      images={imagesByCard.get(selectedBuddyCard.id) ?? []}
                      selectedImageId={selectedBuddyDeckCard?.selected_image_id ?? null}
                      variant="compact"
                    />
                  ) : (
                    <span className="dm-deck-library-missing">未選択</span>
                  )}
                </div>
              </div>

              <div className="dm-battle-entry-preview-meta">
                <p>年代: {getDeckEraLabel(selectedDeck.era_key)}</p>
                <p>
                  枚数:{" "}
                  {(deckCardsByDeck.get(selectedDeck.id) ?? []).reduce(
                    (sum, item) => sum + item.quantity,
                    0,
                  )}
                  枚
                </p>
              </div>

              <div className="dm-dialog-actions">
                <Button variant="secondary" onClick={openSoloBattle}>
                  一人回し開始
                </Button>
                <Button variant="primary" onClick={openBattleRoom}>
                  対戦ルームを作成
                </Button>
              </div>
            </div>
          ) : null}
        </AppCard>
      </div>
    </AppShell>
  );
}

function BattlePageContent() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId");

  if (!deckId) {
    return <BattleEntryPage />;
  }

  return <BattleController />;
}

export default function BattlePage() {
  return (
    <Suspense
      fallback={<main className="bf-battle-loading">Battle を読み込み中です...</main>}
    >
      <BattlePageContent />
    </Suspense>
  );
}
