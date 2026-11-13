"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent } from "react";
import { BoardCard } from "@/components/cards/BoardCard";
import { BattleCompositeCardView } from "@/components/battle/BattleCompositeCardView";
import {
  canDragBattleCard,
  canDropMultipleCards,
  canDropMultipleSoulCards,
  canDropSingleCard,
  canDropSingleSoulCard,
  getAreaStacks,
  isAreaStackZone
} from "@/lib/battle/battleActions";
import { getCompositeGroupCards } from "@/lib/battle/compositeCards";
import { setBattleCardDragImage } from "@/lib/battle/setBattleCardDragImage";
import type { BattleCard, BattleDropInput, BattleZoneId } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

const SET_AREA_CARDS_PER_COLUMN = 4;
const LAEVATEINN_SET_AREA_CARDS_PER_COLUMN = 2;
const EMPTY_EFFECTS: string[] = [];

type BattleZoneProps = {
  zoneId: BattleZoneId;
  label: string;
  cards: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  sleeveImageUrl?: string | null;
  rotateCard?: boolean;
  stack?: boolean;
  showCount?: boolean;
  activeEffects?: string[];
  laevateinnActive?: boolean;
  playerId: "self" | "opponent";
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent"; anchor?: { right: number; bottom: number } }
  ) => void;
  onDoubleClickCard: (
    card: BattleCard,
    input?: { playerId?: "self" | "opponent" }
  ) => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent"
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
  onDoubleClickZone?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLElement>,
    playerId: "self" | "opponent"
  ) => void;
  onContextMenuZone?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
};

function collectZoneCardIds(cards: readonly BattleCard[]) {
  const cardIds = new Set<string>();
  const visit = (card: BattleCard) => {
    cardIds.add(card.cardId);
    card.soul.forEach(visit);
  };
  cards.forEach(visit);
  return cardIds;
}

function areBattleZonePropsEqual(previous: BattleZoneProps, next: BattleZoneProps) {
  for (const key of Object.keys(previous) as Array<keyof BattleZoneProps>) {
    if (key === "imagesByCard") continue;
    if (!Object.is(previous[key], next[key])) return false;
  }

  const cardIds = collectZoneCardIds(previous.cards);
  for (const cardId of cardIds) {
    if (previous.imagesByCard.get(cardId) !== next.imagesByCard.get(cardId)) {
      return false;
    }
  }
  return true;
}

function shouldShowFace(card: BattleCard) {
  return card.visibility !== "face_down";
}

function shouldPreserveBattleOrientation(zoneId: BattleZoneId) {
  return ["center", "left", "right", "item", "set", "resolution"].includes(
    zoneId
  );
}

function isBattleCardRested(card: BattleCard) {
  if (card.meta.isRested === true) return true;
  if (card.meta.isRested === false) return false;
  return false;
}

function getItemSlotStyle(
  slot: number,
  totalSlots: number,
  laevateinnActive: boolean
): CSSProperties {
  if (!laevateinnActive) {
    return {
      "--bf-item-slot-x": `${slot === 0 && totalSlots === 1 ? 0 : slot === 0 ? -66.5 : 66.5}px`,
      "--bf-item-slot-y": "0px"
    } as CSSProperties;
  }

  // Keep each slot fixed as cards are added; later rows grow upward in groups of seven.
  const spacing = 179;
  const firstRowColumns = [0, 1, -1, 2, -2];
  if (slot < 5) {
    const column = firstRowColumns[slot] ?? 0;
    return {
      "--bf-item-slot-x": `${column * spacing}px`,
      "--bf-item-slot-y": "0px"
    } as CSSProperties;
  }

  const rowOffset = slot - 5;
  const row = Math.floor(rowOffset / 7) + 1;
  const columnIndex = rowOffset % 7;
  const column = [0, 1, -1, 2, -2, 3, -3][columnIndex] ?? 0;
  return {
    "--bf-item-slot-x": `${column * spacing}px`,
    "--bf-item-slot-y": `${-row * spacing}px`
  } as CSSProperties;
}

