import {
  CARD_CSV_ARRAY_SEPARATOR,
  CARD_CSV_HEADERS,
  CARD_CSV_VERSION
} from "@/lib/cards/import/cardCsvConstants";
import type { ExportableCard } from "@/lib/cards/export/cardCsvExportTypes";

function csvCell(value: string | number | boolean | null | undefined) {
  const raw = value == null ? "" : String(value);
  if (/[",\r\n]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }
  return raw;
}

export function serializeCardsToCsv(cards: ExportableCard[]) {
  const rows = cards.map((card) => [
    CARD_CSV_VERSION,
    card.name,
    card.card_type,
    card.worlds.join(CARD_CSV_ARRAY_SEPARATOR),
    card.races.join(CARD_CSV_ARRAY_SEPARATOR),
    card.size,
    card.power,
    card.defense,
    card.critical,
    card.card_text,
    card.abilityKeys.join(CARD_CSV_ARRAY_SEPARATOR),
    card.orientation,
    card.is_dragon,
    card.is_hyakki,
    card.is_corner_king,
    card.is_chaos,
    card.is_generic,
    card.is_heaven,
    card.is_hell,
    card.is_active
  ]);

  return [
    CARD_CSV_HEADERS.join(","),
    ...rows.map((row) => row.map(csvCell).join(","))
  ].join("\r\n") + "\r\n";
}
