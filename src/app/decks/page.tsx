"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CardViewer } from "@/components/cards/CardViewer";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import {
  copyDeck,
  deleteDeck,
  loadAllDeckCards,
  loadDecks
} from "@/lib/decks/deckActions";
import { loadFlagsLite } from "@/lib/flags/flagActions";
import { getPublicSupplyImageUrl, loadBattleSupplies } from "@/lib/supplies/supplyActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import {
  DECK_ERA_OPTIONS,
  getDeckEraLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckEraKey,
  type DeckRecord,
  type BattleSupplyRecord,
  type FlagRecord
} from "@/types/baddiePhyto";

type DeckSection = {
  key: string;
  title: string;
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
  const router = useRouter();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardRecord[]>([]);
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [supplies, setSupplies] = useState<BattleSupplyRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [eraFilter, setEraFilter] = useState<DeckEraKey | "">("");
  const [selectedDeckForAction, setSelectedDeckForAction] =
    useState<DeckRecord | null>(null);
  const [copyingDeck, setCopyingDeck] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const requestedImageCardIds = useRef(new Set<string>());

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
        decks: eraFilteredDecks.filter(
          deck =>
            deck.owner_id === currentUserId &&
            deck.deck_visibility !== "default" &&
            deck.deck_visibility !== "public"
        )
      },
      {
        key: "public",
        title: "共有デッキ",
        decks: eraFilteredDecks.filter(deck => deck.deck_visibility === "public")
      },
      {
        key: "default",
        title: "サンプルデッキ",
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

      const [deckResult, deckCardResult, flagResult, supplyResult] = await Promise.allSettled([
        loadDecks({ fresh: true }),
        loadAllDeckCards(),
        loadFlagsLite(),
        loadBattleSupplies()
      ]);

      const decksResponse = deckResult.status === "fulfilled" ? deckResult.value : null;
      const deckCardsResponse =
        deckCardResult.status === "fulfilled" ? deckCardResult.value : null;
      const flagsResponse = flagResult.status === "fulfilled" ? flagResult.value : null;
      const suppliesResponse = supplyResult.status === "fulfilled" ? supplyResult.value : null;

      if (!decksResponse || !deckCardsResponse || decksResponse.error || deckCardsResponse.error) {
        console.error(decksResponse?.error ?? deckCardsResponse?.error);
        setMessage("デッキ一覧の読み込みに失敗しました。商品表示条件のSQL適用状況を確認してください。");
      } else {
        const nextDecks = (decksResponse.data ?? []) as unknown as DeckRecord[];
        const nextDeckIds = new Set(nextDecks.map((deck) => deck.id));
        const nextDeckCards = (deckCardsResponse.data ?? [])
          .filter((deckCard) => nextDeckIds.has(deckCard.deck_id));
        const nextFlags = ((flagsResponse?.error ? [] : flagsResponse?.data ?? []) ??
          []) as FlagRecord[];

        setDecks(nextDecks);
        setDeckCards(nextDeckCards);
        setFlags(nextFlags);
        setSupplies(suppliesResponse?.error ? [] : suppliesResponse?.data ?? []);

        const relatedCardIds = [
          ...nextDeckCards.map((deckCard: DeckCardRecord) => deckCard.card_id),
          ...nextFlags.map((flag: FlagRecord) => flag.card_id).filter(Boolean)
        ] as string[];

        const previewImageCardIds = [
          ...nextDecks.map((deck) => {
            const selectedFlag = nextFlags.find((flag) => flag.id === deck.flag_id);
            return selectedFlag?.card_id ?? null;
          }),
          ...nextDecks.map((deck) => deck.buddy_card_id)
        ].filter(Boolean) as string[];
        previewImageCardIds.forEach((cardId) => requestedImageCardIds.current.add(cardId));

        const [cardsResponse, imagesResponse] = await Promise.allSettled([
          loadCardsByIds(relatedCardIds),
          loadCardImagesByCardIds([...new Set(previewImageCardIds)])
        ]);

        const nextCardsResponse =
          cardsResponse.status === "fulfilled" ? cardsResponse.value : null;
        const nextImagesResponse =
          imagesResponse.status === "fulfilled" ? imagesResponse.value : null;

        setCards(
          (nextCardsResponse?.error ? [] : (nextCardsResponse?.data ?? [])) as unknown as CardRecord[]
        );
        setImages(nextImagesResponse?.error ? [] : nextImagesResponse?.data ?? []);

        if (flagsResponse?.error || nextCardsResponse?.error || nextImagesResponse?.error) {
          console.warn(
            "Optional deck metadata failed to load.",
            flagsResponse?.error ?? nextCardsResponse?.error ?? nextImagesResponse?.error
          );
        }
      }

      setLoading(false);
    }

    void loadPage();
  }, []);

  useEffect(() => {
    if (loading) return;
    let checking = false;
    async function refreshVisibleDecks() {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const result = await loadDecks({ fresh: true });
        if (result.error) return;
        const visibleDecks = result.data ?? [];
        const visibleIds = new Set(visibleDecks.map((deck) => deck.id));
        setDecks(visibleDecks);
        setSelectedDeckForAction((current) =>
          current && !visibleIds.has(current.id) ? null : current
        );
      } finally {
        checking = false;
      }
    }

    window.addEventListener("focus", refreshVisibleDecks);
    document.addEventListener("visibilitychange", refreshVisibleDecks);
    return () => {
      window.removeEventListener("focus", refreshVisibleDecks);
      document.removeEventListener("visibilitychange", refreshVisibleDecks);
    };
  }, [loading]);

  useEffect(() => {
    if (!selectedDeckForAction) return;

    const deckCardIds = (deckCardMap.get(selectedDeckForAction.id) ?? []).map(
      (deckCard) => deckCard.card_id
    );
    const selectedFlag = flags.find((flag) => flag.id === selectedDeckForAction.flag_id);
    const cardIdsToLoad = [...new Set([
      ...deckCardIds,
      selectedFlag?.card_id,
      selectedDeckForAction.buddy_card_id
    ].filter((cardId): cardId is string => Boolean(cardId)))].filter(
      (cardId) => !requestedImageCardIds.current.has(cardId)
    );

    if (cardIdsToLoad.length === 0) return;
    cardIdsToLoad.forEach((cardId) => requestedImageCardIds.current.add(cardId));

    void loadCardImagesByCardIds(cardIdsToLoad).then((result) => {
      if (result.error) {
        cardIdsToLoad.forEach((cardId) => requestedImageCardIds.current.delete(cardId));
        return;
      }
      if (result.data?.length) {
        setImages((current) => {
          const knownIds = new Set(current.map((image) => image.id));
          return [...current, ...result.data!.filter((image) => !knownIds.has(image.id))];
        });
      }
    });
  }, [deckCardMap, flags, selectedDeckForAction]);

  async function handleCopySelectedDeck() {
    if (!selectedDeckForAction) return;

    setCopyingDeck(true);
    setMessage("");

    const result = await copyDeck({
      sourceDeckId: selectedDeckForAction.id
    });

    setCopyingDeck(false);

    if (result.error || !result.data) {
      console.error(result.error);
      setMessage(`デッキのコピーに失敗しました。${result.error?.message ?? ""}`);
      return;
    }

    setSelectedDeckForAction(null);
    router.push(`/decks/${result.data.id}`);
  }

  async function handleDeleteSelectedDeck() {
    if (!selectedDeckForAction) return;
    if (selectedDeckForAction.owner_id !== currentUserId) return;
    if (selectedDeckForAction.deck_visibility === "default") return;

    setDeletingDeck(true);
    setMessage("");

    const targetDeckId = selectedDeckForAction.id;
    const result = await deleteDeck(targetDeckId);

    setDeletingDeck(false);

    if (result.error) {
      console.error(result.error);
      setMessage(`デッキの削除に失敗しました。${result.error.message ?? ""}`);
      return;
    }

    setDecks((previous) => previous.filter((deck) => deck.id !== targetDeckId));
    setDeckCards((previous) => previous.filter((deckCard) => deckCard.deck_id !== targetDeckId));
    setSelectedDeckForAction(null);
    setMessage("デッキを削除しました。");
  }

  function renderDeckContentList(deck: DeckRecord) {
    const contents = deckCardMap.get(deck.id) ?? [];

    if (contents.length === 0) {
      return <p className="dm-muted-text">デッキ内カードはまだありません。</p>;
    }

    return (
      <div className="dm-deck-content-list">
        {contents.map((deckCard) => {
          const card = cardMap.get(deckCard.card_id) ?? null;
          const selectedImageId = findDisplayImageId(
            imagesByCard,
            deckCard.card_id,
            deckCard.selected_image_id
          );

          return (
            <div key={deckCard.id} className="dm-deck-content-row">
              {card ? (
                <>
                  <CardViewer
                    card={card}
                    images={imagesByCard.get(card.id) ?? []}
                    selectedImageId={selectedImageId}
                    variant="compact"
                    className="dm-deck-content-row-image"
                    forcePortrait
                  />
                  <span className="dm-deck-content-row-count">×{deckCard.quantity}</span>
                </>
              ) : (
                <span className="dm-deck-content-row-empty">?</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderDeckCard(deck: DeckRecord) {
    const flag = deck.flag_id ? flagMap.get(deck.flag_id) : null;
    const flagCard = flag?.card_id ? cardMap.get(flag.card_id) ?? null : null;
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

    return (
      <div
        key={deck.id}
        className="dm-deck-management-item"
      >
        <AppCard title={deck.name}>
          <button
            type="button"
            className="dm-deck-management-card dm-deck-management-click-card"
            onClick={(event) => {
              if (event.detail >= 2) setSelectedDeckForAction(deck);
            }}
            onDoubleClick={() => setSelectedDeckForAction(deck)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setSelectedDeckForAction(deck);
              }
            }}
            title="ダブルクリックしてデッキ内容を表示"
          >
            <div className="dm-deck-management-images">
              <div className="is-flag">
                {flagCard ? (
                  <CardViewer
                    card={flagCard}
                    images={imagesByCard.get(flagCard.id) ?? []}
                    selectedImageId={flagImageId}
                    variant="compact"
                    className="dm-deck-management-image"
                    forcePortrait
                  />
                ) : (
                  <span className="dm-deck-management-empty">未選択</span>
                )}
              </div>
              <div className="is-buddy">
                {buddyCard ? (
                  <CardViewer
                    card={buddyCard}
                    images={imagesByCard.get(buddyCard.id) ?? []}
                    selectedImageId={buddyImageId}
                    variant="compact"
                    className="dm-deck-management-image"
                    forcePortrait
                  />
                ) : (
                  <span className="dm-deck-management-empty">未選択</span>
                )}
              </div>
            </div>
            <p className="dm-muted-text">{getDeckEraLabel(deck.era_key)}</p>
          </button>
        </AppCard>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/" />
        <Link href="/decks/new" className="dm-button primary">
          デッキ作成
        </Link>
        <Link href="/battle" className="dm-button secondary">
          対戦開始へ
        </Link>
      </div>

      <div className="dm-deck-management-filter-bar">
        <select
          className="dm-deck-management-filter"
          value={eraFilter}
          onChange={(event) => setEraFilter(event.target.value as DeckEraKey | "")}
          aria-label="年代フィルタ"
        >
          <option value="">年代: すべて</option>
          {DECK_ERA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {message && <p className="dm-form-message">{message}</p>}
      {loading ? (
        <AppCard title="読み込み中" description="デッキを読み込んでいます。" />
      ) : (
        <div className="dm-deck-management-sections">
          {sections.map((section) => (
            <section key={section.key} className="dm-deck-management-section">
              <div className="dm-section-heading">
                <div>
                  <h2>{section.title}</h2>
                </div>
                <span>{section.decks.length}件</span>
              </div>
              <div className="dm-app-grid">
                {section.decks.map(renderDeckCard)}
              </div>
            </section>
          ))}
        </div>
      )}

      {selectedDeckForAction && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedDeckForAction(null)}
        >
          <section
            className="dm-card-detail-modal dm-deck-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-action-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">DECK ACTION</p>
                <h2 id="deck-action-modal-title">{selectedDeckForAction.name}</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={() => setSelectedDeckForAction(null)}
              >
                ×
              </button>
            </header>

            <div className="dm-card-detail-modal-body">
              <AppCard title="">
                <div className="dm-deck-action-card-content">
                  {selectedDeckForAction.owner_id === currentUserId && (
                    <button
                      type="button"
                      className="dm-button primary dm-deck-action-edit"
                      onClick={() => router.push(`/decks/${selectedDeckForAction.id}`)}
                      disabled={deletingDeck}
                    >
                      編集する
                    </button>
                  )}
                  {renderDeckContentList(selectedDeckForAction)}
                </div>
              </AppCard>
              <div className="dm-deck-supply-summary">
                {(["sleeve", "playmat"] as const).map((type) => {
                  const supplyId = type === "sleeve"
                    ? selectedDeckForAction.sleeve_supply_id
                    : selectedDeckForAction.playmat_supply_id;
                  const supply = supplies.find((item) => item.id === supplyId);
                  const imageUrl = getPublicSupplyImageUrl(supply?.image_path);
                  return (
                    <div className={`dm-deck-supply-summary-item is-${type}`} key={type}>
                      <span>{type === "sleeve" ? "スリーブ" : "プレイマット"}</span>
                      {imageUrl ? <img src={imageUrl} alt={supply?.name ?? ""} /> : <small>未設定</small>}
                    </div>
                  );
                })}
              </div>

              {selectedDeckForAction.owner_id === currentUserId ? (
                selectedDeckForAction.deck_visibility !== "default" && (
                  <div className="dm-dialog-actions">
                    <button
                      type="button"
                      className="dm-button danger"
                      onClick={() => void handleDeleteSelectedDeck()}
                      disabled={deletingDeck}
                    >
                      {deletingDeck ? "削除中..." : "削除"}
                    </button>
                  </div>
                )
              ) : (
                <div className="dm-dialog-actions">
                  <button
                    type="button"
                    className="dm-button primary"
                    onClick={() => void handleCopySelectedDeck()}
                    disabled={copyingDeck}
                  >
                    {copyingDeck ? "コピー中..." : "コピーして保存"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
