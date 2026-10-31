import { supabase } from "@/lib/supabase/client";
import type {
  DeckCardRecord,
  DeckEraKey,
  DeckRecord,
  DeckVisibility
} from "@/types/baddiePhyto";

const DECK_SELECT_COLUMNS = [
  "id",
  "owner_id",
  "name",
  "flag_id",
  "buddy_card_id",
  "selected_flag_image_id",
  "selected_buddy_image_id",
  "sleeve_supply_id",
  "playmat_supply_id",
  "deck_visibility",
  "era_key",
  "created_at",
  "updated_at"
].join(",");
const DECK_SELECT_COLUMNS_WITHOUT_BUDDY_IMAGE = DECK_SELECT_COLUMNS
  .split(",")
  .filter((column) => column !== "selected_buddy_image_id")
  .join(",");

const DECK_CARD_SELECT_COLUMNS = [
  "id",
  "deck_id",
  "card_id",
  "selected_image_id",
  "quantity",
  "sort_order",
  "created_at",
  "updated_at"
].join(",");

const DECK_CACHE_TTL_MS = 60_000;

type CachedDeckListResponse = {
  data: DeckRecord[] | null;
  error: { message: string } | null;
};

type CachedDeckResponse = {
  data: DeckRecord | null;
  error: { message: string } | null;
};

type CachedDeckCardListResponse = {
  data: DeckCardRecord[] | null;
  error: { message: string } | null;
};

const decksCache = new Map<string, { expiresAt: number; value: CachedDeckListResponse }>();
const deckCache = new Map<string, { expiresAt: number; value: CachedDeckResponse }>();
const deckCardsCache = new Map<
  string,
  { expiresAt: number; value: CachedDeckCardListResponse }
>();
const decksInFlight = new Map<string, Promise<CachedDeckListResponse>>();
const deckInFlight = new Map<string, Promise<CachedDeckResponse>>();
const deckCardsInFlight = new Map<string, Promise<CachedDeckCardListResponse>>();

function getTimedCache<T>(cache: Map<string, { expiresAt: number; value: T }>, key: string) {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value;
}

function setTimedCache<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string,
  value: T
) {
  cache.set(key, {
    expiresAt: Date.now() + DECK_CACHE_TTL_MS,
    value
  });
}

function clearDeckCaches() {
  decksCache.clear();
  deckCache.clear();
  deckCardsCache.clear();
}

function isMissingColumnError(error: { code?: string; message: string }, columnName: string) {
  return error.code === "PGRST204" || error.message.includes(columnName);
}

export async function loadDecks() {
  const cached = getTimedCache(decksCache, "all");
  if (cached) return cached;
  const inFlight = decksInFlight.get("all");
  if (inFlight) return inFlight;

  const request: Promise<CachedDeckListResponse> = (async () => {
    try {
      let result = await supabase
        .from("decks")
        .select(DECK_SELECT_COLUMNS)
        .order("updated_at", { ascending: false })
        .returns<DeckRecord[]>();
      if (result.error && isMissingColumnError(result.error, "selected_buddy_image_id")) {
        result = await supabase
          .from("decks")
          .select(DECK_SELECT_COLUMNS_WITHOUT_BUDDY_IMAGE)
          .order("updated_at", { ascending: false })
          .returns<DeckRecord[]>();
      }
      if (!result.error) {
        setTimedCache(decksCache, "all", result);
      }
      return result;
    } finally {
      decksInFlight.delete("all");
    }
  })();

  decksInFlight.set("all", request);
  return request;
}

export async function loadDeck(deckId: string) {
  const cached = getTimedCache(deckCache, deckId);
  if (cached) return cached;
  const inFlight = deckInFlight.get(deckId);
  if (inFlight) return inFlight;

  const request: Promise<CachedDeckResponse> = (async () => {
    try {
      let result = await supabase
        .from("decks")
        .select(DECK_SELECT_COLUMNS)
        .eq("id", deckId)
        .maybeSingle<DeckRecord>();
      if (result.error && isMissingColumnError(result.error, "selected_buddy_image_id")) {
        result = await supabase
          .from("decks")
          .select(DECK_SELECT_COLUMNS_WITHOUT_BUDDY_IMAGE)
          .eq("id", deckId)
          .maybeSingle<DeckRecord>();
      }
      if (!result.error) {
        setTimedCache(deckCache, deckId, result);
      }
      return result;
    } finally {
      deckInFlight.delete(deckId);
    }
  })();

  deckInFlight.set(deckId, request);
  return request;
}

