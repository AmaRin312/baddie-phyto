import { supabase } from "@/lib/supabase/client";
import type { DeckCardRecord, DeckRecord, DeckVisibility } from "@/types/baddiePhyto";

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
}) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { data: null, error: userError ?? new Error("ログインが必要です。") };
  }

  return await supabase
    .from("decks")
    .insert({
      owner_id: userData.user.id,
      name: input?.name?.trim() || "無題のデッキ",
      flag_id: null,
      buddy_card_id: null,
      selected_flag_image_id: null,
      deck_visibility: input?.deckVisibility ?? "private"
    })
    .select("id")
    .single<{ id: string }>();
}

export async function updateDeckSettings(input: {
  deckId: string;
  name: string;
  flagId: string | null;
  buddyCardId: string | null;
  selectedFlagImageId: string | null;
  deckVisibility: DeckVisibility;
}) {
  return await supabase
    .from("decks")
    .update({
      name: input.name,
      flag_id: input.flagId,
      buddy_card_id: input.buddyCardId,
      selected_flag_image_id: input.selectedFlagImageId,
      deck_visibility: input.deckVisibility
    })
    .eq("id", input.deckId)
    .select("*")
    .single<DeckRecord>();
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
