import { supabase } from "@/lib/supabase/client";
import type {
  DeckCardRecord,
  DeckEraKey,
  DeckRecord,
  DeckVisibility
} from "@/types/baddiePhyto";

function isMissingColumnError(error: { code?: string; message: string }, columnName: string) {
  return error.code === "PGRST204" || error.message.includes(columnName);
}

export async function loadDecks() {
  return await supabase
    .from("decks")
    .select("*")
    .order("updated_at", { ascending: false })
    .returns<DeckRecord[]>();
}

export async function loadDeck(deckId: string) {
  return await supabase
    .from("decks")
    .select("*")
    .eq("id", deckId)
    .maybeSingle<DeckRecord>();
}

export async function loadDeckCards(deckId: string) {
  return await supabase
    .from("deck_cards")
    .select("*")
    .eq("deck_id", deckId)
    .order("sort_order")
    .returns<DeckCardRecord[]>();
}

export async function loadAllDeckCards() {
  return await supabase
    .from("deck_cards")
    .select("*")
    .order("sort_order")
    .returns<DeckCardRecord[]>();
}

export async function createDeck(input: {
  name: string;
  flagId: string;
  buddyCardId: string;
  deckVisibility?: DeckVisibility;
}) {
  return await supabase.rpc("create_deck", {
    p_name: input.name,
    p_flag_id: input.flagId,
    p_buddy_card_id: input.buddyCardId,
    p_deck_visibility: input.deckVisibility ?? "private"
  });
}

export async function createDraftDeck(input?: {
  name?: string;
  deckVisibility?: DeckVisibility;
  eraKey?: DeckEraKey | null;
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
    return result;
  }

  return await supabase
    .from("decks")
    .insert(baseInsert)
    .select("id")
    .single<{ id: string }>();
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
    return updateWithoutOptionalColumns;
  }

  return await supabase
    .from("decks")
    .update(baseUpdate)
    .eq("id", input.deckId)
    .select("*")
    .single<DeckRecord>();
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
  return await supabase.rpc("set_deck_card", {
    p_deck_id: input.deckId,
    p_card_id: input.cardId,
    p_quantity: input.quantity,
    p_sort_order: input.sortOrder,
    p_selected_image_id: input.selectedImageId
  });
}

export async function deleteDeck(deckId: string) {
  return await supabase.from("decks").delete().eq("id", deckId);
}
