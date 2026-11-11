"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  joinBattleRoom,
  loadActiveBattleRooms,
  type BattleRoomRecord
} from "@/lib/battle/battleRooms";
import type { BattlePlayerSeat } from "@/lib/battle/battlePlayerStateSync";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import { loadDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlagsLite } from "@/lib/flags/flagActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import {
  DECK_ERA_OPTIONS,
  getDeckEraLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckRecord,
  type FlagRecord
} from "@/types/baddiePhyto";

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

function createSoloRoomId(deckId: string) {
  return `solo-${deckId}`;
}

function buildBattleUrl(input: {
  deckId?: string;
  roomId: string;
  seat: BattlePlayerSeat;
  mode: "solo" | "match";
}) {
  const params = new URLSearchParams({
    roomId: input.roomId,
    seat: input.seat,
    mode: input.mode
  });
  if (input.deckId) params.set("deckId", input.deckId);
  return `/battle?${params.toString()}`;
}

function buildBattleRoomEntryUrl(room: BattleRoomRecord, seat: BattlePlayerSeat) {
  const params = new URLSearchParams({
    roomId: room.room_id,
    seat,
    mode: "match"
  });
  const existingDeckId = seat === "player1" ? room.host_deck_id : room.guest_deck_id;
  if (existingDeckId) params.set("deckId", existingDeckId);
  return `/battle?${params.toString()}`;
}

function getRoomOccupancyLabel(room: BattleRoomRecord) {
  const count =
    Number(Boolean(room.host_user_id)) + Number(Boolean(room.guest_user_id));
  return `${count}/2`;
}

