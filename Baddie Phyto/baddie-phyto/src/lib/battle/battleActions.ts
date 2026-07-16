import type {
  BattleAreaSlot,
  BattleCard,
  BattlePlayerId,
  BattleState,
  BattleZoneId,
  PlayerState
} from "@/types/battle";

export const MOVABLE_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "hand",
  "gauge",
  "drop",
  "deck",
  "item",
  "set",
  "center",
  "left",
  "right",
  "resolution"
]);

export const DRAGGABLE_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "hand",
  "gauge",
  "drop",
  "item",
  "set",
  "center",
  "left",
  "right",
  "resolution"
]);

export const DROPPABLE_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "hand",
  "gauge",
  "drop",
  "deck",
  "item",
  "set",
  "center",
  "left",
  "right",
  "resolution"
]);

export const AREA_STACK_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "center",
  "left",
  "right",
  "item",
  "set"
]);

export const MULTIPLE_CARD_DROPPABLE_ZONE_IDS: ReadonlySet<BattleZoneId> =
  new Set(["hand", "gauge", "drop", "deck", "resolution"]);

export const SINGLE_SOUL_DROPPABLE_ZONE_IDS: ReadonlySet<BattleZoneId> = new Set([
  "hand",
  "gauge",
  "drop",
  "deck",
  "center",
  "left",
  "right",
  "item",
  "set",
  "resolution"
]);

export const MULTIPLE_SOUL_DROPPABLE_ZONE_IDS: ReadonlySet<BattleZoneId> =
  new Set(["hand", "gauge", "drop", "deck", "resolution"]);

type LocatedBattleCard = {
  playerId: BattlePlayerId;
  zoneId: BattleZoneId;
  index: number;
  card: BattleCard;
};

export type BattleAreaStack = {
  stackId: string;
  areaSlot: BattleAreaSlot;
  cards: BattleCard[];
  topCard: BattleCard;
};

export type DeckPosition = "top" | "bottom";

export type MoveCardInput = {
  instanceId: string;
  fromZone?: BattleZoneId;
  toZone: BattleZoneId;
  index?: number;
  deckPosition?: DeckPosition;
};

export type MoveCardsInput = {
  instanceIds: string[];
  toZone: BattleZoneId;
  index?: number;
  deckPosition?: DeckPosition;
};

export type StackCardOnAreaCardInput = {
  instanceId: string;
  fromZone?: BattleZoneId;
  toZone: BattleZoneId;
  targetInstanceId: string;
};

export type PlaceCardInAreaSlotInput = {
  instanceId: string;
  fromZone?: BattleZoneId;
  toZone: BattleZoneId;
};

export type PlaceOrStackAreaCardInput = {
  instanceId: string;
  fromZone: BattleZoneId;
  toZone: BattleZoneId;
  targetInstanceId?: string;
};

export type MoveAreaStackToSlotInput = {
  playerId?: BattlePlayerId;
  zoneId: BattleZoneId;
  stackId: string;
  areaSlot: BattleAreaSlot;
};

export type SwapAreaStacksInput = {
  playerId?: BattlePlayerId;
  zoneId: BattleZoneId;
  firstStackId: string;
  secondStackId: string;
};

export type LocatedSoulCard = {
  playerId: BattlePlayerId;
  parentZoneId: BattleZoneId;
  parentIndex: number;
  parentCard: BattleCard;
  soulIndex: number;
  soulCard: BattleCard;
};

export type MoveSoulCardInput = {
  parentInstanceId: string;
  soulInstanceId: string;
  toZone: BattleZoneId;
  deckPosition?: DeckPosition;
  targetInstanceId?: string;
  placeAsNewStack?: boolean;
};

export type MoveSoulCardsInput = {
  parentInstanceId: string;
  soulInstanceIds: string[];
  toZone: BattleZoneId;
  deckPosition?: DeckPosition;
};

export type AddSoulCardInput = {
  instanceId: string;
  fromZone?: BattleZoneId;
  targetInstanceId: string;
  visibility: Extract<BattleCard["visibility"], "public" | "face_down">;
};

export type LookTopDeckInput = {
  playerId: BattlePlayerId;
  count: number;
};

export type RevealDeckCardsInput = {
  playerId: BattlePlayerId;
  count?: number;
  instanceId?: string;
};

export type MoveRevealedCardInput = {
  instanceId: string;
  toZone: BattleZoneId;
  deckPosition?: DeckPosition;
  targetInstanceId?: string;
  placeAsNewStack?: boolean;
};

export type ReturnLookedCardsInput = {
  playerId: BattlePlayerId;
  instanceIds: string[];
  deckPosition: DeckPosition;
};

export type ReorderLookedCardsInput = {
  playerId: BattlePlayerId;
  instanceIds: string[];
};

export type ClearDeckLookInput = {
  playerId: BattlePlayerId;
};

export type PlaceAsFlagInput = {
  instanceId: string;
  fromZone?: BattleZoneId;
};

export type ApplyRuleChangeInput = {
  effectId: string;
  itemLimit?: number | null;
};

export type ActivateBiriKinataInput = {
  sourceInstanceId: string;
  targetInstanceId: string;
};

export type ChangeLifeInput = {
  playerId: BattlePlayerId;
  amount: number;
};

export type MoveSoulToSoulInput = {
  parentInstanceId: string;
  soulInstanceId: string;
  targetInstanceId: string;
  visibility: Extract<BattleCard["visibility"], "public" | "face_down">;
};

