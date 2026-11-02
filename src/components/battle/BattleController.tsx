"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  BattleActionPopup,
  type BattleActionPopupAction
} from "@/components/battle/BattleActionPopup";
import { AbilityNotificationDialog } from "@/components/battle/AbilityNotificationDialog";
import { AbilityNotificationListPanel } from "@/components/battle/AbilityNotificationListPanel";
import { AbilityCardTargetPopup } from "@/components/battle/AbilityCardTargetPopup";
import { BiriKinataTargetPopup } from "@/components/battle/BiriKinataTargetPopup";
import { BattleBoard } from "@/components/battle/BattleBoard";
import { BattlePopup } from "@/components/battle/BattlePopup";
import { BattleSidebar } from "@/components/battle/BattleSidebar";
import { DeckBrowserPopup } from "@/components/battle/DeckBrowserPopup";
import { DeckCountPopup } from "@/components/battle/DeckCountPopup";
import { useEscapeToClose } from "@/hooks/useEscapeToClose";
import {
  getAreaStacks,
  isAreaStackZone
} from "@/lib/battle/battleActions";
import { isBattleShortcutBlocked } from "@/lib/battle/battleShortcutBlocker";
import {
  cleanupExpiredBattleRooms,
  deleteBattleRoom,
  disbandBattleRoom,
  loadBattleRoom,
  PREALLOCATED_BATTLE_ROOMS,
  leaveBattleRoomBeforeDeckSelection,
  releaseBattleRoom,
  updateBattleRoomDeck
} from "@/lib/battle/battleRooms";
import {
  createBattleAbilityNotification,
  loadPendingBattleAbilityNotifications,
  subscribeBattleAbilityNotifications,
  unsubscribeBattleAbilityNotifications,
  updateBattleAbilityNotificationStatus,
  type BattleAbilityNotification
} from "@/lib/battle/battleAbilityNotifications";
import {
  createBattleState,
  deleteBattleState,
  loadBattleState,
  saveBattleState
} from "@/lib/battle/battlePersistence";
import {
  BATTLE_PLAYER_SEATS,
  getBattleStatePlayerKeyForSeat,
  deleteSyncedPlayerBattleState,
  deleteSyncedPlayerBattleStates,
  getOpponentSeat,
  getCurrentBattleUserId,
  loadSyncedPlayerBattleStates,
  mapSyncedSeatStatesToPlayers,
  normalizeBattlePlayerSeat,
  saveSyncedPlayerBattleState,
  subscribeSyncedPlayerBattleStates,
  unsubscribeSyncedPlayerBattleStates,
  type BattlePlayerSeat,
  type RealtimeStatus
} from "@/lib/battle/battlePlayerStateSync";
import { executeBattleCommand } from "@/lib/battle/commands/executeBattleCommand";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";
import { createCommandsFromDeckBrowserRequests } from "@/lib/battle/commands/battleCommandFactory";
import type { DeckBrowserRequest } from "@/lib/battle/deckBrowser/deckBrowserTypes";
import { getAutomaticAbilityCommands } from "@/lib/battle/abilities/battleAbilityDefinitions";
import { findCompositeGroupCardsInBattleState } from "@/lib/battle/compositeCards";
import type {
  AbilityId,
  BattleCardAbilityMap
} from "@/lib/battle/abilities/abilityTypes";
import { createInitialBattleState } from "@/lib/battle/createInitialBattleState";
import type { BattleSelectionMode } from "@/lib/battle/selection/battleSelectionMode";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import { loadBattleCardAbilityMap } from "@/lib/cards/cardAbilityActions";
import { loadDeck, loadDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlag } from "@/lib/flags/flagActions";
import { loadCardImagesByCardIds } from "@/lib/storage/cardImageStorage";
import {
  getPublicSupplyImageUrl,
  loadBattleSupplies,
  loadSiteSupplySettings
} from "@/lib/supplies/supplyActions";
import { loadShortcutSettings } from "@/lib/shortcuts/shortcutSettings";
import type { ShortcutActionId, ShortcutSettings } from "@/lib/shortcuts/shortcutTypes";
import {
  bindingFromKeyboardEvent,
  findActionByBinding,
  mergeWithDefaultShortcuts,
  shouldIgnoreShortcutTarget
} from "@/lib/shortcuts/shortcutUtils";
import type {
  BattleCard,
  BattleDropInput,
  BattlePlayerId,
  BattleState,
  BattleZoneId,
  PlayerState
} from "@/types/battle";
import type {
  BattleSupplyRecord,
  SiteSupplySettingsRecord,
  CardImageRecord,
  DeckCardRecord,
  DeckRecord,
  CardRecord,
  DeckEraKey
} from "@/types/baddiePhyto";
import {
  DECK_ERA_OPTIONS,
  getDeckEraLabel
} from "@/types/baddiePhyto";
import type { DeckPosition } from "@/lib/battle/battleActions";

const MULTI_SELECT_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "hand",
  "gauge",
  "drop",
  "item",
  "set",
  "center",
  "left",
  "right",
  "resolution"
]);

const HYAKUGAN_PLACEMENT_TARGET_ZONES: ReadonlyArray<BattleZoneId> = [
  "center",
  "left",
  "right"
];

type BattleSelection = {
  zoneId: BattleZoneId | null;
  instanceIds: string[];
};

type DragSelection = {
  sourceCard: BattleCard;
  instanceIds: string[];
};

type PendingDeckDrop = {
  kind: "card" | "soul";
  sourceCard: BattleCard;
  instanceIds: string[];
  parentInstanceId?: string;
};

type SoulSelection = {
  parentInstanceId: string | null;
  instanceIds: string[];
};

type SoulDragSelection = {
  parentCard: BattleCard;
  sourceSoulCard: BattleCard;
  instanceIds: string[];
};

type PendingBattleActionPopup = {
  source:
    | { kind: "card"; instanceId: string; fromZone: BattleZoneId }
    | { kind: "soul"; parentInstanceId: string; soulInstanceId: string };
  sourceCard: BattleCard;
  toZone: BattleZoneId;
  targetInstanceId: string;
  x: number;
  y: number;
};

type PendingDeckCountPopup = {
  mode: "look" | "reveal";
  x: number;
  y: number;
};

type PendingBiriKinataPopup = {
  sourceInstanceId: string;
};

type PendingFaceDownSoulPopup = {
  sourceInstanceId: string;
  candidates: BattleCard[];
};

type PendingSoulVisibilityPopup = {
  parentInstanceId: string;
  soulInstanceId: string;
  cardName: string;
  mode: "choose" | "name";
};

type PendingHyakuganPopup = {
  sourceInstanceId: string;
  pairCandidates: BattleCard[];
  selectedPairInstanceId: string | null;
};

type BattleResetSource = {
  flag: Parameters<typeof createInitialBattleState>[0]["flag"];
  buddyCardId: string;
  deckCards: Parameters<typeof createInitialBattleState>[0]["deckCards"];
};

function findBattleCardByInstanceId(
  battleState: BattleState | null,
  instanceId: string | null
) {
  if (!battleState || !instanceId) return null;

  for (const player of Object.values(battleState.players)) {
    for (const zone of Object.values(player.zones)) {
      const card = zone.cards.find((item) => item.instanceId === instanceId);
      if (card) return card;

      for (const parentCard of zone.cards) {
        const soulCard = parentCard.soul.find(
          (item) => item.instanceId === instanceId
        );
        if (soulCard) return soulCard;
      }
    }
  }

  return null;
}

function canUseBattleMultiSelection(
  card: BattleCard,
  playerId: "self" | "opponent"
) {
  return playerId === "self" && MULTI_SELECT_ZONE_IDS.has(card.zoneId);
}

function getBattleSelectionUnitInstanceIds(
  battleState: BattleState | null,
  card: BattleCard
) {
  const compositeCards = battleState
    ? findCompositeGroupCardsInBattleState(battleState, card)
    : [];

  return compositeCards.length > 1
    ? compositeCards.map((item) => item.instanceId)
    : [card.instanceId];
}

function hasBattleAbility(
  cardAbilityMap: BattleCardAbilityMap,
  card: BattleCard,
  abilityId: AbilityId
) {
  return cardAbilityMap.get(card.cardId)?.includes(abilityId) ?? false;
}

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "不明なエラーが発生しました。";
}

