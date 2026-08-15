import { supabase, withSupabaseRetry } from "@/lib/supabase/client";
import type { FlagRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

const FLAG_COLUMNS =
  "id, name, card_id, usable_worlds, initial_life, initial_hand, initial_gauge, can_be_selected_as_flag, is_active, created_at, updated_at";

export type CreateFlagInput = {
  cardId: string;
  name?: string | null;
  usableWorlds: string[];
  initialLife: number;
  initialHand: number;
  initialGauge: number;
  canBeSelectedAsFlag: boolean;
  isActive?: boolean;
};

export type UpdateFlagInput = {
  cardId?: string | null;
  name?: string | null;
  usableWorlds: string[];
  initialLife: number;
  initialHand: number;
  initialGauge: number;
  canBeSelectedAsFlag: boolean;
  isActive: boolean;
};

export async function loadFlags(options?: {
  selectableOnly?: boolean;
  activeOnly?: boolean;
}) {
  return await withSupabaseRetry(async () => {
    let query = supabase
      .from("flags")
      .select("*, card:cards(*)")
      .order("created_at", { ascending: false });

    if (options?.selectableOnly) {
      query = query.eq("can_be_selected_as_flag", true);
    }
    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    return await query.returns<FlagWithCardRecord[]>();
  });
}

export async function loadFlagsByIds(
  flagIds: string[],
  options?: {
    selectableOnly?: boolean;
    activeOnly?: boolean;
  }
) {
  const normalizedIds = [...new Set(flagIds.filter(Boolean))];
  if (normalizedIds.length === 0) {
    return {
      data: [] as FlagRecord[],
      error: null
    };
  }

  return await withSupabaseRetry(async () => {
    let query = supabase
      .from("flags")
      .select(FLAG_COLUMNS)
      .in("id", normalizedIds)
      .order("created_at", { ascending: false });

    if (options?.selectableOnly) {
      query = query.eq("can_be_selected_as_flag", true);
    }
    if (options?.activeOnly) {
      query = query.eq("is_active", true);
    }

    return await query.returns<FlagRecord[]>();
  });
}

export async function loadFlag(flagId: string) {
  return await withSupabaseRetry(() =>
    supabase
      .from("flags")
      .select("*, card:cards(*)")
      .eq("id", flagId)
      .maybeSingle<FlagWithCardRecord>()
  );
}

export async function createFlag(input: CreateFlagInput) {
  return await supabase
    .from("flags")
    .insert({
      name: input.name,
      card_id: input.cardId,
      usable_worlds: input.usableWorlds,
      initial_life: input.initialLife,
      initial_hand: input.initialHand,
      initial_gauge: input.initialGauge,
      can_be_selected_as_flag: input.canBeSelectedAsFlag,
      is_active: input.isActive ?? true
    })
    .select(FLAG_COLUMNS)
    .single<FlagRecord>();
}

export async function updateFlag(flagId: string, input: UpdateFlagInput) {
  const payload: Partial<FlagRecord> = {
    name: input.name ?? null,
    usable_worlds: input.usableWorlds,
    initial_life: input.initialLife,
    initial_hand: input.initialHand,
    initial_gauge: input.initialGauge,
    can_be_selected_as_flag: input.canBeSelectedAsFlag,
    is_active: input.isActive
  };

  if (input.cardId !== undefined) {
    payload.card_id = input.cardId;
  }

  return await supabase
    .from("flags")
    .update(payload)
    .eq("id", flagId)
    .select(FLAG_COLUMNS)
    .single<FlagRecord>();
}

export async function setFlagActive(flagId: string, isActive: boolean) {
  return await supabase
    .from("flags")
    .update({ is_active: isActive })
    .eq("id", flagId);
}