function getVisibilityForZone(zoneId: BattleZoneId): BattleCard["visibility"] {
  if (zoneId === "deck") return "face_down";
  if (zoneId === "hand") return "private";
  return "public";
}

function getVisibilityForSoulMove(zoneId: BattleZoneId): BattleCard["visibility"] {
  if (zoneId === "deck") return "face_down";
  return "public";
}

function getAreaStackId(card: BattleCard) {
  return typeof card.meta.areaStackId === "string"
    ? card.meta.areaStackId
    : card.instanceId;
}

function getAreaSlot(card: BattleCard): BattleAreaSlot | null {
  return card.meta.areaSlot === 0 || card.meta.areaSlot === 1
    ? card.meta.areaSlot
    : null;
}

function withAreaStackData(
  card: BattleCard,
  stackId: string,
  areaSlot: BattleAreaSlot
): BattleCard {
  return {
    ...card,
    meta: {
      ...card.meta,
      areaStackId: stackId,
      areaSlot
    }
  };
}

function withoutAreaStackData(card: BattleCard): BattleCard {
  const meta = { ...card.meta };
  delete meta.areaStackId;
  delete meta.areaSlot;
  return {
    ...card,
    meta
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    life: { ...player.life },
    zones: Object.fromEntries(
      Object.entries(player.zones).map(([zoneId, zone]) => [
        zoneId,
        {
          ...zone,
          cards: [...zone.cards]
        }
      ])
    ) as PlayerState["zones"]
  };
}

function cloneBattleState(state: BattleState): BattleState {
  return {
    ...state,
    players: {
      self: clonePlayer(state.players.self),
      opponent: clonePlayer(state.players.opponent)
    },
    ruleState: {
      itemLimit: state.ruleState.itemLimit,
      appliedRuleEffectIds: [...state.ruleState.appliedRuleEffectIds]
    },
    deckLook: state.deckLook
      ? {
          playerId: state.deckLook.playerId,
          instanceIds: [...state.deckLook.instanceIds]
        }
      : null,
    meta: { ...state.meta }
  };
}

function withoutDeckRevealData(card: BattleCard): BattleCard {
  const meta = { ...card.meta };
  delete meta.deckRevealed;
  return {
    ...card,
    meta
  };
}

function cleanupDeckLookForMovedCard(state: BattleState, instanceId: string) {
  if (!state.deckLook) return;
  state.deckLook.instanceIds = state.deckLook.instanceIds.filter(
    (lookedInstanceId) => lookedInstanceId !== instanceId
  );
  if (state.deckLook.instanceIds.length === 0) {
    state.deckLook = null;
  }
}

export function findBattleCard(
  state: BattleState,
  instanceId: string
): LocatedBattleCard | null {
  for (const player of Object.values(state.players)) {
    for (const zone of Object.values(player.zones)) {
      const index = zone.cards.findIndex((card) => card.instanceId === instanceId);
      if (index >= 0) {
        return {
          playerId: player.id,
          zoneId: zone.id,
          index,
          card: zone.cards[index]
        };
      }
    }
  }

  return null;
}

export function findSoulCard(
  state: BattleState,
  input: {
    parentInstanceId: string;
    soulInstanceId: string;
  }
): LocatedSoulCard | null {
  for (const player of Object.values(state.players)) {
    for (const zone of Object.values(player.zones)) {
      const parentIndex = zone.cards.findIndex(
        (card) => card.instanceId === input.parentInstanceId
      );
      if (parentIndex < 0) continue;

      const parentCard = zone.cards[parentIndex];
      const soulIndex = parentCard.soul.findIndex(
        (card) => card.instanceId === input.soulInstanceId
      );
      if (soulIndex < 0) return null;

      return {
        playerId: player.id,
        parentZoneId: zone.id,
        parentIndex,
        parentCard,
        soulIndex,
        soulCard: parentCard.soul[soulIndex]
      };
    }
  }

  return null;
}

export function getSoulCards(parentCard: BattleCard | null | undefined) {
  return parentCard?.soul ?? [];
}

function getLocatedCardsInBattleOrder(
  state: BattleState,
  instanceIds: string[]
): LocatedBattleCard[] {
  const requestedIds = new Set(instanceIds);
  const locatedCards: LocatedBattleCard[] = [];

  for (const player of Object.values(state.players)) {
    for (const zone of Object.values(player.zones)) {
      zone.cards.forEach((card, index) => {
        if (!requestedIds.has(card.instanceId)) return;

        locatedCards.push({
          playerId: player.id,
          zoneId: zone.id,
          index,
          card
        });
      });
    }
  }

  return locatedCards;
}

function getMoveInsertIndex(
  input: MoveCardInput,
  toCardsLength: number
): number {
  if (input.index != null) {
    return Math.max(0, Math.min(input.index, toCardsLength));
  }

  if (input.toZone === "deck" && input.deckPosition === "top") {
    return 0;
  }

  return toCardsLength;
}

export function isAreaStackZone(zoneId: BattleZoneId) {
  return AREA_STACK_ZONE_IDS.has(zoneId);
}

