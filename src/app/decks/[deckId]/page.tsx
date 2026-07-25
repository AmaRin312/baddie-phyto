"use client";

import { type DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CardViewer } from "@/components/cards/CardViewer";
import { DeckCardSearchPanel } from "@/components/decks/DeckCardSearchPanel";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
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
  DECK_VISIBILITY_OPTIONS,
  getCardTypeLabel,
  getDeckVisibilityLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckRecord,
  type DeckVisibility,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

type DeckDetailPageProps = { params: Promise<{ deckId: string }> };

function getFlagName(flag?: FlagWithCardRecord | null) {
  return flag?.name || flag?.card?.name || "未選択";
}

export default function DeckDetailPage({ params }: DeckDetailPageProps) {
  const [deckId, setDeckId] = useState("");
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [deckName, setDeckName] = useState("");
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedBuddyCardId, setSelectedBuddyCardId] = useState("");
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
  const [selectedDeckCardId, setSelectedDeckCardId] = useState("");
  const [draggedDeckCardId, setDraggedDeckCardId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

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
    setSelectedBuddyCardId(nextDeck.buddy_card_id ?? "");
    setDeckVisibility(nextDeck.deck_visibility ?? "private");
    const nextDeckCards = deckCardsResult.data ?? [];
    setSavedDeckCards(nextDeckCards);
    setDraftDeckCards(createDeckCardDrafts(nextDeckCards));
    setFlags(nextFlags);
    setCards(nextCards);
    setImages(imageResult.data ?? []);
    setCardPrintings(printingSearchResult.printings);
    setCardSets(printingSearchResult.sets);
    setLoading(false);
  }, []);

  useEffect(() => {
    async function loadPage() {
      const [{ deckId: resolvedDeckId }, profile] = await Promise.all([
        params,
        getOrCreateProfile()
      ]);
      if (!profile) {
        window.location.href = "/login";
        return;
      }
      setCurrentUserId(profile.id);
      setDeckId(resolvedDeckId);
      await reload(resolvedDeckId);
    }
    void loadPage();
  }, [params, reload]);

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
  const detailCard = cardMap.get(detailCardId) ?? null;
  const detailDeckDraft = detailCard ? draftDeckCardMap.get(detailCard.id) : undefined;
  const selectedDeckDraft = selectedDeckCardId ? draftDeckCardMap.get(selectedDeckCardId) : undefined;
  const selectedDeckCard = selectedDeckDraft ? cardMap.get(selectedDeckDraft.cardId) ?? null : null;
  const searchOptions = useMemo(() => getDeckCardSearchOptions(cards), [cards]);

  const buddyCandidates = useMemo(
    () => cards.filter((card) => card.is_active && card.card_type !== "flag_card"),
    [cards]
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

  const mainDeckTotal = draftDeckCards.reduce((sum, item) => sum + item.quantity, 0);
  const canEditDeck = Boolean(deck && currentUserId && deck.owner_id === currentUserId);
  const hasUnsavedChanges = deck
    ? deckName.trim() !== deck.name ||
      selectedFlagId !== (deck.flag_id ?? "") ||
      selectedBuddyCardId !== (deck.buddy_card_id ?? "") ||
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
      deckVisibility
    });

    if (settingsResult.error || !settingsResult.data) {
      console.error(settingsResult.error);
      setMessage(`デッキ設定の保存に失敗しました。${settingsResult.error?.message ?? ""}`);
      setSavingDeck(false);
      return;
    }

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

    await reload(deck.id);
    setSavingDeck(false);
    setMessage("デッキを保存しました。");
  }

  function setLocalCardQuantity(card: CardRecord, quantity: number) {
    if (!canEditDeck) {
      setMessage("このデッキは所有者だけが編集できます。");
      return;
    }
    if (card.id === selectedBuddyCardId) {
      setMessage("バディは deck_cards には入れません。");
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

  function setDeckCardImage(cardId: string, selectedImageId: string | null) {
    if (!canEditDeck) return;
    setDraftDeckCards((current) =>
      setDeckCardDraftImage(current, {
        cardId,
        selectedImageId
      })
    );
  }

  function openCardDetail(cardId: string) {
    setDetailCardId(cardId);
  }

  function selectDeckCard(cardId: string) {
    setSelectedDeckCardId(cardId);
  }

  function closeCardDetail() {
    setDetailCardId("");
  }

  function getDroppedSearchCardId(event: DragEvent) {
    return event.dataTransfer.getData("application/x-baddie-card-id") || "";
  }

  function addCardToDeckById(cardId: string) {
    const card = cardMap.get(cardId);
    if (!card) return;
    const existing = draftDeckCardMap.get(card.id);
    setLocalCardQuantity(card, (existing?.quantity ?? 0) + 1);
    setSelectedDeckCardId(card.id);
  }

  function handleDeckCardDrop(event: DragEvent, targetCardId: string) {
    const droppedSearchCardId = getDroppedSearchCardId(event);
    if (droppedSearchCardId) {
      addCardToDeckById(droppedSearchCardId);
      setDraggedDeckCardId(null);
      return;
    }

    if (!canEditDeck || !draggedDeckCardId) return;
    setDraftDeckCards((current) =>
      reorderDeckCardDrafts(current, {
        draggedCardId: draggedDeckCardId,
        targetCardId
      })
    );
    setDraggedDeckCardId(null);
  }

  function handleDeckAreaDrop(event: DragEvent) {
    const droppedSearchCardId = getDroppedSearchCardId(event);
    if (!droppedSearchCardId) return;
    event.preventDefault();
    addCardToDeckById(droppedSearchCardId);
    setDraggedDeckCardId(null);
  }

  return (
    <AppShell kicker="DECK EDIT" title={deck?.name ?? "デッキ編集"}>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
        {deckId && selectedFlagId && selectedBuddyCardId ? (
          <Link href={`/battle?deckId=${deckId}`} className="dm-button primary">
            Battle開始
          </Link>
        ) : (
          <span className="dm-button secondary is-disabled" aria-disabled="true">
            Battle開始にはフラッグとバディが必要です
          </span>
        )}
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="デッキ情報を取得しています。" />
      ) : deck ? (
        <div className="dm-deck-editor-layout is-three-column">
          <aside className="dm-deck-editor-column dm-deck-editor-settings">
            <AppCard title="デッキ設定" description="保存ボタンを押すまでSupabaseへ反映しません。">
              <form
                className="dm-auth-form dm-card-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveDeck();
                }}
              >
                <label>
                  フラッグ
                  <select
                    value={selectedFlagId}
                    onChange={(event) => setSelectedFlagId(event.target.value)}
                    disabled={!canEditDeck}
                  >
                    <option value="">選択してください</option>
                    {flags.map((flag) => (
                      <option key={flag.id} value={flag.id}>
                        {getFlagName(flag)}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  バディ
                  <select
                    value={selectedBuddyCardId}
                    onChange={(event) => setSelectedBuddyCardId(event.target.value)}
                    disabled={!canEditDeck}
                  >
                    <option value="">選択してください</option>
                    {buddyCandidates.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>

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
                  ? "編集中のローカルStateです。枚数変更・並び替えは保存ボタンまでDBへ反映しません。カードクリックで選択、ダブルクリックで詳細と使用画像を選べます。"
                  : "公開デッキを閲覧しています。並び替えや枚数変更はできません。"
              }
            >
              <div
                className="dm-deck-visual-grid"
                aria-label="編集中デッキのカード一覧"
                onDragOver={(event) => {
                  if (!canEditDeck) return;
                  if (getDroppedSearchCardId(event)) {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "copy";
                  }
                }}
                onDrop={handleDeckAreaDrop}
              >
                {draftDeckCards.map((item) => {
                  const card = cardMap.get(item.cardId);
                  if (!card) return null;
                  return (
                    <button
                      key={item.cardId}
                      type="button"
                      className={`dm-deck-visual-card${draggedDeckCardId === item.cardId ? " is-dragging" : ""}${selectedDeckCardId === item.cardId ? " is-selected" : ""}`}
                      draggable={canEditDeck}
                      title={`${card.name} / ${getCardTypeLabel(card.card_type)} ×${item.quantity}`}
                      onClick={() => selectDeckCard(card.id)}
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
                        const droppedSearchCardId = getDroppedSearchCardId(event);
                        if (droppedSearchCardId) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                          return;
                        }
                        if (!draggedDeckCardId || draggedDeckCardId === item.cardId) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleDeckCardDrop(event, item.cardId);
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

              {selectedDeckDraft && selectedDeckCard && (
                <div className="dm-deck-list">
                  <button
                    type="button"
                    className="dm-deck-row dm-deck-row-button is-selected"
                    onClick={() => selectDeckCard(selectedDeckCard.id)}
                    onDoubleClick={() => openCardDetail(selectedDeckCard.id)}
                  >
                    <span className="dm-deck-card-cell">
                      {selectedDeckCard.name} / {getCardTypeLabel(selectedDeckCard.card_type)} ×{selectedDeckDraft.quantity}
                    </span>
                    <span className="dm-deck-row-actions">
                      <Button
                        size="sm"
                        disabled={!canEditDeck}
                        onClick={(event) => {
                          event.stopPropagation();
                          setLocalCardQuantity(selectedDeckCard, selectedDeckDraft.quantity - 1);
                        }}
                      >
                        -
                      </Button>
                      <Button
                        size="sm"
                        disabled={!canEditDeck}
                        onClick={(event) => {
                          event.stopPropagation();
                          setLocalCardQuantity(selectedDeckCard, selectedDeckDraft.quantity + 1);
                        }}
                      >
                        +
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={!canEditDeck}
                        onClick={(event) => {
                          event.stopPropagation();
                          setLocalCardQuantity(selectedDeckCard, 0);
                          setSelectedDeckCardId("");
                        }}
                      >
                        削除
                      </Button>
                    </span>
                  </button>
                </div>
              )}
            </AppCard>
          </main>

          <aside className="dm-deck-editor-column dm-deck-editor-search">
            <AppCard
              title="カード検索"
              description="使用画像はデッキ一覧のカード詳細から選択します。検索結果では画像選択を行いません。"
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

              <div className="dm-deck-list">
                {filteredCards.map((card) => {
                  const existing = draftDeckCardMap.get(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className="dm-deck-row dm-deck-row-button"
                      draggable={canEditDeck}
                      onClick={() => setMessage("")}
                      onDoubleClick={() => openCardDetail(card.id)}
                      onDragStart={(event) => {
                        if (!canEditDeck) {
                          event.preventDefault();
                          return;
                        }
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData("application/x-baddie-card-id", card.id);
                        event.dataTransfer.setData("text/plain", card.id);
                      }}
                    >
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          variant="compact"
                        />
                        <span>
                          {card.name} / {getCardTypeLabel(card.card_type)}
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
                <p className="dm-kicker">CARD DETAIL</p>
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
                selectedImageId={getImageSelectValue(detailCard.id) || null}
              />

              <div className="dm-card-detail-meta">
                <p>
                  <b>カードタイプ</b>
                  <span>{getCardTypeLabel(detailCard.card_type)}</span>
                </p>
                <p>
                  <b>ワールド</b>
                  <span>{detailCard.worlds.join(" / ") || "-"}</span>
                </p>
                <p>
                  <b>種族</b>
                  <span>{detailCard.races.join(" / ") || "-"}</span>
                </p>
                <p>
                  <b>カードテキスト</b>
                  <span>{detailCard.card_text?.trim() || "-"}</span>
                </p>

                {detailDeckDraft ? (
                  <>
                    <label className="dm-card-detail-image-select">
                      使用画像
                      <select
                        value={getImageSelectValue(detailCard.id)}
                        disabled={!canEditDeck}
                        onChange={(event) =>
                          setDeckCardImage(detailCard.id, event.target.value || null)
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

                    <div className="dm-dialog-actions">
                      <Button
                        size="sm"
                        disabled={!canEditDeck}
                        onClick={() => setLocalCardQuantity(detailCard, detailDeckDraft.quantity - 1)}
                      >
                        -1
                      </Button>
                      <Button
                        size="sm"
                        disabled={!canEditDeck}
                        onClick={() => setLocalCardQuantity(detailCard, detailDeckDraft.quantity + 1)}
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
    </AppShell>
  );
}


