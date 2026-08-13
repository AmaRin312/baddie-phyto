import type { BattleCard, BattleState } from "@/types/battle";

export type BattleCompositeRole = "heaven" | "earth";

export function getBattleCompositeId(card: BattleCard) {
  return typeof card.meta.compositeId === "string"
    ? card.meta.compositeId
    : null;
}

export function getBattleCompositeRole(card: BattleCard): BattleCompositeRole | null {
  return card.meta.compositeRole === "heaven" ||
    card.meta.compositeRole === "earth"
    ? card.meta.compositeRole
    : null;
}

export function isBattleCompositeCard(card: BattleCard) {
  return getBattleCompositeId(card) != null;
}

export function sortBattleCompositeCards(cards: readonly BattleCard[]) {
  return [...cards].sort((left, right) => {
    const leftRole = getBattleCompositeRole(left);
    const rightRole = getBattleCompositeRole(right);
    const leftOrder = leftRole === "heaven" ? 0 : 1;
    const rightOrder = rightRole === "heaven" ? 0 : 1;
    return leftOrder - rightOrder;
  });
}

export function getCompositeGroupCards(
  cards: readonly BattleCard[],
  sourceCard: BattleCard | null | undefined
) {
  if (!sourceCard) return [];
  const compositeId = getBattleCompositeId(sourceCard);
  if (!compositeId) return [];

  return sortBattleCompositeCards(
    cards.filter((card) => getBattleCompositeId(card) === compositeId)
  );
}

export function findCompositeGroupCardsInBattleState(
  state: BattleState,
  sourceCard: BattleCard | null | undefined
) {
  if (!sourceCard) return [];
  const compositeId = getBattleCompositeId(sourceCard);
  if (!compositeId) return [];

  for (const player of Object.values(state.players)) {
    for (const zone of Object.values(player.zones)) {
      const groupCards = getCompositeGroupCards(zone.cards, sourceCard);
      if (groupCards.length > 1) return groupCards;
    }
  }

  return [];
}