export function getAreaStacks(cards: BattleCard[]): BattleAreaStack[] {
  const stackMap = new Map<
    string,
    { cards: BattleCard[]; fallbackSlot: BattleAreaSlot; explicitSlot: BattleAreaSlot | null }
  >();

  for (const [index, card] of cards.entries()) {
    const stackId = getAreaStackId(card);
    const existingStack = stackMap.get(stackId);
    const fallbackSlot = Math.min(index, 1) as BattleAreaSlot;
    const explicitSlot = getAreaSlot(card);

    stackMap.set(stackId, {
      cards: [...(existingStack?.cards ?? []), card],
      fallbackSlot: existingStack?.fallbackSlot ?? fallbackSlot,
      explicitSlot: existingStack?.explicitSlot ?? explicitSlot
    });
  }

  return Array.from(stackMap.entries())
    .map(([stackId, stack]) => ({
      stackId,
      areaSlot: stack.explicitSlot ?? stack.fallbackSlot,
      cards: stack.cards,
      topCard: stack.cards[stack.cards.length - 1]
    }))
    .sort((leftStack, rightStack) => leftStack.areaSlot - rightStack.areaSlot);
}

export function canMoveFromZone(zoneId: BattleZoneId) {
  return MOVABLE_ZONE_IDS.has(zoneId);
}

export function canMoveToZone(zoneId: BattleZoneId) {
  return DROPPABLE_ZONE_IDS.has(zoneId);
}

export function canDragBattleCard(input: {
  card: BattleCard;
  playerId: BattlePlayerId;
}) {
  return input.playerId === "self" && DRAGGABLE_ZONE_IDS.has(input.card.zoneId);
}

export function canDropBattleCard(input: {
  card: BattleCard;
  toZone: BattleZoneId;
  targetPlayerId: BattlePlayerId;
}) {
  return canDropSingleCard(input);
}

export function canDropSingleCard(input: {
  card: BattleCard;
  toZone: BattleZoneId;
  targetPlayerId: BattlePlayerId;
}) {
  return (
    input.targetPlayerId === "self" &&
    DROPPABLE_ZONE_IDS.has(input.toZone)
  );
}

export function canDropMultipleCards(input: {
  card: BattleCard;
  toZone: BattleZoneId;
  targetPlayerId: BattlePlayerId;
}) {
  return (
    input.targetPlayerId === "self" &&
    MULTIPLE_CARD_DROPPABLE_ZONE_IDS.has(input.toZone)
  );
}

export function canDropSingleSoulCard(input: {
  toZone: BattleZoneId;
  targetPlayerId: BattlePlayerId;
}) {
  return (
    input.targetPlayerId === "self" &&
    SINGLE_SOUL_DROPPABLE_ZONE_IDS.has(input.toZone)
  );
}

export function canDropMultipleSoulCards(input: {
  toZone: BattleZoneId;
  targetPlayerId: BattlePlayerId;
}) {
  return (
    input.targetPlayerId === "self" &&
    MULTIPLE_SOUL_DROPPABLE_ZONE_IDS.has(input.toZone)
  );
}

function normalizeSoulCardForZone(
  card: BattleCard,
  input: {
    toZone: BattleZoneId;
    areaStackId?: string;
    areaSlot?: BattleAreaSlot;
  }
): BattleCard {
  const movedCard: BattleCard = {
    ...card,
    zoneId: input.toZone,
    visibility: getVisibilityForSoulMove(input.toZone),
    meta: { ...card.meta }
  };

  if (!isAreaStackZone(input.toZone)) {
    return withoutAreaStackData(movedCard);
  }

  return withAreaStackData(
    movedCard,
    input.areaStackId ?? getAreaStackId(movedCard),
    input.areaSlot ?? 0
  );
}

export function moveCard(state: BattleState, input: MoveCardInput): BattleState {
  const located = findBattleCard(state, input.instanceId);
  if (!located) return state;
  if (input.fromZone && located.zoneId !== input.fromZone) return state;
  if (!canMoveFromZone(located.zoneId) || !canMoveToZone(input.toZone)) return state;

  const nextState = cloneBattleState(state);
  const player = nextState.players[located.playerId];
  const fromCards = player.zones[located.zoneId].cards;
  const [removedCard] = fromCards.splice(located.index, 1);
  if (!removedCard) return state;

  const movedCard: BattleCard = {
    ...removedCard,
    zoneId: input.toZone,
    visibility: getVisibilityForZone(input.toZone),
    meta: { ...removedCard.meta }
  };
  const revealNormalizedMovedCard =
    input.toZone === "deck" ? movedCard : withoutDeckRevealData(movedCard);
  const toCards = player.zones[input.toZone].cards;
  const targetAreaStacks = isAreaStackZone(input.toZone)
    ? getAreaStacks(toCards)
    : [];
  const nextAreaSlot: BattleAreaSlot =
    targetAreaStacks.some((areaStack) => areaStack.areaSlot === 0) ? 1 : 0;
  const normalizedMovedCard = isAreaStackZone(input.toZone)
    ? withAreaStackData(
        revealNormalizedMovedCard,
        getAreaStackId(revealNormalizedMovedCard),
        nextAreaSlot
      )
    : withoutAreaStackData(revealNormalizedMovedCard);
  const nextIndex = getMoveInsertIndex(input, toCards.length);

  toCards.splice(nextIndex, 0, normalizedMovedCard);
  if (located.zoneId === "deck" && input.toZone !== "deck") {
    cleanupDeckLookForMovedCard(nextState, input.instanceId);
  }
  return nextState;
}

