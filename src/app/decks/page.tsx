"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useState } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import {
  createDraftDeck,
  deleteDeck,
  loadDeckCards,
  loadDecks,
  setDeckCard,
  updateDeckSettings
} from "@/lib/decks/deckActions";
import { loadFlagsByIds } from "@/lib/flags/flagActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import { getSupabaseLoadErrorMessage } from "@/lib/supabase/client";
import type {
  CardImageRecord,
  CardRecord,
  DeckCardRecord,
  DeckEraKey,
  DeckRecord,
  FlagRecord
} from "@/types/baddiePhyto";
import { getDeckVisibilityLabel } from "@/types/baddiePhyto";

type EraFilter = "all" | DeckEraKey | "unset";

const ERA_FILTER_OPTIONS: ReadonlyArray<{ value: EraFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "first", label: "無印" },
  { value: "hundred", label: "100" },
  { value: "ddd", label: "DDD" },
  { value: "x", label: "X" },
  { value: "god", label: "神" },
  { value: "unset", label: "未設定" }
];

function buildImagesByCard(images: CardImageRecord[]) {
  const map = new Map<string, CardImageRecord[]>();
  for (const image of images) {
    map.set(image.card_id, [...(map.get(image.card_id) ?? []), image]);
  }
  return map;
}

