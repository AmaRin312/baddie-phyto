import type { NormalizedCardCsvRow } from "@/lib/cards/import/cardCsvTypes";
import { CARD_WORLD_ALIASES } from "@/lib/cards/import/cardCsvConstants";

export function normalizeLineBreaks(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeTextValue(value: string) {
  return normalizeLineBreaks(value)
    .replace(/^\uFEFF/, "")
    .replace(/\u3000/g, " ")
    .trim()
    .replace(/[ \t]+/g, " ");
}

export function normalizeCardTextValue(value: string) {
  return normalizeLineBreaks(value).replace(/^\uFEFF/, "").trim();
}

export function normalizeListValue(value: string) {
  const seen = new Set<string>();
  const values: string[] = [];

  value
    .split("|")
    .map(normalizeTextValue)
    .filter(Boolean)
    .forEach((item) => {
      if (seen.has(item)) return;
      seen.add(item);
      values.push(item);
    });

  return values;
}

export function normalizeWorldAliasKey(value: string) {
  return normalizeTextValue(value)
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeWorldValue(value: string) {
  const normalizedKey = normalizeWorldAliasKey(value);
  if (!normalizedKey) return null;
  return CARD_WORLD_ALIASES[normalizedKey] ?? null;
}

export function normalizeWorldListValue(value: string) {
  const seen = new Set<string>();
  const worlds: string[] = [];
  const unknownValues: string[] = [];

  value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((item) => {
      const officialWorld = normalizeWorldValue(item);
      if (!officialWorld) {
        unknownValues.push(item);
        return;
      }
      if (seen.has(officialWorld)) return;
      seen.add(officialWorld);
      worlds.push(officialWorld);
    });

  return { worlds, unknownValues };
}

export function normalizeListForComparison(values: readonly string[]) {
  return Array.from(new Set(values.map(normalizeTextValue).filter(Boolean))).sort(
    (left, right) => left.localeCompare(right, "ja")
  );
}

export function createCardIdentityKey(row: NormalizedCardCsvRow, options?: {
  includeAbility?: boolean;
}) {
  return JSON.stringify({
    name: normalizeTextValue(row.name),
    card_type: row.card_type,
    worlds: normalizeListForComparison(row.worlds),
    races: normalizeListForComparison(row.races),
    size: row.size,
    power: row.power,
    defense: row.defense,
    critical: row.critical,
    card_text: row.card_text == null ? null : normalizeCardTextValue(row.card_text),
    orientation: row.orientation,
    is_dragon: row.is_dragon,
    is_hyakki: row.is_hyakki,
    is_corner_king: row.is_corner_king,
    is_chaos: row.is_chaos,
    is_generic: row.is_generic,
    is_heaven: row.is_heaven,
    is_hell: row.is_hell,
    is_active: row.is_active,
    ability: options?.includeAbility ? row.ability ?? null : undefined
  });
}
