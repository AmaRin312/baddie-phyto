"use client";

import { memo } from "react";
import { BoardCard } from "@/components/cards/BoardCard";
import { CardViewer } from "@/components/cards/CardViewer";
import { getBattleCompositeRole } from "@/lib/battle/compositeCards";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleCompositeCardViewProps = {
  cards: readonly BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  variant: "board" | "viewer";
};

function getRoleLabel(card: BattleCard) {
  const role = getBattleCompositeRole(card);
  if (role === "heaven") return "天";
  if (role === "earth") return "地";
  return "";
}

function BattleCompositeCardViewComponent({
  cards,
  cardMap,
  imagesByCard,
  variant
}: BattleCompositeCardViewProps) {
  const visibleCards = cards
    .map((battleCard) => ({
      battleCard,
      cardRecord: cardMap.get(battleCard.cardId) ?? null
    }))
    .filter(
      (entry): entry is { battleCard: BattleCard; cardRecord: CardRecord } =>
        entry.cardRecord != null
    );

  if (visibleCards.length === 0) return null;

  const isHorizontal = visibleCards.some(
    ({ battleCard }) => battleCard.orientation === "horizontal"
  );
  const isHyakugan = visibleCards.some(
    ({ battleCard }) => battleCard.meta.compositeKind === "hyakugan_yamigedo"
  );

  return (
    <div
      className={`bf-composite-card-view is-${variant}${isHorizontal ? " is-horizontal" : ""}${isHyakugan ? " is-hyakugan" : ""}`}
    >
      {visibleCards.map(({ battleCard, cardRecord }) => (
        <div
          className="bf-composite-card-piece"
          key={battleCard.instanceId}
          data-role={getRoleLabel(battleCard)}
        >
          {variant === "board" ? (
            <BoardCard
              card={cardRecord}
              images={imagesByCard.get(cardRecord.id) ?? []}
              selectedImageId={battleCard.selectedImageId}
              isPublic={battleCard.visibility !== "face_down"}
              variant="board"
              preserveOrientation
            />
          ) : (
            <CardViewer
              card={cardRecord}
              images={imagesByCard.get(cardRecord.id) ?? []}
              selectedImageId={battleCard.selectedImageId}
              faceDown={battleCard.visibility === "face_down"}
              preserveOrientation
            />
          )}
        </div>
      ))}
    </div>
  );
}

function areCompositeCardsEqual(
  previousCards: readonly BattleCard[],
  nextCards: readonly BattleCard[]
) {
  return (
    previousCards.length === nextCards.length &&
    previousCards.every((previous, index) => {
      const next = nextCards[index];
      return (
        next != null &&
        previous.instanceId === next.instanceId &&
        previous.cardId === next.cardId &&
        previous.selectedImageId === next.selectedImageId &&
        previous.visibility === next.visibility &&
        previous.orientation === next.orientation &&
        previous.meta.compositeRole === next.meta.compositeRole &&
        previous.meta.compositeKind === next.meta.compositeKind
      );
    })
  );
}

export const BattleCompositeCardView = memo(
  BattleCompositeCardViewComponent,
  (previous, next) => {
    if (
      previous.variant !== next.variant ||
      previous.cardMap !== next.cardMap ||
      !areCompositeCardsEqual(previous.cards, next.cards)
    ) {
      return false;
    }

    return previous.cards.every((card) =>
      previous.imagesByCard.get(card.cardId) === next.imagesByCard.get(card.cardId)
    );
  }
);
