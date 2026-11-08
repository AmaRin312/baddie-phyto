import { supabase } from "@/lib/supabase/client";
import type {
  CardOrientation,
  CardRecord,
  CardViewRecord,
  CardType
} from "@/types/baddiePhyto";

const CARD_SELECT_COLUMNS = [
  "id",
  "name",
  "worlds",
  "races",
  "orientation",
  "size",
  "power",
  "defense",
  "critical",
  "card_text",
  "card_type",
  "is_dragon",
  "is_corner_king",
  "is_hyakki",
  "is_chaos",
  "is_generic",
  "is_heaven",
  "is_hell",
  "is_original",
  "is_active",
  "created_at",
  "updated_at"
].join(",");

const CARD_CACHE_TTL_MS = 60_000;
const CARD_LIST_PAGE_SIZE = 1000;

type CachedCardResponse = {
  data: CardRecord[] | null;
  error: { message: string } | null;
};

type CardListCacheEntry = {
  expiresAt: number;
  value: CachedCardResponse | null;
};

const cardListCache = new Map<string, CardListCacheEntry>();
const cardListInFlight = new Map<string, Promise<CachedCardResponse>>();

function getCachedCardResponse(key: string): CachedCardResponse | null {
  const cached = cardListCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cardListCache.delete(key);
    return null;
  }
  return cached.value;
}

function setCachedCardResponse(key: string, value: CachedCardResponse) {
  cardListCache.set(key, {
    expiresAt: Date.now() + CARD_CACHE_TTL_MS,
    value
  });
}

function clearCardCache() {
  cardListCache.clear();
}

export type CreateCardInput = {
  name: string;
  worlds: string[];
  races: string[];
  orientation: CardOrientation;
  size: number | null;
  power: number | null;
  defense: number | null;
  critical: number | null;
  cardText: string | null;
  cardType: CardType;
  isDragon: boolean;
  isCornerKing: boolean;
  isHyakki: boolean;
  isChaos: boolean;
  isGeneric: boolean;
  isHeaven?: boolean;
  isHell?: boolean;
  isOriginal?: boolean;
  isActive?: boolean;
  autoCreateFlag?: boolean;
};

export async function ensureFlagForFlagCard(card: CardRecord) {
  if (card.card_type !== "flag_card") return { error: null };

  const { data: existingFlag, error: loadError } = await supabase
    .from("flags")
    .select("id")
    .eq("card_id", card.id)
    .maybeSingle();

  if (loadError) return { error: loadError };
  if (existingFlag) return { error: null };

  return await supabase.from("flags").insert({
    name: card.name,
    card_id: card.id,
    usable_worlds: card.worlds ?? [],
    initial_life: 10,
    initial_hand: 6,
    initial_gauge: 2,
    can_be_selected_as_flag: true,
    is_active: card.is_active
  });
}

export async function loadCards(options?: { activeOnly?: boolean }) {
  const cacheKey = options?.activeOnly ? "cards:active" : "cards:all";
  const cached = getCachedCardResponse(cacheKey);
  if (cached) return cached;
  const inFlight = cardListInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request: Promise<CachedCardResponse> = (async () => {
    try {
      const cards: CardRecord[] = [];
      for (let offset = 0; ; offset += CARD_LIST_PAGE_SIZE) {
        let query = supabase
          .from("cards")
          .select(CARD_SELECT_COLUMNS)
          .order("name")
          .order("id")
          .range(offset, offset + CARD_LIST_PAGE_SIZE - 1);

        if (options?.activeOnly) query = query.eq("is_active", true);

        const result = await query.returns<CardRecord[]>();
        if (result.error) return { data: null, error: result.error };

        cards.push(...(result.data ?? []));
        if ((result.data?.length ?? 0) < CARD_LIST_PAGE_SIZE) break;
      }

      const result = { data: cards, error: null };
      setCachedCardResponse(cacheKey, result);
      return result;
    } finally {
      cardListInFlight.delete(cacheKey);
    }
  })();

  cardListInFlight.set(cacheKey, request);
  return request;
}

