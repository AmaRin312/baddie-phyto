import {
  BOOLEAN_DEFAULTS,
  CARD_TYPE_ALIASES,
  ORIENTATION_ALIASES,
  SUPPORTED_CARD_CSV_VERSIONS
} from "@/lib/cards/import/cardCsvConstants";
import {
  normalizeCardTextValue,
  normalizeListValue,
  normalizeTextValue,
  normalizeWorldListValue
} from "@/lib/cards/import/cardCsvNormalization";
import type {
  CardCsvColumn,
  CardCsvError,
  CardCsvRawRow,
  NormalizedCardCsvRow
} from "@/lib/cards/import/cardCsvTypes";

function parseBoolean(
  rowNumber: number,
  column: keyof typeof BOOLEAN_DEFAULTS,
  value: string
): { value: boolean; error: CardCsvError | null } {
  const trimmed = normalizeTextValue(value);
  if (!trimmed) {
    return { value: BOOLEAN_DEFAULTS[column], error: null };
  }

  if (["true", "t", "1"].includes(trimmed.toLowerCase())) {
    return { value: true, error: null };
  }

  if (["false", "f", "0"].includes(trimmed.toLowerCase())) {
    return { value: false, error: null };
  }

  return {
    value: BOOLEAN_DEFAULTS[column],
    error: {
      rowNumber,
      column,
      message: `Booleanとして解釈できません: ${value}`
    }
  };
}

function parseNullableInteger(
  rowNumber: number,
  column: CardCsvColumn,
  value: string
): { value: number | null; error: CardCsvError | null } {
  const trimmed = normalizeTextValue(value);
  if (!trimmed) return { value: null, error: null };

  if (!/^-?\d+$/.test(trimmed)) {
    return {
      value: null,
      error: {
        rowNumber,
        column,
        message: `整数ではありません: ${value}`
      }
    };
  }

  return {
    value: Number.parseInt(trimmed, 10),
    error: null
  };
}

export function normalizeCardCsvRow(row: CardCsvRawRow): {
  row: NormalizedCardCsvRow | null;
  errors: CardCsvError[];
} {
  const errors: CardCsvError[] = [];
  const value = (column: CardCsvColumn) => row.values[column] ?? "";
  const name = normalizeTextValue(value("name"));
  const csvVersion = normalizeTextValue(value("csv_version")) || null;

  if (csvVersion && !SUPPORTED_CARD_CSV_VERSIONS.some((version) => version === csvVersion)) {
    errors.push({
      rowNumber: row.rowNumber,
      column: "csv_version",
      message: `このCSVバージョンには対応していません: ${csvVersion}`
    });
  }

  if (!name) {
    errors.push({
      rowNumber: row.rowNumber,
      column: "name",
      message: "値が空です"
    });
  }

  const cardTypeInput = normalizeTextValue(value("card_type"));
  const cardType = CARD_TYPE_ALIASES[cardTypeInput] ?? CARD_TYPE_ALIASES[cardTypeInput.toLowerCase()];
  if (!cardType) {
    errors.push({
      rowNumber: row.rowNumber,
      column: "card_type",
      message: `許可されていない値です: ${cardTypeInput}`
    });
  }

  const orientationInput = normalizeTextValue(value("orientation"));
  const orientation =
    orientationInput === ""
      ? "vertical"
      : ORIENTATION_ALIASES[orientationInput] ??
        ORIENTATION_ALIASES[orientationInput.toLowerCase()];
  if (orientationInput && !orientation) {
    errors.push({
      rowNumber: row.rowNumber,
      column: "orientation",
      message: `許可されていない値です: ${orientationInput}`
    });
  }

  const size = parseNullableInteger(row.rowNumber, "size", value("size"));
  const power = parseNullableInteger(row.rowNumber, "power", value("power"));
  const defense = parseNullableInteger(row.rowNumber, "defense", value("defense"));
  const critical = parseNullableInteger(row.rowNumber, "critical", value("critical"));
  [size, power, defense, critical].forEach((result) => {
    if (result.error) errors.push(result.error);
  });

  if (cardType) {
    const requiredNumberColumns: CardCsvColumn[] =
      cardType === "monster" || cardType === "impact_monster"
        ? ["size", "power", "defense", "critical"]
        : cardType === "item"
          ? ["power", "critical"]
          : [];
    const parsedNumbers = { size, power, defense, critical };

    requiredNumberColumns.forEach((column) => {
      if (parsedNumbers[column as keyof typeof parsedNumbers].error) return;
      if (parsedNumbers[column as keyof typeof parsedNumbers].value == null) {
        errors.push({
          rowNumber: row.rowNumber,
          column,
          message: `${cardType}では${column}が必須です。`
        });
      }
    });
  }

  const booleans = {
    is_dragon: parseBoolean(row.rowNumber, "is_dragon", value("is_dragon")),
    is_hyakki: parseBoolean(row.rowNumber, "is_hyakki", value("is_hyakki")),
    is_kakuoh: parseBoolean(row.rowNumber, "is_kakuoh", value("is_kakuoh")),
    is_chaos: parseBoolean(row.rowNumber, "is_chaos", value("is_chaos")),
    is_generic: parseBoolean(row.rowNumber, "is_generic", value("is_generic")),
    is_heaven: parseBoolean(row.rowNumber, "is_heaven", value("is_heaven")),
    is_hell: parseBoolean(row.rowNumber, "is_hell", value("is_hell")),
    is_active: parseBoolean(row.rowNumber, "is_active", value("is_active"))
  };
  Object.values(booleans).forEach((result) => {
    if (result.error) errors.push(result.error);
  });

  const normalizedWorlds = normalizeWorldListValue(value("world"));
  normalizedWorlds.unknownValues.forEach((unknownValue) => {
    errors.push({
      rowNumber: row.rowNumber,
      column: "world",
      message: `認識できないワールド名です: ${unknownValue}`
    });
  });

  if (errors.length > 0 || !cardType || !orientation) {
    return { row: null, errors };
  }

  return {
    row: {
      rowNumber: row.rowNumber,
      csv_version: csvVersion,
      name,
      card_type: cardType,
      worlds: normalizedWorlds.worlds,
      races: normalizeListValue(value("race")),
      size: size.value,
      power: power.value,
      defense: defense.value,
      critical: critical.value,
      card_text: normalizeCardTextValue(value("card_text")) || null,
      ability: normalizeTextValue(value("ability")) || null,
      orientation,
      is_dragon: booleans.is_dragon.value,
      is_hyakki: booleans.is_hyakki.value,
      is_corner_king: booleans.is_kakuoh.value,
      is_chaos: booleans.is_chaos.value,
      is_generic: booleans.is_generic.value,
      is_heaven: booleans.is_heaven.value,
      is_hell: booleans.is_hell.value,
      is_active: booleans.is_active.value
    },
    errors: []
  };
}