function BattleZoneComponent({
  zoneId,
  label,
  cards,
  cardMap,
  imagesByCard,
  sleeveImageUrl = null,
  rotateCard = false,
  stack = false,
  showCount = false,
  activeEffects = EMPTY_EFFECTS,
  laevateinnActive = false,
  playerId,
  draggedCard,
  draggedInstanceCount,
  draggedSoulCard,
  draggedSoulInstanceCount,
  selectedInstanceIds,
  onSelectCard,
  onDoubleClickCard,
  onContextMenuCard,
  onDragStartCard,
  onDragEndCard,
  onDropCard,
  onDoubleClickZone,
  onContextMenuZone,
  placementTargetZones,
  placementTargetPlayerId,
  onPlacementZoneClick
}: BattleZoneProps) {
  const holdTimerRef = useRef<number | null>(null);
  const [heldStackId, setHeldStackId] = useState<string | null>(null);
  const [dropTargetStackId, setDropTargetStackId] = useState<string | null>(null);
  const [isDragOverZone, setIsDragOverZone] = useState(false);
  const [selectedSetColumn, setSelectedSetColumn] = useState(0);
  const setZoneRef = useRef<HTMLDivElement | null>(null);
  const [setColumnCenterX, setSetColumnCenterX] = useState<number | null>(null);
  const previousSetStackIdsRef = useRef<Set<string>>(new Set());
  const topCard = (zoneId === "drop" ? cards[cards.length - 1] : cards[0]) ?? null;
  const cardRecord = topCard ? cardMap.get(topCard.cardId) : null;
  const isSelected = topCard ? selectedInstanceIds.has(topCard.instanceId) : false;
  const areaStacks = isAreaStackZone(zoneId) ? getAreaStacks(cards) : [];
  const setCardsPerColumn = laevateinnActive
    ? LAEVATEINN_SET_AREA_CARDS_PER_COLUMN
    : SET_AREA_CARDS_PER_COLUMN;
  const setColumnCount = zoneId === "set"
    ? Math.max(1, Math.ceil((Math.max(-1, ...areaStacks.map((areaStack) => areaStack.areaSlot)) + 1) / setCardsPerColumn))
    : 1;
  const visibleAreaStacks = zoneId === "set"
    ? areaStacks.filter((areaStack) => Math.floor(areaStack.areaSlot / setCardsPerColumn) === selectedSetColumn)
    : areaStacks;
  const visibleSetStackIds = visibleAreaStacks.map((areaStack) => areaStack.stackId).join(",");
  const isPlacementTarget =
    (placementTargetZones?.has(zoneId) ?? false) &&
    (placementTargetPlayerId == null || placementTargetPlayerId === playerId);
  const canDrop =
    zoneId !== "flag" && (
      (draggedSoulCard != null &&
        (draggedSoulInstanceCount > 1
          ? canDropMultipleSoulCards({
              toZone: zoneId,
              targetPlayerId: playerId
            })
          : canDropSingleSoulCard({
              toZone: zoneId,
              targetPlayerId: playerId
            }))) ||
      (draggedCard != null &&
        (draggedInstanceCount > 1
          ? canDropMultipleCards({
              card: draggedCard,
              toZone: zoneId,
              targetPlayerId: playerId
            })
          : canDropSingleCard({
              card: draggedCard,
              toZone: zoneId,
              targetPlayerId: playerId
            })))
    );
  const draggedSingleCard = draggedCard ?? draggedSoulCard;
  const isDraggingCard = draggedCard != null || draggedSoulCard != null;
  const showOwnDragZoneLabel =
    isDraggingCard &&
    playerId === "self" &&
    cards.length === 0 &&
    ["center", "left", "right", "item", "set", "drop", "resolution"].includes(zoneId);
  const draggedItemCount =
    draggedSoulCard != null ? draggedSoulInstanceCount : draggedInstanceCount;
  const hasAreaStackCards = isAreaStackZone(zoneId) && areaStacks.length > 0;
  const preserveBattleOrientation = shouldPreserveBattleOrientation(zoneId);
  const isLaevateinnItemZone =
    zoneId === "item" && playerId === "self" && laevateinnActive;

  function isDisabledSetDropHalf(event: DragEvent<HTMLElement>) {
    if (zoneId !== "set" || !laevateinnActive) return false;
    const zone = event.currentTarget.closest(".bf-zone-set") as HTMLElement | null;
    const activeArea = zone?.querySelector(".bf-set-area-scroll") as HTMLElement | null;
    if (!activeArea) return false;
    const bounds = activeArea.getBoundingClientRect();
    return event.clientX >= bounds.left + bounds.width / 2;
  }

  useEffect(() => {
    if (zoneId !== "set") return;
    const currentIds = new Set(areaStacks.map((areaStack) => areaStack.stackId));
    const previousIds = previousSetStackIdsRef.current;
    const addedStack = previousIds.size > 0
      ? [...areaStacks].reverse().find((areaStack) => !previousIds.has(areaStack.stackId))
      : null;
    previousSetStackIdsRef.current = currentIds;
    setSelectedSetColumn((column) =>
      addedStack
        ? Math.floor(addedStack.areaSlot / setCardsPerColumn)
        : Math.min(column, setColumnCount - 1)
    );
  }, [zoneId, areaStacks, setCardsPerColumn, setColumnCount]);

  useLayoutEffect(() => {
    if (zoneId !== "set" || setColumnCount < 2) return;
    const setZone = setZoneRef.current;
    const board = setZone?.closest(".bf-player-board");
    const flagZone = board?.querySelector(".bf-zone-flag");
    if (!setZone || !board || !flagZone) return;

    const measure = () => {
      const setBounds = setZone.getBoundingClientRect();
      const flagCard = flagZone.querySelector(".bf-card-button") ?? flagZone;
      const flagBounds = flagCard.getBoundingClientRect();
      const setCards = Array.from(
        setZone.querySelectorAll(".bf-area-stack-zone.is-set-area > .bf-area-stack-card")
      );
      const cardCenters = setCards.map((card) => {
        const bounds = card.getBoundingClientRect();
        return bounds.left + bounds.width / 2;
      });
      if (cardCenters.length === 0) return;
      const rightmostCardCenter = Math.max(...cardCenters);
      const flagCenter = flagBounds.left + flagBounds.width / 2;
      const midpoint = (rightmostCardCenter + flagCenter) / 2;
      const x = board.classList.contains("is-mirrored")
        ? setBounds.right - midpoint
        : midpoint - setBounds.left;
      setSetColumnCenterX(x);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(setZone);
    observer.observe(board);
    observer.observe(flagZone);
    setZone.querySelectorAll(".bf-area-stack-zone.is-set-area > .bf-area-stack-card")
      .forEach((card) => observer.observe(card));
    const flagObserver = new MutationObserver(measure);
    flagObserver.observe(flagZone, { childList: true, subtree: true });
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      flagObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [zoneId, setColumnCount, selectedSetColumn, visibleSetStackIds]);

  useEffect(() => {
    const resetTimerId =
      draggedCard == null && draggedSoulCard == null
        ? window.setTimeout(() => {
            setHeldStackId(null);
            setDropTargetStackId(null);
            setIsDragOverZone(false);
          }, 0)
        : null;

    return () => {
      if (resetTimerId != null) {
        window.clearTimeout(resetTimerId);
      }

      if (holdTimerRef.current == null) return;
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    };
  }, [draggedCard, draggedSoulCard]);

  function clearHoldTimer() {
    if (holdTimerRef.current == null) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  function isGaugeOverSetArea(event: DragEvent<HTMLElement>) {
    if (zoneId !== "gauge" || playerId !== "self") return false;
    const setZone = event.currentTarget
      .closest(".bf-player-board")
      ?.querySelector<HTMLElement>(":scope > .bf-zone-set");
    if (!setZone) return false;
    const rect = setZone.getBoundingClientRect();
    return (
      event.clientX >= rect.left && event.clientX < rect.right &&
      event.clientY >= rect.top && event.clientY < rect.bottom
    );
  }

  function handleAreaStackDragEnter(stackId: string) {
    if (!canDrop || !draggedSingleCard || draggedItemCount > 1) return;
    if (areaStacks.length !== 1) return;

    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      setHeldStackId(stackId);
      holdTimerRef.current = null;
    }, 1000);
  }

  function handleAreaStackDragLeave(stackId: string) {
    clearHoldTimer();
    setHeldStackId((currentStackId) =>
      currentStackId === stackId ? null : currentStackId
    );
  }

  function handleZoneDrop(event: DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    if (isDisabledSetDropHalf(event)) {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverZone(false);
      return;
    }
    if (isGaugeOverSetArea(event)) {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverZone(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropCard(zoneId, {
      clientX: event.clientX,
      clientY: event.clientY
    });
    setHeldStackId(null);
    setDropTargetStackId(null);
    setIsDragOverZone(false);
  }

  function handleCardDrop(
    event: DragEvent<HTMLElement>,
    input?: {
      targetInstanceId?: string;
      placeAsNewStack?: boolean;
    }
  ) {
    if (!canDrop) return;
    if (isDisabledSetDropHalf(event)) {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverZone(false);
      setDropTargetStackId(null);
      return;
    }
    if (isGaugeOverSetArea(event)) {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOverZone(false);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    onDropCard(zoneId, {
      ...input,
      clientX: event.clientX,
      clientY: event.clientY
    });
    setHeldStackId(null);
    setDropTargetStackId(null);
    setIsDragOverZone(false);
  }

  return (
    <div
      ref={setZoneRef}
      className={`bf-zone bf-zone-${zoneId}${isLaevateinnItemZone ? " is-laevateinn-active" : ""}${isDraggingCard ? " is-dragging-over-board" : ""}${showOwnDragZoneLabel ? " is-own-drag-label" : ""}${canDrop && isDragOverZone && zoneId !== "gauge" ? " is-drop-target" : ""}${heldStackId ? " is-second-slot-armed" : ""}${isPlacementTarget ? " is-placement-target" : ""}`}
      onClickCapture={(event) => {
        if (!isPlacementTarget || event.button !== 0) return;
        if ((event.target as Element).closest(".bf-set-column-controls")) return;
        event.preventDefault();
        event.stopPropagation();
        onPlacementZoneClick?.(zoneId, event, playerId);
      }}
      onDragOver={(event) => {
        if (!canDrop) return;
        if (isDisabledSetDropHalf(event)) {
          event.stopPropagation();
          setIsDragOverZone(false);
          return;
        }
        if (isGaugeOverSetArea(event)) {
          setIsDragOverZone(false);
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setIsDragOverZone(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget;
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return;
        }
        setIsDragOverZone(false);
      }}
      onDrop={handleZoneDrop}
      onDoubleClick={(event) => {
        if (event.defaultPrevented) return;
        if (zoneId === "deck") return;
        onDoubleClickZone?.(zoneId, event, playerId);
      }}
      onContextMenu={(event) => {
        if (zoneId !== "deck") return;
        event.preventDefault();
        event.stopPropagation();
        onContextMenuZone?.(zoneId, event, playerId);
      }}
    >
      <div className="bf-zone-title">{label}</div>
      {zoneId === "flag" && activeEffects.length > 0 && (
        <div className="bf-active-effects" aria-label="発動中の常在効果">
          {activeEffects.map((effect) => (
            <span key={effect}>{effect}</span>
          ))}
        </div>
      )}
      {zoneId === "resolution" ? (
        <div className="bf-resolution-card-row">
          {cards.map((battleCard) => {
            const card = cardMap.get(battleCard.cardId);
            const isResolutionSelected = selectedInstanceIds.has(
              battleCard.instanceId
            );
            const isResolutionDragging =
              draggedSingleCard?.instanceId === battleCard.instanceId;
            if (!card) return null;

            return (
              <button
                type="button"
                className={`bf-card-button bf-resolution-card${card.orientation === "horizontal" ? " is-native-horizontal" : ""}${isResolutionSelected ? " is-selected" : ""}${isResolutionDragging ? " is-dragging" : ""}`}
                data-battle-card-instance-id={battleCard.instanceId}
                key={battleCard.instanceId}
                draggable={canDragBattleCard({ card: battleCard, playerId })}
                onDragStart={(event) => {
                  event.stopPropagation();
                  if (!canDragBattleCard({ card: battleCard, playerId })) {
                    event.preventDefault();
                    return;
                  }
                  setBattleCardDragImage(event.currentTarget, event.dataTransfer, selectedInstanceIds);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", battleCard.instanceId);
                  onDragStartCard(battleCard, playerId);
                }}
                onDragEnd={onDragEndCard}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onSelectCard(battleCard, {
                    shiftKey: event.shiftKey,
                    playerId,
                    anchor: { right: rect.right, bottom: rect.bottom }
                  });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onDoubleClickCard(battleCard, { playerId });
                }}
                onContextMenu={(event) =>
                  onContextMenuCard(battleCard, event, playerId)
                }
              >
                <BoardCard
                  card={card}
                  images={imagesByCard.get(card.id) ?? []}
                  selectedImageId={battleCard.selectedImageId}
                  isPublic={shouldShowFace(battleCard)}
                  variant="board"
                  sleeveImageUrl={sleeveImageUrl}
                  preserveOrientation={
                    preserveBattleOrientation && card.orientation === "horizontal"
                  }
                />
              </button>
            );
          })}
          {cards.length === 0 && <div className="bf-empty-zone">空</div>}
        </div>
      ) : isAreaStackZone(zoneId) ? (
        <>
        <div className="bf-set-area-scroll">
          <div
            className={`bf-area-stack-zone${zoneId === "set" ? " is-set-area" : ""}`}
          >
          {visibleAreaStacks.map((areaStack) => {
            const areaTopCard = areaStack.topCard;
            const areaCardRecord = cardMap.get(areaTopCard.cardId);
            const compositeCards = getCompositeGroupCards(
              areaStack.cards,
              areaTopCard
            );
            const isHyakuganComposite = compositeCards.some(
              (card) => card.meta.compositeKind === "hyakugan_yamigedo"
            );
            const areaIsSelected = selectedInstanceIds.has(areaTopCard.instanceId);
            const areaIsDragging =
              draggedSingleCard?.instanceId === areaTopCard.instanceId;
            if (!areaCardRecord) return null;
            const areaIsRested = isBattleCardRested(areaTopCard);
            const areaIsNativeHorizontal =
              preserveBattleOrientation && areaCardRecord.orientation === "horizontal";
            const isWideSetCard =
              (areaIsNativeHorizontal && !isHyakuganComposite) || isHyakuganComposite;
            const setSlotIndex = areaStack.areaSlot % setCardsPerColumn;
            const visibleSoulCards =
              areaTopCard.soul.length > 5
                ? areaTopCard.soul.slice(0, 1)
                : areaTopCard.soul;
            const attachedCards = [
              ...areaStack.cards.slice(0, -1),
              ...visibleSoulCards
            ];

            return (
              <button
                type="button"
                className={`bf-card-button bf-area-stack-card${attachedCards.length > 0 ? " has-soul-preview" : ""}${areaIsRested ? " is-rested" : ""}${areaIsNativeHorizontal && !isHyakuganComposite ? " is-native-horizontal" : ""}${isHyakuganComposite ? " is-hyakugan-composite" : ""}${areaIsSelected ? " is-selected" : ""}${areaIsDragging ? " is-dragging" : ""}${hasAreaStackCards && canDrop && dropTargetStackId === areaStack.stackId ? " is-drop-target" : ""}${heldStackId === areaStack.stackId ? " is-new-slot-target" : ""}`}
                  data-battle-card-instance-id={areaTopCard.instanceId}
                key={areaStack.stackId}
                style={
                  zoneId === "item"
                    ? getItemSlotStyle(areaStack.areaSlot, areaStacks.length, isLaevateinnItemZone)
                    : zoneId === "set"
                      ? ({
                          right: laevateinnActive
                            ? `calc(75% - ${0.5 - setSlotIndex} * (var(--bf-battle-card-w) * 0.85 + 6px) - ${isWideSetCard ? "var(--bf-battle-card-h) * 0.425" : "var(--bf-battle-card-w) * 0.425"})`
                            : `calc(50% - ${1.5 - setSlotIndex} * (var(--bf-battle-card-w) * 0.85 + 6px) - ${isWideSetCard ? "var(--bf-battle-card-h) * 0.425" : "var(--bf-battle-card-w) * 0.425"})`,
                          "--bf-set-soul-layers": attachedCards.length
                        } as CSSProperties)
                      : undefined
                }
                draggable={canDragBattleCard({ card: areaTopCard, playerId })}
                onDragEnter={(event) => {
                  if (isDisabledSetDropHalf(event)) {
                    setDropTargetStackId(null);
                    return;
                  }
                  if (canDrop && draggedItemCount <= 1) {
                    setDropTargetStackId(areaStack.stackId);
                  }
                  handleAreaStackDragEnter(areaStack.stackId);
                }}
                onDragLeave={() => {
                  setDropTargetStackId((current) =>
                    current === areaStack.stackId ? null : current
                  );
                  handleAreaStackDragLeave(areaStack.stackId);
                }}
                onDragOver={(event) => {
                  if (!canDrop || draggedItemCount > 1) return;
                  if (isDisabledSetDropHalf(event)) {
                    event.stopPropagation();
                    setIsDragOverZone(false);
                    setDropTargetStackId(null);
                    return;
                  }
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                  setIsDragOverZone(true);
                  setDropTargetStackId(areaStack.stackId);
                }}
                onDrop={(event) => {
                  if (!canDrop || draggedItemCount > 1) return;
                  handleCardDrop(event, {
                    targetInstanceId: areaTopCard.instanceId,
                    placeAsNewStack: heldStackId === areaStack.stackId
                  });
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  if (!canDragBattleCard({ card: areaTopCard, playerId })) {
                    event.preventDefault();
                    return;
                  }
                  setBattleCardDragImage(event.currentTarget, event.dataTransfer, selectedInstanceIds);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", areaTopCard.instanceId);
                  onDragStartCard(areaTopCard, playerId);
                }}
                onDragEnd={() => {
                  clearHoldTimer();
                  setHeldStackId(null);
                  setDropTargetStackId(null);
                  onDragEndCard();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onSelectCard(areaTopCard, {
                    shiftKey: event.shiftKey,
                    playerId,
                    anchor: { right: rect.right, bottom: rect.bottom }
                  });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onDoubleClickCard(areaTopCard, { playerId });
                }}
                onContextMenu={(event) =>
                  onContextMenuCard(areaTopCard, event, playerId)
                }
              >
                {attachedCards.map((soulCard, soulIndex) => {
                  const attachedCardRecord = cardMap.get(soulCard.cardId);
                  if (!attachedCardRecord) return null;

                  return (
                    <span
                      aria-hidden="true"
                      className="bf-attached-soul-card"
                      key={soulCard.instanceId}
                      style={
                        {
                          "--bf-soul-layer": soulIndex + 1,
                          zIndex: attachedCards.length - soulIndex
                        } as CSSProperties
                      }
                    >
                      <BoardCard
                        card={attachedCardRecord}
                        images={imagesByCard.get(attachedCardRecord.id) ?? []}
                        selectedImageId={soulCard.selectedImageId}
                        isPublic={shouldShowFace(soulCard)}
                        variant="board"
                        sleeveImageUrl={sleeveImageUrl}
                      />
                    </span>
                  );
                })}
                {compositeCards.length > 1 ? (
                  <BattleCompositeCardView
                    cards={compositeCards}
                    cardMap={cardMap}
                    imagesByCard={imagesByCard}
                    variant="board"
                  />
                ) : (
                <BoardCard
                  card={areaCardRecord}
                  images={imagesByCard.get(areaCardRecord.id) ?? []}
                  selectedImageId={areaTopCard.selectedImageId}
                  isPublic={zoneId === "gauge" ? false : shouldShowFace(areaTopCard)}
                  variant="board"
                  sleeveImageUrl={sleeveImageUrl}
                  preserveOrientation={areaIsNativeHorizontal}
                />
                  )}
                {areaStack.cards.length > 1 && (
                  <span className="bf-area-stack-badge">{areaStack.cards.length}</span>
                )}
              </button>
            );
          })}
          {areaStacks.length === 0 && <div className="bf-empty-zone">空</div>}
          {areaStacks.length === 1 && heldStackId && (
            <div className="bf-area-new-slot-preview">2枠目</div>
          )}
          </div>
        </div>
        {zoneId === "set" && setColumnCount >= 2 && (
          <div
            className="bf-set-column-controls"
            aria-label="設置エリアの列切り替え"
            style={setColumnCenterX == null ? undefined : {
              "--bf-set-column-center-x": `${setColumnCenterX}px`
            } as CSSProperties}
          >
            {Array.from({ length: setColumnCount }, (_, column) => (
              <button
                type="button"
                className={`bf-set-column-button${selectedSetColumn === column ? " is-active" : ""}`}
                key={column}
                aria-label={`設置エリアの${column + 1}列目を表示`}
                aria-pressed={selectedSetColumn === column}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedSetColumn(column);
                }}
              >
                {column + 1}
              </button>
            ))}
          </div>
        )}
        </>
      ) : (
        <div
          className={`${stack ? "bf-stack-zone" : "bf-battle-slot"}${zoneId === "gauge" && canDrop && isDragOverZone ? cards.length > 0 ? " is-gauge-drop-has-cards" : " is-gauge-drop-empty" : ""}`}
          style={
            zoneId === "gauge"
              ? ({
                  "--bf-gauge-drop-col-offset": `${Math.max(0, Math.ceil(cards.length / 6) - 1) * 50}px`,
                  "--bf-gauge-drop-row-offset": `${Math.max(0, Math.min(cards.length, 6) - 1) * 33}px`
                } as CSSProperties)
              : undefined
          }
        >
          {zoneId === "gauge" && cards.length > 0 ? (
            cards.map((gaugeCard, gaugeIndex) => {
              const gaugeCardRecord = cardMap.get(gaugeCard.cardId);
              if (!gaugeCardRecord) return null;
              const gaugeIsSelected = selectedInstanceIds.has(gaugeCard.instanceId);
              const gaugeIsDragging =
                draggedSingleCard?.instanceId === gaugeCard.instanceId;
              const gaugeStyle = {
                "--bf-gauge-row": String(gaugeIndex % 6),
                "--bf-gauge-column": String(Math.floor(gaugeIndex / 6))
              } as CSSProperties;

              return (
                <button
                  type="button"
                  className={`bf-card-button is-gauge-card${rotateCard ? " is-rotated" : ""}${gaugeIsSelected ? " is-selected" : ""}${gaugeIsDragging ? " is-dragging" : ""}`}
                  data-battle-card-instance-id={gaugeCard.instanceId}
                  draggable={canDragBattleCard({ card: gaugeCard, playerId })}
                  key={gaugeCard.instanceId}
                  style={gaugeStyle}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    if (!canDragBattleCard({ card: gaugeCard, playerId })) {
                      event.preventDefault();
                      return;
                    }
                    setBattleCardDragImage(event.currentTarget, event.dataTransfer, selectedInstanceIds);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", gaugeCard.instanceId);
                    onDragStartCard(gaugeCard, playerId);
                  }}
                  onDragEnd={onDragEndCard}
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    onSelectCard(gaugeCard, {
                      shiftKey: event.shiftKey,
                      playerId,
                      anchor: { right: rect.right, bottom: rect.bottom }
                    });
                  }}
                  onDoubleClick={(event) => {
                    event.stopPropagation();
                    onDoubleClickCard(gaugeCard, { playerId });
                  }}
                  onContextMenu={(event) =>
                    onContextMenuCard(gaugeCard, event, playerId)
                  }
                  onDragOver={(event) => {
                    if (!canDrop) return;
                    if (isGaugeOverSetArea(event)) {
                      setIsDragOverZone(false);
                      return;
                    }
                    event.preventDefault();
                    event.stopPropagation();
                    event.dataTransfer.dropEffect = "move";
                    if (zoneId === "gauge") setIsDragOverZone(true);
                  }}
                  onDrop={(event) =>
                    handleCardDrop(event, { targetInstanceId: gaugeCard.instanceId })
                  }
                >
                  <BoardCard
                    card={gaugeCardRecord}
                    images={imagesByCard.get(gaugeCardRecord.id) ?? []}
                    selectedImageId={gaugeCard.selectedImageId}
                    isPublic={false}
                    variant="board"
                    sleeveImageUrl={sleeveImageUrl}
                  />
                </button>
              );
            })
          ) : topCard && cardRecord ? (
            (() => {
              const isRested = isBattleCardRested(topCard);
              const isNativeHorizontal =
                preserveBattleOrientation && cardRecord.orientation === "horizontal";

              return (
            <button
              type="button"
              className={`bf-card-button${isRested ? " is-rested" : ""}${isNativeHorizontal ? " is-native-horizontal" : ""}${isSelected ? " is-selected" : ""}${draggedSingleCard?.instanceId === topCard.instanceId ? " is-dragging" : ""}`}
              data-battle-card-instance-id={topCard.instanceId}
              draggable={canDragBattleCard({ card: topCard, playerId })}
              onDragStart={(event) => {
                event.stopPropagation();
                if (!canDragBattleCard({ card: topCard, playerId })) {
                  event.preventDefault();
                  return;
                }
                setBattleCardDragImage(event.currentTarget, event.dataTransfer, selectedInstanceIds);
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", topCard.instanceId);
                onDragStartCard(topCard, playerId);
              }}
              onDragEnd={onDragEndCard}
              onClick={(event) => {
                event.stopPropagation();
                const rect = event.currentTarget.getBoundingClientRect();
                onSelectCard(topCard, {
                  shiftKey: event.shiftKey,
                  playerId,
                  anchor: { right: rect.right, bottom: rect.bottom }
                });
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                if (zoneId === "drop") {
                  onDoubleClickZone?.(zoneId, event, playerId);
                  return;
                }
                if (zoneId === "deck") return;
                onDoubleClickCard(topCard, { playerId });
              }}
              onContextMenu={(event) => onContextMenuCard(topCard, event, playerId)}
              onDragOver={(event) => {
                if (!canDrop) return;
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={(event) =>
                handleCardDrop(event, { targetInstanceId: topCard.instanceId })
              }
            >
              <BoardCard
                card={cardRecord}
                images={imagesByCard.get(cardRecord.id) ?? []}
                selectedImageId={topCard.selectedImageId}
                isPublic={zoneId === "gauge" ? false : shouldShowFace(topCard)}
                variant="board"
                sleeveImageUrl={sleeveImageUrl}
                preserveOrientation={isNativeHorizontal}
              />
            </button>
              );
            })()
          ) : (
            <div className="bf-empty-zone">空</div>
          )}
          {showCount && <span className="bf-count-badge">{cards.length}枚</span>}
        </div>
      )}
    </div>
  );
}

export const BattleZone = memo(BattleZoneComponent, areBattleZonePropsEqual);
