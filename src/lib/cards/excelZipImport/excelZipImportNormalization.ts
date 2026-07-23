import type { CardOrientation, CardRecord, CardType } from "@/types/baddiePhyto";
import type {
  ExcelZipImportColumn,
  ExcelZipImportIssue,
  NormalizedExcelZipCardRow
} from "@/lib/cards/excelZipImport/excelZipImportTypes";

type RawRow = {
  rowNumber: number;
  values: Partial<Record<ExcelZipImportColumn, string>>;
};

type BooleanColumn =
  | "is_dragon"
  | "is_hyakki"
  | "is_kakuoh"
  | "is_chaos"
  | "is_generic"
  | "is_heaven"
  | "is_hell"
  | "is_active";

const TRUE_VALUES = new Set(["true", "t", "1", "yes", "y"]);
const FALSE_VALUES = new Set(["false", "f", "0", "no", "n"]);

const COLUMN_TRUE_ALIASES: Record<BooleanColumn, Set<string>> = {
  is_dragon: new Set(["dragon", "ドラゴン"]),
  is_hyakki: new Set(["hyakki", "百鬼"]),
  is_kakuoh: new Set(["kakuoh", "角王"]),
  is_chaos: new Set(["chaos", "カオス"]),
  is_generic: new Set(["generic", "ジェネリック"]),
  is_heaven: new Set(["heaven", "天国"]),
  is_hell: new Set(["hell", "地獄"]),
  is_active: new Set(["active", "有効"])
};

const CARD_TYPE_ALIASES: Record<string, CardType> = {
  monster: "monster",
  モンスター: "monster",
  spell: "spell",
  魔法: "spell",
  item: "item",
  アイテム: "item",
  impact: "impact",
  必殺技: "impact",
  インパクト: "impact",
  impact_monster: "impact_monster",
  必殺モンスター: "impact_monster",
  flag_card: "flag_card",
  フラッグ: "flag_card",
  フラッグカード: "flag_card",
  other: "other",
  その他: "other"
};

const ORIENTATION_ALIASES: Record<string, CardOrientation> = {
  vertical: "vertical",
  縦: "vertical",
  縦向き: "vertical",
  horizontal: "horizontal",
  横: "horizontal",
  横向き: "horizontal",
  mixed: "mixed",
  混在: "mixed",
  両方: "mixed"
};

const WORLD_ALIASES: Record<string, string> = {
  ドラゴン: "ドラゴンW",
  ドラゴンw: "ドラゴンW",
  ドラゴンワールド: "ドラゴンW",
  デンジャー: "デンジャーW",
  デンジャーw: "デンジャーW",
  デンジャーワールド: "デンジャーW",
  マジック: "マジックW",
  マジックw: "マジックW",
  マジックワールド: "マジックW",
  カタナ: "カタナW",
  カタナw: "カタナW",
  カタナワールド: "カタナW",
  エンシェント: "エンシェントW",
  エンシェントw: "エンシェントW",
  エンシェントワールド: "エンシェントW",
  ダンジョン: "ダンジョンW",
  ダンジョンw: "ダンジョンW",
  ダンジョンワールド: "ダンジョンW",
  レジェンド: "レジェンドW",
  レジェンドw: "レジェンドW",
  レジェンドワールド: "レジェンドW",
  ダークネスドラゴン: "ダークネスドラゴンW",
  ダークネスドラゴンw: "ダークネスドラゴンW",
  ダークネスドラゴンワールド: "ダークネスドラゴンW",
  ヒーロー: "ヒーローW",
  ヒーローw: "ヒーローW",
  ヒーローワールド: "ヒーローW",
  スタードラゴン: "スタードラゴンW",
  スタードラゴンw: "スタードラゴンW",
  スタードラゴンワールド: "スタードラゴンW"
};

export function normalizeImportText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/^\uFEFF/, "")
    .replace(/\u3000/g, " ")
    .trim()
    .replace(/[ \t]+/g, " ");
}

