"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
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
import { BattleDeckContextMenu } from "@/components/battle/BattleDeckContextMenu";
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
  getBattleTextCommandSuggestions,
  parseBattleTextCommand,
  type BattleTextCommandId
} from "@/lib/battle/textCommands";
import {
  cleanupExpiredBattleRooms,
  deleteBattleRoom,
  disbandBattleRoom,
  loadBattleRoom,
  PREALLOCATED_BATTLE_ROOMS,
  leaveBattleRoomBeforeDeckSelection,
  touchBattleRoom,
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
  loadSyncedPlayerBattleStates,
  mapSyncedSeatStatesToPlayers,
  normalizeBattlePlayerSeat,
  saveSyncedPlayerBattleState,
  subscribeSyncedPlayerBattleStates,
  unsubscribeSyncedPlayerBattleStates,
  type BattlePlayerSeat,
  type RealtimeStatus,
  type SyncedPlayerBattleState
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
import {
  createEmptyBattleState,
  createInitialBattleState
} from "@/lib/battle/createInitialBattleState";
import type { BattleSelectionMode } from "@/lib/battle/selection/battleSelectionMode";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardsByIds } from "@/lib/cards/cardActions";
import { loadBattleCardAbilityMap } from "@/lib/cards/cardAbilityActions";
import { loadDeck, loadDeckCards, loadDecks } from "@/lib/decks/deckActions";
import { loadFlag, loadFlagsLite } from "@/lib/flags/flagActions";
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
  BattleActivityLogEntry,
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
  DeckEraKey,
  FlagRecord
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
  x: number;
  y: number;
};