export function stackCardOnAreaCard(
  state: BattleState,
  input: StackCardOnAreaCardInput
): BattleState {
  if (!isAreaStackZone(input.toZone)) return state;

  const located = findBattleCard(state, input.instanceId);
  const target = findBattleCard(state, input.targetInstanceId);
  if (!located || !target) return state;
  if (located.card.instanceId === target.card.instanceId) return state;
  if (input.fromZone && located.zoneId !== input.fromZone) return state;
  if (target.zoneId !== input.toZone) return state;
  if (!canMoveFromZone(located.zoneId) || !canMoveToZone(input.toZone)) return state;

  const targetStackId = getAreaStackId(target.card);
  const targetAreaSlot = getAreaSlot(target.card);
  const targetAreaStacks = getAreaStacks(
    state.players[target.playerId].zones[input.toZone].cards
  );
  const fallbackTargetStack = targetAreaStacks.find(
    (areaStack) => areaStack.stackId === targetStackId
  );
  const nextState = cloneBattleState(state);
  const player = nextState.players[located.playerId];
  const fromCards = player.zones[located.zoneId].cards;
  const fromIndex = fromCards.findIndex(
    (card) => card.instanceId === input.instanceId
  );
  const [removedCard] = fromCards.splice(fromIndex, 1);
  if (!removedCard) return state;

  const movedCard = withAreaStackData(
    withoutDeckRevealData({
      ...removedCard,
      zoneId: input.toZone,
      visibility: getVisibilityForZone(input.toZone),
      meta: { ...removedCard.meta }
    }),
    targetStackId,
    targetAreaSlot ?? fallbackTargetStack?.areaSlot ?? 0
  );

  player.zones[input.toZone].cards.push(movedCard);
  if (located.zoneId === "deck") {
    cleanupDeckLookForMovedCard(nextState, input.instanceId);
  }
  return nextState;
}

export function placeCardInAreaSlot(
  state: BattleState,
  input: PlaceCardInAreaSlotInput
): BattleState {
  if (!isAreaStackZone(input.toZone)) return state;

  const located = findBattleCard(state, input.instanceId);
  if (!located) return state;
  if (input.fromZone && located.zoneId !== input.fromZone) return state;
  if (!canMoveFromZone(located.zoneId) || !canMoveToZone(input.toZone)) return state;

  const targetCards = state.players[located.playerId].zones[input.toZone].cards;
  const areaStacks = getAreaStacks(targetCards);
  if (areaStacks.length >= 2) return state;

  const nextState = cloneBattleState(state);
  const player = nextState.players[located.playerId];
  const fromCards = player.zones[located.zoneId].cards;
  const fromIndex = fromCards.findIndex(
    (card) => card.instanceId === input.instanceId
  );
  const [removedCard] = fromCards.splice(fromIndex, 1);
  if (!removedCard) return state;

  const stackId = `area-stack:${input.toZone}:${removedCard.instanceId}`;
  const areaSlot: BattleAreaSlot = areaStacks.some(
    (areaStack) => areaStack.areaSlot === 0
  )
    ? 1
    : 0;
  const movedCard = withAreaStackData(
    withoutDeckRevealData({
      ...removedCard,
      zoneId: input.toZone,
      visibility: getVisibilityForZone(input.toZone),
      meta: { ...removedCard.meta }
    }),
    stackId,
    areaSlot
  );

  player.zones[input.toZone].cards.push(movedCard);
  if (located.zoneId === "deck") {
    cleanupDeckLookForMovedCard(nextState, input.instanceId);
  }
  return nextState;
}

export function placeOrStackAreaCard(
  state: BattleState,
  input: PlaceOrStackAreaCardInput
): BattleState {
  const source = findBattleCard(state, input.instanceId);
  if (!source) return state;

  if (input.targetInstanceId) {
    const stacks = getAreaStacks(state.players[source.playerId].zones[input.toZone].cards);
    const sourceStack = stacks.find((areaStack) =>
      areaStack.cards.some((card) => card.instanceId === input.instanceId)
    );
    const targetStack = stacks.find((areaStack) =>
      areaStack.cards.some((card) => card.instanceId === input.targetInstanceId)
    );

    if (
      source.zoneId === input.toZone &&
      sourceStack &&
      targetStack &&
      sourceStack.stackId !== targetStack.stackId
    ) {
      return swapAreaStacks(state, {
        playerId: source.playerId,
        zoneId: input.toZone,
        firstStackId: sourceStack.stackId,
        secondStackId: targetStack.stackId
      });
    }

    return stackCardOnAreaCard(state, {
      instanceId: input.instanceId,
      fromZone: input.fromZone,
      toZone: input.toZone,
      targetInstanceId: input.targetInstanceId
    });
  }

  const stacks = getAreaStacks(state.players[source.playerId].zones[input.toZone].cards);
  if (stacks.length === 0) {
    return placeCardInAreaSlot(state, input);
  }

  if (stacks.length === 1) {
    return stackCardOnAreaCard(state, {
      instanceId: input.instanceId,
      fromZone: input.fromZone,
      toZone: input.toZone,
      targetInstanceId: stacks[0].topCard.instanceId
    });
  }

  return state;
}

