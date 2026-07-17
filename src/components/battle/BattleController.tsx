"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  BattleActionPopup,
  type BattleActionPopupAction
} from "@/components/battle/BattleActionPopup";
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
  createBattleState,
  deleteBattleState,
  loadBattleState,
  saveBattleState
} from "@/lib/battle/battlePersistence";
import { executeBattleCommand } from "@/lib/battle/commands/executeBattleCommand";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";
import { createCommandsFromDeckBrowserRequests } from "@/lib/battle/commands/battleCommandFactory";
import type { DeckBrowserRequest } from "@/lib/battle/deckBrowser/deckBrowserTypes";
import { getAutomaticAbilityCommands } from "@/lib/battle/abilities/battleAbilityDefinitions";
import { createInitialBattleState } from "@/lib/battle/createInitialBattleState";
import {
  buildBattleContextMenu,
  type BattleMenuItem,
  type BattlePlacementSource
} from "@/lib/battle/menus/battleContextMenu";
import type { BattleSelectionMode } from "@/lib/battle/selection/battleSelectionMode";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
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
  BattleState,
  BattleZoneId
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

export function BattleController() {
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId");
  const roomId = searchParams.get("roomId") ?? deckId;
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [deck, setDeck] = useState<DeckRecord | null>(null);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [images, setImages] = useState<CardImageRecord[]>([]);
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
  const [viewerPinned, setViewerPinned] = useState(false);
  const [shortcutSettings, setShortcutSettings] = useState<
    Required<ShortcutSettings>
  >(mergeWithDefaultShortcuts(null));
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const resetSourceRef = useRef<BattleResetSource | null>(null);

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

    if (!(await getOrCreateProfile())) {
      window.location.href = "/login";
      return;
    }

    setLoading(true);
    setMessage("");

    const [deckResult, deckCardsResult, cardResult, imageResult, shortcutResult] =
      await Promise.all([
        loadDeck(deckId),
        loadDeckCards(deckId),
        loadCards(),
        loadCardImages(),
        loadShortcutSettings()
      ]);

    if (
      deckResult.error ||
      deckCardsResult.error ||
      cardResult.error ||
      imageResult.error ||
      !deckResult.data
    ) {
      console.error(
        deckResult.error ??
          deckCardsResult.error ??
          cardResult.error ??
          imageResult.error
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
      const savedBattleStateResult = await loadBattleState(roomId);
      const initialState =
        savedBattleStateResult.data ??
        createInitialBattleState(resetSource);

      if (!savedBattleStateResult.data) {
        const createResult = await createBattleState({
          roomId,
          battleState: initialState
        });
        if (createResult.error) {
          setMessage("BattleStateの初期保存に失敗しました。");
        }
      }

      resetSourceRef.current = resetSource;
      setDeck(deckResult.data);
      setCards((cardResult.data ?? []) as CardRecord[]);
      setImages(imageResult.data ?? []);
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
  }, [deckId, roomId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadBattle();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadBattle]);

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
      cardMap
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

  function executeCommand(command: BattleCommand) {
    if (command.type === "SHUFFLE_DECK") {
      const confirmed = window.confirm("山札をシャッフルします。よろしいですか？");
      if (!confirmed) return;
    }

    setBattleState((current) => {
      if (!current) return current;

      const nextState = applyBattleCommand(current, command);
      if (nextState === current) return current;

      const versionedState = incrementBattleVersion(nextState);
      persistBattleState(versionedState);
      return versionedState;
    });
  }

  function executeCommands(commands: BattleCommand[]) {
    const effectiveCommands = commands.filter(Boolean);
    if (effectiveCommands.length === 0) return;
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
      persistBattleState(versionedState);
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
    handleClearSelection();
    setDragSelection(null);
    setSoulDragSelection(null);
    setPendingDeckDrop(null);
    setPendingActionPopup(null);
    setPendingContextMenu(null);
    setSelectionMode(null);
    setPendingDeckCountPopup(null);
    setPendingBiriKinataPopup(null);
  }

  function handleDeleteRoomState() {
    if (!roomId) return;
    const confirmed = window.confirm(
      "このルームの保存済みBattleStateを削除します。ページを離れると復元できません。よろしいですか？"
    );
    if (!confirmed) return;

    void deleteBattleState(roomId).then((result) => {
      if (result.error) {
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
          isBiriKinataPopupOpen: pendingBiriKinataPopup != null
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

    setSelection((current) => {
      if (!shiftKey) {
        return {
          zoneId: card.zoneId,
          instanceIds: [card.instanceId]
        };
      }

      if (current.zoneId !== card.zoneId) {
        return {
          zoneId: card.zoneId,
          instanceIds: [card.instanceId]
        };
      }

      if (current.instanceIds.includes(card.instanceId)) {
        const nextInstanceIds = current.instanceIds.filter(
          (instanceId) => instanceId !== card.instanceId
        );

        return {
          zoneId: nextInstanceIds.length > 0 ? current.zoneId : null,
          instanceIds: nextInstanceIds
        };
      }

      return {
        zoneId: card.zoneId,
        instanceIds: [...current.instanceIds, card.instanceId]
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

    const items = buildBattleContextMenu(
      card.zoneId === "deck"
        ? {
            kind: "deck",
            topCard: card
          }
        : {
            kind: "card",
            card,
            cardRecord: cardMap.get(card.cardId) ?? null
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

    setPendingContextMenu(null);
  }

  function handleBiriKinataTargetSelect(targetInstanceId: string) {
    if (!pendingBiriKinataPopup) return;

    executeCommand({
      type: "ACTIVATE_BIRI_KINATA",
      payload: {
        sourceInstanceId: pendingBiriKinataPopup.sourceInstanceId,
        targetInstanceId
      }
    });
    setPendingBiriKinataPopup(null);
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

      {pendingBiriKinataPopup && (
        <BiriKinataTargetPopup
          dropCards={battleState.players.opponent.zones.drop.cards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          onSelect={handleBiriKinataTargetSelect}
          onCancel={() => setPendingBiriKinataPopup(null)}
        />
      )}
    </main>
  );
}
