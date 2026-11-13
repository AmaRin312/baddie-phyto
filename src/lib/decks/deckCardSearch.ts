import { supabase } from "@/lib/supabase/client";
import { invalidateDeckListCache } from "@/lib/decks/deckActions";
import { CARD_CSV_OFFICIAL_WORLDS } from "@/lib/cards/import/cardCsvSchema";
import type { CardRecord, CardType } from "@/types/baddiePhyto";

const WORLD_ORDER = new Map(
  CARD_CSV_OFFICIAL_WORLDS.map((world, index) => [world.replace(/ワールド$/u, ""), index])
);

function worldOrder(world: string) {
  return WORLD_ORDER.get(world.replace(/(?:ワールド|W)$/u, "")) ?? Number.MAX_SAFE_INTEGER;
}

export function deckSearchWorldLabel(world: string) {
  const index = worldOrder(world);
  return index === Number.MAX_SAFE_INTEGER ? world : CARD_CSV_OFFICIAL_WORLDS[index];
}

export function sortDeckSearchWorlds(worlds: readonly string[]) {
  return [...new Set(worlds)].sort((left, right) =>
    worldOrder(left) - worldOrder(right) || left.localeCompare(right, "ja")
  );
}

export type DeckCardSpecialFlagKey = "dragonEin" | "hyakki";

export const DECK_CARD_SPECIAL_FLAG_OPTIONS: ReadonlyArray<{
  value: DeckCardSpecialFlagKey;
  label: string;
}> = [
  { value: "dragonEin", label: "ドラゴン・アイン" },
  { value: "hyakki", label: "百鬼" }
];

export type DeckCardEraKey = "first" | "hundred" | "ddd" | "x" | "god";

export const DECK_CARD_ERA_OPTIONS: ReadonlyArray<{
  value: DeckCardEraKey;
  label: string;
}> = [
  { value: "first", label: "無印" },
  { value: "hundred", label: "100" },
  { value: "ddd", label: "DDD" },
  { value: "x", label: "X" },
  { value: "god", label: "神" }
];

export type DeckCardAttributeKey =
  | "cornerKing"
  | "chaos"
  | "generic"
  | "heaven"
  | "hell";

export type DeckCardSizeFilter = "4+" | "3" | "2" | "1" | "0";

export const DECK_CARD_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  value: DeckCardAttributeKey;
  label: string;
}> = [
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

export type DeckCardSearchFilters = {
  name: string;
  cardText: string;
  worlds: string[];
  specialFlags: DeckCardSpecialFlagKey[];
  cardTypes: CardType[];
  sizes: DeckCardSizeFilter[];
  races: string[];
  eras: DeckCardEraKey[];
  setIds: string[];
  originalMode: "all" | "official" | "original";
  attributes: DeckCardAttributeKey[];
};

export const EMPTY_DECK_CARD_SEARCH_FILTERS: DeckCardSearchFilters = {
  name: "",
  cardText: "",
  worlds: [],
  specialFlags: [],
  cardTypes: [],
  sizes: [],
  races: [],
  eras: [],
  setIds: [],
  originalMode: "all",
  attributes: []
};

export type DeckCardSearchResponse = {
  items: CardRecord[];
  totalCount: number;
};

type CardSetQueryRow = {
  id: string;
  set_code: string;
  name: string | null;
  era_key: DeckCardEraKey | null;
  is_visible: boolean;
};

export type ManagedCardSet = CardSetQueryRow;

let optionsCache: {
  expiresAt: number;
  value: { worlds: string[]; sets: DeckCardSetOption[]; error: string | null };
} | null = null;
let optionsInFlight: Promise<{
  worlds: string[];
  sets: DeckCardSetOption[];
  error: string | null;
}> | null = null;

export async function loadDeckCardSearchOptions() {
  if (optionsCache && optionsCache.expiresAt > Date.now()) return optionsCache.value;
  if (optionsInFlight) return optionsInFlight;

  optionsInFlight = (async () => {
    try {
      const [worldResult, setResult] = await Promise.all([
        supabase.rpc("list_deck_card_search_worlds"),
        supabase
          .from("card_sets")
          .select("id,set_code,name,era_key,is_visible")
          .eq("is_visible", true)
          .order("set_code")
          .returns<CardSetQueryRow[]>()
      ]);
      const error = worldResult.error ?? setResult.error;
      if (error) return { worlds: [], sets: [], error: error.message };

      const worlds = (worldResult.data as unknown as string[] | null) ?? [];
      const value = {
        worlds: sortDeckSearchWorlds(worlds),
        sets: (setResult.data ?? []).map((set) => ({
          id: set.id,
          setCode: set.set_code,
          name: set.name,
          eraKey: set.era_key ?? "first"
        })),
        error: null
      };
      optionsCache = { expiresAt: Date.now() + 300_000, value };
      return value;
    } finally {
      optionsInFlight = null;
    }
  })();

  return optionsInFlight;
}

export async function loadManagedCardSets() {
  return await supabase
    .from("card_sets")
    .select("id,set_code,name,era_key,is_visible")
    .order("set_code")
    .returns<ManagedCardSet[]>();
}

export async function setCardSetVisibility(id: string, isVisible: boolean) {
  const result = await supabase
    .from("card_sets")
    .update({ is_visible: isVisible })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (!result.error && result.data) {
    optionsCache = null;
    invalidateDeckListCache();
  }
  return result;
}

export async function searchDeckCards(input: {
  filters: DeckCardSearchFilters;
  page: number;
  pageSize?: number;
  preferredWorlds: string[];
  excludedCardId?: string | null;
}) {
  const pageSize = Math.min(Math.max(input.pageSize ?? 100, 1), 100);
  const result = await supabase.rpc("search_deck_cards", {
      p_name: input.filters.name.trim() || null,
      p_card_text: input.filters.cardText.trim() || null,
      p_worlds: input.filters.worlds,
      p_card_types: input.filters.cardTypes,
      p_race_keywords: input.filters.races.map((race) => race.trim()).filter(Boolean),
      p_eras: input.filters.eras,
      p_set_ids: input.filters.setIds,
      p_original_mode: input.filters.originalMode,
      p_attributes: [
        ...input.filters.attributes,
        ...input.filters.specialFlags.map((flag) =>
          flag === "hyakki" ? "hyakki" : `special_flag:${flag}`
        ),
        ...input.filters.sizes.map((size) => `size:${size}`)
      ],
      p_preferred_worlds: input.preferredWorlds,
      p_excluded_card_id: input.excludedCardId || null,
      p_page_size: pageSize,
      p_page_offset: Math.max(0, input.page) * pageSize
    });

  if (result.error) {
    return { data: null, error: result.error };
  }
  return {
    data: result.data as unknown as DeckCardSearchResponse,
    error: null
  };
}

export function resolveDeckSearchWorlds(availableWorlds: string[], preferredWorlds: string[]) {
  function normalize(world: string) {
    const value = world
      .trim()
      .normalize("NFKC")
      .replace(/[\s　]+/g, "")
      .replace(/[・･]/g, "")
      .replace(/ワールド$/u, "W")
      .replace(/world$/iu, "W");
    return value.toLocaleLowerCase("ja");
  }

  const preferredKeys = new Set(preferredWorlds.map(normalize));
  return availableWorlds.filter((world) => preferredKeys.has(normalize(world)));
}