export function swapAreaStacks(
  state: BattleState,
  input: SwapAreaStacksInput
): BattleState {
  if (!isAreaStackZone(input.zoneId)) return state;
  if (input.firstStackId === input.secondStackId) return state;

  const playerId = input.playerId ?? "self";
  const areaStacks = getAreaStacks(state.players[playerId].zones[input.zoneId].cards);
  const firstStack = areaStacks.find(
    (areaStack) => areaStack.stackId === input.firstStackId
  );
  const secondStack = areaStacks.find(
    (areaStack) => areaStack.stackId === input.secondStackId
  );
  if (!firstStack || !secondStack) return state;

  const nextState = cloneBattleState(state);
  const zoneCards = nextState.players[playerId].zones[input.zoneId].cards;

  nextState.players[playerId].zones[input.zoneId].cards = zoneCards.map((card) => {
    const stackId = getAreaStackId(card);
    if (stackId === input.firstStackId) {
      return withAreaStackData(card, stackId, secondStack.areaSlot);
    }

    if (stackId === input.secondStackId) {
      return withAreaStackData(card, stackId, firstStack.areaSlot);
    }

    return card;
  });

  return nextState;
}

export function moveAreaStackToSlot(
  state: BattleState,
  input: MoveAreaStackToSlotInput
): BattleState {
  if (!isAreaStackZone(input.zoneId)) return state;

  const playerId = input.playerId ?? "self";
  const areaStacks = getAreaStacks(state.players[playerId].zones[input.zoneId].cards);
  const sourceStack = areaStacks.find(
    (areaStack) => areaStack.stackId === input.stackId
  );
  if (!sourceStack) return state;
  if (sourceStack.areaSlot === input.areaSlot) return state;

  const targetStack = areaStacks.find(
    (areaStack) => areaStack.areaSlot === input.areaSlot
  );

  if (targetStack) {
    return swapAreaStacks(state, {
      playerId,
      zoneId: input.zoneId,
      firstStackId: sourceStack.stackId,
      secondStackId: targetStack.stackId
    });
  }

  const nextState = cloneBattleState(state);
  const zoneCards = nextState.players[playerId].zones[input.zoneId].cards;

  nextState.players[playerId].zones[input.zoneId].cards = zoneCards.map((card) => {
    const stackId = getAreaStackId(card);
    if (stackId !== input.stackId) return card;
    return withAreaStackData(card, stackId, input.areaSlot);
  });

  return nextState;
}

export function addSoulCard(
  state: BattleState,
  input: AddSoulCardInput
): BattleState {
  const located = findBattleCard(state, input.instanceId);
  const target = findBattleCard(state, input.targetInstanceId);
  if (!located || !target) return state;
  if (located.card.instanceId === target.card.instanceId) return state;
  if (input.fromZone && located.zoneId !== input.fromZone) return state;
  if (!canMoveFromZone(located.zoneId)) return state;
  if (target.playerId !== located.playerId) return state;
  if (target.card.soul.some((card) => card.instanceId === located.card.instanceId)) {
    return state;
  }

  const nextState = cloneBattleState(state);
  const player = nextState.players[located.playerId];
  const fromCards = player.zones[located.zoneId].cards;
  const fromIndex = fromCards.findIndex(
    (card) => card.instanceId === input.instanceId
  );
  const [removedCard] = fromCards.splice(fromIndex, 1);
  if (!removedCard) return state;

  const targetCards = player.zones[target.zoneId].cards;
  const targetCard = targetCards.find(
    (card) => card.instanceId === input.targetInstanceId
  );
  if (!targetCard) return state;

  targetCard.soul.push(
    withoutAreaStackData({
      ...withoutDeckRevealData(removedCard),
      zoneId: target.zoneId,
      visibility: input.visibility,
      meta: { ...withoutDeckRevealData(removedCard).meta }
    })
  );

  if (located.zoneId === "deck") {
    cleanupDeckLookForMovedCard(nextState, input.instanceId);
  }
  return nextState;
}

export function addSoulCardFaceUp(
  state: BattleState,
  input: Omit<AddSoulCardInput, "visibility">
): BattleState {
  return addSoulCard(state, {
    ...input,
    visibility: "public"
  });
}

export function addSoulCardFaceDown(
  state: BattleState,
  input: Omit<AddSoulCardInput, "visibility">
): BattleState {
  return addSoulCard(state, {
    ...input,
    visibility: "face_down"
  });
}

export function moveSoulToSoul(
  state: BattleState,
  input: MoveSoulToSoulInput
): BattleState {
  const located = findSoulCard(state, {
    parentInstanceId: input.parentInstanceId,
    soulInstanceId: input.soulInstanceId
  });
  const target = findBattleCard(state, input.targetInstanceId);
  if (!located || !target) return state;
  if (located.soulCard.instanceId === target.card.instanceId) return state;
  if (located.playerId !== target.playerId) return state;
  if (target.card.soul.some((card) => card.instanceId === located.soulCard.instanceId)) {
    return state;
  }

  const nextState = cloneBattleState(state);
  const parentCards = nextState.players[located.playerId].zones[located.parentZoneId].cards;
  const parentCard = parentCards[located.parentIndex];
  const [removedSoulCard] = parentCard.soul.splice(located.soulIndex, 1);
  if (!removedSoulCard) return state;

  const targetCards = nextState.players[target.playerId].zones[target.zoneId].cards;
  const targetCard = targetCards.find(
    (card) => card.instanceId === input.targetInstanceId
  );
  if (!targetCard) return state;

  targetCard.soul.push(
    withoutAreaStackData({
      ...removedSoulCard,
      zoneId: target.zoneId,
      visibility: input.visibility,
      meta: { ...removedSoulCard.meta }
    })
  );

  return nextState;
}