export async function loadDeckCards(deckId: string) {
  const cacheKey = `deck:${deckId}`;
  const cached = getTimedCache(deckCardsCache, cacheKey);
  if (cached) return cached;
  const inFlight = deckCardsInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request: Promise<CachedDeckCardListResponse> = (async () => {
    try {
      const result = await supabase
        .from("deck_cards")
        .select(DECK_CARD_SELECT_COLUMNS)
        .eq("deck_id", deckId)
        .order("sort_order")
        .returns<DeckCardRecord[]>();
      if (!result.error) {
        setTimedCache(deckCardsCache, cacheKey, result);
      }
      return result;
    } finally {
      deckCardsInFlight.delete(cacheKey);
    }
  })();

  deckCardsInFlight.set(cacheKey, request);
  return request;
}

export async function loadAllDeckCards() {
  const cached = getTimedCache(deckCardsCache, "all");
  if (cached) return cached;
  const inFlight = deckCardsInFlight.get("all");
  if (inFlight) return inFlight;

  const request: Promise<CachedDeckCardListResponse> = (async () => {
    try {
      const result = await supabase
        .from("deck_cards")
        .select(DECK_CARD_SELECT_COLUMNS)
        .order("sort_order")
        .returns<DeckCardRecord[]>();
      if (!result.error) {
        setTimedCache(deckCardsCache, "all", result);
      }
      return result;
    } finally {
      deckCardsInFlight.delete("all");
    }
  })();

  deckCardsInFlight.set("all", request);
  return request;
}

export async function createDeck(input: {
  name: string;
  flagId: string;
  buddyCardId: string;
  deckVisibility?: DeckVisibility;
}) {
  const result = await supabase.rpc("create_deck", {
    p_name: input.name,
    p_flag_id: input.flagId,
    p_buddy_card_id: input.buddyCardId,
    p_deck_visibility: input.deckVisibility ?? "private"
  });
  if (!result.error) {
    clearDeckCaches();
  }
  return result;
}

export async function createDraftDeck(input?: {
  name?: string;
  deckVisibility?: DeckVisibility;
  eraKey?: DeckEraKey | null;
  sleeveSupplyId?: string | null;
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      data: null,
      error: userError ?? new Error("ログインが必要です。")
    };
  }

  const baseInsert = {
    owner_id: userData.user.id,
    name: input?.name?.trim() || "無題のデッキ",
    flag_id: null,
    buddy_card_id: null,
    selected_flag_image_id: null,
    sleeve_supply_id: input?.sleeveSupplyId ?? null,
    deck_visibility: input?.deckVisibility ?? "private"
  };

  const result = await supabase
    .from("decks")
    .insert({
      ...baseInsert,
      era_key: input?.eraKey ?? null
    })
    .select("id")
    .single<{ id: string }>();

  if (!result.error || !isMissingColumnError(result.error, "era_key")) {
    if (!result.error) {
      clearDeckCaches();
    }
    return result;
  }

  const fallbackResult = await supabase
    .from("decks")
    .insert(baseInsert)
    .select("id")
    .single<{ id: string }>();
  if (!fallbackResult.error) {
    clearDeckCaches();
  }
  return fallbackResult;
}

export async function updateDeckSettings(input: {
  deckId: string;
  name: string;
  flagId: string | null;
  buddyCardId: string | null;
  selectedFlagImageId: string | null;
  selectedBuddyImageId: string | null;
  sleeveSupplyId: string | null;
  playmatSupplyId: string | null;
  deckVisibility: DeckVisibility;
  eraKey: DeckEraKey | null;
}) {
  const baseUpdate = {
    name: input.name,
    flag_id: input.flagId,
    buddy_card_id: input.buddyCardId,
    selected_flag_image_id: input.selectedFlagImageId,
    deck_visibility: input.deckVisibility,
    era_key: input.eraKey
  };

  const result = await supabase
    .from("decks")
    .update({
      ...baseUpdate,
      selected_buddy_image_id: input.selectedBuddyImageId,
      sleeve_supply_id: input.sleeveSupplyId,
      playmat_supply_id: input.playmatSupplyId
    })
    .eq("id", input.deckId)
    .select("*")
    .single<DeckRecord>();

  if (
    !result.error ||
    !(
      isMissingColumnError(result.error, "selected_buddy_image_id") ||
      isMissingColumnError(result.error, "sleeve_supply_id") ||
      isMissingColumnError(result.error, "playmat_supply_id")
    )
  ) {
    if (!result.error) {
      clearDeckCaches();
    }
    return result;
  }

  const updateWithoutOptionalColumns = await supabase
    .from("decks")
    .update({
      ...baseUpdate,
      selected_buddy_image_id: input.selectedBuddyImageId
    })
    .eq("id", input.deckId)
    .select("*")
    .single<DeckRecord>();

  if (
    !updateWithoutOptionalColumns.error ||
    !isMissingColumnError(updateWithoutOptionalColumns.error, "selected_buddy_image_id")
  ) {
    if (!updateWithoutOptionalColumns.error) {
      clearDeckCaches();
    }
    return updateWithoutOptionalColumns;
  }

  const fallbackResult = await supabase
    .from("decks")
    .update(baseUpdate)
    .eq("id", input.deckId)
    .select("*")
    .single<DeckRecord>();
  if (!fallbackResult.error) {
    clearDeckCaches();
  }
  return fallbackResult;
}

