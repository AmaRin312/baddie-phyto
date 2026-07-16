import {
  BATTLE_ZONE_LABELS,
  type BattleCard,
  type BattlePlayerId,
  type BattleState,
  type BattleZone,
  type BattleZoneId,
  type PlayerState
} from "@/types/battle";
import type { DeckCardRecord, FlagRecord } from "@/types/baddiePhyto";

type CreateInitialBattleStateInput = {
  flag: Pick<
    FlagRecord,
    "card_id" | "initial_hand" | "initial_gauge" | "initial_life"
  >;
  buddyCardId: string;
  deckCards: Array<
    Pick<DeckCardRecord, "card_id" | "quantity" | "selected_image_id">
  >;
  random?: () => number;
};

const ZONE_IDS: BattleZoneId[] = [
  "deck",
  "hand",
  "gauge",
  "drop",
  "flag",
  "buddy",
  "center",
  "left",
  "right",
  "item",
  "set",
  "resolution"
];

function createEmptyZones(): Record<BattleZoneId, BattleZone> {
  const zones = {} as Record<BattleZoneId, BattleZone>;
  for (const id of ZONE_IDS) {
    zones[id] = {
      id,
      label: BATTLE_ZONE_LABELS[id],
      cards: []
    };
  }
  return zones;
}

function createBattleCard(input: {
  cardId: string;
  ownerId: BattlePlayerId;
  zoneId: BattleZoneId;
  selectedImageId?: string | null;
  visibility?: BattleCard["visibility"];
  index: number;
}): BattleCard {
  return {
    instanceId: `${input.ownerId}:${input.zoneId}:${input.cardId}:${input.index}:${crypto.randomUUID()}`,
    cardId: input.cardId,
    ownerId: input.ownerId,
    zoneId: input.zoneId,
    selectedImageId: input.selectedImageId ?? null,
    visibility: input.visibility ?? "public",
    orientation: "vertical",
    soul: [],
    counters: {},
    meta: {}
  };
}

function shuffleCards<T>(cards: T[], random: () => number) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function expandDeckCards(
  deckCards: CreateInitialBattleStateInput["deckCards"],
  ownerId: BattlePlayerId
) {
  return deckCards.flatMap((deckCard) =>
    Array.from({ length: deckCard.quantity }).map((_, index) =>
      createBattleCard({
        cardId: deckCard.card_id,
        ownerId,
        zoneId: "deck",
        selectedImageId: deckCard.selected_image_id,
        visibility: "face_down",
        index
      })
    )
  );
}

function createEmptyPlayer(id: BattlePlayerId, name: string): PlayerState {
  return {
    id,
    name,
    life: { value: 0 },
    zones: createEmptyZones()
  };
}

export function createInitialBattleState({
  flag,
  buddyCardId,
  deckCards,
  random = Math.random
}: CreateInitialBattleStateInput): BattleState {
  if (!flag.card_id) {
    throw new Error("Game start flag must have card_id.");
  }

  const self = createEmptyPlayer("self", "自分");
  const opponent = createEmptyPlayer("opponent", "相手");

  const flagCard = createBattleCard({
    cardId: flag.card_id,
    ownerId: "self",
    zoneId: "flag",
    visibility: "public",
    index: 0
  });
  const buddyCard = createBattleCard({
    cardId: buddyCardId,
    ownerId: "self",
    zoneId: "buddy",
    visibility: "public",
    index: 0
  });

  const shuffledDeck = shuffleCards(expandDeckCards(deckCards, "self"), random);
  const initialHand = shuffledDeck.slice(0, flag.initial_hand).map((card) => ({
    ...card,
    zoneId: "hand" as const,
    visibility: "private" as const
  }));
  const afterHand = shuffledDeck.slice(flag.initial_hand);
  const initialGauge = afterHand.slice(0, flag.initial_gauge).map((card) => ({
    ...card,
    zoneId: "gauge" as const,
    visibility: "public" as const
  }));
  const remainingDeck = afterHand.slice(flag.initial_gauge).map((card) => ({
    ...card,
    zoneId: "deck" as const,
    visibility: "face_down" as const
  }));

  self.zones.flag.cards = [flagCard];
  self.zones.buddy.cards = [buddyCard];
  self.zones.hand.cards = initialHand;
  self.zones.gauge.cards = initialGauge;
  self.zones.deck.cards = remainingDeck;
  self.life.value = flag.initial_life;

  return {
    id: crypto.randomUUID(),
    version: 0,
    startedAt: new Date().toISOString(),
    players: {
      self,
      opponent
    },
    activeViewerCardInstanceId: flagCard.instanceId,
    ruleState: {
      itemLimit: 1,
      appliedRuleEffectIds: []
    },
    deckLook: null,
    meta: {}
  };
}