export function moveSoulToSoulFaceUp(
  state: BattleState,
  input: Omit<MoveSoulToSoulInput, "visibility">
): BattleState {
  return moveSoulToSoul(state, {
    ...input,
    visibility: "public"
  });
}

export function moveSoulToSoulFaceDown(
  state: BattleState,
  input: Omit<MoveSoulToSoulInput, "visibility">
): BattleState {
  return moveSoulToSoul(state, {
    ...input,
    visibility: "face_down"
  });
}

function getAreaPlacementForSoulCard(
  state: BattleState,
  input: {
    playerId: BattlePlayerId;
    toZone: BattleZoneId;
    targetInstanceId?: string;
    placeAsNewStack?: boolean;
    sourceInstanceId: string;
  }
): { areaStackId: string; areaSlot: BattleAreaSlot } | null {
  const areaStacks = getAreaStacks(state.players[input.playerId].zones[input.toZone].cards);

  if (input.targetInstanceId && !input.placeAsNewStack) {
    const targetStack = areaStacks.find((areaStack) =>
      areaStack.cards.some((card) => card.instanceId === input.targetInstanceId)
    );
    if (!targetStack) return null;
    return {
      areaStackId: targetStack.stackId,
      areaSlot: targetStack.areaSlot
    };
  }

  if (areaStacks.length >= 2) return null;

  if (!input.placeAsNewStack && areaStacks.length === 1) {
    return {
      areaStackId: areaStacks[0].stackId,
      areaSlot: areaStacks[0].areaSlot
    };
  }

  return {
    areaStackId: `area-stack:${input.toZone}:${input.sourceInstanceId}`,
    areaSlot: areaStacks.some((areaStack) => areaStack.areaSlot === 0) ? 1 : 0
  };
}

export function moveSoulCard(
  state: BattleState,
  input: MoveSoulCardInput
): BattleState {
  const located = findSoulCard(state, {
    parentInstanceId: input.parentInstanceId,
    soulInstanceId: input.soulInstanceId
  });
  if (!located) return state;
  if (!canDropSingleSoulCard({ toZone: input.toZone, targetPlayerId: located.playerId })) {
    return state;
  }

  const areaPlacement = isAreaStackZone(input.toZone)
    ? getAreaPlacementForSoulCard(state, {
        playerId: located.playerId,
        toZone: input.toZone,
        targetInstanceId: input.targetInstanceId,
        placeAsNewStack: input.placeAsNewStack,
        sourceInstanceId: input.soulInstanceId
      })
    : null;
  if (isAreaStackZone(input.toZone) && !areaPlacement) return state;

  const nextState = cloneBattleState(state);
  const parentCards = nextState.players[located.playerId].zones[located.parentZoneId].cards;
  const parentCard = parentCards[located.parentIndex];
  const [removedSoulCard] = parentCard.soul.splice(located.soulIndex, 1);
  if (!removedSoulCard) return state;

  const movedSoulCard = normalizeSoulCardForZone(removedSoulCard, {
    toZone: input.toZone,
    areaStackId: areaPlacement?.areaStackId,
    areaSlot: areaPlacement?.areaSlot
  });
  const toCards = nextState.players[located.playerId].zones[input.toZone].cards;
  const insertIndex =
    input.toZone === "deck" && input.deckPosition === "top" ? 0 : toCards.length;

  toCards.splice(insertIndex, 0, movedSoulCard);
  return nextState;
}

export function moveSoulCards(
  state: BattleState,
  input: MoveSoulCardsInput
): BattleState {
  const firstLocated = findSoulCard(state, {
    parentInstanceId: input.parentInstanceId,
    soulInstanceId: input.soulInstanceIds[0] ?? ""
  });
  if (!firstLocated) return state;
  if (
    !canDropMultipleSoulCards({
      toZone: input.toZone,
      targetPlayerId: firstLocated.playerId
    })
  ) {
    return state;
  }

  const requestedIds = new Set(input.soulInstanceIds);
  const parentSoul = firstLocated.parentCard.soul;
  const orderedSoulCards = parentSoul.filter((card) =>
    requestedIds.has(card.instanceId)
  );
  if (orderedSoulCards.length === 0) return state;

  const nextState = cloneBattleState(state);
  const parentCards =
    nextState.players[firstLocated.playerId].zones[firstLocated.parentZoneId].cards;
  const parentCard = parentCards[firstLocated.parentIndex];
  parentCard.soul = parentCard.soul.filter(
    (card) => !requestedIds.has(card.instanceId)
  );

  const movedSoulCards = orderedSoulCards.map((card) =>
    normalizeSoulCardForZone(card, { toZone: input.toZone })
  );
  const toCards = nextState.players[firstLocated.playerId].zones[input.toZone].cards;

  if (input.toZone === "deck" && input.deckPosition === "top") {
    toCards.splice(0, 0, ...movedSoulCards);
  } else {
    toCards.push(...movedSoulCards);
  }

  return nextState;
}

