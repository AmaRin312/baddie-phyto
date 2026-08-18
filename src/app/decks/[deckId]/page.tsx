"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardViewer } from "@/components/cards/CardViewer";
import { DeckCardSearchPanel } from "@/components/decks/DeckCardSearchPanel";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import {
  mergeDeckEntryCacheDeck,
  writeCachedDeckCards
} from "@/lib/decks/deckEntryCache";
import {
  loadDeck,
  loadDeckCards,
  setDeckCard,
  updateDeckSettings
} from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadCardImages } from "@/lib/storage/cardImageStorage";
import {
  EMPTY_DECK_CARD_SEARCH_FILTERS,
  filterDeckCandidateCards,
  getDeckCardSearchOptions,
  loadDeckCardPrintingSearchData,
  type CardPrintingSearchRecord,
  type DeckCardSearchFilters,
  type DeckCardSetOption
} from "@/lib/decks/deckCardSearch";
import {
  areDeckCardDraftsEqual,
  createDeckCardDraftMap,
  createDeckCardDrafts,
  reorderDeckCardDrafts,
  setDeckCardDraftImage,
  setDeckCardDraftQuantity,
  type DeckCardDraft
} from "@/lib/decks/deckEditorState";
import {
  DECK_ERA_OPTIONS,
  DECK_VISIBILITY_OPTIONS,
  getCardTypeLabel,
  getDeckVisibilityLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckEraKey,
  type DeckRecord,
  type DeckVisibility,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

type DeckDetailPageProps = { params: Promise<{ deckId: string }> };
const SEARCH_RESULT_ROW_HEIGHT = 156;
const SEARCH_RESULT_OVERSCAN = 4;

function getFlagName(flag?: FlagWithCardRecord | null) {
  return flag?.name || flag?.card?.name || "未選択";
}

export default function DeckDetailPage({ params }: DeckDetailPageProps) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [deckName, setDeckName] = useState("");
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedFlagImageId, setSelectedFlagImageId] = useState("");
  const [selectedBuddyCardId, setSelectedBuddyCardId] = useState("");
  const [selectedEraKey, setSelectedEraKey] = useState<DeckEraKey | "">("");
  const [deckVisibility, setDeckVisibility] = useState<DeckVisibility>("private");
  const [currentUserId, setCurrentUserId] = useState("");
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardPrintings, setCardPrintings] = useState<CardPrintingSearchRecord[]>([]);
  const [cardSets, setCardSets] = useState<DeckCardSetOption[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [savedDeckCards, setSavedDeckCards] = useState<DeckCardRecord[]>([]);
  const [draftDeckCards, setDraftDeckCards] = useState<DeckCardDraft[]>([]);
  const [searchFilters, setSearchFilters] = useState<DeckCardSearchFilters>(
    EMPTY_DECK_CARD_SEARCH_FILTERS
  );
  const [loading, setLoading] = useState(true);
  const [savingDeck, setSavingDeck] = useState(false);
  const [detailCardId, setDetailCardId] = useState("");
  const [draggedDeckCardId, setDraggedDeckCardId] = useState<string | null>(null);
  const [selectedDeckCardId, setSelectedDeckCardId] = useState<string>("");
  const [isFlagPickerOpen, setIsFlagPickerOpen] = useState(false);
  const [isBuddyPickerOpen, setIsBuddyPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [searchListScrollTop, setSearchListScrollTop] = useState(0);
  const [searchListHeight, setSearchListHeight] = useState(720);
  const searchListRef = useRef<HTMLDivElement | null>(null);

  const reload = useCallback(async (currentDeckId: string) => {
    const [
      deckResult,
      deckCardsResult,
      flagResult,
      cardResult,
      imageResult,
      printingSearchResult
    ] = await Promise.all([
      loadDeck(currentDeckId),
      loadDeckCards(currentDeckId),
      loadFlags({ selectableOnly: true, activeOnly: true }),
      loadCards(),
      loadCardImages(),
      loadDeckCardPrintingSearchData()
    ]);

    if (
      deckResult.error ||
      deckCardsResult.error ||
      flagResult.error ||
      cardResult.error ||
      imageResult.error ||
      printingSearchResult.error ||
      !deckResult.data
    ) {
      console.error(
        deckResult.error ??
          deckCardsResult.error ??
          flagResult.error ??
          cardResult.error ??
          imageResult.error ??
          printingSearchResult.error
      );
      setMessage("デッキ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    const nextDeck = deckResult.data;
    const nextCards = (cardResult.data ?? []) as CardRecord[];
    const nextFlags = (flagResult.data ?? []).filter(
      (flag) =>
        Boolean(flag.card_id) &&
        flag.is_active &&
        flag.can_be_selected_as_flag &&
        flag.card?.card_type === "flag_card" &&
        flag.card?.is_active
    );

    setDeck(nextDeck);
    setDeckName(nextDeck.name);
    setSelectedFlagId(nextDeck.flag_id ?? "");
    setSelectedFlagImageId(nextDeck.selected_flag_image_id ?? "");
    setSelectedBuddyCardId(nextDeck.buddy_card_id ?? "");
    setSelectedEraKey(nextDeck.era_key ?? "");
    setDeckVisibility(nextDeck.deck_visibility ?? "private");
    const nextDeckCards = deckCardsResult.data ?? [];
    setSavedDeckCards(nextDeckCards);
    setDraftDeckCards(createDeckCardDrafts(nextDeckCards));
    setFlags(nextFlags);
    setCards(nextCards);
    setImages(imageResult.data ?? []);
    setCardPrintings(printingSearchResult.printings);
    setCardSets(printingSearchResult.sets);
    writeCachedDeckCards(currentDeckId, nextDeckCards);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function loadPage() {
      const [{ deckId: resolvedDeckId }, profile] = await Promise.all([
        params,
        getOrCreateProfile()
      ]);
      if (!profile) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(profile.id);
      await reload(resolvedDeckId);
    }
    void loadPage();
  }, [params, reload, router]);

  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const savedDeckCardDrafts = useMemo(
    () => createDeckCardDrafts(savedDeckCards),
    [savedDeckCards]
  );

  const draftDeckCardMap = useMemo(
    () => createDeckCardDraftMap(draftDeckCards),
    [draftDeckCards]
  );

  const imagesByCard = useMemo(() => {
    const map = new Map<string, CardImageRecord[]>();
    for (const image of images) {
      const current = map.get(image.card_id) ?? [];
      map.set(image.card_id, [...current, image]);
    }
    return map;
  }, [images]);

  const flagMap = useMemo(
    () => new Map(flags.map((flag) => [flag.id, flag])),
    [flags]
  );

  const selectedFlag = flagMap.get(selectedFlagId) ?? null;
  const selectedFlagCard = selectedFlag?.card ?? null;
  const selectedBuddyCard = selectedBuddyCardId
    ? cardMap.get(selectedBuddyCardId) ?? null
    : null;
  const detailCard = cardMap.get(detailCardId) ?? null;
  const detailDeckDraft = detailCard ? draftDeckCardMap.get(detailCard.id) : undefined;
  const detailIsSelectedFlag = Boolean(
    detailCard && selectedFlagCard && detailCard.id === selectedFlagCard.id
  );
  const searchOptions = useMemo(() => getDeckCardSearchOptions(cards), [cards]);

  const buddyCandidates = useMemo(
    () =>
      draftDeckCards
        .map((item) => cardMap.get(item.cardId) ?? null)
        .filter((card): card is CardRecord => Boolean(card)),
    [cardMap, draftDeckCards]
  );

  const filteredCards = useMemo(() => {
    return filterDeckCandidateCards({
      cards,
      printings: cardPrintings,
      filters: searchFilters,
      selectedBuddyCardId,
      selectedFlagCardId: selectedFlag?.card_id,
      excludeInactive: false,
      excludeFlagCard: false
    });
  }, [
    cardPrintings,
    cards,
    searchFilters,
    selectedBuddyCardId,
    selectedFlag?.card_id
  ]);
  const visibleSearchRange = useMemo(() => {
    const viewportRowCount = Math.max(1, Math.ceil(searchListHeight / SEARCH_RESULT_ROW_HEIGHT));
    const startIndex = Math.max(
      0,
      Math.floor(searchListScrollTop / SEARCH_RESULT_ROW_HEIGHT) - SEARCH_RESULT_OVERSCAN
    );
    const endIndex = Math.min(
      filteredCards.length,
      startIndex + viewportRowCount + SEARCH_RESULT_OVERSCAN * 2
    );

    return {
      startIndex,
      endIndex,
      topPadding: startIndex * SEARCH_RESULT_ROW_HEIGHT,
      bottomPadding: Math.max(0, (filteredCards.length - endIndex) * SEARCH_RESULT_ROW_HEIGHT)
    };
  }, [filteredCards.length, searchListHeight, searchListScrollTop]);
  const visibleFilteredCards = useMemo(
    () => filteredCards.slice(visibleSearchRange.startIndex, visibleSearchRange.endIndex),
    [filteredCards, visibleSearchRange.endIndex, visibleSearchRange.startIndex]
  );

  useEffect(() => {
    const element = searchListRef.current;
    if (!element) return;

    const updateHeight = () => setSearchListHeight(element.clientHeight || 720);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const mainDeckTotal = draftDeckCards.reduce((sum, item) => sum + item.quantity, 0);
  const selectedDeckCard = selectedDeckCardId
    ? cardMap.get(selectedDeckCardId) ?? null
    : null;
  const selectedDeckDraft = selectedDeckCard
    ? draftDeckCardMap.get(selectedDeckCard.id) ?? null
    : null;
  const canEditDeck = Boolean(deck && currentUserId && deck.owner_id === currentUserId);
  const hasUnsavedChanges = deck
    ? deckName.trim() !== deck.name ||
      selectedFlagId !== (deck.flag_id ?? "") ||
      selectedFlagImageId !== (deck.selected_flag_image_id ?? "") ||
      selectedBuddyCardId !== (deck.buddy_card_id ?? "") ||
      selectedEraKey !== (deck.era_key ?? "") ||
      deckVisibility !== (deck.deck_visibility ?? "private") ||
      !areDeckCardDraftsEqual(savedDeckCardDrafts, draftDeckCards)
    : false;

  async function handleSaveDeck() {
    if (!canEditDeck) {
      setMessage("このデッキは所有者だけが編集できます。");
      return;
    }
    if (!deck) {
      setMessage("デッキ情報が読み込まれていません。");
      return;
    }

    setSavingDeck(true);
    setMessage("");
    const settingsResult = await updateDeckSettings({
      deckId: deck.id,
      name: deckName.trim() || "無題のデッキ",
      flagId: selectedFlagId || null,
      buddyCardId: selectedBuddyCardId || null,
      selectedFlagImageId: selectedFlagImageId || null,
      deckVisibility,
      eraKey: selectedEraKey || null
    });

    if (settingsResult.error || !settingsResult.data) {
      console.error(settingsResult.error);
      setMessage(`デッキ設定の保存に失敗しました。${settingsResult.error?.message ?? ""}`);
      setSavingDeck(false);
      return;
    }

    mergeDeckEntryCacheDeck(settingsResult.data);
    const draftMap = createDeckCardDraftMap(draftDeckCards);
    const savedMap = createDeckCardDraftMap(savedDeckCardDrafts);
    const cardIds = Array.from(new Set([...draftMap.keys(), ...savedMap.keys()]));

    for (const cardId of cardIds) {
      const draft = draftMap.get(cardId);
      const saved = savedMap.get(cardId);
      if (
        draft &&
        saved &&
        draft.quantity === saved.quantity &&
        draft.selectedImageId === saved.selectedImageId &&
        draft.sortOrder === saved.sortOrder
      ) {
        continue;
      }

      const { error } = await setDeckCard({
        deckId: deck.id,
        cardId,
        quantity: draft?.quantity ?? 0,
        sortOrder: draft?.sortOrder ?? saved?.sortOrder ?? 0,
        selectedImageId: draft?.selectedImageId ?? null
      });

      if (error) {
        console.error(error);
        setMessage(`デッキカードの保存に失敗しました。${error.message}`);
        setSavingDeck(false);
        return;
      }
    }

    writeCachedDeckCards(
      deck.id,
      draftDeckCards
        .filter((item) => item.quantity > 0)
        .map((item) => ({
          id: `${deck.id}:${item.cardId}`,
          deck_id: deck.id,
          card_id: item.cardId,
          quantity: item.quantity,
          sort_order: item.sortOrder,
          selected_image_id: item.selectedImageId,
          created_at: "",
          updated_at: ""
        }))
    );

    setSavingDeck(false);
    router.push("/decks");
  }

  function setLocalCardQuantity(card: CardRecord, quantity: number) {
    if (!canEditDeck) {
      setMessage("このデッキは所有者だけが編集できます。");
      return;
    }
    if (card.id === selectedFlag?.card_id) {
      setMessage("ゲーム開始フラッグは deck_cards には入れません。");
      return;
    }
    setMessage("");
    setDraftDeckCards((current) =>
      setDeckCardDraftQuantity(current, {
        cardId: card.id,
        quantity
      })
    );
  }

  function getImageSelectValue(cardId: string) {
    return draftDeckCardMap.get(cardId)?.selectedImageId ?? "";
  }

  function getDetailImageSelectValue(cardId: string) {
    if (selectedFlagCard?.id === cardId) {
      return selectedFlagImageId;
    }
    return getImageSelectValue(cardId);
  }

  function setDeckCardImage(cardId: string, selectedImageId: string | null) {
    if (!canEditDeck) return;
    setDraftDeckCards((current) =>
      setDeckCardDraftImage(current, {
        cardId,
        selectedImageId
      })
    );
  }

  function setDetailCardImage(cardId: string, selectedImageId: string | null) {
    if (!canEditDeck) return;
    if (selectedFlagCard?.id === cardId) {
      setSelectedFlagImageId(selectedImageId ?? "");
      return;
    }
    setDeckCardImage(cardId, selectedImageId);
  }

  function openCardDetail(cardId: string) {
    setDetailCardId(cardId);
  }

  function closeCardDetail() {
    setDetailCardId("");
  }

  function handleDeckCardDrop(targetCardId: string) {
    if (!canEditDeck || !draggedDeckCardId) return;
    setDraftDeckCards((current) =>
      reorderDeckCardDrafts(current, {
        draggedCardId: draggedDeckCardId,
        targetCardId
      })
    );
    setDraggedDeckCardId(null);
  }

  function selectFlag(flagId: string) {
    setSelectedFlagId(flagId);
    setSelectedFlagImageId("");
    setIsFlagPickerOpen(false);
  }

  function selectBuddy(cardId: string) {
    setSelectedBuddyCardId(cardId);
    setIsBuddyPickerOpen(false);
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
        <Link href="/battle" className="dm-button secondary">
          対戦開始画面へ
        </Link>
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="デッキ情報を取得しています。" />
      ) : deck ? (
        <div className="dm-deck-editor-layout is-three-column">
          <aside className="dm-deck-editor-column dm-deck-editor-settings">
            <AppCard title="デッキ設定">
              <form
                className="dm-auth-form dm-card-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveDeck();
                }}
              >
                <label>フラッグ</label>

                {selectedFlagCard && (
                  <button
                    type="button"
                    className="dm-deck-linked-card"
                    onClick={() => openCardDetail(selectedFlagCard.id)}
                    >
                    <CardViewer
                      card={selectedFlagCard}
                      images={imagesByCard.get(selectedFlagCard.id) ?? []}
                      selectedImageId={selectedFlagImageId || null}
                      variant="compact"
                    />
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canEditDeck}
                  onClick={() => setIsFlagPickerOpen(true)}
                >
                  変更
                </Button>

                <label>バディ</label>

                {selectedBuddyCard && (
                  <button
                    type="button"
                    className="dm-deck-linked-card"
                    onClick={() => openCardDetail(selectedBuddyCard.id)}
                    >
                    <CardViewer
                      card={selectedBuddyCard}
                      images={imagesByCard.get(selectedBuddyCard.id) ?? []}
                      selectedImageId={getImageSelectValue(selectedBuddyCard.id) || null}
                      variant="compact"
                    />
                  </button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={!canEditDeck}
                  onClick={() => setIsBuddyPickerOpen(true)}
                >
                  変更
                </Button>

                <div className="dm-deck-total-panel" aria-label="デッキ総枚数">
                  <b>デッキ枚数</b>
                  <span>{mainDeckTotal}枚</span>
                </div>

                <label>
                  デッキ名
                  <input
                    value={deckName}
                    onChange={(event) => setDeckName(event.target.value)}
                    disabled={!canEditDeck}
                    placeholder="未入力なら「無題のデッキ」"
                  />
                </label>

                <label>
                  年代
                  <select
                    value={selectedEraKey}
                    onChange={(event) =>
                      setSelectedEraKey(event.target.value as DeckEraKey | "")
                    }
                    disabled={!canEditDeck}
                  >
                    <option value="">未設定</option>
                    {DECK_ERA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  保存方法
                  <select
                    value={deckVisibility}
                    onChange={(event) =>
                      setDeckVisibility(event.target.value as DeckVisibility)
                    }
                    disabled={!canEditDeck}
                  >
                    {DECK_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p className="dm-muted-text">
                  {getDeckVisibilityLabel(deckVisibility)}：
                  {
                    DECK_VISIBILITY_OPTIONS.find(
                      (option) => option.value === deckVisibility
                    )?.description
                  }
                </p>

                <Button
                  type="submit"
                  variant="primary"
                  loading={savingDeck}
                  disabled={!canEditDeck || !hasUnsavedChanges}
                  fullWidth
                >
                  {!canEditDeck ? "閲覧中" : hasUnsavedChanges ? "デッキを保存" : "保存済み"}
                </Button>
              </form>
            </AppCard>
          </aside>
          <main className="dm-deck-editor-column dm-deck-editor-deck">
            <AppCard
              title="デッキ一覧"
              description={
                canEditDeck
                  ? "編集中のローカルStateです。枚数変更・並び替えは保存ボタンまでDBへ反映しません。単クリックで選択、ダブルクリックで詳細を開きます。"
                  : "公開デッキを閲覧しています。並び替えや枚数変更はできません。"
              }
            >
              <div className="dm-deck-visual-grid" aria-label="編集中デッキのカード一覧">
                {draftDeckCards.map((item) => {
                  const card = cardMap.get(item.cardId);
                  if (!card) return null;
                  return (
                    <button
                      key={item.cardId}
                      type="button"
                      className={`dm-deck-visual-card${
                        draggedDeckCardId === item.cardId ? " is-dragging" : ""
                      }`}
                      draggable={canEditDeck}
                      title={`${card.name} / ${getCardTypeLabel(card.card_type)} ×${item.quantity}`}
                      onClick={() => setSelectedDeckCardId(card.id)}
                      onDoubleClick={() => openCardDetail(card.id)}
                      onDragStart={(event) => {
                        if (!canEditDeck) {
                          event.preventDefault();
                          return;
                        }
                        setDraggedDeckCardId(item.cardId);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", item.cardId);
                      }}
                      onDragOver={(event) => {
                        if (!draggedDeckCardId || draggedDeckCardId === item.cardId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDeckCardDrop(item.cardId);
                      }}
                      onDragEnd={() => setDraggedDeckCardId(null)}
                    >
                      <CardViewer
                        card={card}
                        images={imagesByCard.get(card.id) ?? []}
                        selectedImageId={item.selectedImageId}
                        variant="compact"
                      />
                      <span className="dm-deck-visual-count">×{item.quantity}</span>
                    </button>
                  );
                })}
                {draftDeckCards.length === 0 && (
                  <p className="dm-muted-text">まだカードが追加されていません。</p>
                )}
              </div>

              {selectedDeckCard && selectedDeckDraft ? (
                <div className="dm-deck-row">
                  <span className="dm-deck-card-cell">
                    {selectedDeckCard.name} / ×{selectedDeckDraft.quantity}
                  </span>
                  <span className="dm-deck-row-actions">
                    <Button
                      size="sm"
                      disabled={!canEditDeck}
                      onClick={() =>
                        setLocalCardQuantity(
                          selectedDeckCard,
                          selectedDeckDraft.quantity - 1
                        )
                      }
                    >
                      -1
                    </Button>
                    <span className="dm-muted-text">{selectedDeckDraft.quantity}枚</span>
                    <Button
                      size="sm"
                      disabled={!canEditDeck}
                      onClick={() =>
                        setLocalCardQuantity(
                          selectedDeckCard,
                          selectedDeckDraft.quantity + 1
                        )
                      }
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={!canEditDeck}
                      onClick={() => setSelectedBuddyCardId(selectedDeckCard.id)}
                    >
                      バディ
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!canEditDeck}
                      onClick={() => setLocalCardQuantity(selectedDeckCard, 0)}
                    >
                      削除
                    </Button>
                  </span>
                </div>
              ) : null}
            </AppCard>
          </main>

          <aside className="dm-deck-editor-column dm-deck-editor-search">
            <AppCard
              title="カード検索"
            >
              <form className="dm-auth-form dm-card-form">
                <DeckCardSearchPanel
                  filters={searchFilters}
                  worlds={searchOptions.worlds}
                  races={searchOptions.races}
                  sets={cardSets}
                  onChange={setSearchFilters}
                />
              </form>

              <div
                ref={searchListRef}
                className="dm-deck-list"
                onScroll={(event) => setSearchListScrollTop(event.currentTarget.scrollTop)}
              >
                {visibleSearchRange.topPadding > 0 ? (
                  <div
                    aria-hidden="true"
                    style={{ height: `${visibleSearchRange.topPadding}px` }}
                  />
                ) : null}
                {visibleFilteredCards.map((card) => {
                  const existing = draftDeckCardMap.get(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="dm-deck-row dm-deck-row-button"
                      style={{ minHeight: `${SEARCH_RESULT_ROW_HEIGHT - 10}px` }}
                      onClick={() => openCardDetail(card.id)}
                    >
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          variant="compact"
                        />
                        <span>
                          {card.name}
                          {existing ? ` ×${existing.quantity}` : ""}
                          {!card.is_active ? "（無効）" : ""}
                        </span>
                      </span>
                      <span className="dm-deck-row-actions">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!canEditDeck}
                          onClick={(event) => {
                            event.stopPropagation();
                            setLocalCardQuantity(card, (existing?.quantity ?? 0) + 1);
                          }}
                        >
                          追加
                        </Button>
                      </span>
                    </button>
                  );
                })}
                {visibleSearchRange.bottomPadding > 0 ? (
                  <div
                    aria-hidden="true"
                    style={{ height: `${visibleSearchRange.bottomPadding}px` }}
                  />
                ) : null}
                {filteredCards.length === 0 && (
                  <p className="dm-muted-text">条件に合うカードがありません。</p>
                )}
              </div>
            </AppCard>
          </aside>
        </div>
      ) : (
        <AppCard title="エラー" description={message || "デッキが見つかりません。"} />
      )}

      {message && deck && <p className="dm-form-message">{message}</p>}

      {detailCard && (
        <div className="dm-card-detail-modal-backdrop" role="presentation" onClick={closeCardDetail}>
          <section
            className="dm-card-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-card-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <h2 id="deck-card-detail-title">{detailCard.name}</h2>
              </div>
              <button type="button" className="dm-dialog-close" onClick={closeCardDetail}>
                ×
              </button>
            </header>

            <div className="dm-card-detail-modal-body">
              <CardViewer
                card={detailCard}
                images={imagesByCard.get(detailCard.id) ?? []}
                selectedImageId={getDetailImageSelectValue(detailCard.id) || null}
              />

              <div className="dm-card-detail-meta">
                {detailDeckDraft || detailIsSelectedFlag ? (
                  <>
                    <label className="dm-card-detail-image-select">
                      使用画像
                      <select
                        value={getDetailImageSelectValue(detailCard.id)}
                        disabled={!canEditDeck}
                        onChange={(event) =>
                          setDetailCardImage(detailCard.id, event.target.value || null)
                        }
                      >
                        <option value="">Default画像を使う</option>
                        {(imagesByCard.get(detailCard.id) ?? []).map((image, index) => (
                          <option key={image.id} value={image.id}>
                            {image.is_default
                              ? `画像${index + 1}（Default）`
                              : `画像${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>

                    {detailDeckDraft ? (
                      <div className="dm-dialog-actions">
                        <Button
                          size="sm"
                          disabled={!canEditDeck}
                          onClick={() =>
                            setLocalCardQuantity(detailCard, detailDeckDraft.quantity - 1)
                          }
                        >
                          -1
                        </Button>
                        <Button
                          size="sm"
                          disabled={!canEditDeck}
                          onClick={() =>
                            setLocalCardQuantity(detailCard, detailDeckDraft.quantity + 1)
                          }
                        >
                          +1
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!canEditDeck}
                          onClick={() => setLocalCardQuantity(detailCard, 0)}
                        >
                          デッキから削除
                        </Button>
                      </div>
                    ) : (
                      <p className="dm-muted-text">
                        フラッグカードです。deck_cards には入れず、デッキ設定として画像だけ変更できます。
                      </p>
                    )}
                  </>
                ) : (
                  <Button
                    variant="primary"
                    disabled={!canEditDeck}
                    onClick={() => setLocalCardQuantity(detailCard, 1)}
                  >
                    デッキへ追加
                  </Button>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {isFlagPickerOpen && (
        <div className="dm-card-detail-modal-backdrop" role="presentation" onClick={() => setIsFlagPickerOpen(false)}>
          <section
            className="dm-card-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-flag-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <h2 id="deck-flag-picker-title">フラッグを選択</h2>
              <button type="button" className="dm-dialog-close" onClick={() => setIsFlagPickerOpen(false)}>
                ×
              </button>
            </header>
            <div className="dm-deck-list">
              {flags.map((flag) => {
                const flagCard = flag.card;
                if (!flagCard) return null;
                return (
                  <button
                    key={flag.id}
                    type="button"
                    className="dm-deck-row dm-deck-row-button"
                    onClick={() => selectFlag(flag.id)}
                  >
                    <span className="dm-deck-card-cell">
                      <CardViewer
                        card={flagCard}
                        images={imagesByCard.get(flagCard.id) ?? []}
                        selectedImageId={null}
                        variant="compact"
                      />
                      <span>{getFlagName(flag)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {isBuddyPickerOpen && (
        <div className="dm-card-detail-modal-backdrop" role="presentation" onClick={() => setIsBuddyPickerOpen(false)}>
          <section
            className="dm-card-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-buddy-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <h2 id="deck-buddy-picker-title">バディを選択</h2>
              <button type="button" className="dm-dialog-close" onClick={() => setIsBuddyPickerOpen(false)}>
                ×
              </button>
            </header>
            <div className="dm-deck-list">
              {buddyCandidates.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="dm-deck-row dm-deck-row-button"
                  onClick={() => selectBuddy(card.id)}
                >
                  <span className="dm-deck-card-cell">
                    <CardViewer
                      card={card}
                      images={imagesByCard.get(card.id) ?? []}
                      selectedImageId={getImageSelectValue(card.id) || null}
                      variant="compact"
                    />
                    <span>{card.name}</span>
                  </span>
                </button>
              ))}
              {buddyCandidates.length === 0 ? (
                <p className="dm-muted-text">先にデッキ内へカードを追加してください。</p>
              ) : null}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}

