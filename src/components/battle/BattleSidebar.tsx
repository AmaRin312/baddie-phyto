"use client";

import type { MouseEvent } from "react";
import { BattleCompositeCardView } from "@/components/battle/BattleCompositeCardView";
import { SoulCardList } from "@/components/battle/SoulCardList";
import { BoardCard } from "@/components/cards/BoardCard";
import { CardViewer } from "@/components/cards/CardViewer";
import {
  canDragBattleCard,
  canDropMultipleCards,
  canDropMultipleSoulCards,
  canDropSingleCard,
  canDropSingleSoulCard,
} from "@/lib/battle/battleActions";
import { findCompositeGroupCardsInBattleState } from "@/lib/battle/compositeCards";
import type {
  BattleCard,
  BattleDropInput,
  BattleState,
  BattleZoneId,
} from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleSidebarProps = {
  battleState: BattleState;
  activeCard: BattleCard | null;
  viewerCards: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  selectedSoulInstanceIds: ReadonlySet<string>;
  viewerPinned: boolean;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" },
  ) => void;
  onToggleViewerPin: () => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent",
  ) => void;
  onSelectSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    input?: { shiftKey?: boolean },
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDragStartSoulCard: (parentCard: BattleCard, soulCard: BattleCard) => void;
  onDragEndSoulCard: () => void;
  onContextMenuSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
};

type HandCardsProps = {
  cards: BattleCard[];
  self?: boolean;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" },
  ) => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent",
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
  selectedInstanceIds: ReadonlySet<string>;
};

