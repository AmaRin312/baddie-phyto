import { getAbilityMenuContributions } from "@/lib/battle/abilities/battleAbilityDefinitions";
import type {
  AbilityActionId,
  BattleCardAbilityMap
} from "@/lib/battle/abilities/abilityTypes";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";
import type { BattleCard, BattleState, BattleZoneId } from "@/types/battle";
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
  | "activateBiriKinata"
  | "activateFaceDownSoul"
  | "activateHyakuganComposite";

export type BattleMenuItem = {
  direction: BattleMenuDirection;
  label: string;
  command?: BattleCommand;
  placementSource?: BattlePlacementSource;
  uiAction?: BattleMenuUiAction;
  abilityActionId?: AbilityActionId;
  children?: BattleMenuItem[];
};

export type BattleContextMenuSource =
  | {
      kind: "card";
      card: BattleCard;
      cardRecord?: CardRecord | null;
      state: BattleState;
      cardAbilityMap: BattleCardAbilityMap;
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

function createAbilityMenuChildren(input: {
  state: BattleState;
  card: BattleCard;
  cardRecord?: CardRecord | null;
  cardAbilityMap: BattleCardAbilityMap;
}): BattleMenuItem[] {
  if (!input.cardRecord) return [];

  return getAbilityMenuContributions({
    state: input.state,
    card: input.card,
    cardRecord: input.cardRecord,
    cardAbilityMap: input.cardAbilityMap
  }).map((contribution): BattleMenuItem => ({
    direction: contribution.direction,
    label: contribution.label,
    abilityActionId: contribution.actionId,
    uiAction:
      contribution.actionId === "use_biri_kinata_face_down"
        ? "activateBiriKinata"
        : contribution.actionId === "use_face_down_soul"
          ? "activateFaceDownSoul"
          : "activateHyakuganComposite"
  }));
}

function buildHandMenu(input: {
  card: BattleCard;
  cardRecord?: CardRecord | null;
  abilityChildren: BattleMenuItem[];
}): BattleMenuItem[] {
  const useItem: BattleMenuItem = isFlagCard(input.cardRecord)
    ? {
        direction: "W" as const,
        label: "新フラッグとして使用",
        command: {
          type: "PLACE_AS_FLAG",
          payload: {
            instanceId: input.card.instanceId,
            fromZone: "hand"
          }
        } satisfies BattleCommand
      }
    : input.abilityChildren.length > 0
      ? {
          direction: "W" as const,
          label: "使用",
          children: compactItems([
            buildUsePlacement(input.card),
            ...input.abilityChildren
          ])
        }
      : buildUsePlacement(input.card);

  return compactItems([
    useItem,
    {
      direction: "A",
      label: "チャージ",
      command: moveCardCommand(input.card, "gauge")
    },
    {
      direction: "S",
      label: "移動",
      children: buildMoveSubmenuForCard(input.card)
    }
  ]);
}

function buildAreaMenu(input: {
  card: BattleCard;
  abilityChildren: BattleMenuItem[];
}): BattleMenuItem[] {
  const primaryItem: BattleMenuItem =
    input.abilityChildren.length > 0
      ? {
          direction: "W" as const,
          label: "使用",
          children: compactItems([
            {
              direction: "W" as const,
              label:
                input.card.zoneId === "set"
                  ? "上下反転"
                  : "レスト／スタンド",
              command: {
                type: "TOGGLE_CARD_ORIENTATION",
                payload: {
                  instanceId: input.card.instanceId
                }
              } satisfies BattleCommand
            },
            ...input.abilityChildren
          ])
        }
      : {
          direction: "W" as const,
          label:
            input.card.zoneId === "set" ? "上下反転" : "レスト／スタンド",
          command: {
            type: "TOGGLE_CARD_ORIENTATION",
            payload: {
              instanceId: input.card.instanceId
            }
          } satisfies BattleCommand
        };

  return compactItems([
    primaryItem,
    {
      direction: "A",
      label: "ソウル",
      uiAction: "showSoul",
      command: {
        type: "SET_VIEWER_CARD",
        payload: {
          instanceId: input.card.instanceId
        }
      }
    },
    {
      direction: "S",
      label: "ゾーン移動",
      children: buildMoveSubmenuForCard(input.card)
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

function buildDropMenu(card: BattleCard, abilityChildren: BattleMenuItem[] = []): BattleMenuItem[] {
  return compactItems([
    abilityChildren.length > 0
      ? {
          direction: "W",
          label: "使用",
          children: compactItems([buildUsePlacement(card), ...abilityChildren])
        }
      : buildUsePlacement(card),
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

  const abilityChildren = createAbilityMenuChildren(source);
  const { card, cardRecord } = source;
  if (card.zoneId === "hand") {
    return buildHandMenu({ card, cardRecord, abilityChildren });
  }
  if (AREA_ZONE_IDS.includes(card.zoneId)) {
    return buildAreaMenu({ card, abilityChildren });
  }
  if (card.zoneId === "resolution") return buildResolutionMenu(card);
  if (card.zoneId === "gauge") return buildGaugeMenu(card);
  if (card.zoneId === "drop") return buildDropMenu(card, abilityChildren);
  if (card.zoneId === "deck") return buildDeckMenu(card);

  return [];
}