function collectDeckLibraryCardIds(decks: DeckRecord[], flags: FlagRecord[]) {
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

const DeckIconCard = memo(function DeckIconCard({
  deck,
  flagCard,
  buddy,
  imagesByCard,
  onOpen
}: {
  deck: DeckRecord;
  flagCard: CardRecord | null;
  buddy: CardRecord | null;
  imagesByCard: Map<string, CardImageRecord[]>;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="dm-deck-library-card" onDoubleClick={onOpen}>
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
          {buddy ? (
            <CardViewer
              card={buddy}
              images={imagesByCard.get(buddy.id) ?? []}
              variant="compact"
            />
          ) : null}
        </span>
      </span>
    </button>
  );
});

const DeckSection = memo(function DeckSection({
  title,
  decks,
  flagsById,
  cardsById,
  imagesByCard,
  onOpen
}: {
  title: string;
  decks: DeckRecord[];
  flagsById: Map<string, FlagRecord>;
  cardsById: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  onOpen: (deckId: string) => void;
}) {
  return (
    <section className="dm-deck-library-section">
      <div className="dm-deck-library-section-header">
        <div>
          <h2>{title}</h2>
        </div>
        <span className="dm-deck-library-count">{decks.length}件</span>
      </div>

      {decks.length > 0 ? (
        <div className="dm-deck-library-grid">
          {decks.map((deck) => {
            const flag = deck.flag_id ? flagsById.get(deck.flag_id) ?? null : null;
            const flagCard = flag?.card_id ? cardsById.get(flag.card_id) ?? null : null;
            const buddy = deck.buddy_card_id ? cardsById.get(deck.buddy_card_id) ?? null : null;

            return (
              <DeckIconCard
                key={deck.id}
                deck={deck}
                flagCard={flagCard}
                buddy={buddy}
                imagesByCard={imagesByCard}
                onOpen={() => onOpen(deck.id)}
              />
            );
          })}
        </div>
      ) : null}
    </section>
  );
});

export default function DecksPage() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [previewDeckCards, setPreviewDeckCards] = useState<DeckCardRecord[]>([]);
  const [previewCards, setPreviewCards] = useState<CardRecord[]>([]);
  const [previewImages, setPreviewImages] = useState<CardImageRecord[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [previewDeckId, setPreviewDeckId] = useState<string | null>(null);
  const [eraFilter, setEraFilter] = useState<EraFilter>("all");
  const [copyingDeckId, setCopyingDeckId] = useState<string | null>(null);
  const [deletingDeckId, setDeletingDeckId] = useState<string | null>(null);

  const flagsById = useMemo(() => new Map(flags.map((flag) => [flag.id, flag])), [flags]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const imagesByCard = useMemo(() => buildImagesByCard(images), [images]);
  const previewCardsById = useMemo(
    () => new Map(previewCards.map((card) => [card.id, card])),
    [previewCards]
  );
  const previewImagesByCard = useMemo(() => buildImagesByCard(previewImages), [previewImages]);

  const previewDeck = previewDeckId ? decks.find((deck) => deck.id === previewDeckId) ?? null : null;

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(profile.id);

      const deckResult = await loadDecks();

      const flagIds = (deckResult.data ?? [])
        .map((deck) => deck.flag_id)
        .filter((value): value is string => typeof value === "string" && value.length > 0);

      const flagResult = await loadFlagsByIds(flagIds);

      const relatedCardIds = collectDeckLibraryCardIds(deckResult.data ?? [], flagResult.data ?? []);

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
        setMessage(getSupabaseLoadErrorMessage(targetError, "デッキ情報の読み込みに失敗しました。"));
      } else {
        setDecks(deckResult.data ?? []);
        setFlags(flagResult.data ?? []);
        setCards(cardResult.data ?? []);
        setImages(imageResult.data ?? []);
      }

      setLoading(false);
    }

    void loadPage();
  }, [router]);

  useEffect(() => {
    if (!previewDeckId) {
      return;
    }

    const currentPreviewDeckId = previewDeckId;
    let cancelled = false;

    async function loadPreviewDeck() {
      setPreviewLoading(true);
      const deckCardResult = await loadDeckCards(currentPreviewDeckId);
      if (cancelled) {
        return;
      }

      if (deckCardResult.error) {
        console.error(deckCardResult.error);
        setMessage(
          getSupabaseLoadErrorMessage(deckCardResult.error, "デッキ内容の読み込みに失敗しました。")
        );
        setPreviewDeckCards([]);
        setPreviewCards([]);
        setPreviewImages([]);
        setPreviewLoading(false);
        return;
      }

      const nextDeckCards = deckCardResult.data ?? [];
      const cardIds = [...new Set(nextDeckCards.map((deckCard) => deckCard.card_id))];
      const [cardResult, imageResult] = await Promise.all([
        loadCardsByIds(cardIds),
        loadCardImagesByCardIds(cardIds)
      ]);

      if (cancelled) {
        return;
      }

      if (cardResult.error || imageResult.error) {
        const targetError = cardResult.error ?? imageResult.error;
        console.error(targetError);
        setMessage(
          getSupabaseLoadErrorMessage(targetError, "プレビュー用カードの読み込みに失敗しました。")
        );
        setPreviewDeckCards(nextDeckCards);
        setPreviewCards([]);
        setPreviewImages([]);
      } else {
        setPreviewDeckCards(nextDeckCards);
        setPreviewCards(cardResult.data ?? []);
        setPreviewImages(imageResult.data ?? []);
      }

      setPreviewLoading(false);
    }

    void loadPreviewDeck();

    return () => {
      cancelled = true;
    };
  }, [previewDeckId]);

  const filteredDecks = useMemo(() => {
    return decks.filter((deck) => {
      if (eraFilter === "all") return true;
      return getDeckEraFilterValue(deck) === eraFilter;
    });
  }, [decks, eraFilter]);

  const ownDecks = useMemo(
    () =>
      filteredDecks.filter(
        (deck) => deck.owner_id === currentUserId && deck.deck_visibility !== "default"
      ),
    [currentUserId, filteredDecks]
  );

  const sharedDecks = useMemo(
    () =>
      filteredDecks.filter(
        (deck) => deck.deck_visibility === "public" && deck.owner_id !== currentUserId
      ),
    [currentUserId, filteredDecks]
  );

  const sampleDecks = useMemo(
    () => filteredDecks.filter((deck) => deck.deck_visibility === "default"),
    [filteredDecks]
  );

  async function handleCopyDeck(deck: DeckRecord) {
    setCopyingDeckId(deck.id);
    setMessage("");

    const sourceDeckCardsResult = await loadDeckCards(deck.id);
    if (sourceDeckCardsResult.error) {
      console.error(sourceDeckCardsResult.error);
      setMessage("コピー元デッキ内容の読み込みに失敗しました。");
      setCopyingDeckId(null);
      return;
    }

    const sourceCards = sourceDeckCardsResult.data ?? [];

    const copiedName = `${deck.name} のコピー`;
    const draftResult = await createDraftDeck({
      name: copiedName,
      deckVisibility: "private",
      eraKey: deck.era_key ?? null
    });

    if (draftResult.error || !draftResult.data?.id) {
      console.error(draftResult.error);
      setMessage("デッキのコピー作成に失敗しました。");
      setCopyingDeckId(null);
      return;
    }

    const nextDeckId = draftResult.data.id;
    const settingsResult = await updateDeckSettings({
      deckId: nextDeckId,
      name: copiedName,
      flagId: deck.flag_id,
      buddyCardId: deck.buddy_card_id,
      selectedFlagImageId: deck.selected_flag_image_id,
      deckVisibility: "private",
      eraKey: deck.era_key ?? null
    });

    if (settingsResult.error) {
      console.error(settingsResult.error);
      setMessage("コピー先デッキ設定の保存に失敗しました。");
      setCopyingDeckId(null);
      return;
    }

    for (const sourceCard of sourceCards) {
      const result = await setDeckCard({
        deckId: nextDeckId,
        cardId: sourceCard.card_id,
        quantity: sourceCard.quantity,
        sortOrder: sourceCard.sort_order,
        selectedImageId: sourceCard.selected_image_id
      });

      if (result.error) {
        console.error(result.error);
        setMessage("コピー先デッキカードの保存に失敗しました。");
        setCopyingDeckId(null);
        return;
      }
    }

    router.push(`/decks/${nextDeckId}`);
  }

  async function handleDeleteDeck(deck: DeckRecord) {
    if (deck.owner_id !== currentUserId || deck.deck_visibility === "default") {
      return;
    }

    setDeletingDeckId(deck.id);
    setMessage("");

    const result = await deleteDeck(deck.id);
    if (result.error) {
      console.error(result.error);
      setMessage("デッキの削除に失敗しました。");
      setDeletingDeckId(null);
      return;
    }

    setDecks((current) => current.filter((item) => item.id !== deck.id));
    setPreviewDeckId(null);
    setDeletingDeckId(null);
  }

  function openPreviewDeck(nextDeckId: string) {
    setPreviewDeckCards([]);
    setPreviewCards([]);
    setPreviewImages([]);
    setPreviewLoading(true);
    setPreviewDeckId(nextDeckId);
  }

  function closePreviewDeck() {
    setPreviewDeckId(null);
    setPreviewDeckCards([]);
    setPreviewCards([]);
    setPreviewImages([]);
    setPreviewLoading(false);
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <Link href="/decks/new" className="dm-button primary">
          デッキ作成
        </Link>
      </div>

      {message ? <p className="dm-form-message">{message}</p> : null}

      <div className="dm-deck-library-search dm-deck-library-search--compact">
        <label className="dm-deck-library-filter">
          <select
            value={eraFilter}
            onChange={(event) => setEraFilter(event.target.value as EraFilter)}
            aria-label="年代で絞り込み"
          >
            {ERA_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="デッキ情報を取得しています。">
          <p className="dm-muted-text">少し待ってください。</p>
        </AppCard>
      ) : (
        <div className="dm-deck-library-layout">
          <DeckSection
            title="作成したデッキ"
            decks={ownDecks}
            flagsById={flagsById}
            cardsById={cardsById}
            imagesByCard={imagesByCard}
            onOpen={openPreviewDeck}
          />
          <DeckSection
            title="共有デッキ"
            decks={sharedDecks}
            flagsById={flagsById}
            cardsById={cardsById}
            imagesByCard={imagesByCard}
            onOpen={openPreviewDeck}
          />
          <DeckSection
            title="サンプルデッキ"
            decks={sampleDecks}
            flagsById={flagsById}
            cardsById={cardsById}
            imagesByCard={imagesByCard}
            onOpen={openPreviewDeck}
          />
        </div>
      )}

      {previewDeck ? (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={closePreviewDeck}
        >
          <section
            className="dm-card-detail-modal dm-deck-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">{getDeckVisibilityLabel(previewDeck.deck_visibility)}</p>
                <h2 id="deck-preview-title">{previewDeck.name}</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={closePreviewDeck}
              >
                ×
              </button>
            </header>

            <div className="dm-deck-preview-meta">
              <span>{previewDeckCards.reduce((total, card) => total + card.quantity, 0)}枚</span>
              {previewLoading ? <span>読み込み中...</span> : null}
            </div>

            <div className="dm-deck-preview-grid">
              {previewDeckCards.map((deckCard) => {
                const card = previewCardsById.get(deckCard.card_id);
                if (!card) return null;

                return (
                  <div key={deckCard.id} className="dm-deck-preview-card">
                    <CardViewer
                      card={card}
                      images={previewImagesByCard.get(card.id) ?? []}
                      selectedImageId={deckCard.selected_image_id}
                      variant="compact"
                    />
                    <span className="dm-deck-preview-badge">×{deckCard.quantity}</span>
                  </div>
                );
              })}
            </div>

            <footer className="dm-dialog-actions">
              {previewDeck.owner_id === currentUserId ? (
                <Link href={`/decks/${previewDeck.id}`} className="dm-button primary">
                  編集する
                </Link>
              ) : (
                <Button
                  variant="primary"
                  disabled={copyingDeckId === previewDeck.id}
                  onClick={() => void handleCopyDeck(previewDeck)}
                >
                  {copyingDeckId === previewDeck.id ? "コピー中..." : "コピーして保存"}
                </Button>
              )}

              {previewDeck.owner_id === currentUserId && previewDeck.deck_visibility !== "default" ? (
                <Button
                  variant="danger"
                  disabled={deletingDeckId === previewDeck.id}
                  onClick={() => void handleDeleteDeck(previewDeck)}
                >
                  {deletingDeckId === previewDeck.id ? "削除中..." : "削除"}
                </Button>
              ) : null}

              <Button variant="secondary" onClick={closePreviewDeck}>
                戻る
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </AppShell>
  );
}
