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

function isMissingColumnError(error: { code?: string; message?: string }, columnName: string) {
  return error.code === "42703" || Boolean(error.message?.includes(columnName));
}

async function loadCardAbilityBehaviorRows(cardIds?: string[]) {
  let query = supabase
    .from("card_abilities")
    .select("card_id, ability:abilities!inner(behavior_key)");

  if (cardIds) query = query.in("card_id", cardIds);

  const orderedResult = await query.order("sort_order").returns<CardAbilityBehaviorRow[]>();
  if (!orderedResult.error || !isMissingColumnError(orderedResult.error, "sort_order")) {
    return orderedResult;
  }

  let fallbackQuery = supabase
    .from("card_abilities")
    .select("card_id, ability:abilities!inner(behavior_key)");

  if (cardIds) fallbackQuery = fallbackQuery.in("card_id", cardIds);

  return await fallbackQuery.returns<CardAbilityBehaviorRow[]>();
}

export async function loadBattleCardAbilityMap(): Promise<{
  data: BattleCardAbilityMap;
  error: Error | null;
}> {
  const { data, error } = await loadCardAbilityBehaviorRows();

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
  const result = await supabase
    .from("card_abilities")
    .select(
      "id,card_id,ability_id,params,sort_order,created_at,updated_at,ability:abilities(id,name,behavior_key,description,is_active)"
    )
    .eq("card_id", cardId)
    .order("sort_order")
    .returns<CardAbilityWithAbilityRecord[]>();

  if (!result.error || !isMissingColumnError(result.error, "sort_order")) {
    return result;
  }

  return await supabase
    .from("card_abilities")
    .select(
      "id,card_id,ability_id,params,created_at,updated_at,ability:abilities(id,name,behavior_key,description,is_active)"
    )
    .eq("card_id", cardId)
    .returns<CardAbilityWithAbilityRecord[]>();
}

export async function addCardAbilityLink(input: {
  cardId: string;
  abilityId: string;
}) {
  const existingResult = await loadCardAbilityLinks(input.cardId);
  if (existingResult.error) return { data: null, error: existingResult.error };

  const nextSortOrder = existingResult.data?.length ?? 0;
  const insertResult = await supabase
    .from("card_abilities")
    .insert({
      card_id: input.cardId,
      ability_id: input.abilityId,
      params: {},
      sort_order: nextSortOrder
    })
    .select("id")
    .single<{ id: string }>();

  if (!insertResult.error || !isMissingColumnError(insertResult.error, "sort_order")) {
    return insertResult;
  }

  return await supabase
    .from("card_abilities")
    .insert({
      card_id: input.cardId,
      ability_id: input.abilityId,
      params: {}
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

  const { data, error } = await loadCardAbilityBehaviorRows(cardIds);

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
