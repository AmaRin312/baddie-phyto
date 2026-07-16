"use client";

import { CardViewer } from "@/components/cards/CardViewer";
import { BoardCard } from "@/components/cards/BoardCard";
import { SoulCardList } from "@/components/battle/SoulCardList";
import {
  canDragBattleCard,
  canDropMultipleCards,
  canDropMultipleSoulCards,
  canDropSingleCard,
  canDropSingleSoulCard
} from "@/lib/battle/battleActions";
import type { MouseEvent } from "react";
import type {
  BattleCard,
  BattleDropInput,
  BattleState,
  BattleZoneId
} from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleSidebarProps = {
  battleState: BattleState;
  activeCard: BattleCard | null;
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
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" }
  ) => void;
  onToggleViewerPin: () => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent"
  ) => void;
  onSelectSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    input?: { shiftKey?: boolean }
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDragStartSoulCard: (parentCard: BattleCard, soulCard: BattleCard) => void;
  onDragEndSoulCard: () => void;
  onContextMenuSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
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
  onDropCard
}: {
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
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" }
  ) => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent"
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
  selectedInstanceIds: ReadonlySet<string>;
}) {
  const canDropToHand =
    self &&
    ((draggedSoulCard != null &&
      (draggedSoulInstanceCount > 1
        ? canDropMultipleSoulCards({
            toZone: "hand",
            targetPlayerId: "self"
          })
        : canDropSingleSoulCard({
            toZone: "hand",
            targetPlayerId: "self"
          }))) ||
      (draggedCard != null &&
    (draggedInstanceCount > 1
      ? canDropMultipleCards({
          card: draggedCard,
          toZone: "hand",
          targetPlayerId: "self"
        })
      : canDropSingleCard({
          card: draggedCard,
          toZone: "hand",
          targetPlayerId: "self"
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
        const isDragging = draggedCard?.instanceId === battleCard.instanceId;
        return (
          <button
            type="button"
            className={`bf-hand-card-button${selectedInstanceIds.has(battleCard.instanceId) ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
            key={battleCard.instanceId}
            draggable={
              self &&
              canDragBattleCard({
                card: battleCard,
                playerId: self ? "self" : "opponent"
              })
            }
            onDragStart={(event) => {
              event.stopPropagation();
              if (
                !self ||
                !canDragBattleCard({
                  card: battleCard,
                  playerId: self ? "self" : "opponent"
                })
              ) {
                event.preventDefault();
                return;
              }
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", battleCard.instanceId);
              onDragStartCard(battleCard, self ? "self" : "opponent");
            }}
            onDragEnd={onDragEndCard}
            onClick={(event) => {
              event.stopPropagation();
              onSelectCard(battleCard, {
                shiftKey: event.shiftKey,
                playerId: self ? "self" : "opponent"
              });
            }}
            onContextMenu={(event) =>
              onContextMenuCard(battleCard, event, self ? "self" : "opponent")
            }
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
      {cards.length === 0 && <p className="bf-hand-empty">0枚</p>}
    </div>
  );
}

export function BattleSidebar({
  battleState,
  activeCard,
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
  onDropCard
}: BattleSidebarProps) {
  const activeCardRecord = activeCard ? cardMap.get(activeCard.cardId) : null;

  return (
    <aside className="bf-right-panel" aria-label="手札とビューアー">
      <section className="bf-side-panel-card">
        <h2>相手 手札</h2>
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
          <h2>ビューアー</h2>
          <button
            type="button"
            className={`bf-viewer-pin${viewerPinned ? " is-pinned" : ""}`}
            aria-pressed={viewerPinned}
            onClick={(event) => {
              event.stopPropagation();
              onToggleViewerPin();
            }}
          >
            📌
          </button>
        </div>
        <div className="bf-single-viewer">
          {activeCard && activeCardRecord ? (
            <CardViewer
              card={activeCardRecord}
              images={imagesByCard.get(activeCardRecord.id) ?? []}
              selectedImageId={activeCard.selectedImageId}
            />
          ) : (
            <p className="bf-viewer-empty">カードをクリックすると表示します。</p>
          )}
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
        <h2>自分 手札</h2>
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