type DeckContextMenuPosition = {
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

type BattleResetSource = {
  flag: Parameters<typeof createInitialBattleState>[0]["flag"];
  buddyCardId: string;
  deckCards: Parameters<typeof createInitialBattleState>[0]["deckCards"];
};

type BattleCardLookup = Map<
  string,
  { card: BattleCard; playerId: BattlePlayerId; zoneId: BattleZoneId }
> & {
  visibleImageCardIds: Set<string>;
  selfDeckImageCardIds: Set<string>;
  deckLookImageCardIds: Set<string>;
};

function buildBattleCardLookup(battleState: BattleState | null): BattleCardLookup {
  const lookup = Object.assign(new Map(), {
    visibleImageCardIds: new Set<string>(),
    selfDeckImageCardIds: new Set<string>(),
    deckLookImageCardIds: new Set<string>()
  }) as BattleCardLookup;
  if (!battleState) return lookup;
  const deckLookIds = new Set(battleState.deckLook?.instanceIds ?? []);

  for (const playerId of ["self", "opponent"] as const) {
    const player = battleState.players[playerId];
    for (const zone of Object.values(player.zones)) {
      const visit = (
        card: BattleCard,
        rootInstanceId: string,
        isZoneCard: boolean,
        ancestorsVisible: boolean,
        isDeckLooked: boolean
      ) => {
        const ownImageVisible = card.visibility !== "face_down" &&
          !(card.visibility === "private" && playerId !== "self");
        if (!lookup.has(card.instanceId)) {
          lookup.set(card.instanceId, { card, playerId, zoneId: zone.id });
        }
        const imageVisible = ancestorsVisible && ownImageVisible;
        const isCurrentDeckLook = isDeckLooked || (isZoneCard && deckLookIds.has(card.instanceId));
        const isDeckRoot = isZoneCard && zone.id === "deck";
        if (zone.id === "deck") {
          if (playerId === "self" && (isZoneCard || imageVisible)) {
            lookup.selfDeckImageCardIds.add(card.cardId);
          }
        } else if (imageVisible) {
          lookup.visibleImageCardIds.add(card.cardId);
        }
        if (isCurrentDeckLook && (isZoneCard || imageVisible)) {
          lookup.deckLookImageCardIds.add(card.cardId);
        }
        card.soul.forEach((soulCard) =>
          visit(
            soulCard,
            rootInstanceId,
            false,
            isDeckRoot || imageVisible,
            isCurrentDeckLook
          )
        );
      };
      zone.cards.forEach((card) => visit(card, card.instanceId, true, true, false));
    }
  }

  for (const instanceId of deckLookIds) {
    const card = lookup.get(instanceId);
    if (card) lookup.deckLookImageCardIds.add(card.card.cardId);
  }
  return lookup;
}

function getBattleCardImageIds(lookup: BattleCardLookup, includeDeck: boolean) {
  return [...new Set([
    ...lookup.visibleImageCardIds,
    ...(includeDeck ? lookup.selfDeckImageCardIds : []),
    ...lookup.deckLookImageCardIds
  ])];
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

function useStableEvent<Args extends unknown[], Result>(
  callback: (...args: Args) => Result
) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useCallback((...args: Args) => callbackRef.current(...args), []);
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
  const requestedImageCardIdsRef = useRef(new Set<string>());
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
  const [deckContextMenu, setDeckContextMenu] =
    useState<DeckContextMenuPosition | null>(null);
  const [deckViewerOpen, setDeckViewerOpen] = useState(false);
  const [pendingBiriKinataPopup, setPendingBiriKinataPopup] =
    useState<PendingBiriKinataPopup | null>(null);
  const [pendingFaceDownSoulPopup, setPendingFaceDownSoulPopup] =
    useState<PendingFaceDownSoulPopup | null>(null);
  const [pendingSoulVisibilityPopup, setPendingSoulVisibilityPopup] =
    useState<PendingSoulVisibilityPopup | null>(null);
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
  const [battleMenuOpen, setBattleMenuOpen] = useState(false);
  const [battleLogsOpen, setBattleLogsOpen] = useState(false);
  const [battleLogsVisible, setBattleLogsVisible] = useState(true);
  const [battleLogDisplayCount, setBattleLogDisplayCount] = useState(4);
  const [recentBattleLogs, setRecentBattleLogs] = useState<BattleActivityLogEntry[]>([]);
  const [battleLogHistoryOpen, setBattleLogHistoryOpen] = useState(false);
  const [battleLogCenter, setBattleLogCenter] = useState<{ left: number; top: number } | null>(null);
  const battleLogSeenIdsRef = useRef<Set<string> | null>(null);
  const battleLogTimersRef = useRef<Map<string, number>>(new Map());
  const battleLogHistoryListRef = useRef<HTMLOListElement | null>(null);
  const [pendingLogSettings, setPendingLogSettings] =
    useState<"visibility" | "count" | null>(null);
  const [logCountInput, setLogCountInput] = useState("10");
  const [commandInputOpen, setCommandInputOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [specialCommandMessage, setSpecialCommandMessage] = useState("");
  const [pendingTextCommandSelection, setPendingTextCommandSelection] =
    useState<"frag_new" | "quenatar" | "hyakugan-heaven" | "hyakugan-earth" | null>(null);
  const [pendingHyakuganZone, setPendingHyakuganZone] =
    useState<"center" | "left" | "right" | null>(null);
  const [pendingHyakuganHeavenId, setPendingHyakuganHeavenId] =
    useState<string | null>(null);
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
  const [deckChangeCollectionFilter, setDeckChangeCollectionFilter] = useState<"all" | "private" | "public" | "default">("all");
  const [deckChangeFlagId, setDeckChangeFlagId] = useState("");
  const [changeableFlags, setChangeableFlags] = useState<FlagRecord[]>([]);
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

  function areJsonValuesEqual(left: unknown, right: unknown): boolean {
    if (Object.is(left, right)) return true;
    if (typeof left !== "object" || left === null || typeof right !== "object" || right === null) {
      return false;
    }

    if (Array.isArray(left) || Array.isArray(right)) {
      if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
        return false;
      }
      return left.every((value, index) => {
        const rightValue = right[index];
        if (
          value === undefined || typeof value === "function" || typeof value === "symbol" ||
          (typeof value === "number" && !Number.isFinite(value))
        ) {
          return rightValue === null || rightValue === undefined || typeof rightValue === "function" || typeof rightValue === "symbol" ||
            (typeof rightValue === "number" && !Number.isFinite(rightValue));
        }
        if (
          rightValue === undefined || typeof rightValue === "function" || typeof rightValue === "symbol" ||
          (typeof rightValue === "number" && !Number.isFinite(rightValue))
        ) return false;
        return areJsonValuesEqual(value, rightValue);
      });
    }

    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const jsonKeys = (record: Record<string, unknown>) =>
      Object.keys(record).filter((key) => {
        const value = record[key];
        return value !== undefined && typeof value !== "function" && typeof value !== "symbol";
      });
    const leftKeys = jsonKeys(leftRecord);
    const rightKeys = jsonKeys(rightRecord);
    if (leftKeys.length !== rightKeys.length) return false;
    return leftKeys.every((key) =>
      Object.hasOwn(rightRecord, key) && areJsonValuesEqual(leftRecord[key], rightRecord[key])
    );
  }

  function hasSelfPlayerStateChanged(current: BattleState, nextState: BattleState) {
    return !areJsonValuesEqual(current.players.self, nextState.players.self);
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

      if (!isRealtimeBattle && roomId) {
        setLoading(true);
        setMessage("");
        const profile = await getOrCreateProfile();
        if (!profile) {
          window.location.href = "/login";
          return;
        }
        currentUserIdRef.current = profile.id;

        const savedStateResult = await loadBattleState(roomId);
        if (savedStateResult.error) {
          setMessage("一人回しの盤面を読み込めませんでした。");
          setLoading(false);
          return;
        }

        const initialState = savedStateResult.data ?? createEmptyBattleState();
        setBattleState(initialState);
        setBattleDeck(null);
        setPlayerSupplyDecks({});
        setCards([]);
        setImages([]);
        resetSourceRef.current = null;
        if (!savedStateResult.data) {
          const createResult = await createBattleState({
            roomId,
            battleState: initialState,
            updatedBy: profile.id
          });
          if (createResult.error) setMessage("一人回しの盤面を保存できませんでした。");
        }
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
    currentUserIdRef.current = profile.id;

    setLoading(true);
    setMessage("");
    setSyncMessage("");

    const optionalMetadataPromise = Promise.allSettled([
      loadBattleSupplies(),
      loadSiteSupplySettings(),
      isRealtimeBattle ? loadBattleRoom(roomId) : Promise.resolve({ data: null, error: null })
    ]);
    const [deckResult, deckCardsResult, shortcutResult, abilityMapResult] = await Promise.allSettled([
      loadDeck(deckId),
      loadDeckCards(deckId),
      loadShortcutSettings(),
      loadBattleCardAbilityMap()
    ]);

    const deckResponse = deckResult.status === "fulfilled" ? deckResult.value : null;
    const deckCardsResponse =
      deckCardsResult.status === "fulfilled" ? deckCardsResult.value : null;
    const shortcutResponse = shortcutResult.status === "fulfilled" ? shortcutResult.value : null;
    const abilityMapResponse = abilityMapResult.status === "fulfilled" ? abilityMapResult.value : null;

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
      const [cardResponse, savedBattleStateResult, syncedPlayersResult] = await Promise.all([
        loadCardsByIds(battleCardIds),
        loadBattleState(roomId),
        isRealtimeBattle && selfSeat
          ? loadSyncedPlayerBattleStates(roomId)
          : Promise.resolve({
              data: {} as Partial<Record<BattlePlayerSeat, SyncedPlayerBattleState>>,
              error: null
            })
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
      const baseState = savedBattleStateResult.data ?? freshBattleState;
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

      const initialSaveTasks: Promise<void>[] = [];
      if (!savedBattleStateResult.data) {
        initialSaveTasks.push((async () => {
          const createResult = await createBattleState({
            roomId,
            battleState: initialState,
            updatedBy: currentUserIdRef.current ?? undefined
          });
          if (createResult.error) setMessage("BattleStateの初期保存に失敗しました。");
        })());
      }

      if (isRealtimeBattle && selfSeat && !syncedSeats[selfSeat]) {
        initialSaveTasks.push((async () => {
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
        })());
      }
      await Promise.all(initialSaveTasks);

      resetSourceRef.current = resetSource;
      setCards((cardResponse.error ? [] : cardResponse.data ?? []) as unknown as CardRecord[]);
      setBattleDeck(deckResponse.data);
      setPlayerSupplyDecks({ self: deckResponse.data });
      setCardAbilityMap(abilityMapResponse?.error ? new Map() : abilityMapResponse?.data ?? new Map());
      setShortcutSettings(shortcutResponse?.data ?? mergeWithDefaultShortcuts(null));
      setBattleState(initialState);
      setLoading(false);

      void optionalMetadataPromise.then(async ([supplyResult, siteSettingsResult, roomResult]) => {
        if (supplyResult.status === "fulfilled") {
          if (supplyResult.value.error) {
            console.warn("Battle supplies are not available yet.", supplyResult.value.error);
          } else {
            setBattleSupplies(supplyResult.value.data ?? []);
          }
        }
        if (siteSettingsResult.status === "fulfilled") {
          if (siteSettingsResult.value.error) {
            console.warn("Site supply settings are not available yet.", siteSettingsResult.value.error);
          } else {
            setSiteSupplySettings(siteSettingsResult.value.data ?? null);
          }
        }

        if (roomResult.status === "fulfilled" && roomResult.value.error) {
          console.warn("Battle room supply metadata is not available yet.", roomResult.value.error);
        }
        const opponentDeckId =
          isRealtimeBattle && selfSeat && roomResult.status === "fulfilled" && roomResult.value.data
            ? selfSeat === "player1"
              ? roomResult.value.data.guest_deck_id
              : roomResult.value.data.host_deck_id
            : null;
        if (opponentDeckId) {
          const opponentDeckResult = await loadDeck(opponentDeckId);
          if (opponentDeckResult.error) {
            console.warn("Opponent deck supply metadata is not available yet.", opponentDeckResult.error);
          } else if (opponentDeckResult.data) {
            const opponentDeck = opponentDeckResult.data;
            setPlayerSupplyDecks((current) => ({ ...current, opponent: opponentDeck }));
          }
        }
      }).catch((error: unknown) => {
        console.warn("Optional battle metadata could not be loaded.", error);
      });
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof Error
          ? error.message
          : "BattleStateの生成に失敗しました。"
      );
      setLoading(false);
    }
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

  useEffect(() => {
    if (!isRealtimeBattle || !roomId || !selfSeat) return;

    const sendHeartbeat = () => {
      void touchBattleRoom(roomId, selfSeat).then(({ error }) => {
        if (error) console.warn("Battle room heartbeat failed.", error);
      });
    };

    sendHeartbeat();
    const intervalId = window.setInterval(sendHeartbeat, 30_000);
    return () => window.clearInterval(intervalId);
  }, [isRealtimeBattle, roomId, selfSeat]);

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
    roomId,
    selfSeat
  ]);

  useEffect(() => {
    if (!opponentPresent) return;
    void refreshOpponentSupplyMetadata();
  }, [opponentPresent, refreshOpponentSupplyMetadata]);

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

  const imagesByCardRef = useRef(new Map<string, CardImageRecord[]>());
  const imagesByCard = useMemo(() => {
    const map = new Map<string, CardImageRecord[]>();
    for (const image of images) {
      const cardImages = map.get(image.card_id);
      if (cardImages) cardImages.push(image);
      else map.set(image.card_id, [image]);
    }
    for (const [cardId, cardImages] of map) {
      const previousCardImages = imagesByCardRef.current.get(cardId);
      if (
        previousCardImages?.length === cardImages.length &&
        previousCardImages.every((image, index) => image === cardImages[index])
      ) {
        map.set(cardId, previousCardImages);
      }
    }
    imagesByCardRef.current = map;
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

  const battleCardLookup = useMemo(() => buildBattleCardLookup(battleState), [battleState]);
  const activeCard = battleState?.activeViewerCardInstanceId
    ? battleCardLookup.get(battleState.activeViewerCardInstanceId)?.card ?? null
    : null;
  const activeCardPlayerId = battleState?.activeViewerCardInstanceId
    ? battleCardLookup.get(battleState.activeViewerCardInstanceId)?.playerId ?? "self"
    : "self";
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
      .map((instanceId) => battleCardLookup.get(instanceId)?.card ?? null)
      .filter((card): card is BattleCard => card != null);
  }, [battleCardLookup, battleState, viewerInstanceIds]);
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
    ? battleCardLookup.get(activeAbilityNotification.sourceInstanceId)?.card ?? null
    : null;
  const activeAbilityNotificationTargetCard = activeAbilityNotification
    ? battleCardLookup.get(activeAbilityNotification.targetInstanceId)?.card ?? null
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
    return battleState.deckLook.instanceIds
      .map((instanceId) => battleCardLookup.get(instanceId)?.card ?? null)
      .filter((card): card is BattleCard => card != null);
  }, [battleCardLookup, battleState]);
  const dropBrowserCards = useMemo(() => {
    if (!battleState || !dropBrowserPlayerId) return [];
    return battleState.players[dropBrowserPlayerId].zones.drop.cards;
  }, [battleState, dropBrowserPlayerId]);
  const deckViewerCards = useMemo(
    () => battleState?.players.self.zones.deck.cards ?? [],
    [battleState]
  );

  useEffect(() => {
    if (!battleState) return;
    const cardIds = getBattleCardImageIds(battleCardLookup, deckViewerOpen).filter(
      (cardId) => !requestedImageCardIdsRef.current.has(cardId)
    );
    if (cardIds.length === 0) return;

    cardIds.forEach((cardId) => requestedImageCardIdsRef.current.add(cardId));
    void loadCardImagesByCardIds(cardIds).then((result) => {
      if (result.error) {
        cardIds.forEach((cardId) => requestedImageCardIdsRef.current.delete(cardId));
        return;
      }
      setImages((current) => {
        const existingIds = new Set(current.map((image) => image.id));
        const newImages = (result.data ?? []).filter((image) => !existingIds.has(image.id));
        return newImages.length > 0 ? [...current, ...newImages] : current;
      });
    }).catch((error: unknown) => {
      cardIds.forEach((cardId) => requestedImageCardIdsRef.current.delete(cardId));
      console.warn("Battle card images could not be loaded.", error);
    });
  }, [battleCardLookup, battleState, deckViewerOpen]);

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

  function getMovementLogEntries(
    previousState: BattleState,
    nextState: BattleState,
    command: BattleCommand
  ): BattleActivityLogEntry[] {
    const now = new Date().toISOString();
    const actorName = previousState.players.self.name || "自分";
    const entry = (message: string, index = 0): BattleActivityLogEntry => ({
      id: `${now}:${command.type}:${index}:${crypto.randomUUID()}`,
      createdAt: now,
      actorName,
      message
    });
    let previousCardLookup: ReturnType<typeof buildBattleCardLookup> | null = null;
    let nextCardLookup: ReturnType<typeof buildBattleCardLookup> | null = null;
    const getPreviousCard = (instanceId: string) =>
      (previousCardLookup ??= buildBattleCardLookup(previousState)).get(instanceId);
    const getNextCard = (instanceId: string) =>
      (nextCardLookup ??= buildBattleCardLookup(nextState)).get(instanceId);
    const zoneLabel = (playerId: BattlePlayerId, zoneId: BattleZoneId) =>
      previousState.players[playerId].zones[zoneId].label;
    const cardName = (instanceId: string, publicOnly = false) => {
      const location = getPreviousCard(instanceId);
      if (publicOnly && location?.card.visibility !== "public") return null;
      return location ? cardMap.get(location.card.cardId)?.name ?? null : null;
    };

    if (command.type === "SHUFFLE_DECK") {
      return [entry("山札をシャッフル")];
    }
    if (command.type === "LOOK_TOP_DECK") {
      return [entry(`山札を確認（上から${command.payload.count}枚）`)];
    }
    if (command.type === "REVEAL_DECK_CARD") {
      const count = command.payload.count ?? (command.payload.instanceId ? 1 : 0);
      return [entry(`山札から${count}枚を公開`)];
    }

    if (command.type === "DRAW_CARD") {
      const movedCount = Math.max(
        0,
        previousState.players[command.payload.playerId].zones.deck.cards.length -
          nextState.players[command.payload.playerId].zones.deck.cards.length
      );
      return movedCount > 0
        ? [entry(`山札から手札にカードが移動（${movedCount}枚）`)]
        : [];
    }

    let movementIds: string[] = [];
    let destinationZone: BattleZoneId | null = null;
    let targetInstanceId: string | null = null;
    if (command.type === "MOVE_TOP_DECK_CARD") {
      const topCard = previousState.players[command.payload.playerId].zones.deck.cards[0];
      movementIds = topCard ? [topCard.instanceId] : [];
      destinationZone = command.payload.toZone;
    } else
    if (command.type === "MOVE_CARD" || command.type === "MOVE_REVEALED_CARD") {
      movementIds = [command.payload.instanceId];
      destinationZone = command.payload.toZone;
      if (command.type === "MOVE_REVEALED_CARD") {
        targetInstanceId = command.payload.targetInstanceId ?? null;
      }
    } else if (command.type === "MOVE_CARDS") {
      movementIds = command.payload.instanceIds;
      destinationZone = command.payload.toZone;
    } else if (
      command.type === "PLACE_AREA_SLOT" ||
      command.type === "PLACE_OR_STACK_AREA_CARD" ||
      command.type === "STACK_CARD"
    ) {
      movementIds = [command.payload.instanceId];
      destinationZone = command.payload.toZone;
      if (command.type !== "PLACE_AREA_SLOT") {
        targetInstanceId = command.payload.targetInstanceId ?? null;
      }
    } else if (
      command.type === "PLACE_AS_FLAG" ||
      command.type === "PLACE_QUENATAR_CARD"
    ) {
      movementIds = [command.payload.instanceId];
      destinationZone = command.type === "PLACE_AS_FLAG" ? "flag" : "center";
    } else if (command.type === "MOVE_SOUL_CARD") {
      movementIds = [command.payload.soulInstanceId];
      destinationZone = command.payload.toZone;
      targetInstanceId = command.payload.targetInstanceId ?? null;
    } else if (command.type === "MOVE_SOUL_CARDS") {
      movementIds = command.payload.soulInstanceIds;
      destinationZone = command.payload.toZone;
    } else if (
      command.type === "ADD_SOUL_FACE_UP" ||
      command.type === "ADD_SOUL_FACE_DOWN"
    ) {
      movementIds = [command.payload.instanceId];
      const target = getNextCard(command.payload.targetInstanceId);
      destinationZone = target?.zoneId ?? null;
      targetInstanceId = command.payload.targetInstanceId;
    } else {
      return [];
    }

    if (!destinationZone) return [];
    const targetName = targetInstanceId
      ? cardName(targetInstanceId, true)
      : null;
    const entries: BattleActivityLogEntry[] = [];
    if (
      movementIds.some((instanceId) =>
        getPreviousCard(instanceId)?.zoneId === "deck"
      )
    ) {
      entries.push(entry("デッキをサーチ"));
    }
    movementIds.forEach((instanceId, index) => {
      const source = getPreviousCard(instanceId);
      const destination = getNextCard(instanceId);
      if (!source || !destination || source.zoneId === destination.zoneId) return;
      if (source.zoneId !== "deck" && destination.zoneId !== "hand") return;

      const movedCardName = cardName(instanceId);
      const isPublicDestination =
        destination.zoneId !== "deck" &&
        destination.zoneId !== "hand" &&
        destination.card.visibility === "public";
      let message: string;
      if (targetInstanceId) {
        message = isPublicDestination && movedCardName
          ? targetName
            ? `「${movedCardName}」が「${targetName}」の下に移動`
            : "カードの下に公開カードが移動"
          : targetName
            ? `「${targetName}」の下にカードが移動`
            : "カードの下にカードが移動";
      } else if (isPublicDestination && movedCardName) {
        message = `${zoneLabel(source.playerId, source.zoneId)}から${zoneLabel(destination.playerId, destination.zoneId)}に「${movedCardName}」が移動`;
      } else {
        message = `${zoneLabel(source.playerId, source.zoneId)}から${zoneLabel(destination.playerId, destination.zoneId)}にカードが移動`;
      }
      entries.push(entry(message, index + 1));
    });
    return entries;
  }

  function appendBattleActivityLogs(
    state: BattleState,
    entries: BattleActivityLogEntry[]
  ): BattleState {
    if (entries.length === 0) return state;
    const player = state.players.self;
    return {
      ...state,
      players: {
        ...state.players,
        self: {
          ...player,
          activityLogs: [...(player.activityLogs ?? []), ...entries].slice(-30)
        }
      }
    };
  }

  function persistBattleState(nextState: BattleState) {
    if (!roomId) return;

    void saveBattleState({
      roomId,
      battleState: nextState,
      updatedBy: currentUserIdRef.current ?? undefined
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
      "payload" in command &&
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

      const loggedState = appendBattleActivityLogs(
        nextState,
        getMovementLogEntries(current, nextState, command)
      );
      const versionedState = incrementBattleVersion(loggedState);
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

      const nextState = effectiveCommands.reduce((state, command) => {
        const commandState = executeBattleCommand(state, command);
        if (commandState === state) return state;
        return appendBattleActivityLogs(
          commandState,
          getMovementLogEntries(state, commandState, command)
        );
      }, current);
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
    if (!roomId) return;
    const confirmed = window.confirm(
      "対戦盤面を初期状態へリセットします。現在の盤面は保存済み状態も含めて上書きされます。よろしいですか？"
    );
    if (!confirmed) return;

    const freshBattleState = resetSourceRef.current
      ? createInitialBattleState(resetSourceRef.current)
      : createEmptyBattleState();
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
    setPendingTextCommandSelection(null);
    setPendingHyakuganZone(null);
    setPendingHyakuganHeavenId(null);
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
      const matchesCollection =
        deckChangeCollectionFilter === "all" || deck.deck_visibility === deckChangeCollectionFilter;
      const matchesFlag = !deckChangeFlagId || deck.flag_id === deckChangeFlagId;
      return matchesSearch && matchesEra && matchesCollection && matchesFlag;
    });
  }, [changeableDecks, deckChangeCollectionFilter, deckChangeEraKey, deckChangeFlagId, deckChangeSearchText]);

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
    setDeckChangeCollectionFilter("all");
    setDeckChangeFlagId("");
    try {
      const [deckResult, flagsResult] = await Promise.all([loadDecks(), loadFlagsLite()]);
      if (deckResult.error) {
        setDeckChangeError(getErrorMessage(deckResult.error) ?? "デッキ一覧を読み込めませんでした。");
        return;
      }
      setChangeableFlags(flagsResult.error ? [] : flagsResult.data ?? []);

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
      case "turn_start":
        executeShortcutCommand({ type: "STAND_ALL_BATTLE_CARDS" });
        return;
      case "toggle_rest": {
        const selectedCard =
          battleState && selection.instanceIds.length === 1 && selection.zoneId
            ? battleState.players.self.zones[selection.zoneId].cards.find(
                (card) => card.instanceId === selection.instanceIds[0]
              ) ?? null
            : null;
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

  function handleSpecialCommandSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    const parsedCommand = parseBattleTextCommand(commandInput);
    if (!parsedCommand) {
      setSpecialCommandMessage(
        commandInput.trim()
          ? "未登録のコマンドです。"
          : "コマンドを入力してください。"
      );
      return;
    }

    const handlers: Record<BattleTextCommandId, (args: string[]) => void> = {
      frag_new: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("frag_newの後には追加の指定を入力できません。");
          return;
        }
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage("");
        setPendingTextCommandSelection("frag_new");
      },
      frag_reverse: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("frag_reverseの後には追加の指定を入力できません。");
          return;
        }
        const topFlag = battleState?.players.self.zones.flag.cards[0];
        if (!topFlag) {
          setSpecialCommandMessage("裏向きにするフラッグカードがありません。");
          return;
        }
        executeCommand({ type: "TOGGLE_FLAG_VISIBILITY", source: "ability" });
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage(
          topFlag.visibility === "face_down"
            ? "フラッグカードを表向きにしました。"
            : "フラッグカードを裏向きにしました。"
        );
      },
      laevateinn: (args) => {
        if (args.length > 0 || !battleState) {
          setSpecialCommandMessage("Laevateinnの後には追加の指定を入力できません。");
          return;
        }
        const currentlyActive = battleState.ruleState.appliedRuleEffectIds.includes(
          "text-command:laevateinn"
        );
        const active = !currentlyActive;
        executeCommand({
          type: "SET_LAEVATEINN_EFFECT",
          payload: { active },
          source: "ability"
        });
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage(
          active
            ? "レヴァンティンが有効です。アイテムの装備枚数制限を解除しました。"
            : "レヴァンティンを解除し、装備枚数制限を元に戻しました。"
        );
      },
      hand_open: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("hand_openの後には追加の指定を入力できません。");
          return;
        }
        if (!battleState) return;
        const active = !(
          battleState.players.self.activeEffectIds ?? []
        ).includes("text-command:hand_open");
        executeCommand({
          type: "SET_HAND_OPEN_EFFECT",
          payload: { active },
          source: "ability"
        });
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage(
          active
            ? "hand_openが有効です。自分の手札を公開しました。"
            : "hand_openを解除し、自分の手札を非公開にしました。"
        );
      },
      turn_start: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("turn_startの後には追加の指定を入力できません。");
          return;
        }
        executeCommand({
          type: "STAND_ALL_BATTLE_CARDS",
          source: "ability"
        });
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage("ターン開始処理を実行しました。レスト状態のカードをスタンドしました。");
      },
      log: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("logの後には追加の指定を入力できません。");
          return;
        }
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage("");
        setPendingLogSettings("visibility");
      },
      quenatar: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("Quenatarの後には追加の指定を入力できません。");
          return;
        }
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage("");
        setPendingTextCommandSelection("quenatar");
      },
      hyakugan: (args) => {
        if (args.length > 0) {
          setSpecialCommandMessage("Hyakuganの後には追加の指定を入力できません。");
          return;
        }
        setCommandInputOpen(false);
        setCommandInput("");
        setSpecialCommandMessage("");
        setSelectionMode({
          type: "zone",
          title: "百眼の配置先を選択してください",
          description: "センター・レフト・ライトから選択します。",
          allowedZones: HYAKUGAN_PLACEMENT_TARGET_ZONES,
          playerId: "self",
          onSelect: (zoneId) => {
            if (!battleState || !HYAKUGAN_PLACEMENT_TARGET_ZONES.includes(zoneId)) return;
            const destinationZone = zoneId as "center" | "left" | "right";
            const occupied = getAreaStacks(
              battleState.players.self.zones[destinationZone].cards
            ).length;
            if (occupied >= 2) {
              const zoneLabel = destinationZone === "center" ? "センター" : destinationZone === "left" ? "レフト" : "ライト";
              setSpecialCommandMessage(`${zoneLabel}には既にカードがあるため、百眼を配置できません。`);
              setSelectionMode(null);
              return;
            }
            setPendingHyakuganZone(destinationZone);
            setPendingHyakuganHeavenId(null);
            setPendingTextCommandSelection("hyakugan-heaven");
            setSelectionMode(null);
          },
          onCancel: () => {
            setSelectionMode(null);
            setSpecialCommandMessage("Hyakuganをキャンセルしました。");
          }
        });
      }
    };
    handlers[parsedCommand.id](parsedCommand.args);
  }

  const executeShortcutActionRef = useRef(executeShortcutAction);
  executeShortcutActionRef.current = executeShortcutAction;

  useEffect(() => {
    function handleShortcutKeyDown(event: KeyboardEvent) {
      if (shouldIgnoreShortcutTarget(event.target)) return;
      if (
        event.code === "KeyT" &&
        !event.ctrlKey &&
        !event.shiftKey &&
        !event.altKey &&
        !event.metaKey
      ) {
        return;
      }

      if (
        isBattleShortcutBlocked({
          isShortcutCaptureOpen: commandInputOpen,
          isBattleActionPopupOpen: pendingActionPopup != null,
          isSelectionModeOpen: selectionMode != null || pendingTextCommandSelection != null,
          isDeckCountPopupOpen: pendingDeckCountPopup != null,
          isDeckBrowserPopupOpen: lookedDeckCards.length > 0 || dropBrowserPlayerId != null,
          isDeckDropDialogOpen: pendingDeckDrop != null,
          isBiriKinataPopupOpen: pendingBiriKinataPopup != null,
          isFaceDownSoulPopupOpen: pendingFaceDownSoulPopup != null,
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
    activeAbilityNotification,
    selectionMode,
    pendingTextCommandSelection,
    shortcutSettings,
    commandInputOpen
  ]);

  useEffect(() => {
    function handleCommandToggle(event: KeyboardEvent) {
      if (
        event.code !== "KeyT" ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.metaKey ||
        shouldIgnoreShortcutTarget(event.target)
      ) {
        return;
      }

      if (
        isBattleShortcutBlocked({
          isBattleActionPopupOpen: pendingActionPopup != null,
          isSelectionModeOpen: selectionMode != null || pendingTextCommandSelection != null,
          isDeckCountPopupOpen: pendingDeckCountPopup != null,
          isDeckBrowserPopupOpen: lookedDeckCards.length > 0 || dropBrowserPlayerId != null,
          isDeckDropDialogOpen: pendingDeckDrop != null,
          isBiriKinataPopupOpen: pendingBiriKinataPopup != null,
          isFaceDownSoulPopupOpen: pendingFaceDownSoulPopup != null,
          isAbilityNotificationOpen: activeAbilityNotification != null
        })
      ) {
        return;
      }

      event.preventDefault();
      setCommandInputOpen((open) => !open);
      setSpecialCommandMessage("");
    }

    window.addEventListener("keydown", handleCommandToggle);
    return () => window.removeEventListener("keydown", handleCommandToggle);
  }, [
    activeAbilityNotification,
    dropBrowserPlayerId,
    lookedDeckCards.length,
    pendingActionPopup,
    pendingBiriKinataPopup,
    pendingDeckCountPopup,
    pendingDeckDrop,
    pendingFaceDownSoulPopup,
    selectionMode,
    pendingTextCommandSelection
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

  function closeViewerCard(instanceId: string) {
    const remainingInstanceIds = viewerInstanceIds.filter(
      (currentInstanceId) => currentInstanceId !== instanceId
    );
    setViewerInstanceIds(remainingInstanceIds);
    if (remainingInstanceIds.length === 0) {
      nextViewerSlotRef.current = 0;
    }
    executeCommand({
      type: "SET_VIEWER_CARD",
      payload: {
        instanceId: remainingInstanceIds[0] ?? null
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

    if (pendingTextCommandSelection) {
      if (playerId !== "self") return;
      if (
        pendingTextCommandSelection === "hyakugan-heaven" ||
        pendingTextCommandSelection === "hyakugan-earth"
      ) {
        if (card.zoneId !== "hand") {
          setSpecialCommandMessage("百眼の半身は手札から選択してください。");
          return;
        }

        const requiredAbility: AbilityId =
          pendingTextCommandSelection === "hyakugan-heaven"
            ? "ten_no_hanshin_composite"
            : "chi_no_hanshin_composite";
        if (!hasBattleAbility(cardAbilityMap, card, requiredAbility)) {
          setSpecialCommandMessage(
            pendingTextCommandSelection === "hyakugan-heaven"
              ? "天の半身を選択してください。"
              : "地の半身を選択してください。"
          );
          return;
        }
        if (cardMap.get(card.cardId)?.orientation !== "horizontal") {
          setSpecialCommandMessage("選択した半身のカード画像が横向きカードとして登録されていません。");
          return;
        }

        if (pendingTextCommandSelection === "hyakugan-heaven") {
          setPendingHyakuganHeavenId(card.instanceId);
          setPendingTextCommandSelection("hyakugan-earth");
          setSpecialCommandMessage("続けて地の半身を選択してください。");
          setSelection({ zoneId: "hand", instanceIds: [card.instanceId] });
          return;
        }

        if (!pendingHyakuganZone || !pendingHyakuganHeavenId) {
          setPendingTextCommandSelection(null);
          setSpecialCommandMessage("百眼の選択状態が失われました。もう一度実行してください。");
          return;
        }

        const hyakuganCommand: BattleCommand = {
          type: "PLACE_HYAKUGAN_COMPOSITE",
          payload: {
            sourceInstanceId: pendingHyakuganHeavenId,
            pairInstanceId: card.instanceId,
            sourceRole: "heaven",
            pairRole: "earth",
            toZone: pendingHyakuganZone
          },
          source: "ability"
        };
        if (
          !battleState ||
          executeBattleCommand(battleState, hyakuganCommand) === battleState
        ) {
          const zoneLabel = pendingHyakuganZone === "center" ? "センター" : pendingHyakuganZone === "left" ? "レフト" : "ライト";
          setSpecialCommandMessage(`${zoneLabel}には既にカードがあるか、選択した半身が手札にありません。百眼を終了しました。`);
          setPendingTextCommandSelection(null);
          setPendingHyakuganZone(null);
          setPendingHyakuganHeavenId(null);
          handleClearSelection();
          return;
        }

        executeCommand(hyakuganCommand);
        setPendingTextCommandSelection(null);
        setPendingHyakuganZone(null);
        setPendingHyakuganHeavenId(null);
        setSpecialCommandMessage("百眼を複合カードとして配置しました。");
        handleClearSelection();
        return;
      }

      const command: BattleCommand =
        pendingTextCommandSelection === "frag_new"
          ? {
              type: "MOVE_CARD",
              payload: {
                instanceId: card.instanceId,
                fromZone: card.zoneId,
                toZone: "flag",
                index: 0
              }
            }
          : {
              type: "PLACE_QUENATAR_CARD",
              payload: {
                instanceId: card.instanceId,
                fromZone: card.zoneId
              },
              source: "ability"
            };

      if (
        pendingTextCommandSelection === "quenatar" &&
        battleState &&
        executeBattleCommand(battleState, command) === battleState
      ) {
        setSpecialCommandMessage(
          "センターに置けないか、選択したカードはすでに裏向きです。別のカードを選んでください。"
        );
        return;
      }

      executeCommand(command);
      const completedCommand = pendingTextCommandSelection;
      setPendingTextCommandSelection(null);
      setSpecialCommandMessage(
        completedCommand === "frag_new"
          ? "選択したカードをフラッグに重ねました。"
          : "選択したカードを裏向きでセンターに出しました。"
      );
      handleClearSelection();
      return;
    }

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

  function openDeckContextMenu(
    event: MouseEvent<HTMLElement>,
    playerId: BattlePlayerId
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (playerId !== "self") return;

    setDeckContextMenu({
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 228)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 154))
    });
  }

  function handleDeckContextMenuSelect(action: "look" | "reveal" | "view") {
    const position = deckContextMenu;
    setDeckContextMenu(null);
    if (action === "view") {
      setDeckViewerOpen(true);
      return;
    }
    if (action === "reveal") {
      executeCommand({
        type: "REVEAL_DECK_CARD",
        payload: { playerId: "self", count: 1 },
        source: "context_menu"
      });
      return;
    }
    if (!position) return;
    setPendingDeckCountPopup({
      x: position.x,
      y: position.y
    });
  }

  function handleDragStartCard(
    card: BattleCard,
    playerId: "self" | "opponent" = "self"
  ) {
    if (playerId !== "self") return;

    const isSelectedDrag =
      selection.zoneId === card.zoneId && selection.instanceIds.includes(card.instanceId);
    const compositeInstanceIds = getBattleSelectionUnitInstanceIds(battleState, card);

    setDragSelection({
      sourceCard: card,
      instanceIds:
        compositeInstanceIds.length > 1
          ? compositeInstanceIds
          : isSelectedDrag
            ? selection.instanceIds
            : [card.instanceId]
    });
  }

  function handlePopupDragStartCard(card: BattleCard) {
    setDragSelection({
      sourceCard: card,
      instanceIds: getBattleSelectionUnitInstanceIds(battleState, card)
    });
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
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent" = "self"
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (card.zoneId === "deck") {
      openDeckContextMenu(event, playerId);
    }
  }

  function handleContextMenuZone(
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) {
    if (zoneId === "deck") openDeckContextMenu(event, playerId);
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

    if (
      input.targetInstanceId &&
      dragSelection.instanceIds.includes(input.targetInstanceId)
    ) {
      setDragSelection(null);
      return;
    }

    if (
      dragSelection.instanceIds.length > 1 &&
      !dragSelection.sourceCard.meta.compositeId &&
      isAreaStackZone(toZone)
    ) {
      setDragSelection(null);
      return;
    }

    if (
      battleState &&
      (dragSelection.instanceIds.length === 1 ||
        typeof dragSelection.sourceCard.meta.compositeId === "string") &&
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

    const isComposite = typeof sourceCard.meta.compositeId === "string";
    const command: BattleCommand =
      instanceIds.length > 1 && !isComposite
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
    enabled: deckContextMenu != null,
    onClose: () => setDeckContextMenu(null)
  });

  useEscapeToClose({
    enabled: deckViewerOpen,
    onClose: () => setDeckViewerOpen(false)
  });

  useEscapeToClose({
    enabled: selectionMode != null,
    onClose: () => selectionMode?.onCancel()
  });

  useEscapeToClose({
    enabled: pendingTextCommandSelection != null,
    onClose: () => {
      setSpecialCommandMessage(
        pendingTextCommandSelection === "frag_new"
          ? "frag_newをキャンセルしました。"
          : pendingTextCommandSelection === "quenatar"
            ? "Quenatarをキャンセルしました。"
            : "Hyakuganをキャンセルしました。"
      );
      setPendingTextCommandSelection(null);
      setPendingHyakuganZone(null);
      setPendingHyakuganHeavenId(null);
    }
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

    executeCommand({
      type: "LOOK_TOP_DECK",
      payload: {
        playerId: "self",
        count
      }
    });
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

    if (
      source.kind === "card" &&
      typeof sourceCard.meta.compositeId === "string" &&
      (action === "soulFaceUp" || action === "soulFaceDown")
    ) {
      const compositeCards = battleState
        ? findCompositeGroupCardsInBattleState(battleState, sourceCard)
        : [];
      if (compositeCards.length > 1) {
        const pairedSoulCommands: BattleCommand[] = compositeCards.map(
          (card): BattleCommand => ({
            type: action === "soulFaceUp" ? "ADD_SOUL_FACE_UP" : "ADD_SOUL_FACE_DOWN",
            payload: {
              instanceId: card.instanceId,
              fromZone: card.zoneId,
              targetInstanceId
            },
            source: "popup"
          })
        );
        executeCommands(pairedSoulCommands);
        handleClearSelection();
        setPendingActionPopup(null);
        return;
      }
    }

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

  function handlePlacementZoneClick(
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: BattlePlayerId
  ) {
    if (selectionMode?.type !== "zone" || selectionMode.playerId !== playerId) return;
    selectionMode.onSelect(zoneId, {
      x: event.clientX,
      y: event.clientY,
      event
    });
  }

  function handleToggleViewerPin() {
    setViewerPinned((current) => !current);
  }

  const stableSelectCard = useStableEvent(handleSelectCard);
  const stableDoubleClickCard = useStableEvent(handleDoubleClickCard);
  const stableContextMenuCard = useStableEvent(handleContextMenuCard);
  const stableDragStartCard = useStableEvent(handleDragStartCard);
  const stableDragEndCard = useStableEvent(handleDragEndCard);
  const stableDropCard = useStableEvent(handleDropCard);
  const stableDoubleClickZone = useStableEvent(handleDoubleClickZone);
  const stableContextMenuZone = useStableEvent(handleContextMenuZone);
  const stablePlacementZoneClick = useStableEvent(handlePlacementZoneClick);
  const stableChangeSelfLife = useStableEvent(handleChangeSelfLife);
  const stableRollSelfDice = useStableEvent(handleRollSelfDice);
  const stableClearSelfDice = useStableEvent(handleClearSelfDice);
  const stableCloseViewer = useStableEvent(closeViewerCard);
  const stableToggleViewerPin = useStableEvent(handleToggleViewerPin);
  const stableSelectSoulCard = useStableEvent(handleSelectSoulCard);
  const stableDragStartSoulCard = useStableEvent(handleDragStartSoulCard);
  const stableDragEndSoulCard = useStableEvent(handleDragEndSoulCard);
  const stableContextMenuSoulCard = useStableEvent(handleContextMenuSoulCard);
  const stableDoubleClickFaceDownSoul = useStableEvent(handleDoubleClickFaceDownSoul);
  const activePersistentEffects = useMemo(() => {
    const effects: string[] = [];
    if (battleState?.ruleState.appliedRuleEffectIds.includes("text-command:laevateinn")) {
      effects.push("レヴァンティン");
    }
    if ((battleState?.players.self.activeEffectIds ?? []).includes("text-command:hand_open")) {
      effects.push("hand_open");
    }
    return effects;
  }, [
    battleState?.players.self.activeEffectIds,
    battleState?.ruleState.appliedRuleEffectIds
  ]);
  const placementTargetZones = useMemo(
    () => selectionMode?.type === "zone" ? new Set(selectionMode.allowedZones) : undefined,
    [selectionMode]
  );
  const placementTargetPlayerId =
    selectionMode?.type === "zone" ? selectionMode.playerId : undefined;
  const battleActivityLogs = useMemo(
    () => Object.values(battleState?.players ?? {})
      .flatMap((player) => player.activityLogs ?? [])
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-60),
    [battleState]
  );

  useEffect(() => {
    const seenIds = battleLogSeenIdsRef.current;
    if (!seenIds) {
      if (!isBattleLoaded) return;
      battleLogSeenIdsRef.current = new Set(battleActivityLogs.map((log) => log.id));
      return;
    }

    const newLogs = battleActivityLogs.filter((log) => !seenIds.has(log.id));
    battleActivityLogs.forEach((log) => seenIds.add(log.id));
    if (!battleLogsVisible || newLogs.length === 0) return;

    setRecentBattleLogs((current) => [...current, ...newLogs].slice(-4));
    newLogs.forEach((log) => {
      const timerId = window.setTimeout(() => {
        setRecentBattleLogs((current) => current.filter((item) => item.id !== log.id));
        battleLogTimersRef.current.delete(log.id);
      }, 5000);
      battleLogTimersRef.current.set(log.id, timerId);
    });
  }, [battleActivityLogs, battleLogsVisible, isBattleLoaded]);

  useLayoutEffect(() => {
    if (!battleLogHistoryOpen || !battleLogHistoryListRef.current) return;
    battleLogHistoryListRef.current.scrollTop = battleLogHistoryListRef.current.scrollHeight;
  }, [battleLogHistoryOpen]);

  useLayoutEffect(() => {
    if (!isBattleLoaded) return;
    const zones = Array.from(
      document.querySelectorAll<HTMLElement>(".bf-player-board > .bf-zone-resolution")
    );
    if (zones.length < 2) return;

    const updateCenter = () => {
      const first = zones[0].getBoundingClientRect();
      const second = zones[1].getBoundingClientRect();
      setBattleLogCenter({
        left: ((first.left + first.right) / 2 + (second.left + second.right) / 2) / 2,
        top: ((first.top + first.bottom) / 2 + (second.top + second.bottom) / 2) / 2
      });
    };

    updateCenter();
    const observer = new ResizeObserver(updateCenter);
    zones.forEach((zone) => observer.observe(zone));
    const stage = document.querySelector<HTMLElement>(".bf-board-stage");
    if (stage) observer.observe(stage);
    window.addEventListener("resize", updateCenter);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateCenter);
    };
  }, [battleState?.id, isBattleLoaded]);

  useEffect(() => () => {
    battleLogTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    battleLogTimersRef.current.clear();
  }, []);

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

  const commandSuggestions = getBattleTextCommandSuggestions(commandInput);
  const isLaevateinnActive = battleState.ruleState.appliedRuleEffectIds.includes(
    "text-command:laevateinn"
  );
  const isHandOpenActive = (
    battleState.players.self.activeEffectIds ?? []
  ).includes("text-command:hand_open");
  const selectedBattleUnitCount = new Set(
    selection.instanceIds.map((instanceId) => {
      const selectedCard = battleCardLookup.get(instanceId)?.card;
      return typeof selectedCard?.meta.compositeId === "string"
        ? `composite:${selectedCard.meta.compositeId}`
        : instanceId;
    })
  ).size;
  const selectedUnitCount = selectedBattleUnitCount + soulSelection.instanceIds.length;

  return (
    <main
      className={`bf-battle-app${battleMenuOpen ? " is-menu-open" : " is-menu-closed"}`}
      onClick={handleBattleBackgroundClick}
    >
      {battleLogsVisible && <section
        className="bf-battle-live-logs"
        style={battleLogCenter ?? undefined}
        aria-label="直近の対戦ログ。ダブルクリックで履歴を表示"
        title="ダブルクリックで直近のログ履歴を表示"
        onDoubleClick={(event) => {
          event.stopPropagation();
          setBattleLogHistoryOpen(true);
        }}
      >
        <header>操作ログ · ダブルクリックで履歴</header>
        {recentBattleLogs.length > 0 && (
          <ol>
            {recentBattleLogs.map((log) => (
              <li key={log.id}>
                <time dateTime={log.createdAt}>
                  {new Date(log.createdAt).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit"
                  })}
                </time>
                <span><small>{log.actorName}</small>{log.message}</span>
              </li>
            ))}
          </ol>
        )}
      </section>}
      {battleLogsVisible && battleLogHistoryOpen && (
        <div
          className="bf-battle-log-history-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setBattleLogHistoryOpen(false);
          }}
        >
          <section
            className="bf-battle-log-history"
            role="dialog"
            aria-modal="true"
            aria-label="対戦ログ履歴"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <strong>対戦ログ履歴</strong>
              <span>最新15件を初期表示 · スクロールで過去のログを確認</span>
              <button type="button" onClick={() => setBattleLogHistoryOpen(false)}>閉じる</button>
            </header>
            <ol ref={battleLogHistoryListRef}>
              {battleActivityLogs.map((log) => (
                <li key={log.id}>
                  <time dateTime={log.createdAt}>
                    {new Date(log.createdAt).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit"
                    })}
                  </time>
                  <span><small>{log.actorName}</small>{log.message}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
      {selectedUnitCount > 1 && (
        <div className="bf-selection-count-badge" aria-live="polite">
          選択中 {selectedUnitCount}枚
        </div>
      )}
      {selectionMode?.type === "zone" && (
        <div className="bf-placement-mode-banner" role="status">
          {selectionMode.title}
          {selectionMode.description && <span>{selectionMode.description}</span>}
        </div>
      )}
      {pendingTextCommandSelection && (
        <div className="bf-placement-mode-banner is-frag-selection" role="status">
          {pendingTextCommandSelection === "frag_new"
            ? "フラッグに新たに重ねる自分のカードを選択してください。"
            : pendingTextCommandSelection === "quenatar"
              ? "裏向きでセンターに出す自分のカードを選択してください。"
              : pendingTextCommandSelection === "hyakugan-heaven"
                ? "手札から天の半身を選択してください。"
                : "手札から地の半身を選択してください。"}
          {specialCommandMessage && <span>{specialCommandMessage}</span>}
          <button
            type="button"
            onClick={() => {
              setPendingTextCommandSelection(null);
              setPendingHyakuganZone(null);
              setPendingHyakuganHeavenId(null);
              setSpecialCommandMessage(
                pendingTextCommandSelection === "frag_new"
                  ? "frag_newをキャンセルしました。"
                  : pendingTextCommandSelection === "quenatar"
                    ? "Quenatarをキャンセルしました。"
                    : "Hyakuganをキャンセルしました。"
              );
            }}
          >
            キャンセル
          </button>
        </div>
      )}
      {isLaevateinnActive && (
        <div className="bf-laevateinn-status" role="status">
          <span>レヴァンティン発動中：アイテム装備数の制限なし</span>
          <button
            type="button"
            onClick={() => {
              executeCommand({
                type: "SET_LAEVATEINN_EFFECT",
                payload: { active: false },
                source: "ability"
              });
              setSpecialCommandMessage("レヴァンティンを解除しました。");
            }}
          >
            解除
          </button>
        </div>
      )}
      <aside className="bf-left-menu" aria-label="対戦操作">
        <button
          type="button"
          className="bf-left-menu-home"
          aria-expanded={battleMenuOpen}
          aria-controls="bf-battle-menu-actions"
          onClick={(event) => {
            event.stopPropagation();
            setBattleMenuOpen((open) => !open);
          }}
        >
          {battleMenuOpen ? "閉じる" : "ホーム"}
        </button>
        <div className="bf-left-menu-brand" aria-label="Baddie Phyto">
          <span>Baddie</span>
          <b>Phyto</b>
        </div>

        <div className="bf-battle-danger-actions" id="bf-battle-menu-actions">
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
          {battleLogsVisible && (
            <button
              type="button"
              aria-expanded={battleLogsOpen}
              onClick={() => setBattleLogsOpen((open) => !open)}
            >
              操作ログ（最新{battleLogDisplayCount}件）
            </button>
          )}
          {battleLogsVisible && battleLogsOpen && (
            <ol className="bf-battle-log-list" aria-label="対戦操作ログ">
              {battleActivityLogs.length > 0 ? (
                battleActivityLogs.slice(-battleLogDisplayCount).reverse().map((log) => (
                  <li key={log.id}>
                    <time dateTime={log.createdAt}>
                      {new Date(log.createdAt).toLocaleTimeString("ja-JP", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </time>
                    <span className="bf-battle-log-copy">
                      <small>{log.actorName}</small>
                      <span>{log.message}</span>
                    </span>
                  </li>
                ))
              ) : (
                <li className="is-empty">まだ操作ログはありません。</li>
              )}
            </ol>
          )}
        </div>
      </aside>

      {commandInputOpen && (
        <form
          className="bf-special-command-inline"
          aria-label="コマンド入力"
          onSubmit={handleSpecialCommandSubmit}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setCommandInputOpen(false);
              setCommandInput("");
              setSpecialCommandMessage("");
            }
          }}
        >
          <input
            id="bf-special-command-input"
            autoFocus
            value={commandInput}
            onChange={(event) => setCommandInput(event.target.value)}
            placeholder="frag_new / frag_reverse / Laevateinn / Quenatar"
            autoComplete="off"
            spellCheck={false}
          />
          {commandSuggestions.length > 0 && (
            <div className="bf-command-suggestions" role="listbox" aria-label="コマンド候補">
              {commandSuggestions.map((suggestion) => (
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  key={suggestion.id}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setCommandInput(suggestion.label);
                    setSpecialCommandMessage("");
                  }}
                >
                  <strong>{suggestion.label}</strong>
                  <span>{suggestion.localizedName}</span>
                </button>
              ))}
            </div>
          )}
          {specialCommandMessage && (
            <p role="status">{specialCommandMessage}</p>
          )}
        </form>
      )}
      {pendingLogSettings && (
        <div
          className="bf-special-command-backdrop"
          role="presentation"
          onClick={(event) => event.stopPropagation()}
        >
          <section
            className="bf-special-command-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bf-log-settings-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="bf-log-settings-title">
              {pendingLogSettings === "visibility" ? "操作ログの表示設定" : "表示件数を選択"}
            </h2>
            {pendingLogSettings === "visibility" ? (
              <div className="bf-special-command-actions">
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    setLogCountInput(String(battleLogDisplayCount));
                    setPendingLogSettings("count");
                  }}
                >
                  表示する
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBattleLogsVisible(false);
                    setBattleLogsOpen(false);
                    setBattleLogHistoryOpen(false);
                    setPendingLogSettings(null);
                  }}
                >
                  非表示にする
                </button>
              </div>
            ) : (
              <form
                className="bf-log-count-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const count = Number.parseInt(logCountInput, 10);
                  if (!Number.isInteger(count) || count < 1 || count > 30) return;
                  setBattleLogDisplayCount(count);
                  setBattleLogsVisible(true);
                  setBattleLogsOpen(true);
                  setBattleMenuOpen(true);
                  setPendingLogSettings(null);
                }}
              >
                <label htmlFor="bf-log-count-input">表示する最新件数（1〜30）</label>
                <input
                  id="bf-log-count-input"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  autoFocus
                  value={logCountInput}
                  onChange={(event) => setLogCountInput(event.target.value)}
                />
                <div className="bf-special-command-actions">
                  <button type="submit" className="primary">設定する</button>
                  <button type="button" onClick={() => setPendingLogSettings(null)}>
                    キャンセル
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
      {!commandInputOpen && specialCommandMessage && !pendingTextCommandSelection && (
        <div className="bf-special-command-status" role="status">
          {specialCommandMessage}
        </div>
      )}

      <BattleBoard
        battleState={battleState}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        sleeveImageUrls={playerSleeveImageUrls}
        playmatImageUrls={playerPlaymatImageUrls}
        activePersistentEffects={activePersistentEffects}
        draggedCard={dragSelection?.sourceCard ?? null}
        draggedInstanceCount={dragSelection?.instanceIds.length ?? 0}
        draggedSoulCard={soulDragSelection?.sourceSoulCard ?? null}
        draggedSoulInstanceCount={soulDragSelection?.instanceIds.length ?? 0}
        selectedInstanceIds={selectedInstanceIds}
        onSelectCard={stableSelectCard}
        onDoubleClickCard={stableDoubleClickCard}
        onContextMenuCard={stableContextMenuCard}
        onDragStartCard={stableDragStartCard}
        onDragEndCard={stableDragEndCard}
        onDropCard={stableDropCard}
        onDoubleClickZone={stableDoubleClickZone}
        onContextMenuZone={stableContextMenuZone}
        onChangeLife={stableChangeSelfLife}
        onRollDice={stableRollSelfDice}
        onClearDice={stableClearSelfDice}
        placementTargetZones={placementTargetZones}
        placementTargetPlayerId={placementTargetPlayerId}
        onPlacementZoneClick={stablePlacementZoneClick}
      />

      <BattleSidebar
        battleState={battleState}
        activeCard={activeCard}
        activeCardPlayerId={activeCardPlayerId}
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
        onCloseViewer={stableCloseViewer}
        onSelectCard={stableSelectCard}
        onToggleViewerPin={stableToggleViewerPin}
        onContextMenuCard={stableContextMenuCard}
        onSelectSoulCard={stableSelectSoulCard}
        onDragStartCard={stableDragStartCard}
        onDragEndCard={stableDragEndCard}
        onDragStartSoulCard={stableDragStartSoulCard}
        onDragEndSoulCard={stableDragEndSoulCard}
        onContextMenuSoulCard={stableContextMenuSoulCard}
        onDoubleClickFaceDownSoul={stableDoubleClickFaceDownSoul}
        onDropCard={stableDropCard}
      />

      {deckContextMenu && (
        <BattleDeckContextMenu
          x={deckContextMenu.x}
          y={deckContextMenu.y}
          onSelect={handleDeckContextMenuSelect}
          onClose={() => setDeckContextMenu(null)}
        />
      )}

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
                <label className="dm-form-label" htmlFor="battle-deck-change-collection">
                  デッキ区分
                  <select
                    id="battle-deck-change-collection"
                    className="dm-input"
                    value={deckChangeCollectionFilter}
                    onChange={(event) => setDeckChangeCollectionFilter(event.target.value as typeof deckChangeCollectionFilter)}
                    disabled={deckChangeLoading}
                  >
                    <option value="all">すべて</option>
                    <option value="private">自分のデッキ</option>
                    <option value="public">共有デッキ</option>
                    <option value="default">サンプルデッキ</option>
                  </select>
                </label>
                <label className="dm-form-label" htmlFor="battle-deck-change-flag">
                  フラッグ
                  <select
                    id="battle-deck-change-flag"
                    className="dm-input"
                    value={deckChangeFlagId}
                    onChange={(event) => setDeckChangeFlagId(event.target.value)}
                    disabled={deckChangeLoading}
                  >
                    <option value="">すべて</option>
                    {changeableFlags.map((flag) => (
                      <option key={flag.id} value={flag.id}>
                        {flag.name ?? "名称未設定"}
                        {flag.usable_worlds.length === 0 ? "（ワールド指定なし）" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
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
          title="上を見る"
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

      {deckViewerOpen && (
        <DeckBrowserPopup
          cards={deckViewerCards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          soulCandidates={soulTargetCandidates}
          title="デッキ一覧"
          description="山札にあるカードの一覧です。"
          mode="browse"
          className="is-deck-viewer"
          canDragCards
          onDragStartCard={handlePopupDragStartCard}
          onDragEndCard={handleDragEndCard}
          onExecute={() => undefined}
          onClose={() => setDeckViewerOpen(false)}
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