export async function loadCardsByIds(cardIds: readonly string[]) {
  const uniqueCardIds = [...new Set(cardIds.filter(Boolean))];

  if (uniqueCardIds.length === 0) {
    return {
      data: [] as CardRecord[],
      error: null
    };
  }

  const cacheKey = `cards:ids:${uniqueCardIds.slice().sort().join(",")}`;
  const cached = getCachedCardResponse(cacheKey);
  if (cached) return cached;
  const inFlight = cardListInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request: Promise<CachedCardResponse> = (async () => {
    try {
      const result = await supabase
        .from("cards")
        .select(CARD_SELECT_COLUMNS)
        .in("id", uniqueCardIds)
        .order("name")
        .returns<CardRecord[]>();

      if (!result.error) {
        setCachedCardResponse(cacheKey, result);
      }

      return result;
    } finally {
      cardListInFlight.delete(cacheKey);
    }
  })();

  cardListInFlight.set(cacheKey, request);
  return request;
}

export async function searchCardRecords(input?: {
  keyword?: string;
  includeInactive?: boolean;
}) {
  let query = supabase.from("cards").select(CARD_SELECT_COLUMNS).order("name");
  const keyword = input?.keyword?.trim();

  if (keyword) query = query.ilike("name", `%${keyword}%`);
  if (!input?.includeInactive) query = query.eq("is_active", true);

  return await query.returns<CardRecord[]>();
}

export async function searchCards(input?: {
  keyword?: string;
  cardType?: CardType | "";
  world?: string;
  activeOnly?: boolean;
}) {
  return await supabase.rpc("search_cards", {
    p_keyword: input?.keyword?.trim() || null,
    p_card_type: input?.cardType || null,
    p_world: input?.world?.trim() || null,
    p_active_only: input?.activeOnly ?? true
  }).returns<CardViewRecord[]>();
}

export async function loadCard(cardId: string) {
  return await supabase
    .from("cards")
    .select(CARD_SELECT_COLUMNS)
    .eq("id", cardId)
    .maybeSingle();
}

export async function createCard(input: CreateCardInput) {
  const result = await supabase
    .from("cards")
    .insert({
      name: input.name,
      worlds: input.worlds,
      races: input.races,
      orientation: input.orientation,
      size: input.size,
      power: input.power,
      defense: input.defense,
      critical: input.critical,
      card_text: input.cardText,
      card_type: input.cardType,
      is_dragon: input.isDragon,
      is_corner_king: input.isCornerKing,
      is_hyakki: input.isHyakki,
      is_chaos: input.isChaos,
      is_generic: input.isGeneric,
      is_heaven: input.isHeaven ?? false,
      is_hell: input.isHell ?? false,
      is_original: input.isOriginal ?? false,
      is_active: input.isActive ?? true
    })
    .select("*")
    .single<CardRecord>();

  if ((input.autoCreateFlag ?? true) && !result.error && result.data) {
    const flagResult = await ensureFlagForFlagCard(result.data);
    if (flagResult.error) return { ...result, error: flagResult.error };
  }

  if (!result.error) {
    clearCardCache();
  }

  return result;
}

export async function updateCard(cardId: string, input: CreateCardInput) {
  const result = await supabase
    .from("cards")
    .update({
      name: input.name,
      worlds: input.worlds,
      races: input.races,
      orientation: input.orientation,
      size: input.size,
      power: input.power,
      defense: input.defense,
      critical: input.critical,
      card_text: input.cardText,
      card_type: input.cardType,
      is_dragon: input.isDragon,
      is_corner_king: input.isCornerKing,
      is_hyakki: input.isHyakki,
      is_chaos: input.isChaos,
      is_generic: input.isGeneric,
      is_heaven: input.isHeaven ?? false,
      is_hell: input.isHell ?? false,
      is_original: input.isOriginal ?? false,
      is_active: input.isActive ?? true
    })
    .eq("id", cardId)
    .select("*")
    .single<CardRecord>();

  if (!result.error && result.data) {
    const flagResult = await ensureFlagForFlagCard(result.data);
    if (flagResult.error) return { ...result, error: flagResult.error };
  }

  if (!result.error) {
    clearCardCache();
  }

  return result;
}

export async function setCardActive(cardId: string, isActive: boolean) {
  const result = await supabase.from("cards").update({ is_active: isActive }).eq("id", cardId);
  if (!result.error) {
    clearCardCache();
  }
  return result;
}

export async function deleteCard(cardId: string) {
  const result = await supabase.from("cards").delete().eq("id", cardId);
  if (!result.error) {
    clearCardCache();
  }
  return result;
}
