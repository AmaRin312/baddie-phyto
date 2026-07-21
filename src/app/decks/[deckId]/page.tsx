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
  setDeckCardDraftImage,
  setDeckCardDraftQuantity,
  type DeckCardDraft
} from "@/lib/decks/deckEditorState";
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

const CARD_TYPE_ORDER: CardType[] = [
  "monster",
  "spell",
  "item",
  "impact",
  "impact_monster",
  "flag_card",
  "other"
];

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
  const [savedDeckCards, setSavedDeckCards] = useState<DeckCardRecord[]>([]);
  const [draftDeckCards, setDraftDeckCards] = useState<DeckCardDraft[]>([]);
  const [pendingSelectedImages, setPendingSelectedImages] = useState<Record<string, string>>(
    {}
  );
  const [searchFilters, setSearchFilters] = useState<DeckCardSearchFilters>(
    EMPTY_DECK_CARD_SEARCH_FILTERS
  );
  const [loading, setLoading] = useState(true);
  const [savingDeck, setSavingDeck] = useState(false);
  const [selectedPreviewCardId, setSelectedPreviewCardId] = useState("");
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
    const nextDeckCards = deckCardsResult.data ?? [];
    setSavedDeckCards(nextDeckCards);
    setDraftDeckCards(createDeckCardDrafts(nextDeckCards));
    setFlags(nextFlags);
    setCards(nextCards);
    setImages(imageResult.data ?? []);
    setCardPrintings(printingSearchResult.printings);
    setCardSets(printingSearchResult.sets);
    setPendingSelectedImages({});
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
  const selectedBuddy = cardMap.get(selectedBuddyCardId) ?? null;
  const selectedPreviewCard = cardMap.get(selectedPreviewCardId) ?? null;
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
  const draftAsDeckCards = useMemo(
    () =>
      draftDeckCards.map(
        (draft): DeckCardRecord => ({
          id: draft.cardId,
          deck_id: deckId,
          card_id: draft.cardId,
          selected_image_id: draft.selectedImageId,
          quantity: draft.quantity,
          sort_order: draft.sortOrder,
          created_at: "",
          updated_at: ""
        })
      ),
    [deckId, draftDeckCards]
  );
  const typeCounts = countByCardType(draftAsDeckCards, cardMap);
  const worldCounts = countByWorld(draftAsDeckCards, cardMap);
  const hasUnsavedChanges = deck
    ? deckName.trim() !== deck.name ||
      selectedFlagId !== deck.flag_id ||
      selectedBuddyCardId !== deck.buddy_card_id ||
      !areDeckCardDraftsEqual(savedDeckCardDrafts, draftDeckCards)
    : false;

  async function handleSaveDeck() {
    if (!deck || !deckName.trim() || !selectedFlagId || !selectedBuddyCardId) {
      setMessage("デッキ名、フラッグ、バディを選択してください。");
      return;
    }

    setSavingDeck(true);
    setMessage("");
    const settingsResult = await updateDeckSettings({
      deckId: deck.id,
      name: deckName.trim(),
      flagId: selectedFlagId,
      buddyCardId: selectedBuddyCardId
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
        draft.selectedImageId === saved.selectedImageId
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

  function setLocalCardQuantity(
    card: CardRecord,
    quantity: number,
    selectedImageId?: string | null
  ) {
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
        quantity,
        selectedImageId
      })
    );
    setPendingSelectedImages((current) => {
      const next = { ...current };
      delete next[card.id];
      return next;
    });
  }

  function getImageSelectValue(cardId: string) {
    return pendingSelectedImages[cardId] ?? draftDeckCardMap.get(cardId)?.selectedImageId ?? "";
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
          <div className="dm-deck-editor-side">
            <AppCard
              title="デッキ設定"
              description="保存ボタンを押すまでSupabaseへ反映しません。"
            >
              <form
                className="dm-auth-form dm-card-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveDeck();
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
                  loading={savingDeck}
                  disabled={!hasUnsavedChanges}
                  fullWidth
                >
                  {hasUnsavedChanges ? "デッキを保存" : "保存済み"}
                </Button>
              </form>
            </AppCard>

            <AppCard
              title="デッキ一覧"
              description="編集中のローカルStateです。枚数変更は保存ボタンまでDBへ反映しません。"
            >
              <div className="dm-deck-list">
                {draftDeckCards.map((item) => {
                  const card = cardMap.get(item.cardId);
                  if (!card) return null;
                  return (
                    <div key={item.cardId} className="dm-deck-row">
                      <span className="dm-deck-card-cell">
                        <CardViewer
                          card={card}
                          images={imagesByCard.get(card.id) ?? []}
                          selectedImageId={item.selectedImageId}
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
                          onChange={(event) => {
                            setPendingSelectedImages((current) => {
                              const next = { ...current };
                              delete next[card.id];
                              return next;
                            });
                            setDraftDeckCards((current) =>
                              setDeckCardDraftImage(current, {
                                cardId: card.id,
                                selectedImageId: event.target.value || null
                              })
                            );
                          }}
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
                          onClick={() => setLocalCardQuantity(card, item.quantity - 1)}
                        >
                          -
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setLocalCardQuantity(card, item.quantity + 1)}
                        >
                          +
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setLocalCardQuantity(card, 0)}
                        >
                          削除
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {draftDeckCards.length === 0 && (
                  <p className="dm-muted-text">まだカードが追加されていません。</p>
                )}
              </div>
            </AppCard>

            <AppCard title="枚数表示" description="現在の編集中デッキ内容です。">
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

            <AppCard title="カードタイプ別" description="編集中 deck_cards の枚数です。">
              <div className="dm-deck-summary-list">
                {CARD_TYPE_ORDER.map((cardType) => (
                  <p key={cardType}>
                    <b>{getCardTypeLabel(cardType)}</b>
                    <span>{typeCounts.get(cardType) ?? 0}枚</span>
                  </p>
                ))}
              </div>
            </AppCard>
          </div>

          <div className="dm-deck-editor-main">
            <AppCard
              title="カード検索"
              description="フラッグの使用可能ワールドでは候補を制限しません。同一カードの再録は1枚として表示します。"
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
                    <div
                      key={card.id}
                      className="dm-deck-row"
                      onClick={() => setSelectedPreviewCardId(card.id)}
                    >
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
                          onChange={(event) => {
                            const nextImageId = event.target.value;
                            if (existing) {
                              setPendingSelectedImages((current) => {
                                const next = { ...current };
                                delete next[card.id];
                                return next;
                              });
                              setDraftDeckCards((current) =>
                                setDeckCardDraftImage(current, {
                                  cardId: card.id,
                                  selectedImageId: nextImageId || null
                                })
                              );
                              return;
                            }
                            setPendingSelectedImages((current) => ({
                              ...current,
                              [card.id]: nextImageId
                            }));
                          }}
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
                          onClick={() =>
                            setLocalCardQuantity(
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

            <AppCard title="カード詳細" description="検索結果をクリックすると表示します。">
              {selectedPreviewCard ? (
                <div className="dm-deck-card-detail">
                  <CardViewer
                    card={selectedPreviewCard}
                    images={imagesByCard.get(selectedPreviewCard.id) ?? []}
                    selectedImageId={getImageSelectValue(selectedPreviewCard.id) || null}
                  />
                  <p>
                    <b>{selectedPreviewCard.name}</b>
                  </p>
                  <p>{selectedPreviewCard.card_text || "カードテキストなし"}</p>
                </div>
              ) : (
                <p className="dm-muted-text">カードを選択してください。</p>
              )}
            </AppCard>
          </div>
        </div>
      ) : (
        <AppCard title="エラー" description={message || "デッキが見つかりません。"} />
      )}

      {message && deck && <p className="dm-form-message">{message}</p>}
    </AppShell>
  );
}
