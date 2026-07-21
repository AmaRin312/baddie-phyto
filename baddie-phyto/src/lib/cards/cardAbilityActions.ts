import { supabase } from "@/lib/supabase/client";
import type { AbilityId, BattleCardAbilityMap } from "@/lib/battle/abilities/abilityTypes";

type CardAbilityBehaviorRow = {
  card_id: string;
  ability: {
    behavior_key: string;
  } | null;
};

const BATTLE_ABILITY_IDS = new Set<AbilityId>([
  "face_down_soul",
  "biri_kinata_face_down_use",
  "levantine_item_limit_unlimited",
  "hyakugan_yamigedo",
  "ten_no_hanshin_composite",
  "chi_no_hanshin_composite"
]);

function isAbilityId(value: string): value is AbilityId {
  return BATTLE_ABILITY_IDS.has(value as AbilityId);
}

export async function loadBattleCardAbilityMap(): Promise<{
  data: BattleCardAbilityMap;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("card_abilities")
    .select("card_id, ability:abilities!inner(behavior_key)")
    .order("sort_order")
    .returns<CardAbilityBehaviorRow[]>();

  if (error) {
    return {
      data: new Map(),
      error
    };
  }

  const map: BattleCardAbilityMap = new Map();
  for (const row of data ?? []) {
    const behaviorKey = row.ability?.behavior_key;
    if (!behaviorKey || !isAbilityId(behaviorKey)) continue;
    map.set(row.card_id, [...(map.get(row.card_id) ?? []), behaviorKey]);
  }

  return {
    data: map,
    error: null
  };
}
