import { supabase } from "@/lib/supabase/client";
import type { FlagRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

const FLAG_SELECT_COLUMNS = [
  "id",
  "name",
  "card_id",
  "usable_worlds",
  "usable_race_keywords",
  "initial_life",
  "initial_hand",
  "initial_gauge",
  "can_be_selected_as_flag",
  "is_active",
  "created_at",
  "updated_at"
].join(",");

const FLAG_CACHE_TTL_MS = 300_000;
type CachedFlagLiteResponse = {
  data: FlagRecord[] | null;
  error: { message: string } | null;
};
const flagLiteCache = new Map<
  string,
  { expiresAt: number; value: CachedFlagLiteResponse }
>();
const flagLiteInFlight = new Map<string, Promise<CachedFlagLiteResponse>>();
const flagDetailCache = new Map<
  string,
  { expiresAt: number; value: { data: FlagWithCardRecord | null; error: { message: string } | null } }
>();
const flagDetailInFlight = new Map<
  string,
  Promise<{ data: FlagWithCardRecord | null; error: { message: string } | null }>
>();

function getFlagLiteCacheKey(options?: { selectableOnly?: boolean; activeOnly?: boolean }) {
  return `flags:${options?.selectableOnly ? "selectable" : "all"}:${
    options?.activeOnly ? "active" : "all"
  }`;
}

function clearFlagLiteCache() {
  flagLiteCache.clear();
}

const FLAG_WITH_CARD_SELECT_COLUMNS = `${FLAG_SELECT_COLUMNS},card:cards(id,name,worlds,races,orientation,size,power,defense,critical,card_text,card_type,is_dragon,is_corner_king,is_hyakki,is_chaos,is_generic,is_heaven,is_hell,is_original,is_active,created_at,updated_at)`;

export type CreateFlagInput = {
  cardId: string | null;
  name?: string | null;
  usableWorlds: string[];
  usableRaceKeywords: string[];
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
  usableRaceKeywords: string[];
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
  let query = supabase
    .from("flags")
    .select(FLAG_WITH_CARD_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (options?.selectableOnly) {
    query = query.eq("can_be_selected_as_flag", true);
  }
  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  return await query.returns<FlagWithCardRecord[]>();
}

export async function loadFlagsLite(options?: {
  selectableOnly?: boolean;
  activeOnly?: boolean;
}) {
  const cacheKey = getFlagLiteCacheKey(options);
  const cached = flagLiteCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = flagLiteInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  let query = supabase
    .from("flags")
    .select(FLAG_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (options?.selectableOnly) {
    query = query.eq("can_be_selected_as_flag", true);
  }
  if (options?.activeOnly) {
    query = query.eq("is_active", true);
  }

  const request: Promise<CachedFlagLiteResponse> = (async () => {
    try {
      const result = await query.returns<FlagRecord[]>();
      if (!result.error) {
        flagLiteCache.set(cacheKey, {
          expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    } finally {
      flagLiteInFlight.delete(cacheKey);
    }
  })();

  flagLiteInFlight.set(cacheKey, request);
  return request;
}

export async function loadFlag(flagId: string) {
  const cached = flagDetailCache.get(flagId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = flagDetailInFlight.get(flagId);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const result = await supabase
        .from("flags")
        .select(FLAG_WITH_CARD_SELECT_COLUMNS)
        .eq("id", flagId)
        .maybeSingle<FlagWithCardRecord>();

      if (!result.error) {
        flagDetailCache.set(flagId, {
          expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    } finally {
      flagDetailInFlight.delete(flagId);
    }
  })();

  flagDetailInFlight.set(flagId, request);
  return request;
}

export async function createFlag(input: CreateFlagInput) {
  const result = await supabase
    .from("flags")
    .insert({
      name: input.name,
      card_id: input.cardId,
      usable_worlds: input.usableWorlds,
      usable_race_keywords: input.usableRaceKeywords,
      initial_life: input.initialLife,
      initial_hand: input.initialHand,
      initial_gauge: input.initialGauge,
      can_be_selected_as_flag: input.canBeSelectedAsFlag,
      is_active: input.isActive ?? true
    })
    .select("*")
    .single<FlagRecord>();

  if (!result.error) {
    clearFlagLiteCache();
  }
  return result;
}

export async function updateFlag(flagId: string, input: UpdateFlagInput) {
  const payload: Partial<FlagRecord> = {
    name: input.name ?? null,
    usable_worlds: input.usableWorlds,
    usable_race_keywords: input.usableRaceKeywords,
    initial_life: input.initialLife,
    initial_hand: input.initialHand,
    initial_gauge: input.initialGauge,
    can_be_selected_as_flag: input.canBeSelectedAsFlag,
    is_active: input.isActive
  };

  if (input.cardId !== undefined) {
    payload.card_id = input.cardId;
  }

  const result = await supabase
    .from("flags")
    .update(payload)
    .eq("id", flagId)
    .select("*")
    .single<FlagRecord>();

  if (!result.error) {
    clearFlagLiteCache();
  }
  return result;
}

export async function setFlagActive(flagId: string, isActive: boolean) {
  const result = await supabase
    .from("flags")
    .update({ is_active: isActive })
    .eq("id", flagId);
  if (!result.error) {
    clearFlagLiteCache();
  }
  return result;
}
