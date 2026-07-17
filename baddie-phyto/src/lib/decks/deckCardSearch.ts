import { supabase } from "@/lib/supabase/client";
import type { CardRecord, CardType } from "@/types/baddiePhyto";

export type DeckCardEraKey = "first" | "hundred" | "ddd" | "x" | "god";

export const DECK_CARD_ERA_OPTIONS: ReadonlyArray<{
  value: DeckCardEraKey;
  label: string;
}> = [
  { value: "first", label: "1年目" },
  { value: "hundred", label: "100" },
  { value: "ddd", label: "DDD" },
  { value: "x", label: "X" },
  { value: "god", label: "神" }
];

export type DeckCardAttributeKey =
  | "dragon"
  | "hyakki"
  | "cornerKing"
  | "chaos"
  | "generic"
  | "heaven"
  | "hell";

export const DECK_CARD_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  value: DeckCardAttributeKey;
  label: string;
}> = [
  { value: "dragon", label: "ドラゴン" },
  { value: "hyakki", label: "百鬼" },
  { value: "cornerKing", label: "角王" },
  { value: "chaos", label: "カオス" },
  { value: "generic", label: "ジェネリック" },
  { value: "heaven", label: "天国" },
  { value: "hell", label: "地獄" }
];

export type DeckCardSetOption = {
  id: string;
  setCode: string;
  name: string | null;
  eraKey: DeckCardEraKey;
};

export type CardPrintingSearchRecord = {
  cardId: string;
  setId: string;
  setCode: string;
  setName: string | null;
  eraKey: DeckCardEraKey;
};

export type DeckCardSearchFilters = {
  name: string;
  worlds: string[];
  cardTypes: CardType[];
  races: string[];
  eras: DeckCardEraKey[];
  setIds: string[];
  attributes: DeckCardAttributeKey[];
};

export const EMPTY_DECK_CARD_SEARCH_FILTERS: DeckCardSearchFilters = {
  name: "",
  worlds: [],
  cardTypes: [],
  races: [],
  eras: [],
  setIds: [],
  attributes: []
};

type CardPrintingQueryRow = {
  card_id: string;
  card_sets: {
    id: string;
    set_code: string;
    name: string | null;
    era_key: DeckCardEraKey | null;
  } | null;
};

export async function loadDeckCardPrintingSearchData(): Promise<{
  printings: CardPrintingSearchRecord[];
  sets: DeckCardSetOption[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("card_printings")
    .select("card_id,card_sets(id,set_code,name,era_key)")
    .returns<CardPrintingQueryRow[]>();

  if (error) {
    return { printings: [], sets: [], error: error.message };
  }

  const setMap = new Map<string, DeckCardSetOption>();
  const printings: CardPrintingSearchRecord[] = [];

  (data ?? []).forEach((row) => {
    const set = row.card_sets;
    if (!set) return;
    const eraKey = set.era_key ?? "first";
    setMap.set(set.id, {
      id: set.id,
      setCode: set.set_code,
      name: set.name,
      eraKey
    });
    printings.push({
      cardId: row.card_id,
      setId: set.id,
      setCode: set.set_code,
      setName: set.name,
      eraKey
    });
  });

  return {
    printings,
    sets: Array.from(setMap.values()).sort((left, right) =>
      left.setCode.localeCompare(right.setCode, "ja")
    ),
    error: null
  };
}

export function getDeckCardSearchOptions(cards: CardRecord[]) {
  const worlds = new Set<string>();
  const races = new Set<string>();

  cards.forEach((card) => {
    card.worlds.forEach((world) => worlds.add(world));
    card.races.forEach((race) => races.add(race));
  });

  return {
    worlds: Array.from(worlds).sort((left, right) => left.localeCompare(right, "ja")),
    races: Array.from(races).sort((left, right) => left.localeCompare(right, "ja"))
  };
}

function hasAny<T>(source: readonly T[], selected: readonly T[]) {
  return selected.length === 0 || selected.some((value) => source.includes(value));
}

function hasAllAttributes(card: CardRecord, attributes: DeckCardAttributeKey[]) {
  return attributes.every((attribute) => {
    switch (attribute) {
      case "dragon":
        return card.is_dragon;
      case "hyakki":
        return card.is_hyakki;
      case "cornerKing":
        return card.is_corner_king;
      case "chaos":
        return card.is_chaos;
      case "generic":
        return card.is_generic;
      case "heaven":
        return card.is_heaven;
      case "hell":
        return card.is_hell;
    }
  });
}

export function filterDeckCandidateCards(input: {
  cards: CardRecord[];
  printings: CardPrintingSearchRecord[];
  filters: DeckCardSearchFilters;
  selectedBuddyCardId: string;
  selectedFlagCardId?: string | null;
  excludeInactive: boolean;
  excludeFlagCard: boolean;
}) {
  const printingsByCard = new Map<string, CardPrintingSearchRecord[]>();
  input.printings.forEach((printing) => {
    printingsByCard.set(printing.cardId, [
      ...(printingsByCard.get(printing.cardId) ?? []),
      printing
    ]);
  });

  const keyword = input.filters.name.trim().toLowerCase();

  return input.cards
    .filter((card) => card.id !== input.selectedBuddyCardId)
    .filter((card) => card.id !== input.selectedFlagCardId)
    .filter((card) => !input.excludeInactive || card.is_active)
    .filter((card) => !input.excludeFlagCard || card.card_type !== "flag_card")
    .filter((card) => !keyword || card.name.toLowerCase().includes(keyword))
    .filter((card) => hasAny(card.worlds, input.filters.worlds))
    .filter(
      (card) =>
        input.filters.cardTypes.length === 0 ||
        input.filters.cardTypes.includes(card.card_type)
    )
    .filter((card) => hasAny(card.races, input.filters.races))
    .filter((card) => hasAllAttributes(card, input.filters.attributes))
    .filter((card) => {
      const cardPrintings = printingsByCard.get(card.id) ?? [];
      if (input.filters.eras.length > 0) {
        if (!cardPrintings.some((printing) => input.filters.eras.includes(printing.eraKey))) {
          return false;
        }
      }
      if (input.filters.setIds.length > 0) {
        if (!cardPrintings.some((printing) => input.filters.setIds.includes(printing.setId))) {
          return false;
        }
      }
      return true;
    })
    .sort((left, right) => left.name.localeCompare(right.name, "ja"));
}
