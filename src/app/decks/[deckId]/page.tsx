"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CardViewer } from "@/components/cards/CardViewer";
import { DeckCardSearchPanel } from "@/components/decks/DeckCardSearchPanel";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import {
  createDraftDeck,
  copyDeck,
  loadDeck,
  loadDeckCards,
  setDeckCard,
  updateDeckSettings
} from "@/lib/decks/deckActions";
import { loadFlagsLite } from "@/lib/flags/flagActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import {
  getPublicSupplyImageUrl,
  loadBattleSupplies
} from "@/lib/supplies/supplyActions";
import {
  EMPTY_DECK_CARD_SEARCH_FILTERS,
  loadDeckCardSearchOptions,
  resolveDeckSearchWorlds,
  searchDeckCards,
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
  type FlagRecord
} from "@/types/baddiePhyto";

type DeckDetailPageProps = { params: Promise<{ deckId: string }> };

type DetailImageContext = "deck" | "flag" | "buddy";

function getFlagName(flag?: FlagRecord | null, card?: CardRecord | null) {
  return flag?.name || card?.name || "未選択";
}

export default function DeckDetailPage({ params }: DeckDetailPageProps) {
  const router = useRouter();
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [isNewDeckDraft, setIsNewDeckDraft] = useState(false);
  const [deckName, setDeckName] = useState("");
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedFlagImageId, setSelectedFlagImageId] = useState("");
  const [selectedBuddyCardId, setSelectedBuddyCardId] = useState("");
  const [selectedBuddyImageId, setSelectedBuddyImageId] = useState("");
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [selectedPlaymatSupplyId, setSelectedPlaymatSupplyId] = useState("");
  const [saveVisibilities, setSaveVisibilities] = useState<DeckVisibility[]>(["private"]);
  const deckVisibility: DeckVisibility = saveVisibilities[0] ?? "private";
  const [deckEra, setDeckEra] = useState<DeckEraKey | "">("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [searchResults, setSearchResults] = useState<CardRecord[]>([]);
  const [searchTotalCount, setSearchTotalCount] = useState(0);
  const [searchWorlds, setSearchWorlds] = useState<string[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
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
  const [detailImageContext, setDetailImageContext] =
    useState<DetailImageContext>("deck");
  const [previewCardId, setPreviewCardId] = useState("");
  const [selectedDeckCardId, setSelectedDeckCardId] = useState("");
  const [draggedDeckCardId, setDraggedDeckCardId] = useState<string | null>(null);
  const [draggedSearchCardId, setDraggedSearchCardId] = useState<string | null>(null);
  const [flagPickerOpen, setFlagPickerOpen] = useState(false);
  const [buddyPickerOpen, setBuddyPickerOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [searchPage, setSearchPage] = useState(0);
  const searchResultsRef = useRef<HTMLDivElement | null>(null);
  const deferredSearchFilters = useDeferredValue(searchFilters);

  const reload = useCallback(async (currentDeckId: string) => {
    const [
      deckResult,
      deckCardsResult,
      flagResult,
      searchOptionsResult,
      supplyResult
    ] = await Promise.all([
      loadDeck(currentDeckId),
      loadDeckCards(currentDeckId),
      loadFlagsLite({ selectableOnly: true, activeOnly: true }),
      loadDeckCardSearchOptions(),
      loadBattleSupplies()
    ]);

    if (
      deckResult.error ||
      deckCardsResult.error ||
      flagResult.error ||
      searchOptionsResult.error ||
      supplyResult.error ||
      !deckResult.data
    ) {
      console.error(
        deckResult.error ??
          deckCardsResult.error ??
          flagResult.error ??
          searchOptionsResult.error ??
          supplyResult.error
      );
      setMessage("デッキ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    const nextDeck = deckResult.data;
    const nextDeckCards = deckCardsResult.data ?? [];
    const nextCardIds = [...new Set([
      ...nextDeckCards.map((deckCard) => deckCard.card_id),
      ...((flagResult.data ?? []) as FlagRecord[]).map((flag) => flag.card_id).filter(Boolean)
    ].filter(Boolean))] as string[];
    const cardResult = await loadCardsByIds(nextCardIds);
    if (cardResult.error) {
      console.error(cardResult.error);
      setMessage("デッキカード情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }
    const nextCards = (cardResult.data ?? []) as unknown as CardRecord[];
    const nextCardMap = new Map(nextCards.map((card) => [card.id, card]));
    const nextFlags = ((flagResult.data ?? []) as FlagRecord[]).filter(
      (flag: FlagRecord) =>
        Boolean(flag.card_id) &&
        flag.is_active &&
        flag.can_be_selected_as_flag &&
        nextCardMap.get(flag.card_id ?? "")?.card_type === "flag_card" &&
        nextCardMap.get(flag.card_id ?? "")?.is_active
    );
    const imageCardIds = [
      ...new Set(
        [
          ...nextDeckCards.map((deckCard: DeckCardRecord) => deckCard.card_id),
          nextFlags.find((flag) => flag.id === nextDeck.flag_id)?.card_id
        ].filter(Boolean)
      )
    ] as string[];
    const imageResult = await loadCardImagesByCardIds(imageCardIds);

    setDeck(nextDeck);
    setIsNewDeckDraft(false);
    setDeckName(nextDeck.name);
    setSelectedFlagId(nextDeck.flag_id ?? "");
    setSelectedFlagImageId(nextDeck.selected_flag_image_id ?? "");
    setSelectedBuddyCardId(nextDeck.buddy_card_id ?? "");
    setSelectedBuddyImageId(nextDeck.selected_buddy_image_id ?? "");
    setSelectedSleeveSupplyId(nextDeck.sleeve_supply_id ?? "");
    setSelectedPlaymatSupplyId(nextDeck.playmat_supply_id ?? "");
    setSaveVisibilities([nextDeck.deck_visibility ?? "private"]);
    setDeckEra(nextDeck.era_key ?? "");
    setSavedDeckCards(nextDeckCards);
    setDraftDeckCards(createDeckCardDrafts(nextDeckCards));
    setFlags(nextFlags);
    setCards(nextCards);
    setSearchResults([]);
    setImages(imageResult.error ? [] : imageResult.data ?? []);
    setBattleSupplies(supplyResult.data ?? []);
    setSearchWorlds(searchOptionsResult.worlds);
    setCardSets(searchOptionsResult.sets);
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
      if (resolvedDeckId === "new") {
        const [flagResult, searchOptionsResult, supplyResult] =
          await Promise.all([
            loadFlagsLite({ selectableOnly: true, activeOnly: true }),
            loadDeckCardSearchOptions(),
            loadBattleSupplies()
          ]);

        if (
          flagResult.error ||
          searchOptionsResult.error ||
          supplyResult.error
        ) {
          console.error(
            flagResult.error ??
              searchOptionsResult.error ??
              supplyResult.error
          );
          setMessage("デッキ情報の読み込みに失敗しました。");
          setLoading(false);
          return;
        }

        const flagCardIds = [...new Set(
          ((flagResult.data ?? []) as FlagRecord[])
            .map((flag) => flag.card_id)
            .filter(Boolean)
        )] as string[];
        const cardResult = await loadCardsByIds(flagCardIds);
        if (cardResult.error) {
          console.error(cardResult.error);
          setMessage("フラッグ情報の読み込みに失敗しました。");
          setLoading(false);
          return;
        }
        const nextCards = (cardResult.data ?? []) as unknown as CardRecord[];
        const nextCardMap = new Map(nextCards.map((card) => [card.id, card]));
          const nextFlags = ((flagResult.data ?? []) as FlagRecord[]).filter(
            (flag: FlagRecord) =>
              Boolean(flag.card_id) &&
              flag.is_active &&
              flag.can_be_selected_as_flag &&
              nextCardMap.get(flag.card_id ?? "")?.card_type === "flag_card" &&
              nextCardMap.get(flag.card_id ?? "")?.is_active
        );
        setDeck(null);
        setIsNewDeckDraft(true);
        setDeckName("");
        setSelectedFlagId("");
        setSelectedFlagImageId("");
        setSelectedBuddyCardId("");
        setSelectedBuddyImageId("");
        setSelectedSleeveSupplyId("");
        setSelectedPlaymatSupplyId("");
        setSaveVisibilities(["private"]);
        setDeckEra("");
        setSavedDeckCards([]);
        setDraftDeckCards([]);
        setFlags(nextFlags);
        setCards(nextCards);
        setSearchResults([]);
        setImages([]);
        setBattleSupplies(supplyResult.data ?? []);
        setSearchWorlds(searchOptionsResult.worlds);
        setCardSets(searchOptionsResult.sets);
        setLoading(false);
        return;
      }
      await reload(resolvedDeckId);
    }
    void loadPage();
  }, [params, reload]);

  const cardMap = useMemo(
    () => new Map([...cards, ...searchResults].map((card) => [card.id, card])),
    [cards, searchResults]
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
  const selectedFlagCard = selectedFlag?.card_id
    ? cardMap.get(selectedFlag.card_id) ?? null
    : null;
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

  const filteredCards = searchResults;
  const searchPageCount = Math.max(1, Math.ceil(searchTotalCount / 100));
  const safeSearchPage = Math.min(searchPage, searchPageCount - 1);
  const visibleFilteredCards = filteredCards;

  useEffect(() => {
    const resultsElement = searchResultsRef.current;
    if (resultsElement && resultsElement.scrollTop !== 0) {
      resultsElement.scrollTop = 0;
    }
  }, [deferredSearchFilters, safeSearchPage]);

  useEffect(() => {
    if (deferredSearchFilters.worlds.length === 0) {
      setSearchResults([]);
      setSearchTotalCount(0);
      setSearchLoading(false);
      setSearchError("");
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearchLoading(true);
      setSearchError("");
      const result = await searchDeckCards({
        filters: deferredSearchFilters,
        page: safeSearchPage,
        pageSize: 100,
        preferredWorlds: resolveDeckSearchWorlds(searchWorlds, [...preferredWorlds]),
        excludedCardId: selectedFlag?.card_id
      });

      if (cancelled) return;
      setSearchLoading(false);
      if (result.error || !result.data) {
        setSearchResults([]);
        setSearchTotalCount(0);
        setSearchError(`カード検索に失敗しました。${result.error?.message ?? ""}`);
        return;
      }
      setSearchResults(result.data.items ?? []);
      setSearchTotalCount(result.data.totalCount ?? 0);
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [deferredSearchFilters, preferredWorlds, safeSearchPage, searchWorlds, selectedFlag?.card_id]);
  const activeDraftDeckCards = useMemo(
    () => draftDeckCards.filter((item) => cardMap.get(item.cardId)?.is_active),
    [cardMap, draftDeckCards]
  );
  const visibleImageCardIds = useMemo(() => {
    return [
      ...new Set(
        [
          ...activeDraftDeckCards.map((draft) => draft.cardId),
          ...visibleFilteredCards.map((card) => card.id),
          ...(flagPickerOpen ? flags.map((flag) => flag.card_id) : []),
          selectedFlagCard?.id,
          selectedBuddyCard?.id,
          detailCard?.id,
          previewCard?.id
        ].filter(Boolean)
      )
    ] as string[];
  }, [
    activeDraftDeckCards,
    flagPickerOpen,
    flags,
    visibleFilteredCards,
    selectedFlagCard?.id,
    selectedBuddyCard?.id,
    detailCard?.id,
    previewCard?.id
  ]);
  const previewCardIndex = previewCardId
    ? filteredCards.findIndex((card) => card.id === previewCardId)
    : -1;
  const previousPreviewCard =
    previewCardIndex > 0 ? filteredCards[previewCardIndex - 1] : null;
  const nextPreviewCard =
    previewCardIndex >= 0 && previewCardIndex < filteredCards.length - 1
      ? filteredCards[previewCardIndex + 1]
      : null;
  const mainDeckTotal = activeDraftDeckCards.reduce((sum, item) => sum + item.quantity, 0);
  const canEditDeck = Boolean(
    currentUserId && (isNewDeckDraft || (deck && deck.owner_id === currentUserId))
  );
  const shouldCreateAdditionalCopies = saveVisibilities.length > 1;
  const hasUnsavedChanges = isNewDeckDraft
    ? Boolean(
        deckName.trim() ||
          selectedFlagId ||
          selectedFlagImageId ||
          effectiveSelectedBuddyCardId ||
          selectedBuddyImageId ||
          selectedSleeveSupplyId ||
          selectedPlaymatSupplyId ||
          saveVisibilities.length !== 1 || saveVisibilities[0] !== "private" ||
          deckEra ||
          draftDeckCards.length > 0
      )
    : deck
      ? deckName.trim() !== deck.name ||
        selectedFlagId !== (deck.flag_id ?? "") ||
        selectedFlagImageId !== (deck.selected_flag_image_id ?? "") ||
        effectiveSelectedBuddyCardId !== (deck.buddy_card_id ?? "") ||
        selectedBuddyImageId !== (deck.selected_buddy_image_id ?? "") ||
        selectedSleeveSupplyId !== (deck.sleeve_supply_id ?? "") ||
        selectedPlaymatSupplyId !== (deck.playmat_supply_id ?? "") ||
        saveVisibilities.length !== 1 || saveVisibilities[0] !== (deck.deck_visibility ?? "private") ||
        deckEra !== (deck.era_key ?? "") ||
        !areDeckCardDraftsEqual(savedDeckCardDrafts, draftDeckCards)
      : false;

  useEffect(() => {
    const missingCardIds = visibleImageCardIds.filter(
      (cardId) => !imagesByCard.has(cardId)
    );

    if (missingCardIds.length === 0) return;

    let cancelled = false;

    async function loadVisibleImages() {
      const result = await loadCardImagesByCardIds(missingCardIds);
      if (cancelled || result.error || !result.data?.length) return;

      setImages((current) => {
        const knownIds = new Set(current.map((image) => image.id));
        const next = [...current];

        for (const image of result.data ?? []) {
          if (knownIds.has(image.id)) continue;
          knownIds.add(image.id);
          next.push(image);
        }

        return next;
      });
    }

    void loadVisibleImages();

    return () => {
      cancelled = true;
    };
  }, [imagesByCard, visibleImageCardIds]);

  async function handleSaveDeck() {
    if (!canEditDeck) {
      setMessage("このデッキは所有者だけが編集できます。");
      return;
    }

    setSavingDeck(true);
    setMessage("");
    let targetDeck = deck;
    if (!targetDeck) {
      const draftDeckResult = await createDraftDeck({
        name: deckName.trim() || "無題のデッキ",
        deckVisibility,
        eraKey: deckEra || null
      });

      if (draftDeckResult.error || !draftDeckResult.data?.id) {
        console.error(draftDeckResult.error);
        setMessage(`デッキの作成に失敗しました。${draftDeckResult.error?.message ?? ""}`);
        setSavingDeck(false);
        return;
      }

      const createdDeckResult = await loadDeck(draftDeckResult.data.id);
      if (createdDeckResult.error || !createdDeckResult.data) {
        console.error(createdDeckResult.error);
        setMessage("作成したデッキ情報の読み込みに失敗しました。");
        setSavingDeck(false);
        return;
      }

      targetDeck = createdDeckResult.data;
      setDeck(targetDeck);
      setIsNewDeckDraft(false);
    }

    if (!targetDeck) {
      setMessage("保存対象のデッキ情報が見つかりません。");
      setSavingDeck(false);
      return;
    }

    const settingsResult = await updateDeckSettings({
      deckId: targetDeck.id,
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
        deckId: targetDeck.id,
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

    if (shouldCreateAdditionalCopies) {
      for (const visibility of saveVisibilities.slice(1)) {
        const copyResult = await copyDeck({
          sourceDeckId: targetDeck.id,
          name: deckName.trim() || "無題のデッキ"
        });
        if (copyResult.error || !copyResult.data?.id) {
          console.error(copyResult.error);
          setMessage(`選択した保存先の追加作成に失敗しました。${copyResult.error?.message ?? ""}`);
          setSavingDeck(false);
          return;
        }
        const copiedDeckResult = await loadDeck(copyResult.data.id);
        if (copiedDeckResult.error || !copiedDeckResult.data) {
          setMessage("追加デッキの設定読み込みに失敗しました。");
          setSavingDeck(false);
          return;
        }
        const copiedDeck = copiedDeckResult.data;
        const copySettingsResult = await updateDeckSettings({
          deckId: copiedDeck.id,
          name: deckName.trim() || "無題のデッキ",
          flagId: selectedFlagId || null,
          buddyCardId: effectiveSelectedBuddyCardId || null,
          selectedFlagImageId: selectedFlagImageId || null,
          selectedBuddyImageId: selectedBuddyImageId || null,
          sleeveSupplyId: selectedSleeveSupplyId || null,
          playmatSupplyId: selectedPlaymatSupplyId || null,
          deckVisibility: visibility,
          eraKey: deckEra || null
        });
        if (copySettingsResult.error) {
          console.error(copySettingsResult.error);
          setMessage(`追加デッキの保存区分設定に失敗しました。${copySettingsResult.error.message}`);
          setSavingDeck(false);
          return;
        }
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
    setCards((current) =>
      current.some((existingCard) => existingCard.id === card.id)
        ? current
        : [...current, card]
    );
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
    if (detailImageContext === "flag" && selectedFlagCard?.id === cardId) {
      return selectedFlagImageId;
    }
    if (detailImageContext === "buddy" && effectiveSelectedBuddyCardId === cardId) {
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
    if (detailImageContext === "flag" && selectedFlagCard?.id === cardId) {
      setSelectedFlagImageId(selectedImageId ?? "");
      return;
    }
    if (detailImageContext === "buddy" && effectiveSelectedBuddyCardId === cardId) {
      setSelectedBuddyImageId(selectedImageId ?? "");
      return;
    }
    setDeckCardImage(cardId, selectedImageId);
  }

  function openCardDetail(cardId: string, context: DetailImageContext = "deck") {
    setDetailCardId(cardId);
    setDetailImageContext(context);
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
    setDetailImageContext("deck");
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
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
        <Link href="/battle" className="dm-button secondary">
          対戦開始画面へ
        </Link>
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="デッキ情報を取得しています。" />
      ) : deck || isNewDeckDraft ? (
        <div className="dm-deck-editor-layout is-three-column">
          <aside className="dm-deck-editor-column dm-deck-editor-settings">
            <AppCard title={deckName || "無題のデッキ"}>
              <form
                className="dm-auth-form dm-card-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveDeck();
                }}
              >
                <label>
                  デッキ名
                  <input value={deckName} onChange={(event) => setDeckName(event.target.value)} disabled={!canEditDeck} placeholder="未入力なら「無題のデッキ」" />
                </label>

                {(selectedFlagCard || selectedBuddyCard) && (
                  <div className="dm-deck-linked-card-strip">
                    {selectedFlagCard && (
                      <button
                        type="button"
                        className="dm-deck-linked-card is-mini"
                        title={`フラッグ: ${selectedFlagCard.name}`}
                        aria-label={`フラッグ画像: ${selectedFlagCard.name}`}
                        onClick={() => openCardDetail(selectedFlagCard.id, "flag")}
                        onDoubleClick={() => setFlagPickerOpen(true)}
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
                        onDoubleClick={() => openCardDetail(selectedBuddyCard.id, "buddy")}
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
                  fallbackText: "サイト共通のデフォルトを使う",
                  onChange: setSelectedSleeveSupplyId
                })}

                {renderSupplySelect({
                  label: "プレイマット",
                  value: selectedPlaymatSupplyId,
                  supplies: playmatSupplies,
                  fallbackText: "プレイマットなし",
                  onChange: setSelectedPlaymatSupplyId
                })}

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

                <fieldset className="dm-deck-visibility-options" disabled={!canEditDeck}>
                  <legend>保存方法</legend>
                  {DECK_VISIBILITY_OPTIONS.map((option) => (
                    <span className="dm-checkbox-label" key={option.value}>
                      <input
                        type="checkbox"
                        checked={saveVisibilities.includes(option.value)}
                        onChange={(event) => {
                          setSaveVisibilities((current) => {
                            const next = event.target.checked
                              ? [...current, option.value]
                              : current.filter((value) => value !== option.value);
                            return next.length > 0 ? next : ["private"];
                          });
                        }}
                      />
                      {option.label}
                    </span>
                  ))}
                </fieldset>

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
            <AppCard title={deckName || "デッキ内容"}>
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
                      onDoubleClick={() => openCardDetail(card.id, "deck")}
                      onKeyDown={(event) => {
                        if (!canEditDeck) return;
                        if (event.key === "ArrowUp") {
                          event.preventDefault();
                          setLocalCardQuantity(card, item.quantity + 1);
                        } else if (event.key === "ArrowDown") {
                          event.preventDefault();
                          setLocalCardQuantity(card, item.quantity - 1);
                        } else if (event.key === "Delete" || event.key === "Backspace") {
                          event.preventDefault();
                          setLocalCardQuantity(card, 0);
                        } else if (event.key.toLowerCase() === "b") {
                          event.preventDefault();
                          setAsBuddy(card.id);
                        }
                      }}
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
                  <p className="dm-muted-text">矢印キーで枚数変更、Deleteで削除、Bでバディに設定</p>
                </div>
              )}
            </AppCard>
          </main>

          <aside className="dm-deck-editor-column dm-deck-editor-search">
            <AppCard title="カード検索">
              <form className="dm-auth-form dm-card-form">
                <DeckCardSearchPanel
                  filters={searchFilters}
                  worlds={searchWorlds}
                  initialWorlds={
                    selectedFlagCard?.worlds?.length
                      ? selectedFlagCard.worlds
                      : selectedFlag?.usable_worlds ?? []
                  }
                  sets={cardSets}
                  onChange={handleSearchFiltersChange}
                />
              </form>

                <div
                  className="dm-deck-list dm-deck-search-results"
                  ref={searchResultsRef}
                >
                <div
                  style={{
                    position: "relative",
                    height: `${Math.ceil(visibleFilteredCards.length / 4) * 150}px`
                  }}
                >
                  {visibleFilteredCards.map((card, actualIndex) => {
                    const existing = draftDeckCardMap.get(card.id);
                    return (
                      <button
                        key={card.id}
                        type="button"
                        className={`dm-deck-search-card${
                          draggedSearchCardId === card.id ? " is-dragging" : ""
                        }`}
                        style={{
                          position: "absolute",
                          top: `${Math.floor(actualIndex / 4) * 150}px`,
                          left: `${(actualIndex % 4) * 25}%`
                        }}
                        draggable={canEditDeck}
                        onClick={() => setPreviewCardId(card.id)}
                        onKeyDown={(event) => {
                          if ((event.key === "Enter" || event.key === " ") && canEditDeck) {
                            event.preventDefault();
                            setLocalCardQuantity(card, (existing?.quantity ?? 0) + 1);
                          }
                        }}
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
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          variant="compact"
                        />
                        {existing && <span className="dm-deck-search-count">×{existing.quantity}</span>}
                      </button>
                    );
                  })}
                </div>
                {searchFilters.worlds.length === 0 ? (
                  <p className="dm-muted-text">詳細検索からワールドを選択してください。</p>
                ) : searchError ? (
                  <p className="dm-form-message">{searchError}</p>
                ) : searchLoading ? (
                  <p className="dm-muted-text">カードを検索しています...</p>
                ) : searchTotalCount === 0 && (
                  <p className="dm-muted-text">条件に合うカードがありません。</p>
                )}
                {searchTotalCount > 100 && (
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
              {flags.map((flag) => {
                const flagCard = flag.card_id ? cardMap.get(flag.card_id) ?? null : null;
                return (
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
                      const flagWorlds = flagCard?.worlds?.length
                        ? flagCard.worlds
                        : flag.usable_worlds ?? [];
                      setSearchFilters((current) => ({
                        ...current,
                        worlds: resolveDeckSearchWorlds(searchWorlds, flagWorlds)
                      }));
                      setSearchPage(0);
                      setFlagPickerOpen(false);
                    }}
                  >
                    {flagCard && (
                      <CardViewer
                        card={flagCard}
                        images={imagesByCard.get(flagCard.id) ?? []}
                        selectedImageId={null}
                        variant="compact"
                        forcePortrait
                      />
                    )}
                    <span>
                      <b>{getFlagName(flag, flagCard)}</b>
                      <small>
                        手札{flag.initial_hand} / ゲージ{flag.initial_gauge} / ライフ
                        {flag.initial_life}
                      </small>
                    </span>
                  </button>
                );
              })}
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
                {detailDeckDraft || detailIsSelectedFlag || detailIsSelectedBuddy ? (
                  <>
                    <div className="dm-card-detail-image-grid" aria-label="使用画像候補">
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
                        <span className="dm-card-detail-quantity">
                          {detailDeckDraft.quantity}枚
                        </span>
                        <span className="dm-muted-text">矢印キーで枚数変更、Deleteで削除、Bでバディに設定</span>
                      </div>
                    ) : (
                      <p className="dm-muted-text">
                        フラッグカードです。デッキ設定として画像を選択できます。
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

