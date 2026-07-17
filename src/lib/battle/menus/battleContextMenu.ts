import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";
import type { BattleCard, BattleZoneId } from "@/types/battle";
import type { CardRecord } from "@/types/baddiePhyto";

export type BattleMenuDirection = "W" | "A" | "S" | "D";

export type BattlePlacementSource =
  | {
      kind: "card";
      instanceId: string;
      fromZone: BattleZoneId;
    }
  | {
      kind: "soul";
      parentInstanceId: string;
      soulInstanceId: string;
    };

export type BattleMenuUiAction =
  | "showSoul"
  | "openDeckLook"
  | "openDeckReveal"
  | "activateBiriKinata";

export type BattleMenuItem = {
  direction: BattleMenuDirection;
  label: string;
  command?: BattleCommand;
  placementSource?: BattlePlacementSource;
  uiAction?: BattleMenuUiAction;
  children?: BattleMenuItem[];
};

export type BattleContextMenuSource =
  | {
      kind: "card";
      card: BattleCard;
      cardRecord?: CardRecord | null;
    }
  | {
      kind: "deck";
      topCard: BattleCard | null;
      selectedCount?: number;
    }
  | {
      kind: "soul";
      parentCard: BattleCard;
      soulCard: BattleCard;
      selectedCount?: number;
      selectedSoulInstanceIds?: string[];
    };

const AREA_ZONE_IDS: ReadonlyArray<BattleZoneId> = [
  "center",
  "left",
  "right",
  "item",
  "set"
];

function compactItems(items: Array<BattleMenuItem | undefined>) {
  return items.filter((item): item is BattleMenuItem => item != null);
}

function moveCardCommand(
  card: BattleCard,
  toZone: BattleZoneId
): BattleCommand | undefined {
  if (card.zoneId === toZone) return undefined;

  return {
    type: "MOVE_CARD",
    payload: {
      instanceId: card.instanceId,
      fromZone: card.zoneId,
      toZone
    }
  };
}

function moveSoulCommand(input: {
  parentInstanceId: string;
  soulInstanceId: string;
  toZone: BattleZoneId;
}): BattleCommand {
  return {
    type: "MOVE_SOUL_CARD",
    payload: input
  };
}

function isFlagCard(cardRecord: CardRecord | null | undefined) {
  return cardRecord?.card_type === "flag_card";
}

function isBiriKinata(cardRecord: CardRecord | null | undefined) {
  const name = cardRecord?.name ?? "";
  return name.includes("ビリ・キナータ") || name.includes("ビリキナータ");
}

function buildUsePlacement(card: BattleCard): BattleMenuItem {
  return {
    direction: "W",
    label: "使用",
    placementSource: {
      kind: "card",
      instanceId: card.instanceId,
      fromZone: card.zoneId
    }
  };
}

function buildMoveSubmenuForCard(card: BattleCard): BattleMenuItem[] {
  return compactItems([
    buildUsePlacement(card),
    moveCardCommand(card, "deck")
      ? {
          direction: "A",
          label: "デッキ",
          command: moveCardCommand(card, "deck")
        }
      : undefined,
    moveCardCommand(card, "hand")
      ? {
          direction: "S",
          label: "手札",
          command: moveCardCommand(card, "hand")
        }
      : undefined,
    moveCardCommand(card, "drop")
      ? {
          direction: "D",
          label: "ドロップ",
          command: moveCardCommand(card, "drop")
        }
      : undefined
  ]);
}

function buildMoveSubmenuForSoul(input: {
  parentInstanceId: string;
  soulCard: BattleCard;
  allowUse: boolean;
}): BattleMenuItem[] {
  return compactItems([
    input.allowUse
      ? {
          direction: "W",
          label: "使用",
          placementSource: {
            kind: "soul",
            parentInstanceId: input.parentInstanceId,
            soulInstanceId: input.soulCard.instanceId
          }
        }
      : undefined,
    {
      direction: "A",
      label: "デッキ",
      command: moveSoulCommand({
        parentInstanceId: input.parentInstanceId,
        soulInstanceId: input.soulCard.instanceId,
        toZone: "deck"
      })
    },
    {
      direction: "S",
      label: "手札",
      command: moveSoulCommand({
        parentInstanceId: input.parentInstanceId,
        soulInstanceId: input.soulCard.instanceId,
        toZone: "hand"
      })
    },
    {
      direction: "D",
      label: "ドロップ",
      command: moveSoulCommand({
        parentInstanceId: input.parentInstanceId,
        soulInstanceId: input.soulCard.instanceId,
        toZone: "drop"
      })
    }
  ]);
}

function buildHandMenu(
  card: BattleCard,
  cardRecord?: CardRecord | null
): BattleMenuItem[] {
  return compactItems([
    isFlagCard(cardRecord)
      ? {
          direction: "W",
          label: "新フラッグとして使用",
          command: {
            type: "PLACE_AS_FLAG",
            payload: {
              instanceId: card.instanceId,
              fromZone: "hand"
            }
          }
        }
      : buildUsePlacement(card),
    {
      direction: "A",
      label: "チャージ",
      command: moveCardCommand(card, "gauge")
    },
    {
      direction: "S",
      label: "移動",
      children: buildMoveSubmenuForCard(card)
    }
  ]);
}

