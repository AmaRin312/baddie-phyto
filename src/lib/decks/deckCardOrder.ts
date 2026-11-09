import type { CardRecord, CardType } from "@/types/baddiePhyto";

const CARD_TYPE_RANK: Record<CardType, number> = {
  monster: 0,
  impact_monster: 1,
  spell: 2,
  item: 3,
  impact: 4,
  flag_card: 5,
  other: 6
};

export function compareDeckCardsFixed(left: CardRecord, right: CardRecord) {
  const typeDifference = CARD_TYPE_RANK[left.card_type] - CARD_TYPE_RANK[right.card_type];
  if (typeDifference !== 0) return typeDifference;

  if (left.card_type === "monster" || left.card_type === "impact_monster") {
    const sizeDifference = (right.size ?? -1) - (left.size ?? -1);
    if (sizeDifference !== 0) return sizeDifference;
  }

  return left.name.localeCompare(right.name, "ja") || left.id.localeCompare(right.id);
}