export function BattleStartPanel() {
  const router = useRouter();
  const [decks, setDecks] = useState<DeckRecord[]>([]);
  const [deckCards, setDeckCards] = useState<DeckCardRecord[]>([]);
  const [flags, setFlags] = useState<FlagRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [rooms, setRooms] = useState<BattleRoomRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedBattleMode, setSelectedBattleMode] = useState<"solo" | "match" | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [deckCollectionFilter, setDeckCollectionFilter] = useState<"all" | "private" | "public" | "default">("all");
  const [deckEraFilter, setDeckEraFilter] = useState("");
  const [deckFlagFilter, setDeckFlagFilter] = useState("");
  const [previewDeck, setPreviewDeck] = useState<DeckRecord | null>(null);
  const [previewDeckCardsLoading, setPreviewDeckCardsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const previewRequestId = useRef(0);

  const flagMap = useMemo(
    () => new Map(flags.map((flag) => [flag.id, flag])),
    [flags]
  );
  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );
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

  const visibleDecks = useMemo(
    () =>
      decks.filter(
        (deck) =>
          deck.owner_id === currentUserId ||
          deck.deck_visibility === "public" ||
          deck.deck_visibility === "default"
      ),
    [currentUserId, decks]
  );

  const filteredDecks = useMemo(
    () => visibleDecks.filter((deck) =>
      (deckCollectionFilter === "all" || deck.deck_visibility === deckCollectionFilter) &&
      (!deckEraFilter || deck.era_key === deckEraFilter) &&
      (!deckFlagFilter || deck.flag_id === deckFlagFilter)
    ),
    [deckCollectionFilter, deckEraFilter, deckFlagFilter, visibleDecks]
  );

  const effectiveSelectedDeckId = filteredDecks.some((deck) => deck.id === selectedDeckId)
    ? selectedDeckId
    : filteredDecks[0]?.id ?? "";
  const selectedDeck = useMemo(
    () =>
      filteredDecks.find((deck) => deck.id === effectiveSelectedDeckId) ?? null,
    [effectiveSelectedDeckId, filteredDecks]
  );

  const refreshRooms = useCallback(async () => {
    setRoomsLoading(true);
    const result = await loadActiveBattleRooms();
    if (result.error) {
      setMessage(
        "ルーム一覧の読み込みに失敗しました。battle_rooms SQL が未適用の可能性があります。"
      );
    } else {
      setRooms(result.data);
    }
    setRoomsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedBattleMode !== "match") return;
    void refreshRooms();
    const refreshOnFocus = () => void refreshRooms();
    window.addEventListener("focus", refreshOnFocus);
    const intervalId = window.setInterval(refreshOnFocus, 30_000);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      window.clearInterval(intervalId);
    };
  }, [refreshRooms, selectedBattleMode]);

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(profile.id);
      const [deckResult, flagResult] = await Promise.allSettled([
        loadDecks(),
        loadFlagsLite()
      ]);

      const decksResponse = deckResult.status === "fulfilled" ? deckResult.value : null;
      const flagsResponse = flagResult.status === "fulfilled" ? flagResult.value : null;

      if (!decksResponse || decksResponse.error) {
        console.error(decksResponse?.error);
        setMessage("対戦開始に必要なデッキ情報の読み込みに失敗しました。");
      } else {
        const nextDecks = (decksResponse.data ?? []) as unknown as DeckRecord[];
        const nextFlags = ((flagsResponse?.error ? [] : flagsResponse?.data ?? []) ??
          []) as FlagRecord[];

        setDecks(nextDecks);
        setFlags(nextFlags);

        const relatedCardIds = [...new Set([
          ...nextDecks.map((deck) => deck.buddy_card_id),
          ...nextFlags.map((flag: FlagRecord) => flag.card_id)
        ].filter((id): id is string => Boolean(id)))];

        const [cardsResponse, imagesResponse] = await Promise.allSettled([
          loadCardsByIds(relatedCardIds),
          loadCardImagesByCardIds(relatedCardIds)
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
            "Optional battle-start metadata failed to load.",
            flagsResponse?.error ?? nextCardsResponse?.error ?? nextImagesResponse?.error
          );
        }
      }

      setLoading(false);
    }

    void loadPage();
  }, [router]);

  function canStartDeck(deck: DeckRecord | null) {
    return Boolean(deck?.flag_id && deck.buddy_card_id);
  }

  async function openDeckPreview(deck: DeckRecord) {
    const requestId = ++previewRequestId.current;
    setPreviewDeck(deck);
    setDeckCards([]);
    setPreviewDeckCardsLoading(true);

    try {
      const deckCardsResult = await loadDeckCards(deck.id);
      if (requestId !== previewRequestId.current) return;
      if (deckCardsResult.error) {
        setMessage(`デッキ内容の読み込みに失敗しました。${deckCardsResult.error.message}`);
        setPreviewDeckCardsLoading(false);
        return;
      }

      const nextDeckCards = deckCardsResult.data ?? [];
      setDeckCards(nextDeckCards);
      const cardIds = [...new Set(nextDeckCards.map((item) => item.card_id))];
      const missingCardIds = cardIds.filter((id) => !cardMap.has(id));
      const missingImageIds = cardIds.filter((id) => !imagesByCard.has(id));
      const [cardsResult, imagesResult] = await Promise.all([
        loadCardsByIds(missingCardIds),
        loadCardImagesByCardIds(missingImageIds)
      ]);
      if (requestId !== previewRequestId.current) return;
      if (cardsResult.error || imagesResult.error) {
        console.warn("Battle deck preview metadata failed to load.", cardsResult.error ?? imagesResult.error);
      }
      if (!cardsResult.error && cardsResult.data?.length) {
        setCards((current) => {
          const incomingIds = new Set(cardsResult.data!.map((card) => card.id));
          return [...current.filter((card) => !incomingIds.has(card.id)), ...cardsResult.data!];
        });
      }
      if (!imagesResult.error && imagesResult.data?.length) {
        setImages((current) => {
          const incomingIds = new Set(current.map((image) => image.id));
          return [...current, ...imagesResult.data!.filter((image) => !incomingIds.has(image.id))];
        });
      }
      setPreviewDeckCardsLoading(false);
    } catch (error) {
      if (requestId !== previewRequestId.current) return;
      setMessage(`デッキ内容の読み込みに失敗しました。${error instanceof Error ? error.message : ""}`);
      setPreviewDeckCardsLoading(false);
    }
  }

  function closeDeckPreview() {
    previewRequestId.current += 1;
    setPreviewDeck(null);
    setPreviewDeckCardsLoading(false);
  }

  function startSolo(deckId?: string) {
    const roomId = deckId ? createSoloRoomId(deckId) : `solo-empty-${crypto.randomUUID()}`;
    router.push(
      buildBattleUrl({
        ...(deckId ? { deckId } : {}),
        roomId,
        seat: "player1",
        mode: "solo"
      })
    );
  }

  async function handleJoinRoom(room: BattleRoomRecord) {
    const result = await joinBattleRoom({ room });
    if (result.error || !result.data) {
      setMessage(result.error ?? "ルーム入室に失敗しました。");
      await refreshRooms();
      return;
    }

    router.push(buildBattleRoomEntryUrl(result.data.room, result.data.seat));
  }

  function renderDeckSummary(deck: DeckRecord) {
    const flag = deck.flag_id ? flagMap.get(deck.flag_id) : null;
    const flagCard = flag?.card_id ? cardMap.get(flag.card_id) ?? null : null;
    const buddyCard = deck.buddy_card_id
      ? cardMap.get(deck.buddy_card_id) ?? null
      : null;
    const flagImageId = findDisplayImageId(
      imagesByCard,
      flagCard?.id,
      deck.selected_flag_image_id
    );
    const buddyImageId = findDisplayImageId(
      imagesByCard,
      buddyCard?.id,
      deck.selected_buddy_image_id
    );

    return (
      <div className="dm-deck-management-card">
        <div className="dm-deck-management-images">
          <div>
            {flagCard ? (
              <CardViewer
                card={flagCard}
                images={imagesByCard.get(flagCard.id) ?? []}
                selectedImageId={flagImageId}
                variant="compact"
                forcePortrait
              />
            ) : (
              <span className="dm-deck-management-empty">未選択</span>
            )}
          </div>
          <div>
            {buddyCard ? (
              <CardViewer
                card={buddyCard}
                images={imagesByCard.get(buddyCard.id) ?? []}
                selectedImageId={buddyImageId}
                variant="compact"
                forcePortrait
              />
            ) : (
              <span className="dm-deck-management-empty">未選択</span>
            )}
          </div>
        </div>
        <p className="dm-muted-text">{getDeckEraLabel(deck.era_key)}</p>
      </div>
    );
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

  function renderDeck(deck: DeckRecord) {
    return (
      <div
        key={deck.id}
        className="dm-deck-management-item"
        onDoubleClick={() => void openDeckPreview(deck)}
      >
        <AppCard title={deck.name}>
          <button
            type="button"
            className={`dm-deck-management-card dm-deck-management-click-card${
              effectiveSelectedDeckId === deck.id ? " is-selected" : ""
            }`}
            onClick={() => setSelectedDeckId(deck.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void openDeckPreview(deck);
            }}
            title="クリックで選択、ダブルクリックでデッキ内容を表示"
          >
            {renderDeckSummary(deck)}
          </button>
        </AppCard>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <Link href="/decks/new" className="dm-button secondary">
          新規デッキ作成
        </Link>
        <Link href="/decks" className="dm-button secondary">
          デッキ管理
        </Link>
        {selectedBattleMode === "match" && (
          <button
            type="button"
            className="dm-button secondary"
            onClick={() => void refreshRooms()}
          >
            ルーム再読み込み
          </button>
        )}
      </div>

      {selectedBattleMode === null ? (
        <AppCard title="対戦モードを選択" description="先にプレイ方法を選んでください。">
          <div className="dm-app-grid">
            <button
              type="button"
              className="dm-button primary"
              onClick={() => setSelectedBattleMode("solo")}
            >
              一人回し
            </button>
            <button
              type="button"
              className="dm-button secondary"
              onClick={() => setSelectedBattleMode("match")}
            >
              対人ルーム
            </button>
          </div>
        </AppCard>
      ) : (
        <>
          <button
            type="button"
            className="dm-button secondary"
            onClick={() => setSelectedBattleMode(null)}
          >
            モード選択に戻る
          </button>
          {selectedBattleMode === "solo" && (
            <AppCard
              title="一人回し"
              description="使用するデッキを選択してください。"
            >
          <div className="dm-deck-search-filters">
            <label className="dm-form-label">
              デッキ区分
              <select className="dm-input" value={deckCollectionFilter} onChange={(event) => setDeckCollectionFilter(event.target.value as typeof deckCollectionFilter)}>
                <option value="all">すべて</option>
                <option value="private">自分のデッキ</option>
                <option value="public">共有デッキ</option>
                <option value="default">サンプルデッキ</option>
              </select>
            </label>
            <label className="dm-form-label">
              年代
              <select className="dm-input" value={deckEraFilter} onChange={(event) => setDeckEraFilter(event.target.value)}>
                <option value="">すべて</option>
                {DECK_ERA_OPTIONS.map((era) => <option key={era.value} value={era.value}>{era.label}</option>)}
              </select>
            </label>
            <label className="dm-form-label">
              フラッグ
              <select className="dm-input" value={deckFlagFilter} onChange={(event) => setDeckFlagFilter(event.target.value)}>
                <option value="">すべて</option>
                {flags.map((flag) => (
                  <option key={flag.id} value={flag.id}>
                    {flag.name ?? "名称未設定"}
                    {flag.usable_worlds.length === 0 ? "（ワールド指定なし）" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="dm-form-label" htmlFor="battle-solo-deck">
            使用デッキ
          </label>
          <select
            id="battle-solo-deck"
            className="dm-input"
            value={effectiveSelectedDeckId}
            onChange={(event) => setSelectedDeckId(event.target.value)}
          >
            {filteredDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>

          {selectedDeck ? (
            <>
              <h3>{selectedDeck.name}</h3>
              {renderDeckSummary(selectedDeck)}
              <button
                type="button"
                className="dm-button primary"
                disabled={!canStartDeck(selectedDeck)}
                onClick={() => startSolo(selectedDeck.id)}
              >
                このデッキで一人回し
              </button>
              {!canStartDeck(selectedDeck) && (
                <p className="dm-form-message">
                  対戦開始にはフラッグとバディが必要です。
                </p>
              )}
              <button
                type="button"
                className="dm-button secondary"
                onClick={() => startSolo()}
              >
                デッキを選ばずに一人回し
              </button>
            </>
          ) : (
            <>
              <p className="dm-muted-text">条件に合うデッキがありません。</p>
              <button
                type="button"
                className="dm-button primary"
                onClick={() => startSolo()}
              >
                デッキを選ばずに一人回し
              </button>
            </>
          )}
            </AppCard>
          )}
        </>
      )}

      {message && <p className="dm-form-message">{message}</p>}

      {selectedBattleMode === "match" && <AppCard
        title="対人ルーム"
        description="用意済みの2ルームを利用します。ルームに入った後で対戦デッキを選択します。"
      >
        {roomsLoading && <p className="dm-muted-text">ルームを読み込み中です。</p>}
        {!roomsLoading && rooms.length === 0 && (
          <p className="dm-muted-text">入室できるルームはありません。</p>
        )}
        <div className="dm-deck-list">
          {rooms.map((room) => (
            <div key={room.id} className="dm-deck-row">
              <span>
                <b>{room.name}</b>
                <small>
                  {room.status === "waiting" ? "募集中" : "対戦中"} / 参加 {getRoomOccupancyLabel(room)}
                </small>
              </span>
              <div className="dm-deck-row-actions">
                <button
                  type="button"
                  className="dm-button secondary"
                  disabled={
                    Boolean(
                      room.guest_user_id &&
                      room.guest_user_id !== currentUserId &&
                      room.host_user_id !== currentUserId
                    )
                  }
                  onClick={() => void handleJoinRoom(room)}
                >
                  {room.host_user_id === currentUserId
                    ? "再入室"
                    : room.guest_user_id === currentUserId
                      ? "再入室"
                    : !room.host_user_id
                      ? "ルームを使用"
                      : room.guest_user_id
                        ? "対戦中"
                        : "入室"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </AppCard>}

      {selectedBattleMode === "solo" && (loading ? (
        <AppCard title="読み込み中" description="デッキを取得しています。" />
      ) : (
        <div className="dm-deck-management-section">
          <div className="dm-app-grid">
            {filteredDecks.map(renderDeck)}
            {filteredDecks.length === 0 && (
              <AppCard
                title="デッキがありません"
                description="まずデッキを作成してください。"
              />
            )}
          </div>
        </div>
      ))}

      {previewDeck && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={closeDeckPreview}
        >
          <section
            className="dm-card-detail-modal dm-deck-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="battle-deck-preview-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="dm-card-detail-modal-header">
              <div>
                <p className="dm-kicker">DECK PREVIEW</p>
                <h2 id="battle-deck-preview-title">{previewDeck.name}</h2>
              </div>
              <button
                type="button"
                className="dm-dialog-close"
                onClick={closeDeckPreview}
              >
                ×
              </button>
            </header>
            <div className="dm-card-detail-modal-body">
              <AppCard title="デッキ内容一覧">
                {previewDeckCardsLoading
                  ? <p className="dm-muted-text">デッキ内容を読み込んでいます。</p>
                  : renderDeckContentList(previewDeck)}
              </AppCard>
              <div className="dm-dialog-actions">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={closeDeckPreview}
                >
                  戻る
                </button>
                <button
                  type="button"
                  className="dm-button primary"
                  onClick={() => {
                    setSelectedDeckId(previewDeck.id);
                    closeDeckPreview();
                  }}
                >
                  このデッキを選択
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
