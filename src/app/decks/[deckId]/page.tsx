"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  const [selectedFlagImageId, setSelectedFlagImageId] = useState("");
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
  const [draggedSearchCardId, setDraggedSearchCardId] = useState<string | null>(null);
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
    setSelectedFlagImageId(nextDeck.selected_flag_image_id ?? "");
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
  const selectedFlagCard = selectedFlag?.card ?? null;
  const effectiveSelectedBuddyCardId =
    selectedBuddyCardId && draftDeckCardMap.has(selectedBuddyCardId)
      ? selectedBuddyCardId
      : "";
  const selectedBuddyCard = effectiveSelectedBuddyCardId
    ? cardMap.get(effectiveSelectedBuddyCardId) ?? null
    : null;
  const selectedDeckCard = selectedDeckCardId
    ? draftDeckCardMap.has(selectedDeckCardId)
      ? cardMap.get(selectedDeckCardId) ?? null
      : null
    : null;
  const selectedDeckDraft = selectedDeckCardId
    ? draftDeckCardMap.get(selectedDeckCardId)
    : undefined;
  const detailCard = cardMap.get(detailCardId) ?? null;
  const detailDeckDraft = detailCard ? draftDeckCardMap.get(detailCard.id) : undefined;
  const detailIsSelectedFlag = Boolean(
    detailCard && selectedFlagCard && detailCard.id === selectedFlagCard.id
  );
  const searchOptions = useMemo(() => getDeckCardSearchOptions(cards), [cards]);

  const buddyCandidates = useMemo(
    () =>
      draftDeckCards
        .map((draft) => cardMap.get(draft.cardId))
        .filter(
          (card): card is CardRecord =>
            card !== undefined && card.is_active && card.card_type !== "flag_card"
        ),
    [cardMap, draftDeckCards]
  );

  const filteredCards = useMemo(() => {
    return filterDeckCandidateCards({
      cards,
      printings: cardPrintings,
      filters: searchFilters,
      selectedBuddyCardId: effectiveSelectedBuddyCardId,
      selectedFlagCardId: selectedFlag?.card_id,
      excludeInactive: false,
      excludeFlagCard: false
    });
  }, [
    cardPrintings,
    cards,
    searchFilters,
    effectiveSelectedBuddyCardId,
    selectedFlag?.card_id
  ]);

  const mainDeckTotal = draftDeckCards.reduce((sum, item) => sum + item.quantity, 0);
  const canEditDeck = Boolean(deck && currentUserId && deck.owner_id === currentUserId);
  const hasUnsavedChanges = deck
    ? deckName.trim() !== deck.name ||
      selectedFlagId !== (deck.flag_id ?? "") ||
      selectedFlagImageId !== (deck.selected_flag_image_id ?? "") ||
      effectiveSelectedBuddyCardId !== (deck.buddy_card_id ?? "") ||
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
      buddyCardId: effectiveSelectedBuddyCardId || null,
      selectedFlagImageId: selectedFlagImageId || null,
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
    if (card.id === selectedFlag?.card_id) {
      setMessage("ゲーム開始フラッグは deck_cards には入れません。");
      return;
    }
    setMessage("");
    if (quantity <= 0) {
      if (selectedBuddyCardId === card.id) {
        setSelectedBuddyCardId("");
      }
      if (selectedDeckCardId === card.id) {
        setSelectedDeckCardId("");
      }
    }
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

  function selectDeckCard(cardId: string) {
    setSelectedDeckCardId(cardId);
  }

  function setAsBuddy(cardId: string) {
    if (!canEditDeck) return;
    if (!draftDeckCardMap.has(cardId)) {
      setMessage("バディはデッキ内のカードから選択してください。");
      return;
    }
    setSelectedBuddyCardId(cardId);
    setMessage("バディを選択しました。保存ボタンで反映されます。");
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

  function handleSearchCardDropToDeck(targetCardId?: string) {
    if (!canEditDeck || !draggedSearchCardId) return;
    const card = cardMap.get(draggedSearchCardId);
    if (!card) return;
    const existing = draftDeckCardMap.get(card.id);
    setLocalCardQuantity(card, (existing?.quantity ?? 0) + 1);

    if (targetCardId && targetCardId !== card.id && !existing) {
      setDraftDeckCards((current) =>
        reorderDeckCardDrafts(current, {
          draggedCardId: card.id,
          targetCardId
        })
      );
    }

    setDraggedSearchCardId(null);
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
                    onChange={(event) => {
                      setSelectedFlagId(event.target.value);
                      setSelectedFlagImageId("");
                    }}
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
                    <span>
                      <b>{selectedFlagCard.name}</b>
                      <small>フラッグ詳細・画像変更</small>
                    </span>
                  </button>
                )}

                <label>
                  バディ
                  <select
                    value={effectiveSelectedBuddyCardId}
                    onChange={(event) => setSelectedBuddyCardId(event.target.value)}
                    disabled={!canEditDeck || buddyCandidates.length === 0}
                  >
                    <option value="">デッキ内カードから選択</option>
                    {buddyCandidates.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedBuddyCard && (
                  <button
                    type="button"
                    className="dm-deck-linked-card"
                    onClick={() => selectDeckCard(selectedBuddyCard.id)}
                    onDoubleClick={() => openCardDetail(selectedBuddyCard.id)}
                  >
                    <CardViewer
                      card={selectedBuddyCard}
                      images={imagesByCard.get(selectedBuddyCard.id) ?? []}
                      selectedImageId={getImageSelectValue(selectedBuddyCard.id) || null}
                      variant="compact"
                    />
                    <span>
                      <b>{selectedBuddyCard.name}</b>
                      <small>ダブルクリックで詳細・画像変更</small>
                    </span>
                  </button>
                )}

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
                  ? "編集中のローカルStateです。単クリックで対象カードを選択、ダブルクリックで詳細と使用画像を開きます。"
                  : "公開デッキを閲覧しています。並び替えや枚数変更はできません。"
              }
            >
              <div
                className={`dm-deck-visual-grid${
                  draggedSearchCardId ? " is-drop-target" : ""
                }`}
                aria-label="編集中デッキのカード一覧"
                onDragOver={(event) => {
                  if (!draggedSearchCardId) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(event) => {
                  if (!draggedSearchCardId) return;
                  event.preventDefault();
                  handleSearchCardDropToDeck();
                }}
              >
                {draftDeckCards.map((item) => {
                  const card = cardMap.get(item.cardId);
                  if (!card) return null;
                  return (
                    <button
                      key={item.cardId}
                      type="button"
                      className={`dm-deck-visual-card${
                        draggedDeckCardId === item.cardId ? " is-dragging" : ""
                      }${selectedDeckCardId === item.cardId ? " is-selected" : ""}`}
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
                        if (draggedSearchCardId) {
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
                        event.stopPropagation();
                        if (draggedSearchCardId) {
                          handleSearchCardDropToDeck(item.cardId);
                          return;
                        }
                        handleDeckCardDrop(item.cardId);
                      }}
                      onDragEnd={() => {
                        setDraggedDeckCardId(null);
                        setDraggedSearchCardId(null);
                      }}
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

              {selectedDeckCard && selectedDeckDraft && (
                <div className="dm-deck-selected-summary">
                  <b>
                    {selectedDeckCard.name} / ×{selectedDeckDraft.quantity}
                  </b>
                  {effectiveSelectedBuddyCardId === selectedDeckCard.id && <span>バディ</span>}
                </div>
              )}
            </AppCard>
          </main>

          <aside className="dm-deck-editor-column dm-deck-editor-search">
            <AppCard title="カード検索">
              <form className="dm-auth-form dm-card-form">
                <DeckCardSearchPanel
                  filters={searchFilters}
                  worlds={searchOptions.worlds}
                  races={searchOptions.races}
                  sets={cardSets}
                  onChange={setSearchFilters}
                />
              </form>

              <div className="dm-deck-list dm-deck-search-results">
                {filteredCards.map((card) => {
                  const existing = draftDeckCardMap.get(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`dm-deck-row dm-deck-row-button dm-deck-search-card${
                        draggedSearchCardId === card.id ? " is-dragging" : ""
                      }`}
                      draggable={canEditDeck}
                      onClick={() => setSelectedDeckCardId("")}
                      onDragStart={(event) => {
                        if (!canEditDeck) {
                          event.preventDefault();
                          return;
                        }
                        setDraggedSearchCardId(card.id);
                        event.dataTransfer.effectAllowed = "copy";
                        event.dataTransfer.setData("text/plain", card.id);
                      }}
                      onDragEnd={() => setDraggedSearchCardId(null)}
                    >
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          variant="compact"
                        />
                        <span>
                          {card.name}
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

                    <div className="dm-card-detail-image-grid" aria-label="使用画像候補">
                      <button
                        type="button"
                        className={`dm-card-detail-image-option${
                          getDetailImageSelectValue(detailCard.id) === "" ? " is-selected" : ""
                        }`}
                        disabled={!canEditDeck}
                        onClick={() => setDetailCardImage(detailCard.id, null)}
                      >
                        <CardViewer
                          card={detailCard}
                          images={imagesByCard.get(detailCard.id) ?? []}
                          selectedImageId={null}
                          variant="compact"
                        />
                        <span>Default</span>
                      </button>
                      {(imagesByCard.get(detailCard.id) ?? []).map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          className={`dm-card-detail-image-option${
                            getDetailImageSelectValue(detailCard.id) === image.id
                              ? " is-selected"
                              : ""
                          }`}
                          disabled={!canEditDeck}
                          onClick={() => setDetailCardImage(detailCard.id, image.id)}
                        >
                          <CardViewer
                            card={detailCard}
                            images={imagesByCard.get(detailCard.id) ?? []}
                            selectedImageId={image.id}
                            variant="compact"
                          />
                          <span>
                            画像{index + 1}
                            {image.is_default ? " / Default" : ""}
                          </span>
                        </button>
                      ))}
                    </div>

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
                        <span className="dm-card-detail-quantity">
                          {detailDeckDraft.quantity}枚
                        </span>
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
                          disabled={!canEditDeck || effectiveSelectedBuddyCardId === detailCard.id}
                          onClick={() => setAsBuddy(detailCard.id)}
                        >
                          バディにする
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
    </AppShell>
  );
}

