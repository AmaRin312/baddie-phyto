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
  loadDeckListPages,
  loadDeckCards,
  type DeckListSection
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

const DECKS_PER_PAGE = 30;

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
  const [loadingPageAssets, setLoadingPageAssets] = useState(false);
  const [message, setMessage] = useState("");
  const [eraFilter, setEraFilter] = useState<DeckEraKey | "">("");
  const [flagFilter, setFlagFilter] = useState("");
  const [sectionPages, setSectionPages] = useState<Record<string, number>>({});
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});
  const [pageRefreshKey, setPageRefreshKey] = useState(0);
  const [selectedDeckForAction, setSelectedDeckForAction] =
    useState<DeckRecord | null>(null);
  const [copyingDeck, setCopyingDeck] = useState(false);
  const [deletingDeck, setDeletingDeck] = useState(false);
  const requestedImageCardIds = useRef(new Set<string>());
  const lastDeckRefreshAt = useRef(0);

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

  const sections: DeckSection[] = useMemo(
    () => [
      {
        key: "own",
        title: "作成したデッキ",
        decks: decks.filter(
          deck =>
            deck.owner_id === currentUserId &&
            deck.deck_visibility !== "default" &&
            deck.deck_visibility !== "public"
        )
      },
      {
        key: "public",
        title: "共有デッキ",
        decks: decks.filter(deck => deck.deck_visibility === "public")
      },
      {
        key: "default",
        title: "サンプルデッキ",
        decks: decks.filter((deck) => deck.deck_visibility === "default")
      }
    ],
    [currentUserId, decks]
  );

  const visibleDecks = useMemo(
    () => sections.flatMap((section) => section.decks),
    [sections]
  );

  function resetSectionPages() {
    setSectionPages({});
  }

  function setSectionPage(key: string, page: number) {
    if (loadingPageAssets) return;
    setLoadingPageAssets(true);
    setSectionPages(current => ({ ...current, [key]: page }));
  }

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(profile.id);
      try {
        const flagResult = await loadFlagsLite();
        if (flagResult.error) console.warn("Optional flag metadata failed to load.", flagResult.error);
        setFlags((flagResult.error ? [] : flagResult.data ?? []) as FlagRecord[]);
      } catch (error) {
        console.warn("Optional flag metadata failed to load.", error);
        setFlags([]);
      }
    }

    void loadPage();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    if (!loading) setLoadingPageAssets(true);
    void loadDeckListPages({
      ownerId: currentUserId,
      pages: {
        own: sectionPages.own ?? 0,
        public: sectionPages.public ?? 0,
        default: sectionPages.default ?? 0
      },
      pageSize: DECKS_PER_PAGE,
      eraKey: eraFilter,
      flagId: flagFilter
    }).then((pageResult) => {
      if (cancelled) return;
      if (pageResult.error || !pageResult.data) {
        console.error(pageResult.error);
        setMessage("デッキ一覧の読み込みに失敗しました。商品表示条件のSQL適用状況を確認してください。");
        setLoadingPageAssets(false);
        return;
      }
      const sections = ["own", "public", "default"] as const satisfies readonly DeckListSection[];
      const nextDecks = sections.flatMap((section) => pageResult.data![section].items);
      const nextCounts = Object.fromEntries(sections.map((section) => [
        section,
        pageResult.data![section].totalCount
      ]));
      setSectionPages((current) => {
        let changed = false;
        const next = { ...current };
        for (const section of sections) {
          const count = pageResult.data![section].totalCount;
          const lastPage = Math.max(0, Math.ceil(count / DECKS_PER_PAGE) - 1);
          if ((next[section] ?? 0) > lastPage) {
            next[section] = lastPage;
            changed = true;
          }
        }
        return changed ? next : current;
      });
      setDecks(nextDecks);
      setSectionCounts(nextCounts);
      setMessage("");
      lastDeckRefreshAt.current = Date.now();
      setLoadingPageAssets(true);
      setLoading(false);
    }).catch((error) => {
      console.error(error);
      if (!cancelled) {
        setMessage("デッキ一覧の読み込みに失敗しました。");
        setLoadingPageAssets(false);
      }
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [currentUserId, eraFilter, flagFilter, pageRefreshKey, sectionPages]);

  useEffect(() => {
    if (loading || !currentUserId) return;
    if (visibleDecks.length === 0) {
      setLoadingPageAssets(false);
      return;
    }
    let cancelled = false;
    let settled = false;
    const flagCardIds = visibleDecks
      .map((deck) => flags.find((flag) => flag.id === deck.flag_id)?.card_id)
      .filter((id): id is string => Boolean(id));
    const cardIds = [...new Set([
      ...flagCardIds,
      ...visibleDecks.map((deck) => deck.buddy_card_id).filter((id): id is string => Boolean(id))
    ])];
    const missingCardIds = cardIds.filter((id) => !cardMap.has(id));
    const missingImageIds = cardIds.filter((id) => !requestedImageCardIds.current.has(id));
    missingImageIds.forEach((id) => requestedImageCardIds.current.add(id));
    if (missingCardIds.length === 0 && missingImageIds.length === 0) {
      setLoadingPageAssets(false);
      return;
    }
    setLoadingPageAssets(true);

    void Promise.all([
      loadCardsByIds(missingCardIds),
      loadCardImagesByCardIds(missingImageIds)
    ]).then(([cardsResult, imagesResult]) => {
      settled = true;
      if (cancelled) return;
      if (!cardsResult.error && cardsResult.data?.length) {
        setCards((current) => {
          const incomingIds = new Set(cardsResult.data!.map((card) => card.id));
          return [...current.filter((card) => !incomingIds.has(card.id)), ...cardsResult.data!];
        });
      }
      if (cardsResult.error) console.warn("Deck preview cards failed to load.", cardsResult.error);
      if (imagesResult.error) {
        missingImageIds.forEach((id) => requestedImageCardIds.current.delete(id));
        console.warn("Deck preview images failed to load.", imagesResult.error);
      } else if (imagesResult.data?.length) {
        setImages((current) => {
          const existingIds = new Set(current.map((image) => image.id));
          return [...current, ...imagesResult.data!.filter((image) => !existingIds.has(image.id))];
        });
      }
    }).catch((error) => {
      console.warn("Deck preview metadata failed to load.", error);
      missingImageIds.forEach((id) => requestedImageCardIds.current.delete(id));
    }).finally(() => {
      settled = true;
      if (!cancelled) setLoadingPageAssets(false);
    });
    return () => {
      cancelled = true;
      if (!settled) {
        missingImageIds.forEach((id) => requestedImageCardIds.current.delete(id));
      }
    };
  }, [cardMap, flags, loading, visibleDecks]);

  useEffect(() => {
    if (loading) return;
    let checking = false;
    async function refreshVisibleDecks() {
      if (
        checking ||
        document.visibilityState !== "visible" ||
        Date.now() - lastDeckRefreshAt.current < 60_000
      ) return;
      checking = true;
      try {
        setPageRefreshKey((value) => value + 1);
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
  }, [currentUserId, loading]);

  useEffect(() => {
    if (!selectedDeckForAction) return;
    let cancelled = false;
    let imageLoadSettled = false;
    let pendingImageIds: string[] = [];
    const deckId = selectedDeckForAction.id;
    void (async () => {
      const [deckCardsResult, suppliesResult] = await Promise.all([
        loadDeckCards(deckId),
        loadBattleSupplies()
      ]);
      if (cancelled) return;
      if (deckCardsResult.error) {
        setMessage("デッキ内容の読み込みに失敗しました。");
        return;
      }
      const nextDeckCards = deckCardsResult.data ?? [];
      setDeckCards(current => [
        ...current.filter(item => item.deck_id !== deckId),
        ...nextDeckCards
      ]);
      if (!suppliesResult.error) setSupplies(suppliesResult.data ?? []);

      const flag = flags.find(item => item.id === selectedDeckForAction.flag_id);
      const cardIds = [...new Set([
        ...nextDeckCards.map(item => item.card_id),
        flag?.card_id,
        selectedDeckForAction.buddy_card_id
      ].filter((id): id is string => Boolean(id)))];
      const missingCardIds = cardIds.filter(id => !cardMap.has(id));
      const missingImageIds = cardIds.filter(id => !requestedImageCardIds.current.has(id));
      pendingImageIds = missingImageIds;
      missingImageIds.forEach(id => requestedImageCardIds.current.add(id));
      const [cardsResult, imagesResult] = await Promise.all([
        loadCardsByIds(missingCardIds),
        loadCardImagesByCardIds(missingImageIds)
      ]);
      imageLoadSettled = true;
      if (cancelled) return;
      if (!cardsResult.error && cardsResult.data?.length) {
        setCards(current => [...current.filter(card => !cardsResult.data!.some(next => next.id === card.id)), ...cardsResult.data!]);
      }
      if (imagesResult.error) missingImageIds.forEach(id => requestedImageCardIds.current.delete(id));
      else if (imagesResult.data?.length) {
        setImages(current => {
          const ids = new Set(current.map(image => image.id));
          return [...current, ...imagesResult.data!.filter(image => !ids.has(image.id))];
        });
      }
    })();
    return () => {
      cancelled = true;
      if (!imageLoadSettled) {
        pendingImageIds.forEach(id => requestedImageCardIds.current.delete(id));
      }
    };
  }, [cardMap, flags, selectedDeckForAction]);

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

    setDeckCards((previous) => previous.filter((deckCard) => deckCard.deck_id !== targetDeckId));
    setSelectedDeckForAction(null);
    setMessage("デッキを削除しました。");
    setPageRefreshKey((value) => value + 1);
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
          onChange={(event) => {
            if (loading || loadingPageAssets) return;
            setLoadingPageAssets(true);
            setEraFilter(event.target.value as DeckEraKey | "");
            resetSectionPages();
          }}
          disabled={loading || loadingPageAssets}
          aria-label="年代フィルタ"
        >
          <option value="">年代: すべて</option>
          {DECK_ERA_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="dm-deck-management-filter"
          value={flagFilter}
          onChange={event => {
            if (loading || loadingPageAssets) return;
            setLoadingPageAssets(true);
            setFlagFilter(event.target.value);
            resetSectionPages();
          }}
          disabled={loading || loadingPageAssets}
          aria-label="フラッグで絞り込み"
        >
          <option value="">フラッグ: すべて</option>
          {flags.filter(flag => flag.is_active && flag.can_be_selected_as_flag).map(flag => (
            <option key={flag.id} value={flag.id}>{flag.name ?? "名称未設定"}</option>
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
              {(() => {
                const totalCount = sectionCounts[section.key] ?? 0;
                const pageCount = Math.max(1, Math.ceil(totalCount / DECKS_PER_PAGE));
                const page = Math.min(sectionPages[section.key] ?? 0, pageCount - 1);
                const pageDecks = section.decks;
                return (
                  <>
              <div className="dm-section-heading">
                <div>
                  <h2>{section.title}</h2>
                </div>
                <span>{totalCount}件</span>
              </div>
              <div className="dm-app-grid">
                {pageDecks.map(renderDeckCard)}
              </div>
                    {totalCount > DECKS_PER_PAGE && (
                      <nav className="dm-deck-pagination" aria-label={`${section.title}のページ切り替え`}>
                        <button type="button" className="dm-button secondary" disabled={loadingPageAssets || page === 0} onClick={() => setSectionPage(section.key, page - 1)}>前</button>
                        <span>{page + 1} / {pageCount}</span>
                        <button type="button" className="dm-button secondary" disabled={loadingPageAssets || page >= pageCount - 1} onClick={() => setSectionPage(section.key, page + 1)}>次</button>
                      </nav>
                    )}
                  </>
                );
              })()}
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
