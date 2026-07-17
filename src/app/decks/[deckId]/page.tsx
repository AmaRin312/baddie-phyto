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
  getCardTypeLabel,
  type CardImageRecord,
  type CardRecord,
  type CardType,
  type DeckCardRecord,
  type DeckRecord,
  type FlagWithCardRecord
} from "@/types/baddiePhyto";

type DeckDetailPageProps = { params: Promise<{ deckId: string }> };

type ExcludeFilters = {
  dragon: boolean;
  hyakki: boolean;
  chaos: boolean;
  generic: boolean;
  flagCard: boolean;
  inactive: boolean;
};

const CARD_TYPE_ORDER: CardType[] = [
  "monster",
  "spell",
  "item",
  "impact",
  "flag_card",
  "other"
];

const DEFAULT_FILTERS: ExcludeFilters = {
  dragon: false,
  hyakki: false,
  chaos: false,
  generic: false,
  flagCard: true,
  inactive: true
};

function getFlagName(flag?: FlagWithCardRecord | null) {
  return flag?.name || flag?.card?.name || "未選択";
}

function countByCardType(deckCards: DeckCardRecord[], cardMap: Map<string, CardRecord>) {
  const counts = new Map<CardType, number>();
  for (const item of deckCards) {
    const card = cardMap.get(item.card_id);
    if (!card) continue;
    counts.set(card.card_type, (counts.get(card.card_type) ?? 0) + item.quantity);
  }
  return counts;
}

function countByWorld(deckCards: DeckCardRecord[], cardMap: Map<string, CardRecord>) {
  const counts = new Map<string, number>();
  for (const item of deckCards) {
    const card = cardMap.get(item.card_id);
    if (!card) continue;
    for (const world of card.worlds) {
      counts.set(world, (counts.get(world) ?? 0) + item.quantity);
    }
  }
  return [...counts.entries()].sort((left, right) =>
    left[0].localeCompare(right[0], "ja")
  );
}

