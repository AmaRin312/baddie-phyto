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
import { BattleContextMenu } from "@/components/battle/BattleContextMenu";
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
import {
  buildBattleContextMenu,
  type BattleMenuItem,
  type BattlePlacementSource
} from "@/lib/battle/menus/battleContextMenu";
import type { BattleSelectionMode } from "@/lib/battle/selection/battleSelectionMode";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { loadBattleCardAbilityMap } from "@/lib/cards/cardAbilityActions";
import { loadDeck, loadDeckCards } from "@/lib/decks/deckActions";
import { loadFlag } from "@/lib/flags/flagActions";
import { loadCardImages } from "@/lib/storage/cardImageStorage";
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
import type { CardImageRecord, CardRecord, DeckRecord } from "@/types/baddiePhyto";
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
  source: BattlePlacementSource;
  sourceCard: BattleCard;
  toZone: BattleZoneId;
  targetInstanceId: string;
  x: number;
  y: number;
};

type PendingContextMenu = {
  items: BattleMenuItem[];
  title: string;
  x: number;
  y: number;
  sourceCard?: BattleCard;
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

type PendingHyakuganPopup = {
  sourceInstanceId: string;
  pairCandidates: BattleCard[];
  selectedPairInstanceId: string | null;
};

const PLACEMENT_TARGET_ZONES: ReadonlyArray<BattleZoneId> = [
  "center",
  "left",
  "right",
  "item",
  "set"
];

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

export function BattleController() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId");
  const roomId = searchParams.get("roomId") ?? deckId;
  const selfSeat = normalizeBattlePlayerSeat(
    searchParams.get("seat") ?? searchParams.get("playerSeat")
  );
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
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
  const [pendingContextMenu, setPendingContextMenu] =
    useState<PendingContextMenu | null>(null);
  const [selectionMode, setSelectionMode] = useState<BattleSelectionMode>(null);
  const [pendingDeckCountPopup, setPendingDeckCountPopup] =
    useState<PendingDeckCountPopup | null>(null);
  const [pendingBiriKinataPopup, setPendingBiriKinataPopup] =
    useState<PendingBiriKinataPopup | null>(null);
  const [pendingFaceDownSoulPopup, setPendingFaceDownSoulPopup] =
    useState<PendingFaceDownSoulPopup | null>(null);
  const [pendingHyakuganPopup, setPendingHyakuganPopup] =
    useState<PendingHyakuganPopup | null>(null);
  const [abilityNotifications, setAbilityNotifications] = useState<
    BattleAbilityNotification[]
  >([]);
  const [activeAbilityNotificationId, setActiveAbilityNotificationId] =
    useState<string | null>(null);
  const [showAbilityNotificationList, setShowAbilityNotificationList] =
    useState(false);
  const [viewerPinned, setViewerPinned] = useState(false);
  const [shortcutSettings, setShortcutSettings] = useState<
    Required<ShortcutSettings>
  >(mergeWithDefaultShortcuts(null));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("");
  const [savingSeatKeys, setSavingSeatKeys] = useState<BattlePlayerSeat[]>([]);
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
      cardResult,
      imageResult,
      shortcutResult,
      abilityMapResult
    ] =
      await Promise.all([
        loadDeck(deckId),
        loadDeckCards(deckId),
        loadCards(),
        loadCardImages(),
        loadShortcutSettings(),
        loadBattleCardAbilityMap()
      ]);

    if (
      deckResult.error ||
      deckCardsResult.error ||
      cardResult.error ||
      imageResult.error ||
      abilityMapResult.error ||
      !deckResult.data
    ) {
      console.error(
        deckResult.error ??
          deckCardsResult.error ??
          cardResult.error ??
          imageResult.error ??
          abilityMapResult.error
      );
      setMessage("Battle開始に必要なデッキ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    const flagResult = await loadFlag(deckResult.data.flag_id);
    if (flagResult.error || !flagResult.data) {
      console.error(flagResult.error);
      setMessage("フラッグ情報の読み込みに失敗しました。");
      setLoading(false);
      return;
    }

    try {
      const resetSource: BattleResetSource = {
        flag: flagResult.data,
        buddyCardId: deckResult.data.buddy_card_id,
        deckCards: deckCardsResult.data ?? []
      };
      const freshBattleState = createInitialBattleState(resetSource);
      const savedBattleStateResult = await loadBattleState(roomId);
      const baseState = savedBattleStateResult.data ?? freshBattleState;
      const syncedPlayersResult = selfSeat
        ? await loadSyncedPlayerBattleStates(roomId)
        : { data: {}, error: null };
      const syncedSeats = syncedPlayersResult.data;

      if (!selfSeat) {
        setRealtimeStatus("idle");
        setSyncMessage(
          "Realtime固定席を特定できません。URLに ?seat=player1 または ?seat=player2 を付けるまで、席別同期保存は行いません。"
        );
      }

      const initialState = selfSeat
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

      if (selfSeat && !syncedSeats[selfSeat]) {
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
      setDeck(deckResult.data);
      setCards((cardResult.data ?? []) as CardRecord[]);
      setImages(imageResult.data ?? []);
      setCardAbilityMap(abilityMapResult.data);
      setShortcutSettings(shortcutResult.data);
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
  }, [deckId, roomId, selfSeat]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBattle();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBattle]);

  const isBattleLoaded = battleState != null;

  useEffect(() => {
    if (!roomId || !isBattleLoaded || !selfSeat) return;

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
  }, [isBattleLoaded, roomId, selfSeat]);

  useEffect(() => {
    if (!roomId || !isBattleLoaded || !selfSeat) return;

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
  }, [isBattleLoaded, roomId, selfSeat]);

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

  const activeCard = findBattleCardByInstanceId(
    battleState,
    battleState?.activeViewerCardInstanceId ?? null
  );
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
      "対戦状態を初期状態へリセットします。現在の盤面は保存済み状態も含めて上書きされます。よろしいですか？"
    );
    if (!confirmed) return;

    const nextState = {
      ...createInitialBattleState(resetSourceRef.current),
      version: (battleState?.version ?? 0) + 1
    };
    setBattleState(nextState);
    persistBattleState(nextState);
    if (battleState) {
      persistSelfPlayerState(battleState, nextState);
    }
    handleClearSelection();
    setDragSelection(null);
    setSoulDragSelection(null);
    setPendingDeckDrop(null);
    setPendingActionPopup(null);
    setPendingContextMenu(null);
    setSelectionMode(null);
    setPendingDeckCountPopup(null);
    setPendingBiriKinataPopup(null);
    setPendingFaceDownSoulPopup(null);
    setPendingHyakuganPopup(null);
  }

  function handleDeleteRoomState() {
    if (!roomId) return;
    const confirmed = window.confirm(
      "このルームの保存済みBattleStateを削除します。ページを離れると復元できません。よろしいですか？"
    );
    if (!confirmed) return;

    void Promise.all([
      deleteBattleState(roomId),
      deleteSyncedPlayerBattleStates(roomId)
    ]).then(([battleResult, playerResult]) => {
      if (battleResult.error || playerResult.error) {
        setMessage("ルーム削除に失敗しました。");
        return;
      }

      window.location.href = "/decks";
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
          isContextMenuOpen: pendingContextMenu != null,
          isSelectionModeOpen: selectionMode != null,
          isDeckCountPopupOpen: pendingDeckCountPopup != null,
          isDeckBrowserPopupOpen: lookedDeckCards.length > 0,
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
    pendingActionPopup,
    pendingBiriKinataPopup,
    pendingContextMenu,
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
    executeCommand({
      type: "SET_VIEWER_CARD",
      payload: {
        instanceId
      }
    });
  }

  function handleSelectCard(
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" }
  ) {
    const shiftKey = input?.shiftKey ?? false;
    const playerId = input?.playerId ?? "self";

    setViewer(card.instanceId);
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
    if (!["center", "left", "right", "item"].includes(card.zoneId)) return;

    executeShortcutCommand({
      type: "TOGGLE_CARD_ORIENTATION",
      payload: {
        instanceId: card.instanceId
      }
    });
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

  function handleDragEndCard() {
    setDragSelection(null);
  }

  function handleSelectSoulCard(
    parentCard: BattleCard,
    soulCard: BattleCard,
    input?: { shiftKey?: boolean }
  ) {
    const shiftKey = input?.shiftKey ?? false;

    setViewer(soulCard.instanceId);

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
    parentCard: BattleCard,
    soulCard: BattleCard,
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const selectedCount =
      soulSelection.parentInstanceId === parentCard.instanceId &&
      soulSelection.instanceIds.includes(soulCard.instanceId)
        ? soulSelection.instanceIds.length
        : 1;
    const items = buildBattleContextMenu({
      kind: "soul",
      parentCard,
      soulCard,
      selectedCount,
      selectedSoulInstanceIds:
        selectedCount > 1 ? soulSelection.instanceIds : [soulCard.instanceId]
    });
    if (items.length === 0) return;

    setPendingContextMenu({
      items,
      title: "Soul",
      x: event.clientX,
      y: event.clientY
    });
  }

  function handleContextMenuCard(
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent" = "self"
  ) {
    event.preventDefault();
    event.stopPropagation();
    if (playerId !== "self") return;
    if (!battleState) return;

    const items = buildBattleContextMenu(
      card.zoneId === "deck"
        ? {
            kind: "deck",
            topCard: card
          }
        : {
            kind: "card",
            card,
            cardRecord: cardMap.get(card.cardId) ?? null,
            state: battleState,
            cardAbilityMap
          }
    );
    if (items.length === 0) return;

    setPendingContextMenu({
      items,
      title: card.zoneId === "deck" ? "Deck" : card.zoneId,
      x: event.clientX,
      y: event.clientY,
      sourceCard: card
    });
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
      dragSelection.instanceIds.length === 1 &&
      dragSelection.sourceCard.zoneId === "hand" &&
      isAreaStackZone(toZone) &&
      input.targetInstanceId &&
      input.clientX != null &&
      input.clientY != null
    ) {
      setPendingActionPopup({
        source: {
          kind: "card",
          instanceId: dragSelection.sourceCard.instanceId,
          fromZone: "hand"
        },
        sourceCard: dragSelection.sourceCard,
        toZone,
        targetInstanceId: input.targetInstanceId,
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

  function handleContextCommand(command: BattleCommand) {
    executeCommand(command);

    if (command.type === "SET_VIEWER_CARD") {
      setViewer(command.payload.instanceId, { force: true });
    }

    setPendingContextMenu(null);
  }

  function handleContextPlacement(source: BattlePlacementSource) {
    setSelectionMode({
      type: "zone",
      title: "配置するゾーンを選択してください",
      description: "Center / Left / Right / Item / Set から選択します。",
      allowedZones: PLACEMENT_TARGET_ZONES,
      playerId: "self",
      onSelect: (zoneId, input) =>
        handlePlacementZoneSelect(source, zoneId, {
          x: input?.x,
          y: input?.y
        }),
      onCancel: () => setSelectionMode(null)
    });
    setPendingContextMenu(null);
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

  function handleContextUiAction(item: BattleMenuItem) {
    if (item.uiAction === "showSoul") {
      const activeInstanceId = selection.instanceIds[0] ?? null;
      setViewer(activeInstanceId, { force: true });
    }

    if (item.uiAction === "openDeckLook") {
      setPendingDeckCountPopup({
        mode: "look",
        x: pendingContextMenu?.x ?? window.innerWidth / 2,
        y: pendingContextMenu?.y ?? window.innerHeight / 2
      });
    }

    if (item.uiAction === "openDeckReveal") {
      setPendingDeckCountPopup({
        mode: "reveal",
        x: pendingContextMenu?.x ?? window.innerWidth / 2,
        y: pendingContextMenu?.y ?? window.innerHeight / 2
      });
    }

    if (item.uiAction === "activateBiriKinata" && pendingContextMenu?.sourceCard) {
      setPendingBiriKinataPopup({
        sourceInstanceId: pendingContextMenu.sourceCard.instanceId
      });
    }

    if (
      item.uiAction === "activateFaceDownSoul" &&
      pendingContextMenu?.sourceCard
    ) {
      const sourceInstanceId = pendingContextMenu.sourceCard.instanceId;
      setPendingFaceDownSoulPopup({
        sourceInstanceId,
        candidates: getFaceDownSoulCandidates(sourceInstanceId)
      });
    }

    if (
      item.uiAction === "activateHyakuganComposite" &&
      pendingContextMenu?.sourceCard
    ) {
      const pairCandidates = getHyakuganPairCandidates(pendingContextMenu.sourceCard);
      if (pairCandidates.length === 0) {
        setMessage("同じゾーンにもう片方の半身がありません。");
      } else {
        setPendingHyakuganPopup({
          sourceInstanceId: pendingContextMenu.sourceCard.instanceId,
          pairCandidates,
          selectedPairInstanceId: null
        });
      }
    }

    setPendingContextMenu(null);
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

  function getSourceCard(source: BattlePlacementSource) {
    return findBattleCardByInstanceId(
      battleState,
      source.kind === "card" ? source.instanceId : source.soulInstanceId
    );
  }

  function executePlacementToEmptyArea(
    source: BattlePlacementSource,
    toZone: BattleZoneId
  ) {
    if (source.kind === "card") {
      executeCommand({
        type: "PLACE_AREA_SLOT",
        payload: {
          instanceId: source.instanceId,
          fromZone: source.fromZone,
          toZone
        }
      });
      return;
    }

    executeCommand({
      type: "MOVE_SOUL_CARD",
      payload: {
        parentInstanceId: source.parentInstanceId,
        soulInstanceId: source.soulInstanceId,
        toZone,
        placeAsNewStack: true
      }
    });
  }

  function handlePlacementZoneSelect(
    source: BattlePlacementSource,
    toZone: BattleZoneId,
    input?: { x?: number; y?: number }
  ) {
    if (!battleState || !PLACEMENT_TARGET_ZONES.includes(toZone)) return;

    const sourceCard = getSourceCard(source);
    if (!sourceCard) {
      setSelectionMode(null);
      return;
    }

    const areaStacks = getAreaStacks(battleState.players.self.zones[toZone].cards);
    if (areaStacks.length === 0) {
      executePlacementToEmptyArea(source, toZone);
      setSelectionMode(null);
      return;
    }

    setPendingActionPopup({
      source,
      sourceCard,
      toZone,
      targetInstanceId: areaStacks[0].topCard.instanceId,
      x: input?.x ?? window.innerWidth / 2,
      y: input?.y ?? window.innerHeight / 2
    });
    setSelectionMode(null);
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

  if (!battleState) {
    return (
      <main className="bf-battle-loading">
        <p>{message}</p>
        <Link href="/decks" className="dm-button primary">
          デッキへ戻る
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
      <aside className="bf-left-menu" aria-label="メインメニュー">
        <Link href="/home" className="bf-left-menu-brand">
          <span>Baddie</span>
          <b>Phyto</b>
        </Link>

        <nav className="bf-left-menu-nav">
          <Link href="/home">ホーム</Link>
          <Link href="/cards">カード</Link>
          <Link href="/flags">フラッグ</Link>
          <Link href="/decks">デッキ</Link>
          <Link href={deck ? `/battle?deckId=${deck.id}` : "/battle"} className="is-active">
            対戦
          </Link>
          <Link href="/profile">設定</Link>
        </nav>

        <div className="bf-battle-danger-actions">
          <span>Version {battleState.version ?? 0}</span>
          <span>
            Realtime {realtimeStatus}
            {savingSeatKeys.length > 0
              ? ` / 保存中 ${savingSeatKeys.join(", ")}`
              : ""}
          </span>
          {syncMessage && <span>{syncMessage}</span>}
          <button type="button" onClick={handleResetBattleState}>
            対戦状態リセット
          </button>
          <button type="button" onClick={handleDeleteRoomState}>
            ルーム削除
          </button>
        </div>
      </aside>

      <BattleBoard
        battleState={battleState}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
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
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        draggedCard={dragSelection?.sourceCard ?? null}
        draggedInstanceCount={dragSelection?.instanceIds.length ?? 0}
        draggedSoulCard={soulDragSelection?.sourceSoulCard ?? null}
        draggedSoulInstanceCount={soulDragSelection?.instanceIds.length ?? 0}
        selectedInstanceIds={selectedInstanceIds}
        selectedSoulInstanceIds={selectedSoulInstanceIds}
        viewerPinned={viewerPinned}
        onSelectCard={handleSelectCard}
        onToggleViewerPin={() => setViewerPinned((current) => !current)}
        onContextMenuCard={handleContextMenuCard}
        onSelectSoulCard={handleSelectSoulCard}
        onDragStartCard={handleDragStartCard}
        onDragEndCard={handleDragEndCard}
        onDragStartSoulCard={handleDragStartSoulCard}
        onDragEndSoulCard={handleDragEndSoulCard}
        onContextMenuSoulCard={handleContextMenuSoulCard}
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

      {pendingContextMenu && (
        <BattleContextMenu
          key={`${pendingContextMenu.x}:${pendingContextMenu.y}:${pendingContextMenu.title}`}
          x={pendingContextMenu.x}
          y={pendingContextMenu.y}
          title={pendingContextMenu.title}
          items={pendingContextMenu.items}
          onCommand={handleContextCommand}
          onPlacement={handleContextPlacement}
          onUiAction={handleContextUiAction}
          onCancel={() => setPendingContextMenu(null)}
        />
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
          onExecute={handleDeckBrowserExecute}
          onClose={handleCancelDeckLook}
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