export function moveCards(state: BattleState, input: MoveCardsInput): BattleState {
  const locatedCards = getLocatedCardsInBattleOrder(state, input.instanceIds);

  return locatedCards.reduce(
    (current, locatedCard, offset) => {
      const shouldForceDeckTopOrder =
        input.toZone === "deck" &&
        input.deckPosition === "top" &&
        input.index == null;

      return moveCard(current, {
        instanceId: locatedCard.card.instanceId,
        fromZone: locatedCard.zoneId,
        toZone: input.toZone,
        index:
          input.index == null
            ? shouldForceDeckTopOrder
            ? offset
            : undefined
            : input.index + offset,
        deckPosition: shouldForceDeckTopOrder ? undefined : input.deckPosition
      });
    },
    state
  );
}

export function moveTopDeckCard(
  state: BattleState,
  input: {
    playerId: BattlePlayerId;
    toZone: BattleZoneId;
  }
) {
  const topCard = state.players[input.playerId].zones.deck.cards[0];
  if (!topCard) return state;
  return moveCard(state, {
    instanceId: topCard.instanceId,
    fromZone: "deck",
    toZone: input.toZone
  });
}

export function drawCard(
  state: BattleState,
  input: {
    playerId: BattlePlayerId;
    count?: number;
  }
) {
  const count = input.count ?? 1;
  let nextState = state;
  for (let index = 0; index < count; index += 1) {
    nextState = moveTopDeckCard(nextState, {
      playerId: input.playerId,
      toZone: "hand"
    });
  }
  return nextState;
}

export function moveAllCards(
  state: BattleState,
  input: {
    playerId: BattlePlayerId;
    fromZone: BattleZoneId;
    toZone: BattleZoneId;
    deckPosition?: DeckPosition;
  }
) {
  const instanceIds = state.players[input.playerId].zones[input.fromZone].cards.map(
    (card) => card.instanceId
  );
  return moveCards(state, {
    instanceIds,
    toZone: input.toZone,
    deckPosition: input.deckPosition
  });
}

export function shuffleDeck(
  state: BattleState,
  input: {
    playerId: BattlePlayerId;
    random?: () => number;
  }
) {
  const random = input.random ?? Math.random;
  const nextState = cloneBattleState(state);
  const deckCards = nextState.players[input.playerId].zones.deck.cards;

  for (let index = deckCards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deckCards[index], deckCards[swapIndex]] = [
      deckCards[swapIndex],
      deckCards[index]
    ];
  }

  return nextState;
}

export function toggleCardOrientation(
  state: BattleState,
  input: {
    instanceId: string;
  }
): BattleState {
  const located = findBattleCard(state, input.instanceId);
  if (!located) return state;

  const nextState = cloneBattleState(state);
  const card = nextState.players[located.playerId].zones[located.zoneId].cards[
    located.index
  ];
  card.orientation = card.orientation === "horizontal" ? "vertical" : "horizontal";
  return nextState;
}

export function changeLife(
  state: BattleState,
  input: ChangeLifeInput
): BattleState {
  const nextState = cloneBattleState(state);
  nextState.players[input.playerId].life.value += input.amount;
  return nextState;
}

export function placeAsFlag(
  state: BattleState,
  input: PlaceAsFlagInput
): BattleState {
  const located = findBattleCard(state, input.instanceId);
  if (!located) return state;
  if (input.fromZone && located.zoneId !== input.fromZone) return state;
  if (located.playerId !== "self" || located.zoneId !== "hand") return state;

  const nextState = cloneBattleState(state);
  const player = nextState.players[located.playerId];
  const fromCards = player.zones[located.zoneId].cards;
  const fromIndex = fromCards.findIndex(
    (card) => card.instanceId === input.instanceId
  );
  const [removedCard] = fromCards.splice(fromIndex, 1);
  if (!removedCard) return state;

  player.zones.flag.cards.push(
    withoutAreaStackData(
      withoutDeckRevealData({
      ...removedCard,
      zoneId: "flag",
      visibility: "public"
      })
    )
  );

  return nextState;
}

export function applyRuleChange(
  state: BattleState,
  input: ApplyRuleChangeInput
): BattleState {
  if (state.ruleState.appliedRuleEffectIds.includes(input.effectId)) {
    return state;
  }

  return {
    ...state,
    ruleState: {
      itemLimit:
        Object.prototype.hasOwnProperty.call(input, "itemLimit")
          ? input.itemLimit ?? null
          : state.ruleState.itemLimit,
      appliedRuleEffectIds: [
        ...state.ruleState.appliedRuleEffectIds,
        input.effectId
      ]
    }
  };
}

export function activateBiriKinata(
  state: BattleState,
  input: ActivateBiriKinataInput
): BattleState {
  const source = findBattleCard(state, input.sourceInstanceId);
  const target = findBattleCard(state, input.targetInstanceId);
  if (!source || !target) return state;
  if (source.playerId !== "self") return state;
  if (!isAreaStackZone(source.zoneId)) return state;
  if (target.playerId !== "opponent" || target.zoneId !== "drop") return state;

  const nextState = cloneBattleState(state);
  const opponent = nextState.players.opponent;
  const dropCards = opponent.zones.drop.cards;
  const targetIndex = dropCards.findIndex(
    (card) => card.instanceId === input.targetInstanceId
  );
  const [removedCard] = dropCards.splice(targetIndex, 1);
  if (!removedCard) return state;

  opponent.zones.center.cards.push(
    withAreaStackData(
      withoutDeckRevealData({
        ...removedCard,
        zoneId: "center",
        visibility: "face_down",
        meta: {
          ...removedCard.meta,
          placedByAbility: "biri_kinata"
        }
      }),
      `area-stack:center:${removedCard.instanceId}`,
      getAreaStacks(opponent.zones.center.cards).some(
        (areaStack) => areaStack.areaSlot === 0
      )
        ? 1
        : 0
    )
  );

  return nextState;
}

