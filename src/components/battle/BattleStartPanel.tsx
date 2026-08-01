"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  createBattleRoom,
  joinBattleRoom,
  loadActiveBattleRooms,
  type BattleRoomRecord
} from "@/lib/battle/battleRooms";
import type { BattlePlayerSeat } from "@/lib/battle/battlePlayerStateSync";
import { loadCards } from "@/lib/cards/cardActions";
import { loadAllDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadCardImages } from "@/lib/storage/cardImageStorage";
import {
  getDeckEraLabel,
  type CardImageRecord,
  type CardRecord,
  type DeckCardRecord,
  type DeckRecord,
  type FlagWithCardRecord
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
  deckId: string;
  roomId: string;
  seat: BattlePlayerSeat;
  mode: "solo" | "match";
}) {
  const params = new URLSearchParams({
    deckId: input.deckId,
    roomId: input.roomId,
    seat: input.seat,
    mode: input.mode
  });
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
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [rooms, setRooms] = useState<BattleRoomRecord[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [previewDeck, setPreviewDeck] = useState<DeckRecord | null>(null);
  const [roomName, setRoomName] = useState("");
  const [loading, setLoading] = useState(true);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [message, setMessage] = useState("");

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

  const effectiveSelectedDeckId = selectedDeckId || visibleDecks[0]?.id || "";
  const selectedDeck = useMemo(
    () =>
      visibleDecks.find((deck) => deck.id === effectiveSelectedDeckId) ?? null,
    [effectiveSelectedDeckId, visibleDecks]
  );

  async function refreshRooms() {
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
  }

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(profile.id);
      const [deckResult, deckCardResult, flagResult, cardResult, imageResult] =
        await Promise.all([
          loadDecks(),
          loadAllDeckCards(),
          loadFlags(),
          loadCards(),
          loadCardImages()
        ]);

      if (
        deckResult.error ||
        deckCardResult.error ||
        flagResult.error ||
        cardResult.error ||
        imageResult.error
      ) {
        console.error(
          deckResult.error ??
            deckCardResult.error ??
            flagResult.error ??
            cardResult.error ??
            imageResult.error
        );
        setMessage("対戦開始に必要なデッキ情報の読み込みに失敗しました。");
      } else {
        setDecks((deckResult.data ?? []) as DeckRecord[]);
        setDeckCards(deckCardResult.data ?? []);
        setFlags(flagResult.data ?? []);
        setCards((cardResult.data ?? []) as CardRecord[]);
        setImages(imageResult.data ?? []);
      }

      await refreshRooms();
      setLoading(false);
    }

    void loadPage();
  }, [router]);

  function canStartDeck(deck: DeckRecord | null) {
    return Boolean(deck?.flag_id && deck.buddy_card_id);
  }

  function startSolo(deckId: string) {
    router.push(
      buildBattleUrl({
        deckId,
        roomId: createSoloRoomId(deckId),
        seat: "player1",
        mode: "solo"
      })
    );
  }

  async function handleCreateRoom() {
    if (!selectedDeck) {
      setMessage("使用するデッキを選択してください。");
      return;
    }
    if (!canStartDeck(selectedDeck)) {
      setMessage("対戦開始にはフラッグとバディが必要です。");
      return;
    }

    const result = await createBattleRoom({
      deckId: selectedDeck.id,
      name: roomName.trim() || `${selectedDeck.name} のルーム`
    });
    if (result.error || !result.data) {
      setMessage(result.error ?? "ルーム作成に失敗しました。");
      return;
    }

    router.push(
      buildBattleUrl({
        deckId: selectedDeck.id,
        roomId: result.data.room_id,
        seat: "player1",
        mode: "match"
      })
    );
  }

  async function handleJoinRoom(room: BattleRoomRecord) {
    if (!selectedDeck) {
      setMessage("使用するデッキを選択してください。");
      return;
    }
    if (!canStartDeck(selectedDeck)) {
      setMessage("対戦開始にはフラッグとバディが必要です。");
      return;
    }

    const result = await joinBattleRoom({ room, deckId: selectedDeck.id });
    if (result.error || !result.data) {
      setMessage(result.error ?? "ルーム入室に失敗しました。");
      return;
    }

    router.push(
      buildBattleUrl({
        deckId: selectedDeck.id,
        roomId: result.data.room.room_id,
        seat: result.data.seat,
        mode: "match"
      })
    );
  }

  function renderDeckSummary(deck: DeckRecord) {
    const flag = deck.flag_id ? flagMap.get(deck.flag_id) : null;
    const flagCard = flag?.card ?? null;
    const buddyCard = deck.buddy_card_id
      ? cardMap.get(deck.buddy_card_id) ?? null
      : null;
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
        onDoubleClick={() => setPreviewDeck(deck)}
      >
        <AppCard title={deck.name}>
          <button
            type="button"
            className={`dm-deck-management-card dm-deck-management-click-card${
              effectiveSelectedDeckId === deck.id ? " is-selected" : ""
            }`}
            onClick={() => setSelectedDeckId(deck.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setPreviewDeck(deck);
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
        <button
          type="button"
          className="dm-button secondary"
          onClick={() => void refreshRooms()}
        >
          ルーム再読み込み
        </button>
      </div>

      <div className="dm-app-grid">
        <AppCard
          title="一人回し"
          description="選んだデッキで一人回しを開始します。Realtime 同期は使いません。"
        >
          <label className="dm-form-label" htmlFor="battle-solo-deck">
            使用デッキ
          </label>
          <select
            id="battle-solo-deck"
            className="dm-input"
            value={effectiveSelectedDeckId}
            onChange={(event) => setSelectedDeckId(event.target.value)}
          >
            {visibleDecks.map((deck) => (
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
            </>
          ) : (
            <p className="dm-muted-text">デッキを選択してください。</p>
          )}
        </AppCard>

        <AppCard
          title="対人ルーム作成"
          description="作成したルームは既存ルーム一覧に表示されます。後から他の人が入室できます。"
        >
          <label className="dm-form-label" htmlFor="battle-deck">
            使用デッキ
          </label>
          <select
            id="battle-deck"
            className="dm-input"
            value={effectiveSelectedDeckId}
            onChange={(event) => setSelectedDeckId(event.target.value)}
          >
            {visibleDecks.map((deck) => (
              <option key={deck.id} value={deck.id}>
                {deck.name}
              </option>
            ))}
          </select>

          <label className="dm-form-label" htmlFor="battle-room-name">
            ルーム名
          </label>
          <input
            id="battle-room-name"
            className="dm-input"
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            placeholder="例: フリーバトル"
          />

          <button
            type="button"
            className="dm-button primary"
            onClick={() => void handleCreateRoom()}
          >
            ルームを作成して入室
          </button>
        </AppCard>
      </div>

      {message && <p className="dm-form-message">{message}</p>}

      <AppCard
        title="既存ルーム"
        description="既存ルームへ入室できます。現在人数付きで対戦参加の可否を確認できます。"
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
                  disabled={!selectedDeck || !canStartDeck(selectedDeck)}
                  onClick={() => void handleJoinRoom(room)}
                >
                  入室
                </button>
              </div>
            </div>
          ))}
        </div>
      </AppCard>

      {loading ? (
        <AppCard title="読み込み中" description="デッキを取得しています。" />
      ) : (
        <div className="dm-deck-management-section">
          <div className="dm-app-grid">
            {visibleDecks.map(renderDeck)}
            {visibleDecks.length === 0 && (
              <AppCard
                title="デッキがありません"
                description="まずデッキを作成してください。"
              />
            )}
          </div>
        </div>
      )}

      {previewDeck && (
        <div
          className="dm-card-detail-modal-backdrop"
          role="presentation"
          onClick={() => setPreviewDeck(null)}
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
                onClick={() => setPreviewDeck(null)}
              >
                ×
              </button>
            </header>
            <div className="dm-card-detail-modal-body">
              <AppCard title="デッキ内容一覧">
                {renderDeckContentList(previewDeck)}
              </AppCard>
              <div className="dm-dialog-actions">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={() => setPreviewDeck(null)}
                >
                  戻る
                </button>
                <button
                  type="button"
                  className="dm-button primary"
                  onClick={() => {
                    setSelectedDeckId(previewDeck.id);
                    setPreviewDeck(null);
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
