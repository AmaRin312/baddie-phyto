"use client";

import { useEffect, useRef, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
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

function shouldShowFace(card: BattleCard) {
  return card.visibility !== "face_down";
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
  const cardRecord = topCard ? cardMap.get(topCard.cardId) : null;
  const isSelected = topCard ? selectedInstanceIds.has(topCard.instanceId) : false;
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
        ? window.setTimeout(() => {
            setHeldStackId(null);
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
    setHeldStackId((currentStackId) =>
      currentStackId === stackId ? null : currentStackId
    );
  }

  function handleZoneDrop(event: DragEvent<HTMLDivElement>) {
    if (!canDrop) return;
    event.preventDefault();
    event.stopPropagation();
    onDropCard(zoneId);
    setHeldStackId(null);
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
      <div className="bf-zone-title">{label}</div>
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
                className={`bf-card-button bf-resolution-card${isResolutionSelected ? " is-selected" : ""}${isResolutionDragging ? " is-dragging" : ""}`}
                key={battleCard.instanceId}
                draggable={canDragBattleCard({ card: battleCard, playerId })}
                onDragStart={(event) => {
                  event.stopPropagation();
                  if (!canDragBattleCard({ card: battleCard, playerId })) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", battleCard.instanceId);
                  onDragStartCard(battleCard, playerId);
                }}
                onDragEnd={onDragEndCard}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectCard(battleCard, { shiftKey: event.shiftKey, playerId });
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
                />
              </button>
            );
          })}
          {cards.length === 0 && <div className="bf-empty-zone">空</div>}
        </div>
      ) : isAreaStackZone(zoneId) ? (
        <div className="bf-area-stack-zone">
          {areaStacks.map((areaStack) => {
            const areaTopCard = areaStack.topCard;
            const areaCardRecord = cardMap.get(areaTopCard.cardId);
            const compositeCards = getCompositeGroupCards(
              areaStack.cards,
              areaTopCard
            );
            const areaIsSelected = selectedInstanceIds.has(areaTopCard.instanceId);
            const areaIsDragging =
              draggedSingleCard?.instanceId === areaTopCard.instanceId;
            const areaIsRotated = areaTopCard.orientation === "horizontal";
            if (!areaCardRecord) return null;

            return (
              <button
                type="button"
                className={`bf-card-button bf-area-stack-card${areaIsRotated ? " is-rotated" : ""}${areaIsSelected ? " is-selected" : ""}${areaIsDragging ? " is-dragging" : ""}${heldStackId === areaStack.stackId ? " is-new-slot-target" : ""}`}
                key={areaStack.stackId}
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
                onDragStart={(event) => {
                  event.stopPropagation();
                  if (!canDragBattleCard({ card: areaTopCard, playerId })) {
                    event.preventDefault();
                    return;
                  }
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", areaTopCard.instanceId);
                  onDragStartCard(areaTopCard, playerId);
                }}
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
                onContextMenu={(event) =>
                  onContextMenuCard(areaTopCard, event, playerId)
                }
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
          {areaStacks.length === 0 && <div className="bf-empty-zone">遨ｺ</div>}
          {areaStacks.length === 1 && heldStackId && (
            <div className="bf-area-new-slot-preview">2枠目</div>
          )}
        </div>
      ) : (
        <div className={stack ? "bf-stack-zone" : "bf-battle-slot"}>
          {topCard && cardRecord ? (
            <button
              type="button"
              className={`bf-card-button${rotateCard ? " is-rotated" : ""}${isSelected ? " is-selected" : ""}${draggedSingleCard?.instanceId === topCard.instanceId ? " is-dragging" : ""}`}
              draggable={canDragBattleCard({ card: topCard, playerId })}
              onDragStart={(event) => {
                event.stopPropagation();
                if (!canDragBattleCard({ card: topCard, playerId })) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", topCard.instanceId);
                onDragStartCard(topCard, playerId);
              }}
              onDragEnd={onDragEndCard}
              onClick={(event) => {
                event.stopPropagation();
                onSelectCard(topCard, { shiftKey: event.shiftKey, playerId });
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onDoubleClickCard(topCard, { playerId });
              }}
              onContextMenu={(event) => onContextMenuCard(topCard, event, playerId)}
            >
              <BoardCard
                card={cardRecord}
                images={imagesByCard.get(cardRecord.id) ?? []}
                selectedImageId={topCard.selectedImageId}
                isPublic={shouldShowFace(topCard)}
                variant="board"
              />
            </button>
          ) : (
            <div className="bf-empty-zone">遨ｺ</div>
          )}
          {showCount && <span className="bf-count-badge">{cards.length}譫・</span>}
          {revealedDeckCards.length > 0 && (
            <div className="bf-revealed-deck-cards">
              {revealedDeckCards.map((revealedCard) => {
                const revealedCardRecord = cardMap.get(revealedCard.cardId);
                if (!revealedCardRecord) return null;

                return (
                  <button
                    type="button"
                    className="bf-revealed-deck-card"
                    key={revealedCard.instanceId}
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
