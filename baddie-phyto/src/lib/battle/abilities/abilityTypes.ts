import type { BattleCard, BattleState, BattleZoneId } from "@/types/battle";
import type { CardRecord } from "@/types/baddiePhyto";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";

export type AbilityId =
  | "face_down_soul"
  | "biri_kinata_face_down_use"
  | "levantine_item_limit_unlimited"
  | "hyakugan_yamigedo"
  | "ten_no_hanshin_composite"
  | "chi_no_hanshin_composite";

export type AbilityActionId =
  | "use_face_down_soul"
  | "use_biri_kinata_face_down"
  | "use_hyakugan_yamigedo_composite";

export type TargetDefinitionId =
  | "one_own_card_from_face_down_soul_sources"
  | "one_opponent_drop_card"
  | "matching_hyakugan_half_same_container";

export type ExecutorId =
  | "add_selected_card_to_source_soul_face_down"
  | "place_opponent_drop_card_to_opponent_center_face_down"
  | "place_hyakugan_composite";

export type BattleCardAbilityMap = Map<string, AbilityId[]>;

export type BattleAbilityContext = {
  state: BattleState;
  card: BattleCard;
  cardRecord: CardRecord;
  abilityIds: readonly AbilityId[];
  cardAbilityMap: BattleCardAbilityMap;
};

export type BattleAbilityMenuContribution = {
  actionId: AbilityActionId;
  label: string;
  direction: "W" | "A" | "S" | "D";
};

export type BattleAbilityDefinition = {
  id: AbilityId;
  label: string;
  actionId?: AbilityActionId;
  targetDefinitionId?: TargetDefinitionId;
  executorId?: ExecutorId;
  getMenuContribution?: (
    context: BattleAbilityContext
  ) => BattleAbilityMenuContribution | null;
  getAutomaticCommands?: (context: BattleAbilityContext) => BattleCommand[];
};

export type AbilityZoneContainer =
  | {
      kind: "zone";
      playerId: "self" | "opponent";
      zoneId: BattleZoneId;
    }
  | {
      kind: "soul";
      playerId: "self" | "opponent";
      parentInstanceId: string;
    };
