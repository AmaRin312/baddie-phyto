"use client";

import { BoardCard } from "@/components/cards/BoardCard";
import { setBattleCardDragImage } from "@/lib/battle/setBattleCardDragImage";
import type { CSSProperties, MouseEvent } from "react";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type SoulCardListProps = {
  parentCard: BattleCard | null;
  position?: { left: number; top: number } | null;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  sleeveImageUrl?: string | null;
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
  onDoubleClickFaceDownSoul: (parentCard: BattleCard, soulCard: BattleCard) => void;
};

export function SoulCardList({
  parentCard,
  position,
  cardMap,
  imagesByCard,
  sleeveImageUrl,
  selectedSoulInstanceIds,
  onSelectSoulCard,
  onDragStartSoulCard,
  onDragEndSoulCard,
  onContextMenuSoulCard,
  onDoubleClickFaceDownSoul
}: SoulCardListProps) {
  if (!parentCard || !position) return null;

  const soulCards = parentCard.soul;
  if (soulCards.length === 0) {
    return <p className="bf-soul-empty">ソウルなし</p>;
  }

  return (
    <div
      className="bf-soul-list is-floating"
      aria-label="ソウル一覧"
      style={{ left: position.left, top: position.top } as CSSProperties}
    >
      <div className="bf-soul-column">
        {soulCards.map((soulCard) => {
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
              onDoubleClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                if (soulCard.visibility === "face_down") {
                  onDoubleClickFaceDownSoul(parentCard, soulCard);
                }
              }}
              onDragStart={(event) => {
                event.stopPropagation();
                setBattleCardDragImage(event.currentTarget, event.dataTransfer);
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
                sleeveImageUrl={sleeveImageUrl}
              />
              <span>
                {soulCard.visibility === "face_down" ? "裏向き" : card.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
