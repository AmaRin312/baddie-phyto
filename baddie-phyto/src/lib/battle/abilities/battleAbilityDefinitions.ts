import type { BattleCard, BattleState } from "@/types/battle";
import type { CardRecord } from "@/types/baddiePhyto";
import type {
  AbilityId,
  BattleAbilityContext,
  BattleAbilityDefinition,
  BattleCardAbilityMap
} from "@/lib/battle/abilities/abilityTypes";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";

const BATTLE_ZONE_IDS = new Set(["center", "left", "right", "item", "set"]);

function hasAbility(context: BattleAbilityContext, abilityId: AbilityId) {
  return context.abilityIds.includes(abilityId);
}

function countAreaStacks(cards: readonly BattleCard[]) {
  return new Set(
    cards.map((card) =>
      typeof card.meta.areaStackId === "string"
        ? card.meta.areaStackId
        : card.instanceId
    )
  ).size;
}

export const BATTLE_ABILITY_DEFINITIONS: Readonly<
  Record<AbilityId, BattleAbilityDefinition>
> = {
  face_down_soul: {
    id: "face_down_soul",
    label: "裏向きソウル",
    databaseDescription: "対象カードをこのカードのソウルへ裏向きで入れるAbility。",
    actionId: "use_face_down_soul",
    targetDefinitionId: "one_own_card_from_face_down_soul_sources",
    executorId: "add_selected_card_to_source_soul_face_down",
    getMenuContribution: (context) => {
      if (!hasAbility(context, "face_down_soul")) return null;
      if (!BATTLE_ZONE_IDS.has(context.card.zoneId)) return null;
      return {
        actionId: "use_face_down_soul",
        label: "裏向きソウル",
        direction: "A"
      };
    }
  },
  biri_kinata_face_down_use: {
    id: "biri_kinata_face_down_use",
    label: "裏向き使用",
    databaseDescription:
      "相手ドロップのカード1枚を選び、裏向きで相手Centerへ置く通知型Ability。",
    actionId: "use_biri_kinata_face_down",
    targetDefinitionId: "one_opponent_drop_card",
    executorId: "place_opponent_drop_card_to_opponent_center_face_down",
    getMenuContribution: (context) => {
      if (!hasAbility(context, "biri_kinata_face_down_use")) return null;
      if (!BATTLE_ZONE_IDS.has(context.card.zoneId)) return null;
      if (context.state.players.opponent.zones.drop.cards.length === 0) {
        return null;
      }
      if (countAreaStacks(context.state.players.opponent.zones.center.cards) >= 2) {
        return null;
      }
      return {
        actionId: "use_biri_kinata_face_down",
        label: "裏向き使用",
        direction: "S"
      };
    }
  },
  levantine_item_limit_unlimited: {
    id: "levantine_item_limit_unlimited",
    label: "アイテム制限解除",
    databaseDescription: "この対戦中、アイテム枚数制限を解除するAbility。",
    getAutomaticCommands: ({ state, card, abilityIds }) => {
      if (!abilityIds.includes("levantine_item_limit_unlimited")) return [];
      if (!BATTLE_ZONE_IDS.has(card.zoneId)) return [];

      const effectId = `continuous:${card.instanceId}:item_limit_unlimited`;
      if (state.ruleState.appliedRuleEffectIds.includes(effectId)) return [];

      return [
        {
          type: "APPLY_RULE_CHANGE",
          payload: {
            effectId,
            itemLimit: null
          },
          source: "ability"
        }
      ];
    }
  },
  hyakugan_yamigedo: {
    id: "hyakugan_yamigedo",
    label: "ヒャクガンヤミゲドウ",
    databaseDescription: "ヒャクガンヤミゲドウ関連Abilityの親識別子。"
  },
  ten_no_hanshin_composite: {
    id: "ten_no_hanshin_composite",
    label: "天の半身",
    databaseDescription:
      "同じゾーン内の地の半身と組み合わせて、ヒャクガンヤミゲドウとして配置するAbility。",
    actionId: "use_hyakugan_yamigedo_composite",
    targetDefinitionId: "matching_hyakugan_half_same_container",
    executorId: "place_hyakugan_composite",
    getMenuContribution: (context) => {
      if (!hasAbility(context, "ten_no_hanshin_composite")) return null;
      return {
        actionId: "use_hyakugan_yamigedo_composite",
        label: "ヒャクガンヤミゲドウ",
        direction: "W"
      };
    }
  },
  chi_no_hanshin_composite: {
    id: "chi_no_hanshin_composite",
    label: "地の半身",
    databaseDescription:
      "同じゾーン内の天の半身と組み合わせて、ヒャクガンヤミゲドウとして配置するAbility。",
    actionId: "use_hyakugan_yamigedo_composite",
    targetDefinitionId: "matching_hyakugan_half_same_container",
    executorId: "place_hyakugan_composite",
    getMenuContribution: (context) => {
      if (!hasAbility(context, "chi_no_hanshin_composite")) return null;
      return {
        actionId: "use_hyakugan_yamigedo_composite",
        label: "ヒャクガンヤミゲドウ",
        direction: "W"
      };
    }
  }
};

export function getCardAbilityIds(
  card: BattleCard,
  cardAbilityMap: BattleCardAbilityMap
): readonly AbilityId[] {
  return cardAbilityMap.get(card.cardId) ?? [];
}

export function getAbilityMenuContributions(input: {
  state: BattleState;
  card: BattleCard;
  cardRecord: CardRecord;
  cardAbilityMap: BattleCardAbilityMap;
}) {
  const abilityIds = getCardAbilityIds(input.card, input.cardAbilityMap);
  const context: BattleAbilityContext = {
    ...input,
    abilityIds
  };

  return abilityIds
    .map((abilityId) =>
      BATTLE_ABILITY_DEFINITIONS[abilityId]?.getMenuContribution?.(context)
    )
    .filter((item): item is NonNullable<typeof item> => item != null);
}

export function getAutomaticAbilityCommands(input: {
  state: BattleState;
  cardMap: Map<string, CardRecord>;
  cardAbilityMap: BattleCardAbilityMap;
}): BattleCommand[] {
  const commands: BattleCommand[] = [];

  for (const player of Object.values(input.state.players)) {
    for (const zone of Object.values(player.zones)) {
      for (const card of zone.cards) {
        const cardRecord = input.cardMap.get(card.cardId);
        if (!cardRecord) continue;
        const abilityIds = getCardAbilityIds(card, input.cardAbilityMap);
        const context: BattleAbilityContext = {
          state: input.state,
          card,
          cardRecord,
          abilityIds,
          cardAbilityMap: input.cardAbilityMap
        };

        for (const abilityId of abilityIds) {
          commands.push(
            ...(BATTLE_ABILITY_DEFINITIONS[abilityId]?.getAutomaticCommands?.(
              context
            ) ?? [])
          );
        }
      }
    }
  }

  return commands;
}