export function normalizeImportCardText(value: unknown) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function normalizeImportFileName(value: unknown) {
  return normalizeImportText(value).replace(/^images\//i, "");
}

function normalizeLookupKey(value: unknown) {
  return normalizeImportText(value).replace(/\s+/g, "").toLowerCase();
}

function pushIssue(
  issues: ExcelZipImportIssue[],
  rowNumber: number,
  column: ExcelZipImportIssue["column"],
  message: string
) {
  issues.push({ level: "error", rowNumber, column, message });
}

function parseBooleanValue(
  rowNumber: number,
  column: BooleanColumn,
  rawValue: string,
  issues: ExcelZipImportIssue[]
) {
  const normalized = normalizeImportText(rawValue);
  if (!normalized) return false;

  const key = normalized.toLowerCase();
  if (TRUE_VALUES.has(key)) return true;
  if (FALSE_VALUES.has(key)) return false;

  if (COLUMN_TRUE_ALIASES[column].has(normalized)) return true;

  pushIssue(
    issues,
    rowNumber,
    column,
    `Booleanとして認識できません。別列用の別名を入れていないか確認してください: ${rawValue}`
  );
  return false;
}

function parseIntegerValue(
  rowNumber: number,
  column: ExcelZipImportColumn,
  rawValue: string,
  issues: ExcelZipImportIssue[]
) {
  const normalized = normalizeImportText(rawValue);
  if (!normalized) return null;

  if (!/^\d+$/.test(normalized)) {
    pushIssue(issues, rowNumber, column, `0以上の整数で入力してください: ${rawValue}`);
    return null;
  }

  return Number.parseInt(normalized, 10);
}

function normalizeWorlds(row: RawRow, issues: ExcelZipImportIssue[]) {
  const worlds = ["world1", "world2", "world3"]
    .map((column) => normalizeImportText(row.values[column as ExcelZipImportColumn]))
    .filter(Boolean)
    .map((world) => WORLD_ALIASES[normalizeLookupKey(world)] ?? world);
  const duplicate = worlds.find((world, index) => worlds.indexOf(world) !== index);

  if (worlds.length === 0) {
    pushIssue(issues, row.rowNumber, "world1", "ワールドを1つ以上入力してください。");
  }

  if (duplicate) {
    pushIssue(issues, row.rowNumber, "world1", `ワールドが重複しています: ${duplicate}`);
  }

  return worlds;
}

function normalizeRaces(row: RawRow, issues: ExcelZipImportIssue[]) {
  const races = ["race1", "race2", "race3", "race4", "race5"]
    .map((column) => normalizeImportText(row.values[column as ExcelZipImportColumn]))
    .filter(Boolean);
  const duplicate = races.find((race, index) => races.indexOf(race) !== index);

  if (duplicate) {
    pushIssue(issues, row.rowNumber, "race1", `種族が重複しています: ${duplicate}`);
  }

  return races;
}

export function normalizeExcelZipRow(row: RawRow): {
  row: NormalizedExcelZipCardRow | null;
  issues: ExcelZipImportIssue[];
} {
  const issues: ExcelZipImportIssue[] = [];
  const value = (column: ExcelZipImportColumn) => row.values[column] ?? "";
  const name = normalizeImportText(value("name"));
  const imageFile = normalizeImportFileName(value("image_file"));
  const cardTypeInput = normalizeImportText(value("card_type"));
  const orientationInput = normalizeImportText(value("orientation"));
  const cardType =
    CARD_TYPE_ALIASES[cardTypeInput] ??
    CARD_TYPE_ALIASES[cardTypeInput.toLowerCase()];
  const orientation = orientationInput
    ? ORIENTATION_ALIASES[orientationInput] ??
      ORIENTATION_ALIASES[orientationInput.toLowerCase()]
    : "vertical";

  if (!name) pushIssue(issues, row.rowNumber, "name", "カード名が空です。");
  if (!imageFile) pushIssue(issues, row.rowNumber, "image_file", "image_fileが空です。");
  if (!cardType) {
    pushIssue(issues, row.rowNumber, "card_type", `カードタイプを認識できません: ${cardTypeInput}`);
  }
  if (!orientation) {
    pushIssue(issues, row.rowNumber, "orientation", `向きを認識できません: ${orientationInput}`);
  }

  const worlds = normalizeWorlds(row, issues);
  const races = normalizeRaces(row, issues);
  const size = parseIntegerValue(row.rowNumber, "size", value("size"), issues);
  const power = parseIntegerValue(row.rowNumber, "power", value("power"), issues);
  const defense = parseIntegerValue(row.rowNumber, "defense", value("defense"), issues);
  const critical = parseIntegerValue(row.rowNumber, "critical", value("critical"), issues);
  const ability = normalizeImportText(value("ability")) || null;

  const booleans = {
    is_dragon: parseBooleanValue(row.rowNumber, "is_dragon", value("is_dragon"), issues),
    is_hyakki: parseBooleanValue(row.rowNumber, "is_hyakki", value("is_hyakki"), issues),
    is_corner_king: parseBooleanValue(row.rowNumber, "is_kakuoh", value("is_kakuoh"), issues),
    is_chaos: parseBooleanValue(row.rowNumber, "is_chaos", value("is_chaos"), issues),
    is_generic: parseBooleanValue(row.rowNumber, "is_generic", value("is_generic"), issues),
    is_heaven: parseBooleanValue(row.rowNumber, "is_heaven", value("is_heaven"), issues),
    is_hell: parseBooleanValue(row.rowNumber, "is_hell", value("is_hell"), issues),
    is_active: parseBooleanValue(row.rowNumber, "is_active", value("is_active"), issues)
  };

  if (issues.some((issue) => issue.level === "error") || !cardType || !orientation) {
    return { row: null, issues };
  }

  return {
    row: {
      rowNumber: row.rowNumber,
      name,
      worlds,
      races,
      orientation,
      size,
      power,
      defense,
      critical,
      card_text: normalizeImportCardText(value("card_text")) || null,
      ability,
      image_file: imageFile,
      card_type: cardType,
      ...booleans
    },
    issues
  };
}

export function createExcelZipCardIdentity(row: NormalizedExcelZipCardRow) {
  return JSON.stringify({
    worlds: [...row.worlds].sort((left, right) => left.localeCompare(right, "ja")),
    races: row.races,
    orientation: row.orientation,
    size: row.size,
    power: row.power,
    defense: row.defense,
    critical: row.critical,
    card_text: row.card_text,
    ability: row.ability,
    card_type: row.card_type,
    is_dragon: row.is_dragon,
    is_hyakki: row.is_hyakki,
    is_kakuoh: row.is_corner_king,
    is_chaos: row.is_chaos,
    is_generic: row.is_generic,
    is_heaven: row.is_heaven,
    is_hell: row.is_hell,
    is_active: row.is_active
  });
}

type ComparableField = {
  label: ExcelZipImportColumn;
  getRowValue: (row: NormalizedExcelZipCardRow) => unknown;
  getCardValue?: (card: CardRecord) => unknown;
  normalize?: (value: unknown) => unknown;
};

function normalizeWorldsForCompare(value: unknown) {
  return Array.isArray(value)
    ? [...value].map(String).sort((left, right) => left.localeCompare(right, "ja"))
    : [];
}

function normalizeRacesForCompare(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function normalizeNullableTextForCompare(value: unknown) {
  return value == null ? null : normalizeImportCardText(value) || null;
}

const COMPARABLE_FIELDS: ComparableField[] = [
  {
    label: "world1",
    getRowValue: (row) => row.worlds,
    getCardValue: (card) => card.worlds ?? [],
    normalize: normalizeWorldsForCompare
  },
  {
    label: "race1",
    getRowValue: (row) => row.races,
    getCardValue: (card) => card.races ?? [],
    normalize: normalizeRacesForCompare
  },
  { label: "orientation", getRowValue: (row) => row.orientation },
  { label: "size", getRowValue: (row) => row.size },
  { label: "power", getRowValue: (row) => row.power },
  { label: "defense", getRowValue: (row) => row.defense },
  { label: "critical", getRowValue: (row) => row.critical },
  {
    label: "card_text",
    getRowValue: (row) => row.card_text,
    getCardValue: (card) => card.card_text,
    normalize: normalizeNullableTextForCompare
  },
  { label: "ability", getRowValue: (row) => row.ability },
  { label: "card_type", getRowValue: (row) => row.card_type },
  { label: "is_dragon", getRowValue: (row) => row.is_dragon },
  { label: "is_hyakki", getRowValue: (row) => row.is_hyakki },
  {
    label: "is_kakuoh",
    getRowValue: (row) => row.is_corner_king,
    getCardValue: (card) => card.is_corner_king
  },
  { label: "is_chaos", getRowValue: (row) => row.is_chaos },
  { label: "is_generic", getRowValue: (row) => row.is_generic },
  {
    label: "is_heaven",
    getRowValue: (row) => row.is_heaven,
    getCardValue: (card) => card.is_heaven ?? false
  },
  {
    label: "is_hell",
    getRowValue: (row) => row.is_hell,
    getCardValue: (card) => card.is_hell ?? false
  },
  { label: "is_active", getRowValue: (row) => row.is_active }
];

function normalizeComparableValue(field: ComparableField, value: unknown) {
  return field.normalize ? field.normalize(value) : value;
}

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function findExcelZipRowDiffColumns(
  baseRow: NormalizedExcelZipCardRow,
  comparedRow: NormalizedExcelZipCardRow
) {
  return COMPARABLE_FIELDS.filter((field) => {
    const baseValue = normalizeComparableValue(field, field.getRowValue(baseRow));
    const comparedValue = normalizeComparableValue(field, field.getRowValue(comparedRow));
    return !valuesEqual(baseValue, comparedValue);
  }).map((field) => field.label);
}

export function findExcelZipCardRecordDiffColumns(
  card: CardRecord,
  row: NormalizedExcelZipCardRow
) {
  return COMPARABLE_FIELDS.filter((field) => {
    const cardValue = normalizeComparableValue(
      field,
      field.getCardValue ? field.getCardValue(card) : (card as unknown as Record<string, unknown>)[field.label]
    );
    const rowValue = normalizeComparableValue(field, field.getRowValue(row));
    return !valuesEqual(cardValue, rowValue);
  }).map((field) => field.label);
}

export function isSameExcelZipCardRecord(
  card: CardRecord,
  row: NormalizedExcelZipCardRow
) {
  return (
    normalizeImportText(card.name) === row.name &&
    card.card_type === row.card_type &&
    JSON.stringify([...(card.worlds ?? [])].sort()) ===
      JSON.stringify([...row.worlds].sort()) &&
    JSON.stringify(card.races ?? []) === JSON.stringify(row.races) &&
    card.orientation === row.orientation &&
    card.size === row.size &&
    card.power === row.power &&
    card.defense === row.defense &&
    card.critical === row.critical &&
    (card.card_text ?? null) === row.card_text &&
    card.is_dragon === row.is_dragon &&
    card.is_hyakki === row.is_hyakki &&
    card.is_corner_king === row.is_corner_king &&
    card.is_chaos === row.is_chaos &&
    card.is_generic === row.is_generic &&
    (card.is_heaven ?? false) === row.is_heaven &&
    (card.is_hell ?? false) === row.is_hell &&
    card.is_active === row.is_active
  );
}
