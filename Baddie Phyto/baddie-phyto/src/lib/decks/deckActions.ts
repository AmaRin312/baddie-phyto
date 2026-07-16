import { supabase } from "@/lib/supabase/client";
import type { DeckCardRecord, DeckRecord } from "@/types/baddiePhyto";

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
}) {
  return await supabase.rpc("create_deck", {
    p_name: input.name,
    p_flag_id: input.flagId,
    p_buddy_card_id: input.buddyCardId
  });
}

export async function updateDeckSettings(input: {
  deckId: string;
  name: string;
  flagId: string;
  buddyCardId: string;
}) {
  return await supabase
    .from("decks")
    .update({
      name: input.name,
      flag_id: input.flagId,
      buddy_card_id: input.buddyCardId
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
