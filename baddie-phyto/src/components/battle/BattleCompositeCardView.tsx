"use client";

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

export function BattleCompositeCardView({
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

  return (
    <div
      className={`bf-composite-card-view is-${variant}${isHorizontal ? " is-horizontal" : ""}`}
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
            />
          ) : (
            <CardViewer
              card={cardRecord}
              images={imagesByCard.get(cardRecord.id) ?? []}
              selectedImageId={battleCard.selectedImageId}
              faceDown={battleCard.visibility === "face_down"}
            />
          )}
        </div>
      ))}
    </div>
  );
}
