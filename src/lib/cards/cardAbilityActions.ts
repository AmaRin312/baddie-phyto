import { supabase } from "@/lib/supabase/client";
import {
  isBattleAbilityId,
  type BattleCardAbilityMap
} from "@/lib/battle/abilities/abilityTypes";
import type { AbilityRecord, CardAbilityRecord } from "@/types/baddiePhyto";

export type CardAbilityWithAbilityRecord = CardAbilityRecord & {
  ability: Pick<
    AbilityRecord,
    "id" | "name" | "behavior_key" | "description" | "is_active"
  > | null;
};

type CardAbilityBehaviorRow = {
  card_id: string;
  ability: {
    behavior_key: string;
  } | null;
};

type CardAbilitySummaryRow = {
  card_id: string;
  ability: {
    behavior_key: string;
  } | null;
};

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
    if (!behaviorKey || !isBattleAbilityId(behaviorKey)) continue;
    map.set(row.card_id, [...(map.get(row.card_id) ?? []), behaviorKey]);
  }

  return {
    data: map,
    error: null
  };
}

export async function loadAvailableAbilities() {
  return await supabase
    .from("abilities")
    .select("id,name,behavior_key,description,params,is_active,created_at,updated_at")
    .eq("is_active", true)
    .order("behavior_key")
    .returns<AbilityRecord[]>();
}

export async function loadCardAbilityLinks(cardId: string) {
  return await supabase
    .from("card_abilities")
    .select(
      "id,card_id,ability_id,params,sort_order,created_at,updated_at,ability:abilities(id,name,behavior_key,description,is_active)"
    )
    .eq("card_id", cardId)
    .order("sort_order")
    .returns<CardAbilityWithAbilityRecord[]>();
}

export async function addCardAbilityLink(input: {
  cardId: string;
  abilityId: string;
}) {
  const existingResult = await loadCardAbilityLinks(input.cardId);
  if (existingResult.error) return { data: null, error: existingResult.error };

  const nextSortOrder = existingResult.data?.length ?? 0;
  return await supabase
    .from("card_abilities")
    .insert({
      card_id: input.cardId,
      ability_id: input.abilityId,
      params: {},
      sort_order: nextSortOrder
    })
    .select("id")
    .single<{ id: string }>();
}

export async function removeCardAbilityLink(cardAbilityId: string) {
  return await supabase
    .from("card_abilities")
    .delete()
    .eq("id", cardAbilityId);
}

export async function loadCardAbilityBehaviorKeyMap(cardIds: string[]) {
  if (cardIds.length === 0) {
    return {
      data: new Map<string, string[]>(),
      error: null
    };
  }

  const { data, error } = await supabase
    .from("card_abilities")
    .select("card_id, ability:abilities!inner(behavior_key)")
    .in("card_id", cardIds)
    .order("sort_order")
    .returns<CardAbilitySummaryRow[]>();

  if (error) {
    return {
      data: new Map<string, string[]>(),
      error
    };
  }

  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const behaviorKey = row.ability?.behavior_key;
    if (!behaviorKey) continue;
    map.set(row.card_id, [...(map.get(row.card_id) ?? []), behaviorKey]);
  }

  return {
    data: map,
    error: null
  };
}
