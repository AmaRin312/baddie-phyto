export type CardOrientation = "vertical" | "horizontal" | "mixed";

export type CardType =
  | "monster"
  | "spell"
  | "item"
  | "impact"
  | "impact_monster"
  | "flag_card"
  | "other";

export type CardRecord = {
  id: string;
  name: string;
  worlds: string[];
  races: string[];
  orientation: CardOrientation;
  size: number | null;
  power: number | null;
  defense: number | null;
  critical: number | null;
  card_text: string | null;
  card_type: CardType;
  is_dragon: boolean;
  is_corner_king: boolean;
  is_hyakki: boolean;
  is_chaos: boolean;
  is_generic: boolean;
  is_heaven: boolean;
  is_hell: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CardViewRecord = CardRecord & {
  ability_names: string[];
  search_text: string | null;
};

export type FlagRecord = {
  id: string;
  name: string | null;
  card_id: string | null;
  usable_worlds: string[];
  initial_life: number;
  initial_hand: number;
  initial_gauge: number;
  can_be_selected_as_flag: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FlagWithCardRecord = FlagRecord & {
  card: CardRecord | null;
};

export type CardImageRecord = {
  id: string;
  card_id: string;
  owner_id: string;
  image_path: string;
  thumbnail_path: string | null;
  is_default: boolean;
  created_at: string;
};

export type AbilityRecord = {
  id: string;
  name: string;
  behavior_key: string;
  description: string | null;
  params: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CardAbilityRecord = {
  id: string;
  card_id: string;
  ability_id: string;
  params: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DeckRecord = {
  id: string;
  owner_id: string;
  name: string;
  flag_id: string;
  buddy_card_id: string;
  created_at: string;
  updated_at: string;
};

export type DeckCardRecord = {
  id: string;
  deck_id: string;
  card_id: string;
  selected_image_id: string | null;
  quantity: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export const CARD_TYPE_OPTIONS: ReadonlyArray<{
  value: CardType;
  label: string;
}> = [
  { value: "monster", label: "モンスター" },
  { value: "spell", label: "魔法" },
  { value: "item", label: "アイテム" },
  { value: "impact", label: "必殺技" },
  { value: "impact_monster", label: "必殺モンスター" },
  { value: "flag_card", label: "フラッグカード" },
  { value: "other", label: "その他" }
];

export const ORIENTATION_OPTIONS: ReadonlyArray<{
  value: CardOrientation;
  label: string;
}> = [
  { value: "vertical", label: "縦" },
  { value: "horizontal", label: "横" },
  { value: "mixed", label: "混在" }
];

export function getCardTypeLabel(cardType: CardType) {
  return (
    CARD_TYPE_OPTIONS.find((option) => option.value === cardType)?.label ??
    cardType
  );
}