function HandCards({
  cards,
  self,
  cardMap,
  imagesByCard,
  draggedCard,
  draggedInstanceCount,
  draggedSoulCard,
  draggedSoulInstanceCount,
  selectedInstanceIds,
  onSelectCard,
  onContextMenuCard,
  onDragStartCard,
  onDragEndCard,
  onDropCard,
}: HandCardsProps) {
  const canDropToHand =
    self &&
    ((draggedSoulCard != null &&
      (draggedSoulInstanceCount > 1
        ? canDropMultipleSoulCards({
            toZone: "hand",
            targetPlayerId: "self",
          })
        : canDropSingleSoulCard({
            toZone: "hand",
            targetPlayerId: "self",
          }))) ||
      (draggedCard != null &&
        (draggedInstanceCount > 1
          ? canDropMultipleCards({
              card: draggedCard,
              toZone: "hand",
              targetPlayerId: "self",
            })
          : canDropSingleCard({
              card: draggedCard,
              toZone: "hand",
              targetPlayerId: "self",
            }))));

  return (
    <div
      className={`bf-hand-row${self ? " is-self" : ""}${canDropToHand ? " is-drop-target" : ""}`}
      onDragOver={(event) => {
        if (!canDropToHand) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={(event) => {
        if (!canDropToHand) return;
        event.preventDefault();
        onDropCard("hand");
      }}
    >
      {cards.map((battleCard) => {
        const card = cardMap.get(battleCard.cardId);
        if (!card) return null;

        const playerId = self ? "self" : "opponent";
        const canDrag =
          self &&
          canDragBattleCard({
            card: battleCard,
            playerId,
          });
        const isDragging = draggedCard?.instanceId === battleCard.instanceId;

        return (
          <button
            key={battleCard.instanceId}
            type="button"
            className={`bf-hand-card-button${selectedInstanceIds.has(battleCard.instanceId) ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
            draggable={canDrag}
            onDragStart={(event) => {
              event.stopPropagation();
              if (!canDrag) {
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
              onSelectCard(battleCard, {
                shiftKey: event.shiftKey,
                playerId,
              });
            }}
            onContextMenu={(event) => onContextMenuCard(battleCard, event, playerId)}
          >
            <BoardCard
              card={card}
              images={imagesByCard.get(card.id) ?? []}
              selectedImageId={battleCard.selectedImageId}
              isPublic={self || battleCard.visibility === "public"}
              variant="board"
            />
          </button>
        );
      })}
    </div>
  );
}

export function BattleSidebar({
  battleState,
  activeCard,
  viewerCards,
  cardMap,
  imagesByCard,
  draggedCard,
  draggedInstanceCount,
  draggedSoulCard,
  draggedSoulInstanceCount,
  selectedInstanceIds,
  selectedSoulInstanceIds,
  viewerPinned,
  onSelectCard,
  onToggleViewerPin,
  onContextMenuCard,
  onSelectSoulCard,
  onDragStartCard,
  onDragEndCard,
  onDragStartSoulCard,
  onDragEndSoulCard,
  onContextMenuSoulCard,
  onDropCard,
}: BattleSidebarProps) {
  function renderViewerCard(card: BattleCard) {
    const cardRecord = cardMap.get(card.cardId);
    if (!cardRecord) return null;

    const compositeCards = findCompositeGroupCardsInBattleState(battleState, card);
    if (compositeCards.length > 1) {
      return (
        <BattleCompositeCardView
          cards={compositeCards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          variant="viewer"
        />
      );
    }

    return (
      <CardViewer
        card={cardRecord}
        images={imagesByCard.get(cardRecord.id) ?? []}
        selectedImageId={card.selectedImageId}
        displayOrientation={card.meta.baseOrientation === "horizontal" ? "horizontal" : "vertical"}
      />
    );
  }

  return (
    <aside className="bf-right-panel" aria-label="battle sidebar">
      <section className="bf-side-panel-card">
        <HandCards
          cards={battleState.players.opponent.zones.hand.cards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          draggedCard={draggedCard}
          draggedInstanceCount={draggedInstanceCount}
          draggedSoulCard={draggedSoulCard}
          draggedSoulInstanceCount={draggedSoulInstanceCount}
          selectedInstanceIds={selectedInstanceIds}
          onSelectCard={onSelectCard}
          onContextMenuCard={onContextMenuCard}
          onDragStartCard={onDragStartCard}
          onDragEndCard={onDragEndCard}
          onDropCard={onDropCard}
        />
      </section>

      <section className="bf-side-panel-card bf-viewer-panel">
        <div className="bf-viewer-panel-header">
          <button
            type="button"
            className={`bf-viewer-pin${viewerPinned ? " is-pinned" : ""}`}
            aria-pressed={viewerPinned}
            aria-label={viewerPinned ? "viewer pin off" : "viewer pin on"}
            onClick={(event) => {
              event.stopPropagation();
              onToggleViewerPin();
            }}
          >
            📌
          </button>
        </div>

        <div className="bf-viewer-grid">
          {viewerCards.slice(0, 2).map((viewerCard) => (
            <div key={viewerCard.instanceId} className="bf-viewer-slot">
              {renderViewerCard(viewerCard)}
            </div>
          ))}
        </div>

        <SoulCardList
          parentCard={activeCard}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          selectedSoulInstanceIds={selectedSoulInstanceIds}
          onSelectSoulCard={onSelectSoulCard}
          onDragStartSoulCard={onDragStartSoulCard}
          onDragEndSoulCard={onDragEndSoulCard}
          onContextMenuSoulCard={onContextMenuSoulCard}
        />
      </section>

      <section className="bf-side-panel-card is-self-hand">
        <HandCards
          self
          cards={battleState.players.self.zones.hand.cards}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
          draggedCard={draggedCard}
          draggedInstanceCount={draggedInstanceCount}
          draggedSoulCard={draggedSoulCard}
          draggedSoulInstanceCount={draggedSoulInstanceCount}
          selectedInstanceIds={selectedInstanceIds}
          onSelectCard={onSelectCard}
          onContextMenuCard={onContextMenuCard}
          onDragStartCard={onDragStartCard}
          onDragEndCard={onDragEndCard}
          onDropCard={onDropCard}
        />
      </section>
    </aside>
  );
}