export async function copyDeck(input: { sourceDeckId: string; name?: string }) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return {
      data: null,
      error: userError ?? new Error("ログインが必要です。")
    };
  }

  const sourceDeckResult = await loadDeck(input.sourceDeckId);
  if (sourceDeckResult.error || !sourceDeckResult.data) {
    return {
      data: null,
      error: sourceDeckResult.error ?? new Error("コピー元デッキが見つかりません。")
    };
  }

  const sourceDeckCardsResult = await loadDeckCards(input.sourceDeckId);
  if (sourceDeckCardsResult.error) {
    return {
      data: null,
      error: sourceDeckCardsResult.error
    };
  }

  const sourceDeck = sourceDeckResult.data;
  const baseInsert = {
    owner_id: userData.user.id,
    name: input.name?.trim() || `${sourceDeck.name} のコピー`,
    flag_id: sourceDeck.flag_id,
    buddy_card_id: sourceDeck.buddy_card_id,
    selected_flag_image_id: sourceDeck.selected_flag_image_id,
    deck_visibility: "private" as DeckVisibility,
    era_key: sourceDeck.era_key ?? null
  };

  const insertWithBuddyImage = await supabase
    .from("decks")
    .insert({
      ...baseInsert,
      selected_buddy_image_id: sourceDeck.selected_buddy_image_id ?? null,
      sleeve_supply_id: sourceDeck.sleeve_supply_id ?? null,
      playmat_supply_id: sourceDeck.playmat_supply_id ?? null
    })
    .select("id")
    .single<{ id: string }>();

  const insertResult =
    !insertWithBuddyImage.error ||
    !(
      isMissingColumnError(insertWithBuddyImage.error, "selected_buddy_image_id") ||
      isMissingColumnError(insertWithBuddyImage.error, "sleeve_supply_id") ||
      isMissingColumnError(insertWithBuddyImage.error, "playmat_supply_id")
    )
      ? insertWithBuddyImage
      : await supabase
          .from("decks")
          .insert(baseInsert)
          .select("id")
          .single<{ id: string }>();

  if (insertResult.error || !insertResult.data) {
    return {
      data: null,
      error: insertResult.error ?? new Error("デッキコピーの作成に失敗しました。")
    };
  }

  for (const deckCard of sourceDeckCardsResult.data ?? []) {
    const { error } = await setDeckCard({
      deckId: insertResult.data.id,
      cardId: deckCard.card_id,
      quantity: deckCard.quantity,
      sortOrder: deckCard.sort_order,
      selectedImageId: deckCard.selected_image_id
    });

    if (error) {
      return {
        data: null,
        error
      };
    }
  }

  clearDeckCaches();

  return {
    data: insertResult.data,
    error: null
  };
}

export async function setDeckCard(input: {
  deckId: string;
  cardId: string;
  quantity: number;
  sortOrder: number;
  selectedImageId: string | null;
}) {
  const result = await supabase.rpc("set_deck_card", {
    p_deck_id: input.deckId,
    p_card_id: input.cardId,
    p_quantity: input.quantity,
    p_sort_order: input.sortOrder,
    p_selected_image_id: input.selectedImageId
  });
  if (!result.error) {
    clearDeckCaches();
  }
  return result;
}

export async function deleteDeck(deckId: string) {
  const result = await supabase.from("decks").delete().eq("id", deckId);
  if (!result.error) {
    clearDeckCaches();
  }
  return result;
}