function buildAreaMenu(
  card: BattleCard,
  cardRecord?: CardRecord | null
): BattleMenuItem[] {
  return compactItems([
    isBiriKinata(cardRecord)
      ? {
          direction: "W",
          label: "Ability",
          children: [
            {
              direction: "S",
              label: "起動能力",
              uiAction: "activateBiriKinata"
            }
          ]
        }
      : {
          direction: "W",
          label: card.zoneId === "set" ? "上下反転" : "レスト/スタンド",
          command: {
            type: "TOGGLE_CARD_ORIENTATION",
            payload: {
              instanceId: card.instanceId
            }
          }
        },
    {
      direction: "A",
      label: "ソウル",
      uiAction: "showSoul",
      command: {
        type: "SET_VIEWER_CARD",
        payload: {
          instanceId: card.instanceId
        }
      }
    },
    {
      direction: "S",
      label: "ゾーン移動",
      children: buildMoveSubmenuForCard(card)
    }
  ]);
}

function buildGaugeMenu(card: BattleCard): BattleMenuItem[] {
  return compactItems([
    {
      direction: "W",
      label: "ドロップへ",
      command: moveCardCommand(card, "drop")
    }
  ]);
}

function buildDropMenu(card: BattleCard): BattleMenuItem[] {
  return compactItems([
    buildUsePlacement(card),
    {
      direction: "S",
      label: "ゾーン移動",
      children: buildMoveSubmenuForCard(card)
    }
  ]);
}

function buildResolutionMenu(card: BattleCard): BattleMenuItem[] {
  return compactItems([
    {
      direction: "S",
      label: "ゾーン移動",
      children: buildMoveSubmenuForCard(card)
    }
  ]);
}

function buildDeckMenu(topCard: BattleCard | null): BattleMenuItem[] {
  return compactItems([
    {
      direction: "W",
      label: "ドロー",
      command: {
        type: "DRAW_CARD",
        payload: {
          playerId: "self",
          count: 1
        }
      }
    },
    {
      direction: "A",
      label: "確認",
      children: compactItems([
        {
          direction: "W",
          label: "上を見る",
          uiAction: "openDeckLook"
        },
        {
          direction: "A",
          label: "公開する",
          uiAction: "openDeckReveal"
        },
        {
          direction: "D",
          label: "シャッフル",
          command: {
            type: "SHUFFLE_DECK",
            payload: {
              playerId: "self"
            }
          }
        }
      ])
    },
    topCard
      ? {
          direction: "S",
          label: "ゾーン移動",
          children: compactItems([
            {
              direction: "W",
              label: "使用",
              placementSource: {
                kind: "card",
                instanceId: topCard.instanceId,
                fromZone: "deck"
              }
            },
            {
              direction: "S",
              label: "手札",
              command: moveCardCommand(topCard, "hand")
            },
            {
              direction: "D",
              label: "ドロップ",
              command: moveCardCommand(topCard, "drop")
            }
          ])
        }
      : undefined
  ]);
}

function buildSoulMenu(source: Extract<BattleContextMenuSource, { kind: "soul" }>) {
  const isMultiple = (source.selectedCount ?? 1) > 1;
  const selectedSoulInstanceIds =
    source.selectedSoulInstanceIds && source.selectedSoulInstanceIds.length > 0
      ? source.selectedSoulInstanceIds
      : [source.soulCard.instanceId];
  const soulMoveChildren = isMultiple
    ? compactItems([
        {
          direction: "A",
          label: "デッキ",
          command: {
            type: "MOVE_SOUL_CARDS",
            payload: {
              parentInstanceId: source.parentCard.instanceId,
              soulInstanceIds: selectedSoulInstanceIds,
              toZone: "deck"
            }
          }
        },
        {
          direction: "S",
          label: "手札",
          command: {
            type: "MOVE_SOUL_CARDS",
            payload: {
              parentInstanceId: source.parentCard.instanceId,
              soulInstanceIds: selectedSoulInstanceIds,
              toZone: "hand"
            }
          }
        },
        {
          direction: "D",
          label: "ドロップ",
          command: {
            type: "MOVE_SOUL_CARDS",
            payload: {
              parentInstanceId: source.parentCard.instanceId,
              soulInstanceIds: selectedSoulInstanceIds,
              toZone: "drop"
            }
          }
        }
      ])
    : buildMoveSubmenuForSoul({
        parentInstanceId: source.parentCard.instanceId,
        soulCard: source.soulCard,
        allowUse: true
      });

  return compactItems([
    !isMultiple
      ? {
          direction: "W",
          label: "使用",
          placementSource: {
            kind: "soul",
            parentInstanceId: source.parentCard.instanceId,
            soulInstanceId: source.soulCard.instanceId
          }
        }
      : undefined,
    {
      direction: "A",
      label: "Viewer",
      command: {
        type: "SET_VIEWER_CARD",
        payload: {
          instanceId: source.soulCard.instanceId
        }
      }
    },
    {
      direction: "S",
      label: "ゾーン移動",
      children: soulMoveChildren
    }
  ]);
}

export function buildBattleContextMenu(source: BattleContextMenuSource): BattleMenuItem[] {
  if (source.kind === "deck") {
    return buildDeckMenu(source.topCard);
  }

  if (source.kind === "soul") {
    return buildSoulMenu(source);
  }

  const { card, cardRecord } = source;
  if (card.zoneId === "hand") return buildHandMenu(card, cardRecord);
  if (AREA_ZONE_IDS.includes(card.zoneId)) return buildAreaMenu(card, cardRecord);
  if (card.zoneId === "resolution") return buildResolutionMenu(card);
  if (card.zoneId === "gauge") return buildGaugeMenu(card);
  if (card.zoneId === "drop") return buildDropMenu(card);
  if (card.zoneId === "deck") return buildDeckMenu(card);

  return [];
}