export function BattleController() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId");
  const roomId = searchParams.get("roomId") ?? deckId;
  const battleMode = searchParams.get("mode") === "match" ? "match" : "solo";
  const isRealtimeBattle = battleMode === "match";
  const selfSeat = normalizeBattlePlayerSeat(
    searchParams.get("seat") ?? searchParams.get("playerSeat")
  );
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
  const [battleSupplies, setBattleSupplies] = useState<BattleSupplyRecord[]>([]);
  const [siteSupplySettings, setSiteSupplySettings] =
    useState<SiteSupplySettingsRecord | null>(null);
  const [battleDeck, setBattleDeck] = useState<DeckRecord | null>(null);
  const [showRoomDeckSelection, setShowRoomDeckSelection] = useState(false);
  const [roomDeckOptions, setRoomDeckOptions] = useState<DeckRecord[]>([]);
  const [roomDeckSelectionId, setRoomDeckSelectionId] = useState("");
  const [roomDeckSelectionName, setRoomDeckSelectionName] = useState("");
  const [roomDeckSelectionBusy, setRoomDeckSelectionBusy] = useState(false);
  const [roomDeckSelectionError, setRoomDeckSelectionError] = useState("");
  const [playerSupplyDecks, setPlayerSupplyDecks] = useState<
    Partial<Record<BattlePlayerId, DeckRecord>>
  >({});
  const [cardAbilityMap, setCardAbilityMap] = useState<BattleCardAbilityMap>(
    () => new Map()
  );
  const [selection, setSelection] = useState<BattleSelection>({
    zoneId: null,
    instanceIds: []
  });
  const [soulSelection, setSoulSelection] = useState<SoulSelection>({
    parentInstanceId: null,
    instanceIds: []
  });
  const [dragSelection, setDragSelection] = useState<DragSelection | null>(null);
  const [soulDragSelection, setSoulDragSelection] =
    useState<SoulDragSelection | null>(null);
  const [pendingDeckDrop, setPendingDeckDrop] = useState<PendingDeckDrop | null>(
    null
  );
  const [pendingActionPopup, setPendingActionPopup] =
    useState<PendingBattleActionPopup | null>(null);
  const [selectionMode, setSelectionMode] = useState<BattleSelectionMode>(null);
  const [pendingDeckCountPopup, setPendingDeckCountPopup] =
    useState<PendingDeckCountPopup | null>(null);
  const [pendingBiriKinataPopup, setPendingBiriKinataPopup] =
    useState<PendingBiriKinataPopup | null>(null);
  const [pendingFaceDownSoulPopup, setPendingFaceDownSoulPopup] =
    useState<PendingFaceDownSoulPopup | null>(null);
  const [pendingSoulVisibilityPopup, setPendingSoulVisibilityPopup] =
    useState<PendingSoulVisibilityPopup | null>(null);
  const [pendingHyakuganPopup, setPendingHyakuganPopup] =
    useState<PendingHyakuganPopup | null>(null);
  const [dropBrowserPlayerId, setDropBrowserPlayerId] =
    useState<BattlePlayerId | null>(null);
  const [abilityNotifications, setAbilityNotifications] = useState<
    BattleAbilityNotification[]
  >([]);
  const [activeAbilityNotificationId, setActiveAbilityNotificationId] =
    useState<string | null>(null);
  const [showAbilityNotificationList, setShowAbilityNotificationList] =
    useState(false);
  const [viewerPinned, setViewerPinned] = useState(false);
  const [soulListPosition, setSoulListPosition] = useState<{ left: number; top: number } | null>(null);
  const [viewerInstanceIds, setViewerInstanceIds] = useState<string[]>([]);
  const nextViewerSlotRef = useRef<0 | 1>(0);
  const [shortcutSettings, setShortcutSettings] = useState<
    Required<ShortcutSettings>
  >(mergeWithDefaultShortcuts(null));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [showDeckChangePopup, setShowDeckChangePopup] = useState(false);
  const [deckChangeLoading, setDeckChangeLoading] = useState(false);
  const [deckChangeError, setDeckChangeError] = useState("");
  const [changeableDecks, setChangeableDecks] = useState<DeckRecord[]>([]);
  const [deckChangeTargetId, setDeckChangeTargetId] = useState("");
  const [deckChangeSearchText, setDeckChangeSearchText] = useState("");
  const [deckChangeEraKey, setDeckChangeEraKey] = useState<DeckEraKey | "">("");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [savingSeatKeys, setSavingSeatKeys] = useState<BattlePlayerSeat[]>([]);
  const [opponentPresent, setOpponentPresent] = useState(false);
  const resetSourceRef = useRef<BattleResetSource | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const playerVersionsRef = useRef<Record<BattlePlayerSeat, number>>({
    player1: 0,
    player2: 0
  });

  function mergePlayerStates(
    state: BattleState,
    players: Partial<Record<BattlePlayerId, PlayerState>>
  ): BattleState {
    return {
      ...state,
      players: {
        ...state.players,
        ...players
      }
    };
  }

  function hasSelfPlayerStateChanged(current: BattleState, nextState: BattleState) {
    return (
      JSON.stringify(current.players.self) !==
      JSON.stringify(nextState.players.self)
    );
  }

  function rememberPlayerVersion(seatKey: BattlePlayerSeat, version: number) {
    playerVersionsRef.current = {
      ...playerVersionsRef.current,
      [seatKey]: Math.max(playerVersionsRef.current[seatKey] ?? 0, version)
    };
  }

  const loadBattle = useCallback(async () => {
    if (!deckId) {
      if (isRealtimeBattle && roomId && selfSeat) {
        setLoading(true);
        setMessage("");
        const profile = await getOrCreateProfile();
        if (!profile) {
          window.location.href = "/login";
          return;
        }
        currentUserIdRef.current = profile.id;

        const [roomResult, decksResult] = await Promise.all([
          loadBattleRoom(roomId),
          loadDecks()
        ]);
        if (roomResult.error || !roomResult.data) {
          setMessage(roomResult.error ?? "ルームを読み込めませんでした。");
          setLoading(false);
          return;
        }

        const room = roomResult.data;
        const seatUserId = selfSeat === "player1" ? room.host_user_id : room.guest_user_id;
        if (room.status === "disbanded" || seatUserId !== profile.id) {
          setMessage("このルームの席を確認できません。対戦開始画面から入り直してください。");
          setLoading(false);
          return;
        }
        if (decksResult.error) {
          setMessage(getErrorMessage(decksResult.error) ?? "デッキ一覧を読み込めませんでした。");
          setLoading(false);
          return;
        }

        const availableDecks = (decksResult.data ?? []).filter(
          (deck) =>
            (deck.owner_id === profile.id ||
              deck.deck_visibility === "public" ||
              deck.deck_visibility === "default") &&
            deck.flag_id &&
            deck.buddy_card_id
        );
        const currentRoomDeckId =
          selfSeat === "player1" ? room.host_deck_id : room.guest_deck_id;
        setRoomDeckOptions(availableDecks);
        setRoomDeckSelectionId(
          availableDecks.some((deck) => deck.id === currentRoomDeckId)
            ? currentRoomDeckId ?? ""
            : availableDecks[0]?.id ?? ""
        );
        setRoomDeckSelectionName(room.name);
        setRoomDeckSelectionError("");
        setShowRoomDeckSelection(true);
        setLoading(false);
        return;
      }

      setLoading(false);
      setMessage("デッキを選択してからBattleを開始してください。");
      return;
    }

    if (!roomId) {
      setLoading(false);
      setMessage("Battle roomを特定できませんでした。");
      return;
    }

    const profile = await getOrCreateProfile();
    if (!profile) {
      window.location.href = "/login";
      return;
    }
    currentUserIdRef.current = await getCurrentBattleUserId();

    setLoading(true);
    setMessage("");
    setSyncMessage("");

    const [
      deckResult,
      deckCardsResult,
      shortcutResult,
      abilityMapResult,
      supplyResult,
      siteSupplySettingsResult,
      roomResult
    ] =
      await Promise.allSettled([
        loadDeck(deckId),
        loadDeckCards(deckId),
        loadShortcutSettings(),
        loadBattleCardAbilityMap(),
        loadBattleSupplies(),
        loadSiteSupplySettings(),
        isRealtimeBattle ? loadBattleRoom(roomId) : Promise.resolve({ data: null, error: null })
      ]);

    const deckResponse = deckResult.status === "fulfilled" ? deckResult.value : null;
    const deckCardsResponse =
      deckCardsResult.status === "fulfilled" ? deckCardsResult.value : null;
    const shortcutResponse =
      shortcutResult.status === "fulfilled" ? shortcutResult.value : null;
    const abilityMapResponse =
      abilityMapResult.status === "fulfilled" ? abilityMapResult.value : null;
    const supplyResponse = supplyResult.status === "fulfilled" ? supplyResult.value : null;
    const siteSupplySettingsResponse =
      siteSupplySettingsResult.status === "fulfilled"
        ? siteSupplySettingsResult.value
        : null;
    const roomResponse = roomResult.status === "fulfilled" ? roomResult.value : null;

    if (
      !deckResponse ||
      !deckCardsResponse ||
      deckResponse.error ||
      deckCardsResponse.error ||
      !deckResponse.data
    ) {
      console.error(deckResponse?.error ?? deckCardsResponse?.error);
      setMessage("Battle開始に必要なデッキ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    if (!deckResponse.data.flag_id || !deckResponse.data.buddy_card_id) {
      setMessage("Battle開始には、デッキ編集画面でフラッグとバディを選択してください。");
      setLoading(false);
      return;
    }

    const flagResult = await loadFlag(deckResponse.data.flag_id);
    if (flagResult.error || !flagResult.data) {
      console.error(flagResult.error);
      setMessage("フラッグ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    try {
      const battleCardIds = [
        ...new Set(
          [
            deckResponse.data.flag_id ? flagResult.data.card_id : null,
            deckResponse.data.buddy_card_id,
            ...(deckCardsResponse.data ?? []).map((deckCard: DeckCardRecord) => deckCard.card_id)
          ].filter(Boolean)
        )
      ] as string[];
      const [cardResponse, imageResponse] = await Promise.all([
        loadCardsByIds(battleCardIds),
        loadCardImagesByCardIds(battleCardIds)
      ]);
      const activeCardIds = new Set(
        (((cardResponse.error ? [] : cardResponse.data) ?? []) as unknown as CardRecord[])
          .filter((card) => card.is_active)
          .map((card) => card.id)
      );
      const activeDeckCards = (deckCardsResponse.data ?? []).filter((deckCard: DeckCardRecord) =>
        activeCardIds.has(deckCard.card_id)
      );
      const resetSource: BattleResetSource = {
        flag: flagResult.data,
        buddyCardId: deckResponse.data.buddy_card_id,
        deckCards: activeDeckCards
      };
      const freshBattleState = createInitialBattleState(resetSource);
      const savedBattleStateResult = await loadBattleState(roomId);
      const baseState = savedBattleStateResult.data ?? freshBattleState;
      const syncedPlayersResult = isRealtimeBattle && selfSeat
        ? await loadSyncedPlayerBattleStates(roomId)
        : { data: {}, error: null };
      const syncedSeats = syncedPlayersResult.data;

      if (isRealtimeBattle && !selfSeat) {
        setRealtimeStatus("idle");
        setSyncMessage(
          "Realtime固定席を特定できません。URLに ?seat=player1 または ?seat=player2 を付けるまで、席別同期保存は行いません。"
        );
      }
      setOpponentPresent(
        Boolean(
          isRealtimeBattle &&
            selfSeat &&
            syncedSeats[getOpponentSeat(selfSeat)]
        )
      );

      const initialState = isRealtimeBattle && selfSeat
        ? mergePlayerStates(baseState, {
            self: syncedSeats[selfSeat]?.state ?? freshBattleState.players.self,
            opponent:
              syncedSeats[getOpponentSeat(selfSeat)]?.state ??
              mapSyncedSeatStatesToPlayers({
                seatStates: syncedSeats,
                selfSeat
              }).opponent ??
              baseState.players.opponent
          })
        : baseState;

      BATTLE_PLAYER_SEATS.forEach((seatKey) => {
        const syncedSeat = syncedSeats[seatKey];
        if (syncedSeat) {
          rememberPlayerVersion(seatKey, syncedSeat.version);
        }
      });

      if (!savedBattleStateResult.data) {
        const createResult = await createBattleState({
          roomId,
          battleState: initialState
        });
        if (createResult.error) {
          setMessage("BattleStateの初期保存に失敗しました。");
        }
      }

      if (isRealtimeBattle && selfSeat && !syncedSeats[selfSeat]) {
        const result = await saveSyncedPlayerBattleState({
          roomId,
          seatKey: selfSeat,
          state: initialState.players.self,
          expectedVersion: playerVersionsRef.current[selfSeat] ?? 0
        });
        if (result.data) {
          rememberPlayerVersion(selfSeat, result.data.version);
        } else if (result.error) {
          setRealtimeStatus("error");
          setSyncMessage("自分の固定席PlayerStateの初期保存に失敗しました。");
        }
      }

      resetSourceRef.current = resetSource;
      setCards((((cardResponse?.error ? [] : cardResponse?.data) ?? []) as unknown as CardRecord[]));
      setImages(imageResponse?.error ? [] : imageResponse?.data ?? []);
      setBattleDeck(deckResponse.data);
      if (supplyResponse?.error) {
        console.warn("Battle supplies are not available yet.", supplyResponse.error);
      } else {
        setBattleSupplies(supplyResponse?.data ?? []);
      }
      if (siteSupplySettingsResponse?.error) {
        console.warn(
          "Site supply settings are not available yet.",
          siteSupplySettingsResponse.error
        );
      } else {
        setSiteSupplySettings(siteSupplySettingsResponse?.data ?? null);
      }
      if (roomResponse?.error) {
        console.warn("Battle room supply metadata is not available yet.", roomResponse.error);
      }
      const selfSupplyDeck = deckResponse.data;
      const opponentDeckId =
        isRealtimeBattle && selfSeat && roomResponse?.data
          ? selfSeat === "player1"
            ? roomResponse.data.guest_deck_id
            : roomResponse.data.host_deck_id
          : null;
      const opponentDeckResult = opponentDeckId
        ? await loadDeck(opponentDeckId)
        : { data: null, error: null };
      if (opponentDeckResult.error) {
        console.warn("Opponent deck supply metadata is not available yet.", opponentDeckResult.error);
      }
      const opponentDeck = opponentDeckResult.data ?? null;
      setPlayerSupplyDecks({
        self: selfSupplyDeck,
        ...(opponentDeck ? { opponent: opponentDeck } : {})
      });
      setCardAbilityMap(abilityMapResponse?.error ? new Map() : abilityMapResponse?.data ?? new Map());
      setShortcutSettings(shortcutResponse?.data ?? mergeWithDefaultShortcuts(null));
      setBattleState(initialState);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "BattleStateの生成に失敗しました。"
      );
    }

    setLoading(false);
  }, [deckId, isRealtimeBattle, roomId, selfSeat]);

  async function handleConfirmRoomDeckSelection() {
    if (!roomId || !selfSeat || !roomDeckSelectionId) return;
    setRoomDeckSelectionBusy(true);
    setRoomDeckSelectionError("");
    const result = await updateBattleRoomDeck({
      roomId,
      seat: selfSeat,
      deckId: roomDeckSelectionId
    });
    setRoomDeckSelectionBusy(false);
    if (result.error || !result.data) {
      setRoomDeckSelectionError(result.error ?? "デッキを設定できませんでした。");
      return;
    }

    window.location.href = buildBattleUrl({
      deckId: roomDeckSelectionId,
      roomId,
      seat: selfSeat,
      mode: "match"
    });
  }

  async function handleCancelRoomDeckSelection() {
    if (!roomId || !selfSeat) return;
    setRoomDeckSelectionBusy(true);
    setRoomDeckSelectionError("");
    const result = await leaveBattleRoomBeforeDeckSelection(roomId, selfSeat);
    setRoomDeckSelectionBusy(false);
    if (result.error) {
      setRoomDeckSelectionError(result.error);
      return;
    }
    window.location.href = "/battle";
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBattle();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBattle]);

  const isBattleLoaded = battleState != null;

  const refreshOpponentSupplyMetadata = useCallback(async () => {
    if (!isRealtimeBattle || !roomId || !selfSeat) return;

    const roomResult = await loadBattleRoom(roomId);
    if (roomResult.error || !roomResult.data) {
      if (roomResult.error) {
        console.warn("Battle room supply metadata refresh failed.", roomResult.error);
      }
      return;
    }

    const opponentDeckId =
      selfSeat === "player1"
        ? roomResult.data.guest_deck_id
        : roomResult.data.host_deck_id;
    if (!opponentDeckId) return;

    const opponentDeckResult = await loadDeck(opponentDeckId);
    if (opponentDeckResult.error || !opponentDeckResult.data) {
      console.warn(
        "Opponent deck supply metadata refresh failed.",
        opponentDeckResult.error
      );
      return;
    }

    const opponentDeck = opponentDeckResult.data;
    setPlayerSupplyDecks((current) => ({
      ...current,
      opponent: opponentDeck
    }));
  }, [isRealtimeBattle, roomId, selfSeat]);

  useEffect(() => {
    if (!isRealtimeBattle || !roomId || !isBattleLoaded || !selfSeat) return;

    const channel = subscribeSyncedPlayerBattleStates({
      roomId,
      onStatusChange: setRealtimeStatus,
      onError: setSyncMessage,
      onPlayerState: (syncedPlayer) => {
        const currentVersion =
          playerVersionsRef.current[syncedPlayer.seatKey] ?? 0;
        if (syncedPlayer.version <= currentVersion) return;

        rememberPlayerVersion(syncedPlayer.seatKey, syncedPlayer.version);
        const playerId = getBattleStatePlayerKeyForSeat({
          seatKey: syncedPlayer.seatKey,
          selfSeat
        });
        if (playerId === "opponent") {
          setOpponentPresent(true);
          void refreshOpponentSupplyMetadata();
        }
        setBattleState((current) =>
          current
            ? mergePlayerStates(current, {
                [playerId]: syncedPlayer.state
              })
            : current
        );
      }
    });

    return () => {
      void unsubscribeSyncedPlayerBattleStates(channel);
    };
  }, [
    isBattleLoaded,
    isRealtimeBattle,
    refreshOpponentSupplyMetadata,
    roomId,
    selfSeat
  ]);

  useEffect(() => {
    if (!isRealtimeBattle || !roomId || !isBattleLoaded || !selfSeat) return;

    void loadPendingBattleAbilityNotifications({
      roomId,
      targetSeatKey: selfSeat
    }).then((result) => {
      if (result.error) {
        setSyncMessage(result.error);
        return;
      }
      setAbilityNotifications(result.data);
      setActiveAbilityNotificationId(
        (current) => current ?? result.data[0]?.id ?? null
      );
    });

    const channel = subscribeBattleAbilityNotifications({
      roomId,
      targetSeatKey: selfSeat,
      onError: setSyncMessage,
      onNotification: (notification) => {
        if (notification.status !== "pending") {
          setAbilityNotifications((current) =>
            current.filter((item) => item.id !== notification.id)
          );
          setActiveAbilityNotificationId((current) =>
            current === notification.id ? null : current
          );
          return;
        }

        setAbilityNotifications((current) => {
          if (current.some((item) => item.id === notification.id)) {
            return current.map((item) =>
              item.id === notification.id ? notification : item
            );
          }
          return [...current, notification];
        });
        setActiveAbilityNotificationId((current) => current ?? notification.id);
      }
    });

    return () => {
      void unsubscribeBattleAbilityNotifications(channel);
    };
  }, [isBattleLoaded, isRealtimeBattle, roomId, selfSeat]);

  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const imagesByCard = useMemo(() => {
    const map = new Map<string, CardImageRecord[]>();
    for (const image of images) {
      map.set(image.card_id, [...(map.get(image.card_id) ?? []), image]);
    }
    return map;
  }, [images]);

  const resolvePlayerSupplyImageUrl = useCallback((
    playerId: BattlePlayerId,
    supplyType: "sleeve" | "playmat"
  ) => {
    const deck = playerSupplyDecks[playerId] ?? (playerId === "self" ? battleDeck : null);
    const supplyId =
      supplyType === "sleeve"
        ? deck?.sleeve_supply_id || siteSupplySettings?.sleeve_supply_id || null
        : deck?.playmat_supply_id || null;
    const supply = battleSupplies.find((item) => item.id === supplyId);
    return getPublicSupplyImageUrl(supply?.image_path);
  }, [battleDeck, battleSupplies, playerSupplyDecks, siteSupplySettings]);

  const playerSleeveImageUrls = useMemo(
    () => ({
      self: resolvePlayerSupplyImageUrl("self", "sleeve"),
      opponent: resolvePlayerSupplyImageUrl("opponent", "sleeve")
    }),
    [resolvePlayerSupplyImageUrl]
  );

  const playerPlaymatImageUrls = useMemo(
    () => ({
      self: resolvePlayerSupplyImageUrl("self", "playmat"),
      opponent: resolvePlayerSupplyImageUrl("opponent", "playmat")
    }),
    [resolvePlayerSupplyImageUrl]
  );

  const activeCard = findBattleCardByInstanceId(
    battleState,
    battleState?.activeViewerCardInstanceId ?? null
  );
  const viewerCards = useMemo(() => {
    if (!battleState) return [];
    const activeInstanceId = battleState.activeViewerCardInstanceId;
    const instanceIds =
      viewerInstanceIds.length > 0
        ? viewerInstanceIds
        : activeInstanceId
          ? [activeInstanceId]
          : [];
    const uniqueInstanceIds = Array.from(new Set(instanceIds)).slice(0, 2);
    return uniqueInstanceIds
      .map((instanceId) => findBattleCardByInstanceId(battleState, instanceId))
      .filter((card): card is BattleCard => card != null);
  }, [battleState, viewerInstanceIds]);
  const activeAbilityNotification =
    activeAbilityNotificationId == null
      ? null
      : abilityNotifications.find(
          (notification) => notification.id === activeAbilityNotificationId
        ) ?? null;
  const pendingAbilityNotificationCount = abilityNotifications.length;
  const hasHiddenAbilityNotification =
    pendingAbilityNotificationCount > 0 && activeAbilityNotification == null;
  const activeAbilityNotificationSourceCard = activeAbilityNotification
    ? findBattleCardByInstanceId(
        battleState,
        activeAbilityNotification.sourceInstanceId
      )
    : null;
  const activeAbilityNotificationTargetCard = activeAbilityNotification
    ? findBattleCardByInstanceId(
        battleState,
        activeAbilityNotification.targetInstanceId
      )
    : null;

  const selectedInstanceIds = useMemo(
    () => new Set(selection.instanceIds),
    [selection.instanceIds]
  );
  const selectedSoulInstanceIds = useMemo(
    () => new Set(soulSelection.instanceIds),
    [soulSelection.instanceIds]
  );
  const lookedDeckCards = useMemo(() => {
    if (!battleState?.deckLook) return [];
    const deckCards = battleState.players[battleState.deckLook.playerId].zones.deck.cards;
    return battleState.deckLook.instanceIds
      .map((instanceId) => deckCards.find((card) => card.instanceId === instanceId))
      .filter((card): card is BattleCard => card != null);
  }, [battleState]);
  const dropBrowserCards = useMemo(() => {
    if (!battleState || !dropBrowserPlayerId) return [];
    return battleState.players[dropBrowserPlayerId].zones.drop.cards;
  }, [battleState, dropBrowserPlayerId]);
  const soulTargetCandidates = useMemo(() => {
    if (!battleState) return [];
    return (["center", "left", "right", "item", "set"] as const).flatMap(
      (zoneId) => battleState.players.self.zones[zoneId].cards
    );
  }, [battleState]);

  function handleClearSelection() {
    setSelection({
      zoneId: null,
      instanceIds: []
    });
    setSoulSelection({
      parentInstanceId: null,
      instanceIds: []
    });
  }

  function handleBattleBackgroundClick() {
    setSoulListPosition(null);
    if (selectionMode) {
      selectionMode.onCancel();
      return;
    }

    handleClearSelection();
  }

  function applyBattleCommand(state: BattleState, command: BattleCommand) {
    const commandState = executeBattleCommand(state, command);
    return getAutomaticAbilityCommands({
      state: commandState,
      cardMap,
      cardAbilityMap
    }).reduce(
      (nextState, abilityCommand) =>
        executeBattleCommand(nextState, abilityCommand),
      commandState
    );
  }

  function incrementBattleVersion(state: BattleState): BattleState {
    return {
      ...state,
      version: (state.version ?? 0) + 1
    };
  }

  function persistBattleState(nextState: BattleState) {
    if (!roomId) return;

    void saveBattleState({
      roomId,
      battleState: nextState
    }).then((result) => {
      if (result.error) {
        setMessage("BattleStateの保存に失敗しました。");
      }
    });
  }

  function persistSelfPlayerState(
    previousState: BattleState,
    nextState: BattleState
  ) {
    if (!isRealtimeBattle) {
      persistBattleState(nextState);
      return;
    }

    if (!roomId || !selfSeat) return;
    if (!hasSelfPlayerStateChanged(previousState, nextState)) return;

    setSavingSeatKeys((current) => Array.from(new Set([...current, selfSeat])));
    setSyncMessage("");

    void saveSyncedPlayerBattleState({
      roomId,
      seatKey: selfSeat,
      state: nextState.players.self,
      expectedVersion: playerVersionsRef.current[selfSeat] ?? 0
    }).then(async (result) => {
      setSavingSeatKeys((current) =>
        current.filter((item) => item !== selfSeat)
      );

      if (result.error || !result.data) {
        setRealtimeStatus("error");
        setSyncMessage(
          `${selfSeat}側の同期保存に失敗しました。再読み込みまたは再操作で再試行できます。`
        );
        const latest = await loadSyncedPlayerBattleStates(roomId);
        const latestSeat = latest.data[selfSeat];
        if (latestSeat) {
          rememberPlayerVersion(selfSeat, latestSeat.version);
          setBattleState((current) =>
            current
              ? mergePlayerStates(current, {
                  self: latestSeat.state
                })
              : current
          );
        }
        return;
      }

      rememberPlayerVersion(selfSeat, result.data.version);
    });
  }

  function isAllowedSelfSideCommand(command: BattleCommand) {
    if (
      "playerId" in command.payload &&
      command.payload.playerId === "opponent"
    ) {
      return false;
    }

    return true;
  }

  function executeCommand(command: BattleCommand) {
    if (!isAllowedSelfSideCommand(command)) {
      setSyncMessage("通常操作では相手側PlayerStateを直接変更できません。");
      return;
    }

    if (command.type === "SHUFFLE_DECK") {
      const confirmed = window.confirm("山札をシャッフルします。よろしいですか？");
      if (!confirmed) return;
    }

    setBattleState((current) => {
      if (!current) return current;

      const nextState = applyBattleCommand(current, command);
      if (nextState === current) return current;

      const versionedState = incrementBattleVersion(nextState);
      persistSelfPlayerState(current, versionedState);
      return versionedState;
    });
  }

  function executeCommands(commands: BattleCommand[]) {
    const effectiveCommands = commands.filter(Boolean);
    if (effectiveCommands.length === 0) return;
    if (!effectiveCommands.every(isAllowedSelfSideCommand)) {
      setSyncMessage("通常操作では相手側PlayerStateを直接変更できません。");
      return;
    }

    if (
      effectiveCommands.some((command) => command.type === "SHUFFLE_DECK") &&
      !window.confirm("山札をシャッフルします。よろしいですか？")
    ) {
      return;
    }

    setBattleState((current) => {
      if (!current) return current;

      const nextState = effectiveCommands.reduce(
        (state, command) => executeBattleCommand(state, command),
        current
      );
      if (nextState === current) return current;

      const versionedState = incrementBattleVersion(nextState);
      persistSelfPlayerState(current, versionedState);
      return versionedState;
    });
  }

  function executeShortcutCommand(command: BattleCommand) {
    executeCommand({
      ...command,
      source: "shortcut"
    });
  }

  function handleResetBattleState() {
    if (!roomId || !resetSourceRef.current) return;
    const confirmed = window.confirm(
      "対戦盤面を初期状態へリセットします。現在の盤面は保存済み状態も含めて上書きされます。よろしいですか？"
    );
    if (!confirmed) return;

    const freshBattleState = createInitialBattleState(resetSourceRef.current);
    const nextState =
      isRealtimeBattle && battleState
        ? {
            ...battleState,
            players: {
              ...battleState.players,
              self: freshBattleState.players.self
            },
            activeViewerCardInstanceId: null,
            deckLook: null,
            version: (battleState.version ?? 0) + 1
          }
        : {
            ...freshBattleState,
            version: (battleState?.version ?? 0) + 1
          };
    setBattleState(nextState);
    if (isRealtimeBattle && battleState) {
      persistSelfPlayerState(battleState, nextState);
    } else {
      persistBattleState(nextState);
    }
    handleClearSelection();
    setDragSelection(null);
    setSoulDragSelection(null);
    setPendingDeckDrop(null);
    setPendingActionPopup(null);
    setSelectionMode(null);
    setPendingDeckCountPopup(null);
    setPendingBiriKinataPopup(null);
    setPendingFaceDownSoulPopup(null);
    setPendingHyakuganPopup(null);
  }

  function handleChangeSelfLife(amount: number) {
    executeCommand({
      type: "CHANGE_LIFE",
      payload: {
        playerId: "self",
        amount
      }
    });
  }

  function handleRollSelfDice() {
    executeCommand({
      type: "ROLL_DICE",
      payload: {
        playerId: "self"
      }
    });
  }

  function handleClearSelfDice() {
    executeCommand({
      type: "CLEAR_DICE",
      payload: {
        playerId: "self"
      }
    });
  }

  function handleDeleteRoomState() {
    if (!roomId) return;
    const confirmed = window.confirm(
      isRealtimeBattle
        ? "部屋から退室します。対戦状態を整理して対戦開始画面へ戻ります。よろしいですか？"
        : "一人回しから退室します。保存済みの盤面状態も削除します。よろしいですか？"
    );
    if (!confirmed) return;

    const deleteTask =
      isRealtimeBattle && selfSeat
        ? (!opponentPresent
            ? Promise.all([
                PREALLOCATED_BATTLE_ROOMS.some((room) => room.roomId === roomId)
                  ? releaseBattleRoom(roomId)
                  : deleteBattleRoom(roomId),
                deleteBattleState(roomId),
                deleteSyncedPlayerBattleStates(roomId)
              ])
            : Promise.all([
                disbandBattleRoom(roomId),
                deleteSyncedPlayerBattleState({ roomId, seatKey: selfSeat })
              ]))
        : Promise.all([
            deleteBattleState(roomId),
            deleteSyncedPlayerBattleStates(roomId)
          ]);

    void deleteTask.then((results) => {
      const error = results.find((result) => result.error)?.error;
      if (error) console.error(error);

      void cleanupExpiredBattleRooms();
      window.location.href = "/battle";
    }).catch((error) => {
      console.error(error);
      window.location.href = "/battle";
    });
  }

  function canStartBattleDeck(deck: DeckRecord | null) {
    return Boolean(deck?.flag_id && deck?.buddy_card_id);
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

  function createSoloRoomId(nextDeckId: string) {
    return `solo-${nextDeckId}`;
  }

  const filteredChangeableDecks = useMemo(() => {
    const searchText = deckChangeSearchText.trim().toLowerCase();
    return changeableDecks.filter((deck) => {
      const matchesSearch =
        !searchText || deck.name.toLowerCase().includes(searchText);
      const matchesEra =
        !deckChangeEraKey || deck.era_key === deckChangeEraKey;
      return matchesSearch && matchesEra;
    });
  }, [changeableDecks, deckChangeEraKey, deckChangeSearchText]);

  const resolvedDeckChangeTargetId = useMemo(() => {
    if (filteredChangeableDecks.length === 0) return "";
    if (filteredChangeableDecks.some((deck) => deck.id === deckChangeTargetId)) {
      return deckChangeTargetId;
    }
    return filteredChangeableDecks[0].id;
  }, [deckChangeTargetId, filteredChangeableDecks]);

  async function handleOpenDeckChangePopup() {
    setDeckChangeError("");
    setChangeableDecks([]);
    setShowDeckChangePopup(true);
    setDeckChangeLoading(true);
    setDeckChangeSearchText("");
    setDeckChangeEraKey("");
    try {
      const deckResult = await loadDecks();
      if (deckResult.error) {
        setDeckChangeError(getErrorMessage(deckResult.error) ?? "デッキ一覧を読み込めませんでした。");
        return;
      }

      const currentUserId = currentUserIdRef.current ?? "";
      const visibleDecks = (deckResult.data ?? []).filter(
        (deck: DeckRecord) =>
          (deck.owner_id === currentUserId ||
            deck.deck_visibility === "public" ||
            deck.deck_visibility === "default") &&
          canStartBattleDeck(deck)
      );

      setChangeableDecks(visibleDecks);
      setDeckChangeTargetId(
        visibleDecks.find((deck: DeckRecord) => deck.id === battleDeck?.id)?.id ??
          visibleDecks[0]?.id ??
          ""
      );
    } catch (error) {
      setDeckChangeError(getErrorMessage(error) ?? "デッキ一覧を読み込めませんでした。");
    } finally {
      setDeckChangeLoading(false);
    }
  }

  function handleChangeDeck() {
    void handleOpenDeckChangePopup();
  }

  async function handleConfirmDeckChange() {
    if (!resolvedDeckChangeTargetId || !roomId) return;
    if (resolvedDeckChangeTargetId === deckId) {
      setShowDeckChangePopup(false);
      return;
    }

    setDeckChangeLoading(true);

    if (!isRealtimeBattle) {
      const cleanupResults = await Promise.all([
        deleteBattleState(roomId),
        deleteSyncedPlayerBattleStates(roomId)
      ]);
      setDeckChangeLoading(false);

      const failedCleanup = cleanupResults.find((result) => result.error);
      if (failedCleanup?.error) {
        setMessage(getErrorMessage(failedCleanup.error) ?? "デッキ変更に失敗しました。");
        return;
      }

      window.location.href = buildBattleUrl({
        deckId: resolvedDeckChangeTargetId,
        roomId: createSoloRoomId(resolvedDeckChangeTargetId),
        seat: "player1",
        mode: "solo"
      });
      return;
    }

    if (!selfSeat) {
      setDeckChangeLoading(false);
      setMessage("デッキ変更には seat 情報が必要です。");
      return;
    }

    const [roomUpdateResult, selfStateDeleteResult] = await Promise.all([
      updateBattleRoomDeck({
        roomId,
        seat: selfSeat,
        deckId: resolvedDeckChangeTargetId
      }),
      deleteSyncedPlayerBattleState({ roomId, seatKey: selfSeat })
    ]);
    setDeckChangeLoading(false);

    if (roomUpdateResult.error || selfStateDeleteResult.error) {
      setMessage(
        getErrorMessage(roomUpdateResult.error) ??
          getErrorMessage(selfStateDeleteResult.error) ??
          "デッキ変更に失敗しました。"
      );
      return;
    }

    window.location.href = buildBattleUrl({
      deckId: resolvedDeckChangeTargetId,
      roomId,
      seat: selfSeat,
      mode: "match"
    });
  }

  function getSingleSelectedSelfCard() {
    if (!battleState || selection.instanceIds.length !== 1 || !selection.zoneId) {
      return null;
    }

    return (
      battleState.players.self.zones[selection.zoneId].cards.find(
        (card) => card.instanceId === selection.instanceIds[0]
      ) ?? null
    );
  }

  function executeShortcutAction(actionId: ShortcutActionId) {
    switch (actionId) {
      case "draw_one":
        executeShortcutCommand({
          type: "DRAW_CARD",
          payload: {
            playerId: "self",
            count: 1
          }
        });
        return;
      case "clear_selection":
        handleClearSelection();
        return;
      case "life_plus":
        executeShortcutCommand({
          type: "CHANGE_LIFE",
          payload: {
            playerId: "self",
            amount: 1
          }
        });
        return;
      case "life_minus":
        executeShortcutCommand({
          type: "CHANGE_LIFE",
          payload: {
            playerId: "self",
            amount: -1
          }
        });
        return;
      case "hand_to_gauge":
      case "hand_to_resolution": {
        const selectedCard = getSingleSelectedSelfCard();
        if (!selectedCard || selectedCard.zoneId !== "hand") return;
        executeShortcutCommand({
          type: "MOVE_CARD",
          payload: {
            instanceId: selectedCard.instanceId,
            fromZone: "hand",
            toZone: actionId === "hand_to_gauge" ? "gauge" : "resolution"
          }
        });
        handleClearSelection();
        return;
      }
      case "gauge_to_drop": {
        const selectedCard = getSingleSelectedSelfCard();
        if (!selectedCard || selectedCard.zoneId !== "gauge") return;
        executeShortcutCommand({
          type: "MOVE_CARD",
          payload: {
            instanceId: selectedCard.instanceId,
            fromZone: "gauge",
            toZone: "drop"
          }
        });
        handleClearSelection();
        return;
      }
      case "selected_to_drop":
        if (soulSelection.parentInstanceId && soulSelection.instanceIds.length > 0) {
          executeShortcutCommand(
            soulSelection.instanceIds.length > 1
              ? {
                  type: "MOVE_SOUL_CARDS",
                  payload: {
                    parentInstanceId: soulSelection.parentInstanceId,
                    soulInstanceIds: soulSelection.instanceIds,
                    toZone: "drop"
                  }
                }
              : {
                  type: "MOVE_SOUL_CARD",
                  payload: {
                    parentInstanceId: soulSelection.parentInstanceId,
                    soulInstanceId: soulSelection.instanceIds[0],
                    toZone: "drop"
                  }
                }
          );
          handleClearSelection();
          return;
        }

        if (!selection.zoneId || selection.instanceIds.length === 0) return;
        if (!["hand", "gauge", "center", "left", "right", "item", "set", "resolution"].includes(selection.zoneId)) {
          return;
        }
        executeShortcutCommand(
          selection.instanceIds.length > 1
            ? {
                type: "MOVE_CARDS",
                payload: {
                  instanceIds: selection.instanceIds,
                  toZone: "drop"
                }
              }
            : {
                type: "MOVE_CARD",
                payload: {
                  instanceId: selection.instanceIds[0],
                  fromZone: selection.zoneId,
                  toZone: "drop"
                }
              }
        );
        handleClearSelection();
        return;
      case "toggle_rest": {
        const selectedCard = getSingleSelectedSelfCard();
        if (
          !selectedCard ||
          !["center", "left", "right", "item"].includes(selectedCard.zoneId)
        ) {
          return;
        }
        executeShortcutCommand({
          type: "TOGGLE_CARD_ORIENTATION",
          payload: {
            instanceId: selectedCard.instanceId
          }
        });
        return;
      }
      default:
        return;
    }
  }

  const executeShortcutActionRef = useRef(executeShortcutAction);
  executeShortcutActionRef.current = executeShortcutAction;

  useEffect(() => {
    function handleShortcutKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcutTarget(event.target)) return;

      if (
        isBattleShortcutBlocked({
          isBattleActionPopupOpen: pendingActionPopup != null,
          isSelectionModeOpen: selectionMode != null,
          isDeckCountPopupOpen: pendingDeckCountPopup != null,
          isDeckBrowserPopupOpen: lookedDeckCards.length > 0 || dropBrowserPlayerId != null,
          isDeckDropDialogOpen: pendingDeckDrop != null,
          isBiriKinataPopupOpen: pendingBiriKinataPopup != null,
          isFaceDownSoulPopupOpen: pendingFaceDownSoulPopup != null,
          isHyakuganPopupOpen: pendingHyakuganPopup != null,
          isAbilityNotificationOpen: activeAbilityNotification != null
        })
      ) {
        return;
      }

      const action = findActionByBinding(
        shortcutSettings,
        bindingFromKeyboardEvent(event)
      );
      if (!action || action.inputKind === "double_click") return;

      event.preventDefault();
      executeShortcutActionRef.current(action.id);
    }

    window.addEventListener("keydown", handleShortcutKeyDown);
    return () => window.removeEventListener("keydown", handleShortcutKeyDown);
  }, [
    lookedDeckCards.length,
    dropBrowserPlayerId,
    pendingActionPopup,
    pendingBiriKinataPopup,
    pendingDeckCountPopup,
    pendingDeckDrop,
    pendingFaceDownSoulPopup,
    pendingHyakuganPopup,
    activeAbilityNotification,
    selectionMode,
    shortcutSettings
  ]);

  function setViewer(instanceId: string | null, input?: { force?: boolean }) {
    if (viewerPinned && !input?.force) return;
    setViewerInstanceIds((currentInstanceIds) => {
      if (!instanceId) {
        nextViewerSlotRef.current = 0;
        return [];
      }

      if (currentInstanceIds.includes(instanceId)) {
        return currentInstanceIds;
      }

      const nextSlot = nextViewerSlotRef.current;
      if (currentInstanceIds.length === 0) {
        nextViewerSlotRef.current = 1;
        return [instanceId];
      }

      if (currentInstanceIds.length === 1) {
        nextViewerSlotRef.current = nextSlot === 0 ? 1 : 0;
        return nextSlot === 0
          ? [instanceId, currentInstanceIds[0]]
          : [currentInstanceIds[0], instanceId];
      }

      nextViewerSlotRef.current = nextSlot === 0 ? 1 : 0;
      return nextSlot === 0
        ? [instanceId, currentInstanceIds[1]]
        : [currentInstanceIds[0], instanceId];
    });
    executeCommand({
      type: "SET_VIEWER_CARD",
      payload: {
        instanceId
      }
    });
  }

  function canDisplayInViewer(
    card: BattleCard,
    playerId: BattlePlayerId
  ) {
    if (card.zoneId === "gauge") return false;
    if (card.visibility === "public") return true;
    if (playerId === "self" && card.zoneId === "hand") return true;
    return false;
  }

  function handleSelectCard(
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent"; anchor?: { right: number; bottom: number } }
  ) {
    const shiftKey = input?.shiftKey ?? false;
    const playerId = input?.playerId ?? "self";

    if (input?.anchor && card.soul.length > 0 && canDisplayInViewer(card, playerId)) {
      setSoulListPosition({
        left: Math.max(8, Math.min(input.anchor.right + 8, window.innerWidth - 248)),
        top: Math.max(8, Math.min(input.anchor.bottom + 8, window.innerHeight - 204))
      });
    } else if (input?.anchor) {
      setSoulListPosition(null);
    }

    if (canDisplayInViewer(card, playerId)) {
      setViewer(card.instanceId);
    }
    setSoulSelection({
      parentInstanceId: null,
      instanceIds: []
    });

    if (!canUseBattleMultiSelection(card, playerId)) {
      handleClearSelection();
      return;
    }

    const selectionUnitInstanceIds = getBattleSelectionUnitInstanceIds(
      battleState,
      card
    );

    setSelection((current) => {
      if (!shiftKey) {
        return {
          zoneId: card.zoneId,
          instanceIds: selectionUnitInstanceIds
        };
      }

      if (current.zoneId !== card.zoneId) {
        return {
          zoneId: card.zoneId,
          instanceIds: selectionUnitInstanceIds
        };
      }

      const isSelectionUnitSelected = selectionUnitInstanceIds.every(
        (instanceId) => current.instanceIds.includes(instanceId)
      );

      if (isSelectionUnitSelected) {
        const nextInstanceIds = current.instanceIds.filter(
          (instanceId) => !selectionUnitInstanceIds.includes(instanceId)
        );

        return {
          zoneId: nextInstanceIds.length > 0 ? current.zoneId : null,
          instanceIds: nextInstanceIds
        };
      }

      return {
        zoneId: card.zoneId,
        instanceIds: [
          ...current.instanceIds,
          ...selectionUnitInstanceIds.filter(
            (instanceId) => !current.instanceIds.includes(instanceId)
          )
        ]
      };
    });
  }

  function handleDoubleClickCard(
    card: BattleCard,
    input?: { playerId?: "self" | "opponent" }
  ) {
    const playerId = input?.playerId ?? "self";
    if (playerId !== "self") return;
    if (!["center", "left", "right", "item", "buddy"].includes(card.zoneId)) return;

    executeShortcutCommand({
      type: "TOGGLE_CARD_ORIENTATION",
      payload: {
        instanceId: card.instanceId
      }
    });
  }

  function handleDoubleClickZone(
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLElement>,
    playerId: BattlePlayerId
  ) {
    if (zoneId !== "drop" || playerId !== "self") return;
    event.stopPropagation();
    setDropBrowserPlayerId(playerId);
  }

  function handleDragStartCard(
    card: BattleCard,
    playerId: "self" | "opponent" = "self"
  ) {
    if (playerId !== "self") return;

    const isSelectedDrag =
      selection.zoneId === card.zoneId && selection.instanceIds.includes(card.instanceId);

    setDragSelection({
      sourceCard: card,
      instanceIds: isSelectedDrag ? selection.instanceIds : [card.instanceId]
    });
  }

  function handlePopupDragStartCard(card: BattleCard) {
    setDragSelection({ sourceCard: card, instanceIds: [card.instanceId] });
  }

  function handleDragEndCard() {
    setDragSelection(null);
  }

  function handleSelectSoulCard(
    parentCard: BattleCard,
    soulCard: BattleCard,
    input?: { shiftKey?: boolean }
  ) {
    const shiftKey = input?.shiftKey ?? false;

    if (soulCard.visibility !== "face_down") {
      setViewer(soulCard.instanceId);
    }

    setSoulSelection((current) => {
      if (!shiftKey || current.parentInstanceId !== parentCard.instanceId) {
        return {
          parentInstanceId: parentCard.instanceId,
          instanceIds: [soulCard.instanceId]
        };
      }

      if (current.instanceIds.includes(soulCard.instanceId)) {
        const nextInstanceIds = current.instanceIds.filter(
          (instanceId) => instanceId !== soulCard.instanceId
        );

        return {
          parentInstanceId:
            nextInstanceIds.length > 0 ? parentCard.instanceId : null,
          instanceIds: nextInstanceIds
        };
      }

      return {
        parentInstanceId: parentCard.instanceId,
        instanceIds: [...current.instanceIds, soulCard.instanceId]
      };
    });
  }

  function handleDoubleClickFaceDownSoul(
    parentCard: BattleCard,
    soulCard: BattleCard
  ) {
    if (!battleState || soulCard.visibility !== "face_down") return;
    const isOwnParentCard = Object.values(battleState.players.self.zones).some(
      (zone) => zone.cards.some((card) => card.instanceId === parentCard.instanceId)
    );
    if (!isOwnParentCard) return;

    setPendingSoulVisibilityPopup({
      parentInstanceId: parentCard.instanceId,
      soulInstanceId: soulCard.instanceId,
      cardName: cardMap.get(soulCard.cardId)?.name ?? "カード名不明",
      mode: "choose"
    });
  }

  function handleRevealSoulCard() {
    if (!pendingSoulVisibilityPopup) return;
    executeCommand({
      type: "REVEAL_SOUL_CARD",
      payload: {
        parentInstanceId: pendingSoulVisibilityPopup.parentInstanceId,
        soulInstanceId: pendingSoulVisibilityPopup.soulInstanceId
      },
      source: "popup"
    });
    setPendingSoulVisibilityPopup(null);
  }

  function handleDragStartSoulCard(parentCard: BattleCard, soulCard: BattleCard) {
    const isSelectedSoulDrag =
      soulSelection.parentInstanceId === parentCard.instanceId &&
      soulSelection.instanceIds.includes(soulCard.instanceId);

    setSoulDragSelection({
      parentCard,
      sourceSoulCard: soulCard,
      instanceIds: isSelectedSoulDrag
        ? soulSelection.instanceIds
        : [soulCard.instanceId]
    });
  }

  function handleDragEndSoulCard() {
    setSoulDragSelection(null);
  }

  function handleContextMenuSoulCard(
    _parentCard: BattleCard,
    _soulCard: BattleCard,
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleContextMenuCard(
    _card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    _playerId: "self" | "opponent" = "self"
  ) {
    event.preventDefault();
    event.stopPropagation();
  }

  function handleDropCard(toZone: BattleZoneId, input: BattleDropInput = {}) {
    if (soulDragSelection) {
      if (soulDragSelection.instanceIds.length > 1 && isAreaStackZone(toZone)) {
        setSoulDragSelection(null);
        return;
      }

      if (toZone === "deck") {
        setPendingDeckDrop({
          kind: "soul",
          sourceCard: soulDragSelection.sourceSoulCard,
          instanceIds: soulDragSelection.instanceIds,
          parentInstanceId: soulDragSelection.parentCard.instanceId
        });
        return;
      }

      applySoulDrop(toZone, undefined, soulDragSelection, input);
      return;
    }

    if (!dragSelection) return;

    if (dragSelection.instanceIds.length > 1 && isAreaStackZone(toZone)) {
      setDragSelection(null);
      return;
    }

    if (
      battleState &&
      dragSelection.instanceIds.length === 1 &&
      isAreaStackZone(toZone) &&
      input.clientX != null &&
      input.clientY != null
    ) {
      const existingAreaStacks = getAreaStacks(
        battleState.players.self.zones[toZone].cards
      );
      const targetInstanceId =
        input.targetInstanceId ?? existingAreaStacks[0]?.topCard.instanceId;
      if (!targetInstanceId) {
        applyCardDrop(toZone, undefined, dragSelection, input);
        return;
      }

      setPendingActionPopup({
        source: {
          kind: "card",
          instanceId: dragSelection.sourceCard.instanceId,
          fromZone: dragSelection.sourceCard.zoneId
        },
        sourceCard: dragSelection.sourceCard,
        toZone,
        targetInstanceId,
        x: input.clientX,
        y: input.clientY
      });
      setDragSelection(null);
      return;
    }

    if (toZone === "deck") {
      setPendingDeckDrop({
        kind: "card",
        sourceCard: dragSelection.sourceCard,
        instanceIds: dragSelection.instanceIds
      });
      return;
    }

    applyCardDrop(toZone, undefined, dragSelection, input);
  }

  function applyCardDrop(
    toZone: BattleZoneId,
    deckPosition?: DeckPosition,
    targetSelection: DragSelection | PendingDeckDrop | null = dragSelection,
    input: BattleDropInput = {}
  ) {
    if (!targetSelection) return;

    const { sourceCard, instanceIds } = targetSelection;

    const command: BattleCommand =
      instanceIds.length > 1
        ? {
            type: "MOVE_CARDS",
            payload: {
              instanceIds,
              toZone,
              deckPosition
            },
            source: "drag_drop"
          }
        : isAreaStackZone(toZone)
          ? input.placeAsNewStack
            ? {
                type: "PLACE_AREA_SLOT",
                payload: {
                  instanceId: sourceCard.instanceId,
                  fromZone: sourceCard.zoneId,
                  toZone
                },
                source: "drag_drop"
              }
            : {
                type: "PLACE_OR_STACK_AREA_CARD",
                payload: {
                  instanceId: sourceCard.instanceId,
                  fromZone: sourceCard.zoneId,
                  toZone,
                  targetInstanceId: input.targetInstanceId
                },
                source: "drag_drop"
              }
          : {
              type: "MOVE_CARD",
              payload: {
                instanceId: sourceCard.instanceId,
                fromZone: sourceCard.zoneId,
                toZone,
                deckPosition
              },
              source: "drag_drop"
            };

    executeCommand(command);
    setSelection(
      instanceIds.length === 1 && isAreaStackZone(toZone)
        ? {
            zoneId: toZone,
            instanceIds: [sourceCard.instanceId]
          }
        : {
            zoneId: null,
            instanceIds: []
          }
    );
    setDragSelection(null);
    setPendingDeckDrop(null);
  }

  function applySoulDrop(
    toZone: BattleZoneId,
    deckPosition?: DeckPosition,
    targetSelection: SoulDragSelection | PendingDeckDrop | null = soulDragSelection,
    input: BattleDropInput = {}
  ) {
    if (!targetSelection) return;

    const parentInstanceId =
      "parentCard" in targetSelection
        ? targetSelection.parentCard.instanceId
        : targetSelection.parentInstanceId;
    if (!parentInstanceId) return;

    const instanceIds = targetSelection.instanceIds;

    executeCommand(
      instanceIds.length > 1
        ? {
            type: "MOVE_SOUL_CARDS",
            payload: {
              parentInstanceId,
              soulInstanceIds: instanceIds,
              toZone,
              deckPosition
            },
            source: "drag_drop"
          }
        : {
            type: "MOVE_SOUL_CARD",
            payload: {
              parentInstanceId,
              soulInstanceId: instanceIds[0],
              toZone,
              deckPosition,
              targetInstanceId: input.targetInstanceId,
              placeAsNewStack: input.placeAsNewStack
            },
            source: "drag_drop"
          }
    );
    setSoulSelection({
      parentInstanceId: null,
      instanceIds: []
    });
    setSoulDragSelection(null);
    setPendingDeckDrop(null);
  }

  function handleDeckDropChoice(deckPosition: DeckPosition | null) {
    if (deckPosition == null) {
      setDragSelection(null);
      setSoulDragSelection(null);
      setPendingDeckDrop(null);
      return;
    }

    if (pendingDeckDrop?.kind === "soul") {
      applySoulDrop("deck", deckPosition, pendingDeckDrop);
      return;
    }

    applyCardDrop("deck", deckPosition, pendingDeckDrop);
  }

  useEscapeToClose({
    enabled: pendingDeckDrop != null,
    onClose: () => handleDeckDropChoice(null)
  });

  useEscapeToClose({
    enabled: selectionMode != null,
    onClose: () => selectionMode?.onCancel()
  });

  function handleBattleActionPopupCancel() {
    setPendingActionPopup(null);
  }

  function getFaceDownSoulCandidates(sourceInstanceId: string) {
    if (!battleState) return [];
    return [
      ...battleState.players.self.zones.hand.cards,
      ...battleState.players.self.zones.drop.cards,
      ...battleState.players.self.zones.deck.cards.slice(0, 1),
      ...(["center", "left", "right", "item", "set"] as const).flatMap(
        (zoneId) => battleState.players.self.zones[zoneId].cards
      )
    ].filter((card) => card.instanceId !== sourceInstanceId);
  }

  function getHyakuganPairCandidates(sourceCard: BattleCard) {
    if (!battleState) return [];
    const sourceIsTen = hasBattleAbility(
      cardAbilityMap,
      sourceCard,
      "ten_no_hanshin_composite"
    );
    const requiredAbility: AbilityId = sourceIsTen
      ? "chi_no_hanshin_composite"
      : "ten_no_hanshin_composite";
    const zoneCards =
      battleState.players.self.zones[sourceCard.zoneId]?.cards ?? [];

    return zoneCards.filter(
      (card) =>
        card.instanceId !== sourceCard.instanceId &&
        hasBattleAbility(cardAbilityMap, card, requiredAbility)
    );
  }

  function handleStartHyakuganPlacement(pairInstanceId: string) {
    if (!pendingHyakuganPopup) return;
    setPendingHyakuganPopup({
      ...pendingHyakuganPopup,
      selectedPairInstanceId: pairInstanceId
    });
    setSelectionMode({
      type: "zone",
      title: "ヒャクガンヤミゲドウの配置先を選択してください",
      description: "Center / Left / Right から選択します。",
      allowedZones: HYAKUGAN_PLACEMENT_TARGET_ZONES,
      playerId: "self",
      onSelect: (zoneId) => {
        const sourceCard = findBattleCardByInstanceId(
          battleState,
          pendingHyakuganPopup.sourceInstanceId
        );
        if (!sourceCard) return;
        const sourceRole = hasBattleAbility(
          cardAbilityMap,
          sourceCard,
          "ten_no_hanshin_composite"
        )
          ? "heaven"
          : "earth";
        executeCommand({
          type: "PLACE_HYAKUGAN_COMPOSITE",
          payload: {
            sourceInstanceId: pendingHyakuganPopup.sourceInstanceId,
            pairInstanceId,
            sourceRole,
            pairRole: sourceRole === "heaven" ? "earth" : "heaven",
            toZone: zoneId as "center" | "left" | "right"
          },
          source: "ability"
        });
        setPendingHyakuganPopup(null);
        setSelectionMode(null);
      },
      onCancel: () => {
        setPendingHyakuganPopup(null);
        setSelectionMode(null);
      }
    });
  }

  function handleFaceDownSoulTargetSelect(targetInstanceId: string) {
    if (!pendingFaceDownSoulPopup) return;

    executeCommand({
      type: "ADD_SOUL_FACE_DOWN",
      payload: {
        instanceId: targetInstanceId,
        targetInstanceId: pendingFaceDownSoulPopup.sourceInstanceId
      },
      source: "ability"
    });
    setPendingFaceDownSoulPopup(null);
  }

  function handleBiriKinataTargetSelect(targetInstanceId: string) {
    if (!pendingBiriKinataPopup) return;
    if (!roomId || !selfSeat) {
      setMessage("ビリ・キナータの通知Abilityには roomId と seat が必要です。");
      setPendingBiriKinataPopup(null);
      return;
    }

    void createBattleAbilityNotification({
      roomId,
      abilityKey: "biri_kinata_face_down_use",
      sourceSeatKey: selfSeat,
      targetSeatKey: getOpponentSeat(selfSeat),
      sourceInstanceId: pendingBiriKinataPopup.sourceInstanceId,
      targetInstanceId,
      payload: {
        targetZone: "center",
        visibility: "face_down"
      }
    }).then((result) => {
      if (result.error) {
        setMessage(`Ability通知の作成に失敗しました: ${result.error}`);
      }
    });
    setPendingBiriKinataPopup(null);
  }

  function removeAbilityNotification(notificationId: string) {
    setAbilityNotifications((current) =>
      current.filter((notification) => notification.id !== notificationId)
    );
    setActiveAbilityNotificationId((current) =>
      current === notificationId ? null : current
    );
  }

  function handleConfirmAbilityNotification() {
    if (!activeAbilityNotification) return;

    const notification = activeAbilityNotification;
    let didChange = false;

    setBattleState((current) => {
      if (!current) return current;

      const nextState = applyBattleCommand(current, {
        type: "RESOLVE_BIRI_KINATA_NOTIFICATION",
        payload: {
          sourceInstanceId: notification.sourceInstanceId,
          targetInstanceId: notification.targetInstanceId
        },
        source: "ability"
      });
      if (nextState === current) return current;

      didChange = true;
      const versionedState = incrementBattleVersion(nextState);
      persistSelfPlayerState(current, versionedState);
      return versionedState;
    });

    window.setTimeout(() => {
      if (!didChange) {
        setMessage("Ability通知の解決条件を満たしていないため、盤面は変更されませんでした。");
        return;
      }

      void updateBattleAbilityNotificationStatus({
        id: notification.id,
        status: "resolved"
      }).then((result) => {
        if (result.error) {
          setMessage(`Ability通知の完了更新に失敗しました: ${result.error}`);
          return;
        }
        removeAbilityNotification(notification.id);
      });
    }, 0);
  }

  function handleDeckCountSubmit(count: number) {
    if (!pendingDeckCountPopup) return;

    executeCommand(
      pendingDeckCountPopup.mode === "look"
        ? {
            type: "LOOK_TOP_DECK",
            payload: {
              playerId: "self",
              count
            }
          }
        : {
            type: "REVEAL_DECK_CARD",
            payload: {
              playerId: "self",
              count
            }
          }
    );
    setPendingDeckCountPopup(null);
  }

  function handleCancelDeckLook() {
    executeCommand({
      type: "CLEAR_DECK_LOOK",
      payload: {
        playerId: "self"
      },
      source: "popup"
    });
  }

  function handleDeckBrowserExecute(requests: DeckBrowserRequest[]) {
    const commands = createCommandsFromDeckBrowserRequests({
      requests,
      playerId: "self",
      clearDeckLook: true,
      source: "popup"
    });
    executeCommands(commands);
  }

  function handleBattleActionPopupSelect(action: BattleActionPopupAction) {
    if (!pendingActionPopup) return;

    const { source, sourceCard, targetInstanceId, toZone } = pendingActionPopup;
    let command: BattleCommand | null = null;

    if (source.kind === "soul") {
      switch (action) {
        case "stack":
          command = {
            type: "MOVE_SOUL_CARD",
            payload: {
              parentInstanceId: source.parentInstanceId,
              soulInstanceId: source.soulInstanceId,
              toZone,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        case "place":
          command = {
            type: "MOVE_SOUL_CARD",
            payload: {
              parentInstanceId: source.parentInstanceId,
              soulInstanceId: source.soulInstanceId,
              toZone,
              placeAsNewStack: true
            },
            source: "popup"
          };
          break;
        case "soulFaceUp":
          command = {
            type: "MOVE_SOUL_TO_SOUL_FACE_UP",
            payload: {
              parentInstanceId: source.parentInstanceId,
              soulInstanceId: source.soulInstanceId,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        case "soulFaceDown":
          command = {
            type: "MOVE_SOUL_TO_SOUL_FACE_DOWN",
            payload: {
              parentInstanceId: source.parentInstanceId,
              soulInstanceId: source.soulInstanceId,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        default:
          command = null;
      }
    } else {
      switch (action) {
        case "stack":
          command = {
            type: "STACK_CARD",
            payload: {
              instanceId: sourceCard.instanceId,
              fromZone: source.fromZone,
              toZone,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        case "place":
          command = {
            type: "PLACE_AREA_SLOT",
            payload: {
              instanceId: sourceCard.instanceId,
              fromZone: source.fromZone,
              toZone
            },
            source: "popup"
          };
          break;
        case "soulFaceUp":
          command = {
            type: "ADD_SOUL_FACE_UP",
            payload: {
              instanceId: sourceCard.instanceId,
              fromZone: source.fromZone,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        case "soulFaceDown":
          command = {
            type: "ADD_SOUL_FACE_DOWN",
            payload: {
              instanceId: sourceCard.instanceId,
              fromZone: source.fromZone,
              targetInstanceId
            },
            source: "popup"
          };
          break;
        default:
          command = null;
      }
    }

    if (command) executeCommand(command);

    setSelection(
      action === "stack" || action === "place"
        ? {
            zoneId: toZone,
            instanceIds: [sourceCard.instanceId]
          }
        : {
            zoneId: null,
            instanceIds: []
          }
    );
    setPendingActionPopup(null);
  }

  if (loading) {
    return <main className="bf-battle-loading">Battleを準備しています。</main>;
  }

  if (showRoomDeckSelection) {
    return (
      <main className="bf-battle-loading">
        <section className="bf-room-deck-selection">
          <p className="dm-kicker">{roomDeckSelectionName}</p>
          <h1>使用するデッキを選択</h1>
          <p>ルームへの入室が完了しました。対戦で使うデッキを選んでください。</p>
          {roomDeckOptions.length > 0 ? (
            <select
              className="dm-input"
              value={roomDeckSelectionId}
              onChange={(event) => setRoomDeckSelectionId(event.target.value)}
              disabled={roomDeckSelectionBusy}
            >
              {roomDeckOptions.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name}
                </option>
              ))}
            </select>
          ) : (
            <p role="alert">対戦に使えるデッキがありません。フラッグとバディを設定したデッキを作成してください。</p>
          )}
          {roomDeckSelectionError && <p role="alert">{roomDeckSelectionError}</p>}
          <div className="bf-room-deck-selection-actions">
            <button
              type="button"
              className="dm-button primary"
              disabled={roomDeckSelectionBusy || !roomDeckSelectionId}
              onClick={() => void handleConfirmRoomDeckSelection()}
            >
              {roomDeckSelectionBusy ? "設定中…" : "このデッキで対戦へ"}
            </button>
            <button
              type="button"
              className="dm-button secondary"
              disabled={roomDeckSelectionBusy}
              onClick={() => void handleCancelRoomDeckSelection()}
            >
              ルームを退出
            </button>
          </div>
        </section>
      </main>
    );
  }

  if (!battleState) {
    return (
      <main className="bf-battle-loading">
        <p>{message}</p>
        <Link href="/battle" className="dm-button primary">
          対戦開始画面へ戻る
        </Link>
      </main>
    );
  }

  return (
    <main className="bf-battle-app" onClick={handleBattleBackgroundClick}>
      {(selection.instanceIds.length > 1 || soulSelection.instanceIds.length > 1) && (
        <div className="bf-selection-count-badge" aria-live="polite">
          選択中 {selection.instanceIds.length + soulSelection.instanceIds.length}枚
        </div>
      )}
      {selectionMode?.type === "zone" && (
        <div className="bf-placement-mode-banner" role="status">
          {selectionMode.title}
          {selectionMode.description && <span>{selectionMode.description}</span>}
        </div>
      )}
      <aside className="bf-left-menu" aria-label="対戦操作">
        <div className="bf-left-menu-brand" aria-label="Baddie Phyto">
          <span>Baddie</span>
          <b>Phyto</b>
        </div>

        <div className="bf-battle-danger-actions">
          <span>Version {battleState.version ?? 0}</span>
          <span>
            Realtime {realtimeStatus}
            {savingSeatKeys.length > 0
              ? ` / 保存中 ${savingSeatKeys.join(", ")}`
              : ""}
          </span>
          {isRealtimeBattle && (
            <span>{opponentPresent ? "対戦相手あり" : "対戦相手待ち"}</span>
          )}
          {syncMessage && <span>{syncMessage}</span>}
          <button type="button" onClick={handleResetBattleState}>
            盤面リセット
          </button>
          <button type="button" onClick={handleChangeDeck}>
            デッキ変更
          </button>
          <button type="button" onClick={handleDeleteRoomState}>
            退室
          </button>
        </div>
      </aside>

      <BattleBoard
        battleState={battleState}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        sleeveImageUrls={playerSleeveImageUrls}
        playmatImageUrls={playerPlaymatImageUrls}
        draggedCard={dragSelection?.sourceCard ?? null}
        draggedInstanceCount={dragSelection?.instanceIds.length ?? 0}
        draggedSoulCard={soulDragSelection?.sourceSoulCard ?? null}
        draggedSoulInstanceCount={soulDragSelection?.instanceIds.length ?? 0}
        selectedInstanceIds={selectedInstanceIds}
        onSelectCard={handleSelectCard}
        onDoubleClickCard={handleDoubleClickCard}
        onContextMenuCard={handleContextMenuCard}
        onDragStartCard={handleDragStartCard}
        onDragEndCard={handleDragEndCard}
        onDropCard={handleDropCard}
        onDoubleClickZone={handleDoubleClickZone}
        onChangeLife={handleChangeSelfLife}
        onRollDice={handleRollSelfDice}
        onClearDice={handleClearSelfDice}
        placementTargetZones={
          selectionMode?.type === "zone"
            ? new Set(selectionMode.allowedZones)
            : undefined
        }
        placementTargetPlayerId={
          selectionMode?.type === "zone" ? selectionMode.playerId : undefined
        }
        onPlacementZoneClick={(zoneId, event, playerId) => {
          if (selectionMode?.type !== "zone" || selectionMode.playerId !== playerId) {
            return;
          }

          selectionMode.onSelect(zoneId, {
            x: event.clientX,
            y: event.clientY,
            event
          });
        }}
      />

      <BattleSidebar
        battleState={battleState}
        activeCard={activeCard}
        soulListPosition={soulListPosition}
        viewerCards={viewerCards}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        sleeveImageUrls={playerSleeveImageUrls}
        draggedCard={dragSelection?.sourceCard ?? null}
        draggedInstanceCount={dragSelection?.instanceIds.length ?? 0}
        draggedSoulCard={soulDragSelection?.sourceSoulCard ?? null}
        draggedSoulInstanceCount={soulDragSelection?.instanceIds.length ?? 0}
        selectedInstanceIds={selectedInstanceIds}
        selectedSoulInstanceIds={selectedSoulInstanceIds}
        viewerPinned={viewerPinned}
        onCloseViewer={() => setViewer(null, { force: true })}
        onSelectCard={handleSelectCard}
        onToggleViewerPin={() => setViewerPinned((current) => !current)}
        onContextMenuCard={handleContextMenuCard}
        onSelectSoulCard={handleSelectSoulCard}
        onDragStartCard={handleDragStartCard}
        onDragEndCard={handleDragEndCard}
        onDragStartSoulCard={handleDragStartSoulCard}
        onDragEndSoulCard={handleDragEndSoulCard}
        onContextMenuSoulCard={handleContextMenuSoulCard}
        onDoubleClickFaceDownSoul={handleDoubleClickFaceDownSoul}
        onDropCard={handleDropCard}
      />

      {hasHiddenAbilityNotification && (
        <button
          type="button"
          className="bf-ability-notification-reopen"
          onClick={() => setShowAbilityNotificationList(true)}
          aria-label={`未確認Ability通知 ${pendingAbilityNotificationCount}件を表示`}
        >
          <span>Ability通知</span>
          <strong>{pendingAbilityNotificationCount}</strong>
        </button>
      )}

      {showAbilityNotificationList && (
        <AbilityNotificationListPanel
          notifications={abilityNotifications}
          battleState={battleState}
          cardMap={cardMap}
          onSelect={(notificationId) => {
            setActiveAbilityNotificationId(notificationId);
            setShowAbilityNotificationList(false);
          }}
          onClose={() => setShowAbilityNotificationList(false)}
        />
      )}

      {showDeckChangePopup && (
        <BattlePopup
          title="デッキ変更"
          description="対戦中のデッキを検索して切り替えます。"
          size="large"
          onClose={() => setShowDeckChangePopup(false)}
          footer={
            <>
              <button
                type="button"
                onClick={() => setShowDeckChangePopup(false)}
                disabled={deckChangeLoading}
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDeckChange()}
                disabled={deckChangeLoading || !resolvedDeckChangeTargetId}
              >
                {deckChangeLoading ? "変更中..." : "このデッキに変更"}
              </button>
            </>
          }
        >
          {deckChangeLoading ? (
            <p role="status">デッキ一覧を読み込んでいます…</p>
          ) : deckChangeError ? (
            <p role="alert">{deckChangeError}</p>
          ) : changeableDecks.length === 0 ? (
            <p>対戦開始に使えるデッキがありません。</p>
          ) : (
            <div className="bf-deck-change-popup">
              <div className="bf-deck-change-search-row">
                <label className="dm-form-label" htmlFor="battle-deck-change-search">
                  デッキ名
                  <input
                    id="battle-deck-change-search"
                    className="dm-input"
                    type="search"
                    value={deckChangeSearchText}
                    placeholder="デッキ名を入力"
                    onChange={(event) => setDeckChangeSearchText(event.target.value)}
                    disabled={deckChangeLoading}
                  />
                </label>
                <label className="dm-form-label" htmlFor="battle-deck-change-era">
                  年代
                  <select
                    id="battle-deck-change-era"
                    className="dm-input"
                    value={deckChangeEraKey}
                    onChange={(event) =>
                      setDeckChangeEraKey(event.target.value as DeckEraKey | "")
                    }
                    disabled={deckChangeLoading}
                  >
                    <option value="">すべて</option>
                    {DECK_ERA_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="dm-form-label" htmlFor="battle-deck-change-select">
                使用デッキ
                <select
                  id="battle-deck-change-select"
                  className="dm-input"
                  value={resolvedDeckChangeTargetId}
                  onChange={(event) => setDeckChangeTargetId(event.target.value)}
                  disabled={deckChangeLoading}
                >
                  {filteredChangeableDecks.length === 0 ? (
                    <option value="">該当なし</option>
                  ) : (
                    filteredChangeableDecks.map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name} / {getDeckEraLabel(deck.era_key)}
                      </option>
                    ))
                  )}
                </select>
              </label>

              <div className="bf-deck-change-summary">
                <span>候補 {filteredChangeableDecks.length}件</span>
                {resolvedDeckChangeTargetId && (
                  <span>
                    選択中 {filteredChangeableDecks.find((deck) => deck.id === resolvedDeckChangeTargetId)?.name ?? "未選択"}
                  </span>
                )}
              </div>
            </div>
          )}
        </BattlePopup>
      )}

      {pendingDeckDrop && (
        <div
          className="bf-deck-drop-dialog-backdrop"
          role="presentation"
          onClick={(event) => event.stopPropagation()}
        >
          <section
            className="bf-deck-drop-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bf-deck-drop-dialog-title"
          >
            <h2 id="bf-deck-drop-dialog-title">山札へ置く位置を選択</h2>
            <p>{pendingDeckDrop.instanceIds.length}枚のカードを移動します。</p>
            <div className="bf-deck-drop-dialog-actions">
              <button type="button" onClick={() => handleDeckDropChoice("top")}>
                山札の上へ置く
              </button>
              <button type="button" onClick={() => handleDeckDropChoice("bottom")}>
                山札の下へ置く
              </button>
              <button type="button" onClick={() => handleDeckDropChoice(null)}>
                キャンセル
              </button>
            </div>
          </section>
        </div>
      )}

      {pendingActionPopup && (
        <BattleActionPopup
          x={pendingActionPopup.x}
          y={pendingActionPopup.y}
          onSelect={handleBattleActionPopupSelect}
          onCancel={handleBattleActionPopupCancel}
        />
      )}

      {pendingSoulVisibilityPopup && (
        <BattlePopup
          title="裏向きソウル"
          size="small"
          onClose={() => setPendingSoulVisibilityPopup(null)}
          ariaLabel="裏向きソウルの操作"
        >
          {pendingSoulVisibilityPopup.mode === "name" ? (
            <div className="bf-soul-visibility-actions">
              <p>カード名：{pendingSoulVisibilityPopup.cardName}</p>
              <button type="button" onClick={() => setPendingSoulVisibilityPopup(null)}>
                閉じる
              </button>
            </div>
          ) : (
            <div className="bf-soul-visibility-actions">
              <p>この裏向きカードの操作を選択してください。</p>
              <button
                type="button"
                onClick={() =>
                  setPendingSoulVisibilityPopup((current) =>
                    current ? { ...current, mode: "name" } : current
                  )
                }
              >
                カード名を確認する
              </button>
              <button type="button" onClick={handleRevealSoulCard}>
                表向きにする
              </button>
            </div>
          )}
        </BattlePopup>
      )}

      {pendingDeckCountPopup && (
        <DeckCountPopup
          title={pendingDeckCountPopup.mode === "look" ? "上を見る" : "公開する"}
          maxCount={battleState.players.self.zones.deck.cards.length}
          x={pendingDeckCountPopup.x}
          y={pendingDeckCountPopup.y}
          onSubmit={handleDeckCountSubmit}
          onCancel={() => setPendingDeckCountPopup(null)}
        />
      )}

      {lookedDeckCards.length > 0 && (
        <DeckBrowserPopup
          cards={lookedDeckCards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          soulCandidates={soulTargetCandidates}
          title={
            battleState.deckLook
              ? `山札上から${battleState.deckLook.instanceIds.length}枚を見る`
              : "Deck Browser"
          }
          description="カードを選択し、移動先を設定してください。未指定カードは移動しません。"
          mode="move"
          canDragCards
          onDragStartCard={handlePopupDragStartCard}
          onDragEndCard={handleDragEndCard}
          onExecute={handleDeckBrowserExecute}
          onClose={handleCancelDeckLook}
        />
      )}

      {dropBrowserPlayerId && (
        <DeckBrowserPopup
          cards={dropBrowserCards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          soulCandidates={soulTargetCandidates}
          title="ドロップゾーン"
          description="ドロップゾーンのカード一覧です。"
          mode="browse"
          canDragCards={dropBrowserPlayerId === "self"}
          onDragStartCard={handlePopupDragStartCard}
          onDragEndCard={handleDragEndCard}
          onExecute={() => undefined}
          onClose={() => setDropBrowserPlayerId(null)}
        />
      )}

      {pendingFaceDownSoulPopup && (
        <AbilityCardTargetPopup
          title="裏向きソウル"
          description="ソウルへ裏向きで入れる自分のカードを1枚選択してください。"
          candidates={pendingFaceDownSoulPopup.candidates}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          onSelect={handleFaceDownSoulTargetSelect}
          onCancel={() => setPendingFaceDownSoulPopup(null)}
        />
      )}

      {pendingHyakuganPopup && pendingHyakuganPopup.selectedPairInstanceId == null && (
        <AbilityCardTargetPopup
          title="ヒャクガンヤミゲドウ"
          description="同じゾーンからもう片方の半身を1枚選択してください。"
          candidates={pendingHyakuganPopup.pairCandidates}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          onSelect={handleStartHyakuganPlacement}
          onCancel={() => setPendingHyakuganPopup(null)}
        />
      )}

      {pendingBiriKinataPopup && (
        <BiriKinataTargetPopup
          dropCards={battleState.players.opponent.zones.drop.cards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          onSelect={handleBiriKinataTargetSelect}
          onCancel={() => setPendingBiriKinataPopup(null)}
        />
      )}

      {activeAbilityNotification && (
        <AbilityNotificationDialog
          notification={activeAbilityNotification}
          sourceCard={activeAbilityNotificationSourceCard}
          targetCard={activeAbilityNotificationTargetCard}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          onConfirm={handleConfirmAbilityNotification}
          onCancel={() => setActiveAbilityNotificationId(null)}
        />
      )}
    </main>
  );
}