export default function DeckDetailPage({ params }: DeckDetailPageProps) {
  const [deckId, setDeckId] = useState("");
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [deckName, setDeckName] = useState("");
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [selectedBuddyCardId, setSelectedBuddyCardId] = useState("");
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [cardPrintings, setCardPrintings] = useState<CardPrintingSearchRecord[]>([]);
  const [cardSets, setCardSets] = useState<DeckCardSetOption[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardRecord[]>([]);
  const [selectedImages, setSelectedImages] = useState<Record<string, string>>(
    {}
  );
  const [searchFilters, setSearchFilters] = useState<DeckCardSearchFilters>(
    EMPTY_DECK_CARD_SEARCH_FILTERS
  );
  const [filters, setFilters] = useState<ExcludeFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingCardId, setSavingCardId] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async (currentDeckId: string) => {
    const [
      deckResult,
      deckCardsResult,
      flagResult,
      cardResult,
      imageResult,
      printingSearchResult
    ] =
      await Promise.all([
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
    setSelectedFlagId(nextDeck.flag_id);
    setSelectedBuddyCardId(nextDeck.buddy_card_id);
    setDeckCards(deckCardsResult.data ?? []);
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
      setDeckId(resolvedDeckId);
      await reload(resolvedDeckId);
    }
    void loadPage();
  }, [params, reload]);

  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const deckCardMap = useMemo(
    () => new Map(deckCards.map((item) => [item.card_id, item])),
    [deckCards]
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
  const selectedBuddy = cardMap.get(selectedBuddyCardId) ?? null;
  const searchOptions = useMemo(() => getDeckCardSearchOptions(cards), [cards]);

  const buddyCandidates = useMemo(
    () =>
      cards.filter(
        (card) => card.is_active && card.card_type !== "flag_card"
      ),
    [cards]
  );

  const filteredCards = useMemo(() => {
    return filterDeckCandidateCards({
      cards: cards
        .filter((card) => !filters.dragon || !card.is_dragon)
        .filter((card) => !filters.hyakki || !card.is_hyakki)
        .filter((card) => !filters.chaos || !card.is_chaos)
        .filter((card) => !filters.generic || !card.is_generic),
      printings: cardPrintings,
      filters: searchFilters,
      selectedBuddyCardId,
      selectedFlagCardId: selectedFlag?.card_id,
      excludeInactive: filters.inactive,
      excludeFlagCard: filters.flagCard
    });
  }, [
    cardPrintings,
    cards,
    filters.chaos,
    filters.dragon,
    filters.flagCard,
    filters.generic,
    filters.hyakki,
    filters.inactive,
    searchFilters,
    selectedBuddyCardId,
    selectedFlag?.card_id
  ]);

  const mainDeckTotal = deckCards.reduce((sum, item) => sum + item.quantity, 0);
  const typeCounts = countByCardType(deckCards, cardMap);
  const worldCounts = countByWorld(deckCards, cardMap);

  function setFilter(key: keyof ExcludeFilters, value: boolean) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveSettings() {
    if (!deck || !deckName.trim() || !selectedFlagId || !selectedBuddyCardId) {
      setMessage("デッキ名、フラッグ、バディを選択してください。");
      return;
    }

    setSavingSettings(true);
    setMessage("");
    const { error, data } = await updateDeckSettings({
      deckId: deck.id,
      name: deckName.trim(),
      flagId: selectedFlagId,
      buddyCardId: selectedBuddyCardId
    });
    setSavingSettings(false);

    if (error || !data) {
      console.error(error);
      setMessage(`デッキ設定の保存に失敗しました。${error?.message ?? ""}`);
      return;
    }

    await reload(deck.id);
    setMessage("デッキ設定を保存しました。");
  }

  async function saveCardQuantity(
    card: CardRecord,
    quantity: number,
    selectedImageId?: string | null
  ) {
    if (!deckId) return;
    if (card.id === selectedBuddyCardId) {
      setMessage("バディは deck_cards には入れません。");
      return;
    }
    if (card.id === selectedFlag?.card_id) {
      setMessage("ゲーム開始フラッグは deck_cards には入れません。");
      return;
    }

    const existing = deckCardMap.get(card.id);
    setSavingCardId(card.id);
    setMessage("");
    const { error } = await setDeckCard({
      deckId,
      cardId: card.id,
      quantity,
      sortOrder: existing?.sort_order ?? deckCards.length,
      selectedImageId:
        selectedImageId !== undefined
          ? selectedImageId
          : existing?.selected_image_id ?? null
    });
    setSavingCardId("");

    if (error) {
      console.error(error);
      setMessage(`デッキカードの保存に失敗しました。${error.message}`);
      return;
    }

    await reload(deckId);
  }

  async function saveSelectedImage(card: CardRecord, imageId: string) {
    const existing = deckCardMap.get(card.id);
    if (!existing) {
      setSelectedImages((current) => ({ ...current, [card.id]: imageId }));
      return;
    }

    await saveCardQuantity(card, existing.quantity, imageId || null);
  }

  function getImageSelectValue(cardId: string) {
    return selectedImages[cardId] ?? deckCardMap.get(cardId)?.selected_image_id ?? "";
  }

  return (
    <AppShell kicker="DECK EDIT" title={deck?.name ?? "デッキ編集"}>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
        {deckId && (
          <Link href={`/battle?deckId=${deckId}`} className="dm-button primary">
            Battle開始
          </Link>
        )}
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="デッキ情報を取得しています。" />
      ) : deck ? (
        <div className="dm-deck-editor-layout">
          <div className="dm-deck-editor-main">
            <AppCard
              title="1. デッキ設定"
              description="フラッグとバディを選択して保存します。バディは1枚固定で deck_cards には入りません。"
            >
              <form
                className="dm-auth-form dm-card-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveSettings();
                }}
              >
                <label>
                  デッキ名
                  <input
                    value={deckName}
                    onChange={(event) => setDeckName(event.target.value)}
                    required
                  />
                </label>

                <label>
                  フラッグ
                  <select
                    value={selectedFlagId}
                    onChange={(event) => setSelectedFlagId(event.target.value)}
                    required
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
                    required
                  >
                    <option value="">選択してください</option>
                    {buddyCandidates.map((card) => (
                      <option key={card.id} value={card.id}>
                        {card.name}
                      </option>
                    ))}
                  </select>
                </label>

                <Button
                  type="submit"
                  variant="primary"
                  loading={savingSettings}
                  fullWidth
                >
                  デッキ設定を保存
                </Button>
              </form>
            </AppCard>

            <AppCard
              title="2. デッキ内容"
              description="枚数変更はすぐ保存されます。0枚にすると deck_cards から削除されます。"
            >
              <div className="dm-deck-list">
                {deckCards.map((item) => {
                  const card = cardMap.get(item.card_id);
                  if (!card) return null;
                  return (
                    <div key={item.id} className="dm-deck-row">
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          selectedImageId={item.selected_image_id}
                          variant="compact"
                        />
                        <span>
                          {card.name} / {getCardTypeLabel(card.card_type)} ×{" "}
                          {item.quantity}
                        </span>
                      </span>
                      <div className="dm-deck-row-actions">
                        <select
                          value={getImageSelectValue(card.id)}
                          onChange={(event) =>
                            void saveSelectedImage(card, event.target.value)
                          }
                        >
                          <option value="">Default画像を使う</option>
                          {(imagesByCard.get(card.id) ?? []).map((image, index) => (
                            <option key={image.id} value={image.id}>
                              {image.is_default
                                ? `画像${index + 1}（Default）`
                                : `画像${index + 1}`}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          disabled={savingCardId === card.id}
                          onClick={() => saveCardQuantity(card, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <Button
                          size="sm"
                          disabled={savingCardId === card.id}
                          onClick={() => saveCardQuantity(card, item.quantity + 1)}
                        >
                          +
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={savingCardId === card.id}
                          onClick={() => saveCardQuantity(card, 0)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {deckCards.length === 0 && (
                  <p className="dm-muted-text">まだカードが追加されていません。</p>
                )}
              </div>
            </AppCard>

            <AppCard
              title="3. カード追加"
              description="複数条件を組み合わせて候補を絞り込みます。採用画像未選択なら selected_image_id=null でDefault画像を使います。"
            >
              <form className="dm-auth-form dm-card-form">
                <DeckCardSearchPanel
                  filters={searchFilters}
                  worlds={searchOptions.worlds}
                  races={searchOptions.races}
                  sets={cardSets}
                  onChange={setSearchFilters}
                />

                <fieldset className="dm-form-fieldset">
                  <legend>除外フィルター</legend>
                  <div className="dm-checkbox-grid">
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.dragon}
                        onChange={(event) => setFilter("dragon", event.target.checked)}
                      />
                      ドラゴン除外
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.hyakki}
                        onChange={(event) => setFilter("hyakki", event.target.checked)}
                      />
                      百鬼除外
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.chaos}
                        onChange={(event) => setFilter("chaos", event.target.checked)}
                      />
                      カオス除外
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.generic}
                        onChange={(event) => setFilter("generic", event.target.checked)}
                      />
                      ジェネリック除外
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.flagCard}
                        onChange={(event) => setFilter("flagCard", event.target.checked)}
                      />
                      flag_card 除外
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={filters.inactive}
                        onChange={(event) => setFilter("inactive", event.target.checked)}
                      />
                      無効カード除外
                    </label>
                  </div>
                </fieldset>
              </form>

              <div className="dm-deck-list">
                {filteredCards.map((card) => {
                  const existing = deckCardMap.get(card.id);
                  return (
                    <div key={card.id} className="dm-deck-row">
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          selectedImageId={getImageSelectValue(card.id) || null}
                          variant="compact"
                        />
                        <span>
                          {card.name} / {getCardTypeLabel(card.card_type)}
                          {existing ? ` × ${existing.quantity}` : ""}
                          {!card.is_active ? "（無効）" : ""}
                        </span>
                      </span>
                      <div className="dm-deck-row-actions">
                        <select
                          value={getImageSelectValue(card.id)}
                          onChange={(event) =>
                            setSelectedImages((current) => ({
                              ...current,
                              [card.id]: event.target.value
                            }))
                          }
                        >
                          <option value="">Default画像を使う</option>
                          {(imagesByCard.get(card.id) ?? []).map((image, index) => (
                            <option key={image.id} value={image.id}>
                              {image.is_default
                                ? `画像${index + 1}（Default）`
                                : `画像${index + 1}`}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={savingCardId === card.id}
                          onClick={() =>
                            saveCardQuantity(
                              card,
                              (existing?.quantity ?? 0) + 1,
                              getImageSelectValue(card.id) || null
                            )
                          }
                        >
                          追加
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {filteredCards.length === 0 && (
                  <p className="dm-muted-text">条件に合うカードがありません。</p>
                )}
              </div>
            </AppCard>
          </div>

          <aside className="dm-deck-editor-side">
            <AppCard title="枚数表示" description="現在の保存済みデッキ内容です。">
              <div className="dm-deck-summary">
                <p>
                  <b>メインデッキ合計</b>
                  <span>{mainDeckTotal}枚</span>
                </p>
                <p>
                  <b>選択フラッグ</b>
                  <span>{getFlagName(selectedFlag)}</span>
                </p>
                <p>
                  <b>バディカード</b>
                  <span>{selectedBuddy?.name ?? "未選択"}</span>
                </p>
              </div>
            </AppCard>

            <AppCard title="カードタイプ別" description="deck_cards の枚数です。">
              <div className="dm-deck-summary-list">
                {CARD_TYPE_ORDER.map((cardType) => (
                  <p key={cardType}>
                    <b>{getCardTypeLabel(cardType)}</b>
                    <span>{typeCounts.get(cardType) ?? 0}枚</span>
                  </p>
                ))}
              </div>
            </AppCard>

            <AppCard title="ワールド別" description="複数ワールドカードは各ワールドに加算します。">
              <div className="dm-deck-summary-list">
                {worldCounts.map(([world, count]) => (
                  <p key={world}>
                    <b>{world}</b>
                    <span>{count}枚</span>
                  </p>
                ))}
                {worldCounts.length === 0 && (
                  <p className="dm-muted-text">ワールド情報がありません。</p>
                )}
              </div>
            </AppCard>
          </aside>
        </div>
      ) : (
        <AppCard title="エラー" description={message || "デッキが見つかりません。"} />
      )}

      {message && deck && <p className="dm-form-message">{message}</p>}
    </AppShell>
  );
}
