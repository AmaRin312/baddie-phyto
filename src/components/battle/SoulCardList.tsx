"use client";

import { BoardCard } from "@/components/cards/BoardCard";
import type { MouseEvent } from "react";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type SoulCardListProps = {
  parentCard: BattleCard | null;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  selectedSoulInstanceIds: ReadonlySet<string>;
  onSelectSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    input?: { shiftKey?: boolean }
  ) => void;
  onDragStartSoulCard: (parentCard: BattleCard, soulCard: BattleCard) => void;
  onDragEndSoulCard: () => void;
  onContextMenuSoulCard: (
    parentCard: BattleCard,
    soulCard: BattleCard,
    event: MouseEvent<HTMLButtonElement>
  ) => void;
};

function createSoulColumns(soulCards: BattleCard[]) {
  const columns: BattleCard[][] = [];
  for (let index = 0; index < soulCards.length; index += 8) {
    columns.push(soulCards.slice(index, index + 8));
  }
  return columns;
}

export function SoulCardList({
  parentCard,
  cardMap,
  imagesByCard,
  selectedSoulInstanceIds,
  onSelectSoulCard,
  onDragStartSoulCard,
  onDragEndSoulCard,
  onContextMenuSoulCard
}: SoulCardListProps) {
  if (!parentCard) return null;

  const soulCards = parentCard.soul;
  if (soulCards.length === 0) {
    return <p className="bf-soul-empty">ソウルなし</p>;
  }

  return (
    <div className="bf-soul-list" aria-label="ソウル一覧">
      {createSoulColumns(soulCards).map((column, columnIndex) => (
        <div className="bf-soul-column" key={`soul-column-${columnIndex}`}>
          {column.map((soulCard) => {
            const card = cardMap.get(soulCard.cardId);
            if (!card) return null;

            return (
              <button
                type="button"
                className={`bf-soul-card-button${selectedSoulInstanceIds.has(soulCard.instanceId) ? " is-selected" : ""}`}
                draggable
                key={soulCard.instanceId}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectSoulCard(parentCard, soulCard, {
                    shiftKey: event.shiftKey
                  });
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onContextMenuSoulCard(parentCard, soulCard, event);
                }}
                onDragStart={(event) => {
                  event.stopPropagation();
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", soulCard.instanceId);
                  onDragStartSoulCard(parentCard, soulCard);
                }}
                onDragEnd={onDragEndSoulCard}
              >
                <BoardCard
                  card={card}
                  images={imagesByCard.get(card.id) ?? []}
                  selectedImageId={soulCard.selectedImageId}
                  isPublic={soulCard.visibility !== "face_down"}
                  variant="board"
                />
                <span>{card.name}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
