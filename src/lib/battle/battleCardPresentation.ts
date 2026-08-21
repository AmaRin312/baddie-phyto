import type { BattleCard } from "@/types/battle";
import type { CardOrientation } from "@/types/baddiePhyto";

export function getBattleCardBaseOrientation(card: BattleCard): CardOrientation {
  return card.meta.baseOrientation === "horizontal" ? "horizontal" : "vertical";
}

export function getBattleCardPresentation(
  card: BattleCard,
  input?: {
    rotateCard?: boolean;
  }
) {
  const rotateCard = input?.rotateCard ?? false;
  const baseOrientation = getBattleCardBaseOrientation(card);
  const isRotated =
    !rotateCard &&
    ((baseOrientation === "vertical" && card.orientation === "horizontal") ||
      (baseOrientation === "horizontal" && card.orientation === "vertical"));
  const isHorizontalBase =
    rotateCard ||
    (baseOrientation === "horizontal" && card.orientation === "horizontal");

  return {
    baseOrientation,
    isRotated,
    isHorizontalBase,
    displayOrientation: rotateCard ? "horizontal" : baseOrientation
  } as const;
}
