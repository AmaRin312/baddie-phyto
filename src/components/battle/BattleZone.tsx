"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import { BattleCompositeCardView } from "@/components/battle/BattleCompositeCardView";
import { BoardCard } from "@/components/cards/BoardCard";
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
import type { BattleCard, BattleDropInput, BattleZoneId } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleZoneProps = {
  zoneId: BattleZoneId;
  label: string;
  cards: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  rotateCard?: boolean;
  stack?: boolean;
  showCount?: boolean;
  playerId: "self" | "opponent";
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" }
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
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
};

const EMPTY_ZONE_LABEL = "空";
const GAUGE_CARDS_PER_COLUMN = 10;
const GAUGE_BASE_LEFT = 110;
const GAUGE_BASE_TOP = 48;
const GAUGE_COLUMN_OFFSET = 110;
const GAUGE_ROW_OFFSET = 18;

function shouldShowFace(card: BattleCard) {
  return card.visibility !== "face_down";
}

function shouldRotateBattleCard(card: BattleCard, forceRotate: boolean) {
  return forceRotate || card.orientation === "horizontal";
}

export function BattleZone({
  zoneId,
  label,
  cards,
  cardMap,
  imagesByCard,
  rotateCard = false,
  stack = false,
  showCount = false,
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
  placementTargetZones,
  placementTargetPlayerId,
  onPlacementZoneClick
}: BattleZoneProps) {
  const holdTimerRef = useRef<number | null>(null);
  const [heldStackId, setHeldStackId] = useState<string | null>(null);

  const topCard = cards[0] ?? null;
  const topCardRecord = topCard ? cardMap.get(topCard.cardId) : null;
  const revealedDeckCards =
    zoneId === "deck"
      ? cards.filter((card) => card.meta.deckRevealed === true)
      : [];
  const areaStacks = isAreaStackZone(zoneId) ? getAreaStacks(cards) : [];
  const isPlacementTarget =
    (placementTargetZones?.has(zoneId) ?? false) &&
    (placementTargetPlayerId == null || placementTargetPlayerId === playerId);

  const canDrop =
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
          })));

  const draggedSingleCard = draggedCard ?? draggedSoulCard;
  const draggedItemCount =
    draggedSoulCard != null ? draggedSoulInstanceCount : draggedInstanceCount;

  useEffect(() => {
    const resetTimerId =
      draggedCard == null
        ? window.setTimeout(() => setHeldStackId(null), 0)
        : null;

    return () => {
      if (resetTimerId != null) {
        window.clearTimeout(resetTimerId);
      }

      if (holdTimerRef.current != null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
  }, [draggedCard]);

  function clearHoldTimer() {
    if (holdTimerRef.current == null) return;
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
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
    setHeldStackId((current) => (current === stackId ? null : current));
  }

  function handleZoneDrop(event: DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    event.preventDefault();
    event.stopPropagation();
    onDropCard(zoneId);
    setHeldStackId(null);
  }

  function handleCardDragStart(
    event: DragEvent<HTMLButtonElement>,
    card: BattleCard
  ) {
    event.stopPropagation();
    if (!canDragBattleCard({ card, playerId })) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", card.instanceId);
    onDragStartCard(card, playerId);
  }

  function renderSingleBoardCard(
    battleCard: BattleCard,
    cardRecord: CardRecord,
    className: string,
    input?: {
      style?: React.CSSProperties;
      onDragEnter?: () => void;
      onDragLeave?: () => void;
      onDrop?: (event: DragEvent<HTMLButtonElement>) => void;
      onDragEnd?: () => void;
      badge?: React.ReactNode;
    }
  ) {
    const isSelected = selectedInstanceIds.has(battleCard.instanceId);
    const isDragging = draggedSingleCard?.instanceId === battleCard.instanceId;
    const isRotated = shouldRotateBattleCard(battleCard, rotateCard);

    return (
      <button
        type="button"
        className={`${className}${isRotated ? " is-rotated" : ""}${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
        style={input?.style}
        draggable={canDragBattleCard({ card: battleCard, playerId })}
        onDragEnter={input?.onDragEnter}
        onDragLeave={input?.onDragLeave}
        onDragOver={(event) => {
          if (input?.onDrop == null) return;
          if (!canDrop || draggedItemCount > 1) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={input?.onDrop}
        onDragStart={(event) => handleCardDragStart(event, battleCard)}
        onDragEnd={() => {
          input?.onDragEnd?.();
          onDragEndCard();
        }}
        onClick={(event) => {
          event.stopPropagation();
          onSelectCard(battleCard, { shiftKey: event.shiftKey, playerId });
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onDoubleClickCard(battleCard, { playerId });
        }}
        onContextMenu={(event) => onContextMenuCard(battleCard, event, playerId)}
      >
        <BoardCard
          card={cardRecord}
          images={imagesByCard.get(cardRecord.id) ?? []}
          selectedImageId={battleCard.selectedImageId}
          isPublic={shouldShowFace(battleCard)}
          variant="board"
        />
        {input?.badge}
      </button>
    );
  }

  function renderEmptyZone() {
    return <div className="bf-empty-zone">{EMPTY_ZONE_LABEL}</div>;
  }

  return (
    <div
      className={`bf-zone bf-zone-${zoneId}${canDrop ? " is-drop-target" : ""}${heldStackId ? " is-second-slot-armed" : ""}${isPlacementTarget ? " is-placement-target" : ""}`}
      onClickCapture={(event) => {
        if (!isPlacementTarget || event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        onPlacementZoneClick?.(zoneId, event, playerId);
      }}
      onDragOver={(event) => {
        if (!canDrop) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={handleZoneDrop}
    >
      {(canDrop || isPlacementTarget) && <div className="bf-zone-title">{label}</div>}

      {zoneId === "resolution" ? (
        <div className="bf-resolution-card-row">
          {cards.map((battleCard) => {
            const card = cardMap.get(battleCard.cardId);
            if (!card) return null;

            return renderSingleBoardCard(
              battleCard,
              card,
              "bf-card-button bf-resolution-card"
            );
          })}
          {cards.length === 0 && renderEmptyZone()}
        </div>
      ) : zoneId === "gauge" ? (
        <div className="bf-gauge-grid">
          {cards.map((battleCard, index) => {
            const card = cardMap.get(battleCard.cardId);
            if (!card) return null;

            const columnIndex = Math.floor(index / GAUGE_CARDS_PER_COLUMN);
            const rowIndex = index % GAUGE_CARDS_PER_COLUMN;
            const left = GAUGE_BASE_LEFT - columnIndex * GAUGE_COLUMN_OFFSET;
            const top = GAUGE_BASE_TOP + rowIndex * GAUGE_ROW_OFFSET;

            return renderSingleBoardCard(
              battleCard,
              card,
              "bf-card-button bf-gauge-card",
              {
                style: { left: `${left}px`, top: `${top}px` }
              }
            );
          })}
          {cards.length === 0 && renderEmptyZone()}
        </div>
      ) : isAreaStackZone(zoneId) ? (
        <div className="bf-area-stack-zone">
          {areaStacks.map((areaStack) => {
            const areaTopCard = areaStack.topCard;
            const areaCardRecord = cardMap.get(areaTopCard.cardId);
            if (!areaCardRecord) return null;

            const compositeCards = getCompositeGroupCards(
              areaStack.cards,
              areaTopCard
            );
            const isSelected = selectedInstanceIds.has(areaTopCard.instanceId);
            const isDragging =
              draggedSingleCard?.instanceId === areaTopCard.instanceId;
            const isRotated = shouldRotateBattleCard(areaTopCard, rotateCard);

            return (
              <button
                key={areaStack.stackId}
                type="button"
                className={`bf-card-button bf-area-stack-card${isRotated ? " is-rotated" : ""}${isSelected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}${heldStackId === areaStack.stackId ? " is-new-slot-target" : ""}`}
                draggable={canDragBattleCard({ card: areaTopCard, playerId })}
                onDragEnter={() => handleAreaStackDragEnter(areaStack.stackId)}
                onDragLeave={() => handleAreaStackDragLeave(areaStack.stackId)}
                onDragOver={(event) => {
                  if (!canDrop || draggedItemCount > 1) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDrop={(event) => {
                  if (!canDrop || draggedItemCount > 1) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onDropCard(zoneId, {
                    targetInstanceId: areaTopCard.instanceId,
                    placeAsNewStack: heldStackId === areaStack.stackId,
                    clientX: event.clientX,
                    clientY: event.clientY
                  });
                  setHeldStackId(null);
                }}
                onDragStart={(event) => handleCardDragStart(event, areaTopCard)}
                onDragEnd={() => {
                  clearHoldTimer();
                  setHeldStackId(null);
                  onDragEndCard();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectCard(areaTopCard, { shiftKey: event.shiftKey, playerId });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  onDoubleClickCard(areaTopCard, { playerId });
                }}
                onContextMenu={(event) => onContextMenuCard(areaTopCard, event, playerId)}
              >
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
                    isPublic={shouldShowFace(areaTopCard)}
                    variant="board"
                  />
                )}
                {areaStack.cards.length > 1 && (
                  <span className="bf-area-stack-badge">{areaStack.cards.length}</span>
                )}
              </button>
            );
          })}
          {areaStacks.length === 0 && renderEmptyZone()}
          {areaStacks.length === 1 && heldStackId && (
            <div className="bf-area-new-slot-preview">2枚目</div>
          )}
        </div>
      ) : (
        <div className={stack ? "bf-stack-zone" : "bf-battle-slot"}>
          {topCard && topCardRecord
            ? renderSingleBoardCard(topCard, topCardRecord, "bf-card-button")
            : renderEmptyZone()}

          {showCount && <span className="bf-count-badge">{cards.length}枚</span>}

          {revealedDeckCards.length > 0 && (
            <div className="bf-revealed-deck-cards">
              {revealedDeckCards.map((revealedCard) => {
                const revealedCardRecord = cardMap.get(revealedCard.cardId);
                if (!revealedCardRecord) return null;

                return (
                  <button
                    key={revealedCard.instanceId}
                    type="button"
                    className="bf-revealed-deck-card"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectCard(revealedCard, {
                        shiftKey: event.shiftKey,
                        playerId
                      });
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onDoubleClickCard(revealedCard, { playerId });
                    }}
                    onContextMenu={(event) =>
                      onContextMenuCard(revealedCard, event, playerId)
                    }
                  >
                    <BoardCard
                      card={revealedCardRecord}
                      images={imagesByCard.get(revealedCardRecord.id) ?? []}
                      selectedImageId={revealedCard.selectedImageId}
                      isPublic
                      variant="board"
                    />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
