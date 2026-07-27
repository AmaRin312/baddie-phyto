"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
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
  copyDeck,
  loadDeck,
  loadDeckCards,
  setDeckCard,
  updateDeckSettings
} from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadCardImages } from "@/lib/storage/cardImageStorage";
import {
  getPublicSupplyImageUrl,
  loadBattleSupplies
} from "@/lib/supplies/supplyActions";
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
  type BattleSupplyRecord,
  type DeckEraKey,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckRecord,
  type DeckVisibility,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

type DeckDetailPageProps = { params: Promise<{ deckId: string }> };

const DECK_SEARCH_TYPE_ORDER: Record<CardRecord["card_type"], number> = {
  monster: 0,
  spell: 1,
  item: 2,
  impact: 3,
  impact_monster: 4,
  flag_card: 5,
  other: 6
};

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
  const [selectedBuddyImageId, setSelectedBuddyImageId] = useState("");
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [selectedPlaymatSupplyId, setSelectedPlaymatSupplyId] = useState("");
  const [deckVisibility, setDeckVisibility] = useState<DeckVisibility>("private");
  const [saveDefaultAlsoPrivate, setSaveDefaultAlsoPrivate] = useState(false);
  const [deckEra, setDeckEra] = useState<DeckEraKey | "">("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardPrintings, setCardPrintings] = useState<CardPrintingSearchRecord[]>([]);
  const [cardSets, setCardSets] = useState<DeckCardSetOption[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [battleSupplies, setBattleSupplies] = useState<BattleSupplyRecord[]>([]);
  const [savedDeckCards, setSavedDeckCards] = useState<DeckCardRecord[]>([]);
  const [draftDeckCards, setDraftDeckCards] = useState<DeckCardDraft[]>([]);
  const [searchFilters, setSearchFilters] = useState<DeckCardSearchFilters>(
    EMPTY_DECK_CARD_SEARCH_FILTERS
  );
  const [loading, setLoading] = useState(true);
  const [savingDeck, setSavingDeck] = useState(false);
  const [detailCardId, setDetailCardId] = useState("");
  const [previewCardId, setPreviewCardId] = useState("");
  const [selectedDeckCardId, setSelectedDeckCardId] = useState("");
  const [draggedDeckCardId, setDraggedDeckCardId] = useState<string | null>(null);
  const [draggedSearchCardId, setDraggedSearchCardId] = useState<string | null>(null);
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [searchPage, setSearchPage] = useState(0);
  const deferredSearchFilters = useDeferredValue(searchFilters);

  const reload = useCallback(async (currentDeckId: string) => {
    const [
      deckResult,
      deckCardsResult,
      flagResult,
      cardResult,
      imageResult,
      printingSearchResult,
      supplyResult
    ] = await Promise.all([
      loadDeck(currentDeckId),
      loadDeckCards(currentDeckId),
      loadFlags({ selectableOnly: true, activeOnly: true }),
      loadCards(),
      loadCardImages(),
      loadDeckCardPrintingSearchData(),
      loadBattleSupplies()
    ]);

    if (
      deckResult.error ||
      deckCardsResult.error ||
      flagResult.error ||
      cardResult.error ||
      imageResult.error ||
      printingSearchResult.error ||
      supplyResult.error ||
      !deckResult.data
    ) {
      console.error(
        deckResult.error ??
          deckCardsResult.error ??
          flagResult.error ??
          cardResult.error ??
          imageResult.error ??
          printingSearchResult.error ??
          supplyResult.error
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
    setSelectedBuddyImageId(nextDeck.selected_buddy_image_id ?? "");
    setSelectedSleeveSupplyId(nextDeck.sleeve_supply_id ?? "");
    setSelectedPlaymatSupplyId(nextDeck.playmat_supply_id ?? "");
    setDeckVisibility(nextDeck.deck_visibility ?? "private");
    setSaveDefaultAlsoPrivate(false);
    setDeckEra(nextDeck.era_key ?? "");
    const nextDeckCards = deckCardsResult.data ?? [];
    setSavedDeckCards(nextDeckCards);
    setDraftDeckCards(createDeckCardDrafts(nextDeckCards));
    setFlags(nextFlags);
    setCards(nextCards);
    setImages(imageResult.data ?? []);
    setBattleSupplies(supplyResult.data ?? []);
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
  const sleeveSupplies = useMemo(
    () => battleSupplies.filter((supply) => supply.supply_type === "sleeve"),
    [battleSupplies]
  );
  const playmatSupplies = useMemo(
    () => battleSupplies.filter((supply) => supply.supply_type === "playmat"),
    [battleSupplies]
  );
  const selectedDeckCard = selectedDeckCardId
    ? draftDeckCardMap.has(selectedDeckCardId)
      ? cardMap.get(selectedDeckCardId)?.is_active
        ? cardMap.get(selectedDeckCardId) ?? null
        : null
      : null
    : null;
  const selectedDeckDraft = selectedDeckCardId
    ? draftDeckCardMap.get(selectedDeckCardId)
    : undefined;
  const detailCard = cardMap.get(detailCardId) ?? null;
  const previewCard = cardMap.get(previewCardId) ?? null;
  const detailDeckDraft = detailCard ? draftDeckCardMap.get(detailCard.id) : undefined;
  const detailIsSelectedFlag = Boolean(
    detailCard && selectedFlagCard && detailCard.id === selectedFlagCard.id
  );
  const detailIsSelectedBuddy = Boolean(
    detailCard && effectiveSelectedBuddyCardId === detailCard.id
  );
  const searchOptions = useMemo(() => getDeckCardSearchOptions(cards), [cards]);
  const preferredWorlds = useMemo(
    () => new Set([...(selectedFlag?.usable_worlds ?? []), ...(selectedFlagCard?.worlds ?? [])]),
    [selectedFlag, selectedFlagCard]
  );

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
      filters: deferredSearchFilters,
      selectedBuddyCardId: effectiveSelectedBuddyCardId,
      selectedFlagCardId: selectedFlag?.card_id,
      excludeInactive: true,
      excludeFlagCard: false
    }).sort((left, right) => {
      const leftPreferred = left.worlds.some((world) => preferredWorlds.has(world));
      const rightPreferred = right.worlds.some((world) => preferredWorlds.has(world));
      if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      const typeDiff =
        DECK_SEARCH_TYPE_ORDER[left.card_type] - DECK_SEARCH_TYPE_ORDER[right.card_type];
      if (typeDiff !== 0) return typeDiff;
      if (left.card_type === "monster" && right.card_type === "monster") {
        const sizeDiff = (right.size ?? -1) - (left.size ?? -1);
        if (sizeDiff !== 0) return sizeDiff;
      }
      return left.name.localeCompare(right.name, "ja");
    });
  }, [
    cardPrintings,
    cards,
    deferredSearchFilters,
    effectiveSelectedBuddyCardId,
    preferredWorlds,
    selectedFlag?.card_id
  ]);

  const searchPageCount = Math.max(1, Math.ceil(filteredCards.length / 100));
  const safeSearchPage = Math.min(searchPage, searchPageCount - 1);
  const visibleFilteredCards = useMemo(
    () => filteredCards.slice(safeSearchPage * 100, safeSearchPage * 100 + 100),
    [filteredCards, safeSearchPage]
  );
  const previewCardIndex = previewCardId
    ? filteredCards.findIndex((card) => card.id === previewCardId)
    : -1;
  const previousPreviewCard =
    previewCardIndex > 0 ? filteredCards[previewCardIndex - 1] : null;
  const nextPreviewCard =
    previewCardIndex >= 0 && previewCardIndex < filteredCards.length - 1
      ? filteredCards[previewCardIndex + 1]
      : null;
  const activeDraftDeckCards = useMemo(
    () => draftDeckCards.filter((item) => cardMap.get(item.cardId)?.is_active),
    [cardMap, draftDeckCards]
  );
  const mainDeckTotal = activeDraftDeckCards.reduce((sum, item) => sum + item.quantity, 0);
  const canEditDeck = Boolean(deck && currentUserId && deck.owner_id === currentUserId);
  const shouldCopyDefaultDeckToPrivate = deckVisibility === "default" && saveDefaultAlsoPrivate;
  const hasUnsavedChanges = deck
    ? deckName.trim() !== deck.name ||
      selectedFlagId !== (deck.flag_id ?? "") ||
      selectedFlagImageId !== (deck.selected_flag_image_id ?? "") ||
      effectiveSelectedBuddyCardId !== (deck.buddy_card_id ?? "") ||
      selectedBuddyImageId !== (deck.selected_buddy_image_id ?? "") ||
      selectedSleeveSupplyId !== (deck.sleeve_supply_id ?? "") ||
      selectedPlaymatSupplyId !== (deck.playmat_supply_id ?? "") ||
      deckVisibility !== (deck.deck_visibility ?? "private") ||
      deckEra !== (deck.era_key ?? "") ||
      shouldCopyDefaultDeckToPrivate ||
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
      selectedBuddyImageId: selectedBuddyImageId || null,
      sleeveSupplyId: selectedSleeveSupplyId || null,
      playmatSupplyId: selectedPlaymatSupplyId || null,
      deckVisibility,
      eraKey: deckEra || null
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

    if (shouldCopyDefaultDeckToPrivate) {
      const copyResult = await copyDeck({
        sourceDeckId: deck.id,
        name: `${deckName.trim() || "無題のデッキ"}（自分用）`
      });

      if (copyResult.error || !copyResult.data) {
        console.error(copyResult.error);
        setMessage(
          `サンプルデッキは保存しましたが、自分用コピーの作成に失敗しました。${
            copyResult.error?.message ?? ""
          }`
        );
        setSavingDeck(false);
        return;
      }
    }

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
    if (quantity <= 0) {
      if (selectedBuddyCardId === card.id) {
        setSelectedBuddyCardId("");
        setSelectedBuddyImageId("");
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
    if (effectiveSelectedBuddyCardId === cardId) {
      return selectedBuddyImageId;
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
    if (effectiveSelectedBuddyCardId === cardId) {
      setSelectedBuddyImageId(selectedImageId ?? "");
      return;
    }
    setDeckCardImage(cardId, selectedImageId);
  }

  function openCardDetail(cardId: string) {
    setDetailCardId(cardId);
  }

  function handleSearchFiltersChange(nextFilters: DeckCardSearchFilters) {
    setSearchPage(0);
    setSearchFilters(nextFilters);
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
    if (selectedBuddyCardId !== cardId) {
      setSelectedBuddyImageId("");
    }
    setMessage("バディを選択しました。保存ボタンで反映されます。");
  }

  function closeCardDetail() {
    setDetailCardId("");
  }

  function moveSearchPreview(direction: "previous" | "next") {
    const nextCard = direction === "previous" ? previousPreviewCard : nextPreviewCard;
    if (!nextCard) return;
    setPreviewCardId(nextCard.id);
    const nextIndex = filteredCards.findIndex((card) => card.id === nextCard.id);
    if (nextIndex >= 0) {
      setSearchPage(Math.floor(nextIndex / 100));
    }
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

  function renderSupplySelect(input: {
    label: string;
    value: string;
    supplies: BattleSupplyRecord[];
    fallbackText: string;
    onChange: (value: string) => void;
  }) {
    const selectedSupply =
      input.supplies.find((supply) => supply.id === input.value) ?? null;
    const imageUrl = getPublicSupplyImageUrl(selectedSupply?.image_path);

    return (
      <label>
        {input.label}
        <div className="dm-deck-supply-setting">
          <select
            value={input.value}
            onChange={(event) => input.onChange(event.target.value)}
            disabled={!canEditDeck}
          >
            <option value="">{input.fallbackText}</option>
            {input.supplies.map((supply) => (
              <option key={supply.id} value={supply.id}>
                {supply.name}
              </option>
            ))}
          </select>
          {selectedSupply && imageUrl && (
            <div
              className={`dm-deck-supply-preview is-${selectedSupply.supply_type}`}
              title={selectedSupply.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={selectedSupply.name} />
            </div>
          )}
        </div>
      </label>
    );
  }

  return (
    <AppShell kicker="DECK EDIT" title={deck?.name ?? "デッキ編集"}>
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
                <label>
                  フラッグ
                  <button
                    type="button"
                    className="dm-deck-picker-button"
                    onClick={() => setFlagPickerOpen(true)}
                    disabled={!canEditDeck}
                  >
                    <span>{selectedFlag ? getFlagName(selectedFlag) : "選択してください"}</span>
                    <small>変更</small>
                  </button>
                </label>

                <label>
                  バディ
                  <button
                    type="button"
                    className="dm-deck-picker-button"
                    onClick={() => setBuddyPickerOpen(true)}
                    disabled={!canEditDeck || buddyCandidates.length === 0}
                  >
                    <span>{selectedBuddyCard?.name ?? "デッキ内カードから選択"}</span>
                    <small>変更</small>
                  </button>
                </label>

                {(selectedFlagCard || selectedBuddyCard) && (
                  <div className="dm-deck-linked-card-strip">
                    {selectedFlagCard && (
                      <button
                        type="button"
                        className="dm-deck-linked-card is-mini"
                        title={`フラッグ: ${selectedFlagCard.name}`}
                        aria-label={`フラッグ画像: ${selectedFlagCard.name}`}
                        onClick={() => openCardDetail(selectedFlagCard.id)}
                      >
                        <CardViewer
                          card={selectedFlagCard}
                          images={imagesByCard.get(selectedFlagCard.id) ?? []}
                          selectedImageId={selectedFlagImageId || null}
                          variant="compact"
                          forcePortrait
                        />
                      </button>
                    )}

                    {selectedBuddyCard && (
                      <button
                        type="button"
                        className="dm-deck-linked-card is-mini"
                        title={`バディ: ${selectedBuddyCard.name}`}
                        aria-label={`バディ画像: ${selectedBuddyCard.name}`}
                        onClick={() => selectDeckCard(selectedBuddyCard.id)}
                        onDoubleClick={() => openCardDetail(selectedBuddyCard.id)}
                      >
                        <CardViewer
                          card={selectedBuddyCard}
                          images={imagesByCard.get(selectedBuddyCard.id) ?? []}
                          selectedImageId={selectedBuddyImageId || null}
                          variant="compact"
                          forcePortrait
                        />
                      </button>
                    )}
                  </div>
                )}

                {renderSupplySelect({
                  label: "スリーブ",
                  value: selectedSleeveSupplyId,
                  supplies: sleeveSupplies,
                  fallbackText: "ユーザー既定スリーブを使う",
                  onChange: setSelectedSleeveSupplyId
                })}

                {renderSupplySelect({
                  label: "プレイマット",
                  value: selectedPlaymatSupplyId,
                  supplies: playmatSupplies,
                  fallbackText: "ユーザー既定プレイマットを使う",
                  onChange: setSelectedPlaymatSupplyId
                })}

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
                    value={deckEra}
                    onChange={(event) => setDeckEra(event.target.value as DeckEraKey | "")}
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
                    onChange={(event) => {
                      const nextVisibility = event.target.value as DeckVisibility;
                      setDeckVisibility(nextVisibility);
                      if (nextVisibility !== "default") {
                        setSaveDefaultAlsoPrivate(false);
                      }
                    }}
                    disabled={!canEditDeck}
                  >
                    {DECK_VISIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {deckVisibility === "default" && (
                  <label className="dm-checkbox-label">
                    <input
                      type="checkbox"
                      checked={saveDefaultAlsoPrivate}
                      onChange={(event) => setSaveDefaultAlsoPrivate(event.target.checked)}
                      disabled={!canEditDeck}
                    />
                    自分のデッキとしても保存する
                  </label>
                )}

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
              <div className="dm-deck-list-header">
                <span>デッキ内カード</span>
                <div className="dm-deck-total-panel is-compact" aria-label="デッキ総枚数">
                  <b>デッキ枚数</b>
                  <span>{mainDeckTotal}枚</span>
                </div>
              </div>
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
                {activeDraftDeckCards.map((item) => {
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
                        forcePortrait
                      />
                      <span className="dm-deck-visual-count">×{item.quantity}</span>
                    </button>
                  );
                })}
                {activeDraftDeckCards.length === 0 && (
                  <p className="dm-muted-text">まだカードが追加されていません。</p>
                )}
              </div>

              {selectedDeckCard && selectedDeckDraft && (
                <div className="dm-deck-selected-summary">
                  <b>
                    {selectedDeckCard.name} / ×{selectedDeckDraft.quantity}
                  </b>
                  {effectiveSelectedBuddyCardId === selectedDeckCard.id && <span>バディ</span>}
                  <div className="dm-deck-selected-actions">
                    <Button
                      size="sm"
                      disabled={!canEditDeck}
                      onClick={() =>
                        setLocalCardQuantity(selectedDeckCard, selectedDeckDraft.quantity - 1)
                      }
                    >
                      -1
                    </Button>
                    <strong>{selectedDeckDraft.quantity}枚</strong>
                    <Button
                      size="sm"
                      disabled={!canEditDeck}
                      onClick={() =>
                        setLocalCardQuantity(selectedDeckCard, selectedDeckDraft.quantity + 1)
                      }
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      disabled={
                        !canEditDeck ||
                        selectedDeckCard.card_type === "flag_card" ||
                        effectiveSelectedBuddyCardId === selectedDeckCard.id
                      }
                      onClick={() => setAsBuddy(selectedDeckCard.id)}
                    >
                      バディ
                    </Button>
                  </div>
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
                  sets={cardSets}
                  onChange={handleSearchFiltersChange}
                />
              </form>

              <div className="dm-deck-list dm-deck-search-results">
                {visibleFilteredCards.map((card) => {
                  const existing = draftDeckCardMap.get(card.id);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`dm-deck-row dm-deck-row-button dm-deck-search-card${
                        draggedSearchCardId === card.id ? " is-dragging" : ""
                      }`}
                      draggable={canEditDeck}
                      onClick={() => setPreviewCardId(card.id)}
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
                {filteredCards.length > visibleFilteredCards.length && (
                  <div className="dm-deck-search-pagination">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={safeSearchPage === 0}
                      onClick={() => setSearchPage((current) => Math.max(0, current - 1))}
                    >
                      前の100件
                    </Button>
                    <span>
                      {safeSearchPage + 1} / {searchPageCount}ページ
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={safeSearchPage >= searchPageCount - 1}
                      onClick={() =>
                        setSearchPage((current) => Math.min(searchPageCount - 1, current + 1))
                      }
                    >
                      次の100件
                    </Button>
                  </div>
                )}
              </div>
            </AppCard>
          </aside>
        </div>
      ) : (
        <AppCard title="エラー" description={message || "デッキが見つかりません。"} />
      )}

      {message && deck && <p className="dm-form-message">{message}</p>}

      {flagPickerOpen && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={() => setFlagPickerOpen(false)}
        >
          <section
            className="dm-card-detail-modal dm-deck-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-flag-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">FLAG PICKER</p>
                <h2 id="deck-flag-picker-title">フラッグを選択</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={() => setFlagPickerOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="dm-deck-picker-list">
              <button
                type="button"
                className={`dm-deck-picker-option${!selectedFlagId ? " is-selected" : ""}`}
                disabled={!canEditDeck}
                onClick={() => {
                  setSelectedFlagId("");
                  setSelectedFlagImageId("");
                  setSearchPage(0);
                  setFlagPickerOpen(false);
                }}
              >
                <span>
                  <b>未選択</b>
                  <small>あとで選択します</small>
                </span>
              </button>
              {flags.map((flag) => (
                <button
                  key={flag.id}
                  type="button"
                  className={`dm-deck-picker-option${
                    selectedFlagId === flag.id ? " is-selected" : ""
                  }`}
                  disabled={!canEditDeck}
                  onClick={() => {
                    setSelectedFlagId(flag.id);
                    setSelectedFlagImageId("");
                    setSearchPage(0);
                    setFlagPickerOpen(false);
                  }}
                >
                  {flag.card && (
                    <CardViewer
                      card={flag.card}
                      images={imagesByCard.get(flag.card.id) ?? []}
                      selectedImageId={null}
                      variant="compact"
                    />
                  )}
                  <span>
                    <b>{getFlagName(flag)}</b>
                    <small>
                      手札{flag.initial_hand} / ゲージ{flag.initial_gauge} / ライフ
                      {flag.initial_life}
                    </small>
                  </span>
                </button>
              ))}
              {flags.length === 0 && (
                <p className="dm-muted-text">選択できるフラッグがありません。</p>
              )}
            </div>
          </section>
        </div>
      )}

      {buddyPickerOpen && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={() => setBuddyPickerOpen(false)}
        >
          <section
            className="dm-card-detail-modal dm-deck-picker-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-buddy-picker-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">BUDDY PICKER</p>
                <h2 id="deck-buddy-picker-title">バディを選択</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={() => setBuddyPickerOpen(false)}
              >
                ×
              </button>
            </header>
            <div className="dm-deck-picker-list">
              <button
                type="button"
                className={`dm-deck-picker-option${
                  !effectiveSelectedBuddyCardId ? " is-selected" : ""
                }`}
                disabled={!canEditDeck}
                onClick={() => {
                  setSelectedBuddyCardId("");
                  setSelectedBuddyImageId("");
                  setBuddyPickerOpen(false);
                }}
              >
                <span>
                  <b>未選択</b>
                  <small>デッキ内カードからあとで選択します</small>
                </span>
              </button>
              {buddyCandidates.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className={`dm-deck-picker-option${
                    effectiveSelectedBuddyCardId === card.id ? " is-selected" : ""
                  }`}
                  disabled={!canEditDeck}
                  onClick={() => {
                    setSelectedBuddyCardId(card.id);
                    setSelectedBuddyImageId("");
                    setBuddyPickerOpen(false);
                  }}
                >
                  <CardViewer
                    card={card}
                    images={imagesByCard.get(card.id) ?? []}
                    selectedImageId={getImageSelectValue(card.id) || null}
                    variant="compact"
                  />
                  <span>
                    <b>{card.name}</b>
                    <small>{getCardTypeLabel(card.card_type)}</small>
                  </span>
                </button>
              ))}
              {buddyCandidates.length === 0 && (
                <p className="dm-muted-text">バディ候補はデッキへカードを追加すると表示されます。</p>
              )}
            </div>
          </section>
        </div>
      )}

      {previewCard && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewCardId("")}
        >
          <section
            className="dm-card-detail-modal dm-deck-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="deck-search-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">CARD PREVIEW</p>
                <h2 id="deck-search-preview-title">{previewCard.name}</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={() => setPreviewCardId("")}
              >
                ×
              </button>
            </header>
            <div className="dm-deck-preview-modal-body">
              <div className="dm-deck-preview-navigation" aria-label="検索結果の前後移動">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!previousPreviewCard}
                  onClick={() => moveSearchPreview("previous")}
                >
                  ← 前のカード
                </Button>
                <span>
                  {previewCardIndex >= 0 ? previewCardIndex + 1 : "-"} / {filteredCards.length}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!nextPreviewCard}
                  onClick={() => moveSearchPreview("next")}
                >
                  次のカード →
                </Button>
              </div>
              <CardViewer
                card={previewCard}
                images={imagesByCard.get(previewCard.id) ?? []}
              />
              <div className="dm-dialog-actions">
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canEditDeck}
                  onClick={() => {
                    setLocalCardQuantity(
                      previewCard,
                      (draftDeckCardMap.get(previewCard.id)?.quantity ?? 0) + 1
                    );
                    setPreviewCardId("");
                  }}
                >
                  デッキへ追加
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

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

                    {detailIsSelectedBuddy && detailDeckDraft && (
                      <label className="dm-card-detail-image-select">
                        デッキ内カード画像
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
                    )}

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

