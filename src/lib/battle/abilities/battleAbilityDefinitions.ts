import type { BattleCard, BattleState } from "@/types/battle";
import type { CardRecord } from "@/types/baddiePhyto";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";

export type BattleAbilityContext = {
  state: BattleState;
  card: BattleCard;
  cardRecord: CardRecord;
};

export type BattleAbilityDefinition = {
  id: string;
  matches: (cardRecord: CardRecord) => boolean;
  getAutomaticCommands?: (context: BattleAbilityContext) => BattleCommand[];
};

function isLevantine(cardRecord: CardRecord) {
  return (
    cardRecord.name.includes("レヴァンティン") ||
    cardRecord.name.toLowerCase().includes("levantine")
  );
}

export const BATTLE_ABILITY_DEFINITIONS: readonly BattleAbilityDefinition[] = [
  {
    id: "levantine_item_limit_unlock",
    matches: isLevantine,
    getAutomaticCommands: ({ state, card }) => {
      const isInBattleZone = ["center", "left", "right", "item"].includes(
        card.zoneId
      );
      const effectId = "levantine:item_limit_unlock";

      if (!isInBattleZone) return [];
      if (state.ruleState.appliedRuleEffectIds.includes(effectId)) return [];

      return [
        {
          type: "APPLY_RULE_CHANGE",
          payload: {
            effectId,
            itemLimit: null
          }
        }
      ];
    }
  }
];

export function getAutomaticAbilityCommands(input: {
  state: BattleState;
  cardMap: Map<string, CardRecord>;
}): BattleCommand[] {
  const commands: BattleCommand[] = [];

  for (const player of Object.values(input.state.players)) {
    for (const zone of Object.values(player.zones)) {
      for (const card of zone.cards) {
        const cardRecord = input.cardMap.get(card.cardId);
        if (!cardRecord) continue;

        for (const definition of BATTLE_ABILITY_DEFINITIONS) {
          if (!definition.matches(cardRecord)) continue;
          commands.push(
            ...(definition.getAutomaticCommands?.({
              state: input.state,
              card,
              cardRecord
            }) ?? [])
          );
        }
      }
    }
  }

  return commands;
}
