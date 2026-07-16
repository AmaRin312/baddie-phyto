import { supabase } from "@/lib/supabase/client";
import type {
  CardOrientation,
  CardRecord,
  CardViewRecord,
  CardType
} from "@/types/baddiePhyto";

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
  isActive?: boolean;
};

export async function loadCards(options?: { activeOnly?: boolean }) {
  let query = supabase.from("cards").select("*").order("name");

  if (options?.activeOnly) query = query.eq("is_active", true);
  return await query;
}

export async function searchCardRecords(input?: {
  keyword?: string;
  includeInactive?: boolean;
}) {
  let query = supabase.from("cards").select("*").order("name");
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
  return await supabase.from("cards").select("*").eq("id", cardId).maybeSingle();
}

export async function createCard(input: CreateCardInput) {
  return await supabase
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
      is_active: input.isActive ?? true
    })
    .select("*")
    .single<CardRecord>();
}

export async function updateCard(cardId: string, input: CreateCardInput) {
  return await supabase
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
      is_active: input.isActive ?? true
    })
    .eq("id", cardId)
    .select("*")
    .single<CardRecord>();
}

export async function setCardActive(cardId: string, isActive: boolean) {
  return await supabase.from("cards").update({ is_active: isActive }).eq("id", cardId);
}
