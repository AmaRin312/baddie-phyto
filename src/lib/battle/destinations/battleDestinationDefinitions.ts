import type {
  BattleDestination,
  BattleDestinationDefinition
} from "@/lib/battle/destinations/battleDestinationTypes";

export const BATTLE_DESTINATION_DEFINITIONS: ReadonlyArray<BattleDestinationDefinition> = [
  {
    id: "none",
    label: "未指定",
    kind: "special",
    allowsMultiple: true
  },
  {
    id: "hand",
    label: "手札",
    kind: "zone",
    zoneId: "hand",
    allowsMultiple: true
  },
  {
    id: "gauge",
    label: "ゲージ",
    kind: "zone",
    zoneId: "gauge",
    allowsMultiple: true
  },
  {
    id: "drop",
    label: "ドロップ",
    kind: "zone",
    zoneId: "drop",
    allowsMultiple: true
  },
  {
    id: "deck",
    label: "デッキ",
    kind: "zone",
    zoneId: "deck",
    allowsMultiple: true
  },
  {
    id: "center",
    label: "Center",
    kind: "zone",
    zoneId: "center",
    allowsMultiple: false
  },
  {
    id: "left",
    label: "Left",
    kind: "zone",
    zoneId: "left",
    allowsMultiple: false
  },
  {
    id: "right",
    label: "Right",
    kind: "zone",
    zoneId: "right",
    allowsMultiple: false
  },
  {
    id: "item",
    label: "Item",
    kind: "zone",
    zoneId: "item",
    allowsMultiple: false
  },
  {
    id: "set",
    label: "Set",
    kind: "zone",
    zoneId: "set",
    allowsMultiple: false
  },
  {
    id: "resolution",
    label: "どこでもないゾーン",
    kind: "zone",
    zoneId: "resolution",
    allowsMultiple: true
  },
  {
    id: "soul",
    label: "Soul",
    kind: "special",
    requiresVisibilityChoice: true,
    allowsMultiple: true
  },
  {
    id: "reveal",
    label: "公開",
    kind: "special",
    faceUpOnMove: true,
    allowsMultiple: true
  }
];

export const DEFAULT_DECK_BROWSER_DESTINATIONS: ReadonlyArray<BattleDestination> = [
  "none",
  "hand",
  "gauge",
  "drop",
  "center",
  "left",
  "right",
  "item",
  "set",
  "resolution",
  "soul",
  "reveal"
];

export function getBattleDestinationDefinition(destination: BattleDestination) {
  return BATTLE_DESTINATION_DEFINITIONS.find(
    (definition) => definition.id === destination
  );
}

export function getBattleDestinationDefinitions(
  destinations: ReadonlyArray<BattleDestination>
) {
  return destinations
    .map((destination) => getBattleDestinationDefinition(destination))
    .filter(
      (definition): definition is BattleDestinationDefinition =>
        definition != null
    );
}