export function lookTopDeck(
  state: BattleState,
  input: LookTopDeckInput
): BattleState {
  const deckCards = state.players[input.playerId].zones.deck.cards;
  const count = Math.floor(input.count);
  if (count < 1 || count > deckCards.length) return state;

  return {
    ...state,
    deckLook: {
      playerId: input.playerId,
      instanceIds: deckCards.slice(0, count).map((card) => card.instanceId)
    }
  };
}

export function revealDeckCards(
  state: BattleState,
  input: RevealDeckCardsInput
): BattleState {
  const deckCards = state.players[input.playerId].zones.deck.cards;
  const count = input.count == null ? null : Math.floor(input.count);
  if (input.instanceId == null && (count == null || count < 1 || count > deckCards.length)) {
    return state;
  }

  const revealIds = new Set(
    input.instanceId
      ? [input.instanceId]
      : deckCards.slice(0, count ?? 0).map((card) => card.instanceId)
  );
  if (input.instanceId && !deckCards.some((card) => card.instanceId === input.instanceId)) {
    return state;
  }
  const nextState = cloneBattleState(state);
  nextState.players[input.playerId].zones.deck.cards = nextState.players[
    input.playerId
  ].zones.deck.cards.map((card) =>
    revealIds.has(card.instanceId)
      ? {
          ...card,
          visibility: "public",
          meta: {
            ...card.meta,
            deckRevealed: true
          }
        }
      : card
  );
  if (input.instanceId) {
    cleanupDeckLookForMovedCard(nextState, input.instanceId);
  }

  return nextState;
}

export function moveRevealedCard(
  state: BattleState,
  input: MoveRevealedCardInput
): BattleState {
  const located = findBattleCard(state, input.instanceId);
  if (!located || located.zoneId !== "deck") return state;
  const isLooked = state.deckLook?.instanceIds.includes(input.instanceId) ?? false;
  const isRevealed = located.card.meta.deckRevealed === true;
  if (!isLooked && !isRevealed) return state;

  if (isAreaStackZone(input.toZone)) {
    if (input.placeAsNewStack) {
      return placeCardInAreaSlot(state, {
        instanceId: input.instanceId,
        fromZone: "deck",
        toZone: input.toZone
      });
    }

    return placeOrStackAreaCard(state, {
      instanceId: input.instanceId,
      fromZone: "deck",
      toZone: input.toZone,
      targetInstanceId: input.targetInstanceId
    });
  }

  return moveCard(state, {
    instanceId: input.instanceId,
    fromZone: "deck",
    toZone: input.toZone,
    deckPosition: input.deckPosition
  });
}

export function reorderLookedCards(
  state: BattleState,
  input: ReorderLookedCardsInput
): BattleState {
  if (!state.deckLook || state.deckLook.playerId !== input.playerId) return state;

  const currentIds = new Set(state.deckLook.instanceIds);
  const nextIds = input.instanceIds.filter((instanceId) =>
    currentIds.has(instanceId)
  );
  if (nextIds.length !== state.deckLook.instanceIds.length) return state;

  return {
    ...state,
    deckLook: {
      playerId: input.playerId,
      instanceIds: nextIds
    }
  };
}

export function returnLookedCards(
  state: BattleState,
  input: ReturnLookedCardsInput
): BattleState {
  if (!state.deckLook || state.deckLook.playerId !== input.playerId) return state;

  const requestedIds = input.instanceIds.length > 0
    ? input.instanceIds
    : state.deckLook.instanceIds;
  const requestedIdSet = new Set(requestedIds);
  const deckCards = state.players[input.playerId].zones.deck.cards;
  const returnedCards = requestedIds
    .map((instanceId) => deckCards.find((card) => card.instanceId === instanceId))
    .filter((card): card is BattleCard => card != null);
  if (returnedCards.length === 0) {
    return {
      ...state,
      deckLook: null
    };
  }

  const nextState = cloneBattleState(state);
  const nextDeckCards = nextState.players[input.playerId].zones.deck.cards.filter(
    (card) => !requestedIdSet.has(card.instanceId)
  );
  const normalizedReturnedCards = returnedCards.map((card) => ({
    ...card,
    zoneId: "deck" as const,
    visibility: card.meta.deckRevealed === true ? "public" as const : "face_down" as const
  }));

  nextState.players[input.playerId].zones.deck.cards =
    input.deckPosition === "top"
      ? [...normalizedReturnedCards, ...nextDeckCards]
      : [...nextDeckCards, ...normalizedReturnedCards];
  nextState.deckLook = null;

  return nextState;
}

export function clearDeckLook(
  state: BattleState,
  input: ClearDeckLookInput
): BattleState {
  if (!state.deckLook || state.deckLook.playerId !== input.playerId) return state;

  return {
    ...state,
    deckLook: null
  };
}

export function setViewerCard(
  state: BattleState,
  instanceId: string | null
): BattleState {
  if (state.activeViewerCardInstanceId === instanceId) return state;

  return {
    ...state,
    activeViewerCardInstanceId: instanceId
  };
}

export function clearViewer(state: BattleState): BattleState {
  return setViewerCard(state, null);
}
