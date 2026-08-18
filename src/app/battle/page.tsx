"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BattleController } from "@/components/battle/BattleController";
import { CardViewer } from "@/components/cards/CardViewer";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import {
  readCachedDeckCards,
  readDeckEntryCache,
  writeCachedDeckCards,
  writeDeckEntryCache
} from "@/lib/decks/deckEntryCache";
import { loadDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlagsByIds } from "@/lib/flags/flagActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import { getSupabaseLoadErrorMessage } from "@/lib/supabase/client";
import {
  DECK_ERA_OPTIONS,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckEraKey,
  type DeckRecord,
  type FlagRecord
} from "@/types/baddiePhyto";

type EraFilter = "all" | DeckEraKey | "unset";

function buildImagesByCard(images: CardImageRecord[]) {
  const map = new Map<string, CardImageRecord[]>();
  for (const image of images) {
    map.set(image.card_id, [...(map.get(image.card_id) ?? []), image]);
  }
  return map;
}

function collectBattleEntryCardIds(decks: DeckRecord[], flags: FlagRecord[]) {
  const ids = new Set<string>();

  for (const deck of decks) {
    if (deck.buddy_card_id) ids.add(deck.buddy_card_id);
  }

  for (const flag of flags) {
    if (flag.card_id) ids.add(flag.card_id);
  }

  return [...ids];
}

function getDeckEraFilterValue(deck: DeckRecord): EraFilter {
  return deck.era_key ?? "unset";
}

function BattleEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [selectedDeckCards, setSelectedDeckCards] = useState<DeckCardRecord[]>([]);
  const [selectedDeckCardsLoading, setSelectedDeckCardsLoading] = useState(false);
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
      const cachedEntry = readDeckEntryCache();
      if (cachedEntry) {
        setDecks(cachedEntry.decks);
        setFlags(cachedEntry.flags);
        setCards(cachedEntry.cards);
        setImages(cachedEntry.images);
        setLoading(false);
      }

      const deckResult = await loadDecks();

      const flagIds = (deckResult.data ?? [])
        .map((deck) => deck.flag_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const flagResult = await loadFlagsByIds(flagIds);

      const relatedCardIds = collectBattleEntryCardIds(deckResult.data ?? [], flagResult.data ?? []);

      const [cardResult, imageResult] = await Promise.all([
        loadCardsByIds(relatedCardIds),
        loadCardImagesByCardIds(relatedCardIds)
      ]);

      if (deckResult.error || flagResult.error || cardResult.error || imageResult.error) {
        const targetError =
          deckResult.error ??
          flagResult.error ??
          cardResult.error ??
          imageResult.error;
        console.error(targetError);
        if (cachedEntry) {
          setMessage(
            `${getSupabaseLoadErrorMessage(
              targetError,
              "対戦開始に必要なデッキ情報の読み込みに失敗しました。"
            )} 保存済みのデッキ一覧を表示しています。`
          );
        } else {
          setMessage(
            getSupabaseLoadErrorMessage(
              targetError,
              "対戦開始に必要なデッキ情報の読み込みに失敗しました。"
            )
          );
        }
      } else {
        setDecks(deckResult.data ?? []);
        setFlags(flagResult.data ?? []);
        setCards(cardResult.data ?? []);
        setImages(imageResult.data ?? []);
        writeDeckEntryCache({
          decks: deckResult.data ?? [],
          flags: flagResult.data ?? [],
          cards: cardResult.data ?? [],
          images: imageResult.data ?? []
        });
      }

      setLoading(false);
    }

    void loadPage();
  }, [router]);

  useEffect(() => {
    if (!selectedDeckId) {
      return;
    }

    let cancelled = false;

    async function loadSelectedDeckCards() {
      setSelectedDeckCardsLoading(true);
      const result = await loadDeckCards(selectedDeckId);
      if (cancelled) {
        return;
      }

      if (result.error) {
        console.error(result.error);
        const cachedDeckCards = readCachedDeckCards(selectedDeckId);
        if (cachedDeckCards) {
          setMessage(
            `${getSupabaseLoadErrorMessage(
              result.error,
              "選択したデッキ内容の読み込みに失敗しました。"
            )} 保存済みのデッキ内容を表示しています。`
          );
          setSelectedDeckCards(cachedDeckCards);
        } else {
          setMessage(
            getSupabaseLoadErrorMessage(
              result.error,
              "選択したデッキ内容の読み込みに失敗しました。"
            )
          );
          setSelectedDeckCards([]);
        }
      } else {
        const nextDeckCards = result.data ?? [];
        setSelectedDeckCards(nextDeckCards);
        writeCachedDeckCards(selectedDeckId, nextDeckCards);
      }

      setSelectedDeckCardsLoading(false);
    }

    void loadSelectedDeckCards();

    return () => {
      cancelled = true;
    };
  }, [selectedDeckId]);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const flagsById = useMemo(() => new Map(flags.map((flag) => [flag.id, flag])), [flags]);
  const imagesByCard = useMemo(() => buildImagesByCard(images), [images]);

  const filteredDecks = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return decks.filter((deck) => {
      const eraValue = getDeckEraFilterValue(deck);
      if (eraFilter !== "all" && eraValue !== eraFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return deck.name.toLowerCase().includes(normalizedSearch);
    });
  }, [decks, eraFilter, searchText]);

  const ownDecks = useMemo(
    () =>
      filteredDecks.filter(
        (deck) => deck.deck_visibility !== "default" && deck.owner_id === currentUserId
      ),
    [currentUserId, filteredDecks]
  );

  const sampleDecks = useMemo(
    () => filteredDecks.filter((deck) => deck.deck_visibility === "default"),
    [filteredDecks]
  );

  const selectedDeck = selectedDeckId
    ? decks.find((deck) => deck.id === selectedDeckId) ?? null
    : null;
  const selectedFlag = selectedDeck?.flag_id ? flagsById.get(selectedDeck.flag_id) ?? null : null;
  const selectedFlagCard = selectedFlag?.card_id
    ? cardsById.get(selectedFlag.card_id) ?? null
    : null;
  const selectedBuddyCard = selectedDeck?.buddy_card_id
    ? cardsById.get(selectedDeck.buddy_card_id) ?? null
    : null;
  const selectedBuddyDeckCard =
    selectedDeck && selectedDeck.buddy_card_id
      ? selectedDeckCards.find((deckCard) => deckCard.card_id === selectedDeck.buddy_card_id) ?? null
      : null;

  function openSoloBattle() {
    if (!selectedDeck) return;
    const roomId = `solo-${selectedDeck.id}`;
    router.push(`/battle?deckId=${selectedDeck.id}&roomId=${roomId}&seat=player1&mode=solo`);
  }

  function openBattleRoom() {
    if (!selectedDeck) return;
    const roomId = `room-${selectedDeck.id}-${Date.now()}`;
    router.push(`/battle?deckId=${selectedDeck.id}&roomId=${roomId}&seat=player1&mode=room`);
  }

  function renderDeckCard(deck: DeckRecord) {
    const flag = deck.flag_id ? flagsById.get(deck.flag_id) ?? null : null;
    const flagCard = flag?.card_id ? cardsById.get(flag.card_id) ?? null : null;
    const buddyCard = deck.buddy_card_id ? cardsById.get(deck.buddy_card_id) ?? null : null;

    return (
      <button
        key={deck.id}
        type="button"
        className={`dm-deck-library-card${selectedDeckId === deck.id ? " is-selected" : ""}`}
        onClick={() => {
          setSelectedDeckCards([]);
          setSelectedDeckCardsLoading(true);
          setSelectedDeckId(deck.id);
        }}
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
            ) : null}
          </span>
          <span className="dm-deck-library-image">
            {buddyCard ? (
              <CardViewer
                card={buddyCard}
                images={imagesByCard.get(buddyCard.id) ?? []}
                variant="compact"
              />
            ) : null}
          </span>
        </span>
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
            <p className="dm-muted-text">読み込み中です。</p>
          ) : (
            <div className="dm-battle-entry-sections">
              <section className="dm-deck-library-section">
                <div className="dm-deck-library-section-header">
                  <div>
                    <h2>自分のデッキ</h2>
                  </div>
                  <span className="dm-deck-library-count">{ownDecks.length}件</span>
                </div>
                {ownDecks.length > 0 ? (
                  <div className="dm-deck-library-grid">{ownDecks.map(renderDeckCard)}</div>
                ) : null}
              </section>

              <section className="dm-deck-library-section">
                <div className="dm-deck-library-section-header">
                  <div>
                    <h2>サンプルデッキ</h2>
                  </div>
                  <span className="dm-deck-library-count">{sampleDecks.length}件</span>
                </div>
                {sampleDecks.length > 0 ? (
                  <div className="dm-deck-library-grid">{sampleDecks.map(renderDeckCard)}</div>
                ) : null}
              </section>
            </div>
          )}
        </AppCard>

        <AppCard title={selectedDeck ? selectedDeck.name : "デッキ未選択"}>
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
                  ) : null}
                </div>
                <div className="dm-deck-library-image">
                  {selectedBuddyCard ? (
                    <CardViewer
                      card={selectedBuddyCard}
                      images={imagesByCard.get(selectedBuddyCard.id) ?? []}
                      selectedImageId={selectedBuddyDeckCard?.selected_image_id ?? null}
                      variant="compact"
                    />
                  ) : null}
                </div>
              </div>

              <div className="dm-battle-entry-preview-meta">
                <p>
                  枚数:{" "}
                  {selectedDeckCards.reduce((sum, item) => sum + item.quantity, 0)}
                  枚
                </p>
                {selectedDeckCardsLoading ? <p>枚数を更新中...</p> : null}
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
          ) : (
            <p className="dm-muted-text">左の一覧から選択してください</p>
          )}
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
    <Suspense fallback={<main className="bf-battle-loading">Battle を準備しています。</main>}>
      <BattlePageContent />
    </Suspense>
  );
}
