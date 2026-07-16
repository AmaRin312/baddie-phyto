import type { CardOrientation, CardType } from "@/types/baddiePhyto";

export const CARD_CSV_VERSION = "1";
export const CARD_CSV_LEGACY_VERSION_LABEL = "未指定（旧形式）";
export const CARD_CSV_ARRAY_SEPARATOR = "|";

export const CARD_CSV_OFFICIAL_WORLDS = [
  "ドラゴンワールド",
  "デンジャーワールド",
  "マジックワールド",
  "カタナワールド",
  "エンシェントワールド",
  "ダンジョンワールド",
  "レジェンドワールド",
  "ダークネスドラゴンワールド",
  "ヒーローワールド",
  "スタードラゴンワールド"
] as const;

export const CARD_WORLD_ALIASES: Readonly<Record<string, string>> = {
  ドラゴン: "ドラゴンワールド",
  ドラゴンw: "ドラゴンワールド",
  ドラゴンworld: "ドラゴンワールド",
  ドラゴンワールド: "ドラゴンワールド",
  デンジャー: "デンジャーワールド",
  デンジャーw: "デンジャーワールド",
  デンジャーworld: "デンジャーワールド",
  デンジャーワールド: "デンジャーワールド",
  マジック: "マジックワールド",
  マジックw: "マジックワールド",
  マジックworld: "マジックワールド",
  マジックワールド: "マジックワールド",
  カタナ: "カタナワールド",
  カタナw: "カタナワールド",
  カタナworld: "カタナワールド",
  カタナワールド: "カタナワールド",
  エンシェント: "エンシェントワールド",
  エンシェントw: "エンシェントワールド",
  エンシェントworld: "エンシェントワールド",
  エンシェントワールド: "エンシェントワールド",
  ダンジョン: "ダンジョンワールド",
  ダンジョンw: "ダンジョンワールド",
  ダンジョンworld: "ダンジョンワールド",
  ダンジョンワールド: "ダンジョンワールド",
  レジェンド: "レジェンドワールド",
  レジェンドw: "レジェンドワールド",
  レジェンドworld: "レジェンドワールド",
  レジェンドワールド: "レジェンドワールド",
  ダークネスドラゴン: "ダークネスドラゴンワールド",
  ダークネスドラゴンw: "ダークネスドラゴンワールド",
  ダークネスドラゴンworld: "ダークネスドラゴンワールド",
  ダークネスドラゴンワールド: "ダークネスドラゴンワールド",
  ヒーロー: "ヒーローワールド",
  ヒーローw: "ヒーローワールド",
  ヒーローworld: "ヒーローワールド",
  ヒーローワールド: "ヒーローワールド",
  スタードラゴン: "スタードラゴンワールド",
  スタードラゴンw: "スタードラゴンワールド",
  スタードラゴンworld: "スタードラゴンワールド",
  スタードラゴンワールド: "スタードラゴンワールド"
};

export const CARD_CSV_HEADERS = [
  "csv_version",
  "name",
  "card_type",
  "world",
  "race",
  "size",
  "power",
  "defense",
  "critical",
  "card_text",
  "ability",
  "orientation",
  "is_dragon",
  "is_hyakki",
  "is_kakuoh",
  "is_chaos",
  "is_generic",
  "is_heaven",
  "is_hell",
  "is_active"
] as const;

export const CARD_CSV_LEGACY_HEADERS = CARD_CSV_HEADERS.filter(
  (header) => header !== "csv_version"
);

export const SUPPORTED_CARD_CSV_VERSIONS = [CARD_CSV_VERSION] as const;

export const CARD_CSV_TEMPLATE = `${CARD_CSV_HEADERS.join(",")}\r\n`;

export const CARD_CSV_EXAMPLE_TEMPLATE = `${CARD_CSV_HEADERS.join(",")}\r\n${[
  CARD_CSV_VERSION,
  "サンプルモンスター",
  "monster",
  "ドラゴンW",
  "サンプル種族",
  "1",
  "5000",
  "3000",
  "2",
  "これは入力例です。",
  "",
  "vertical",
  "false",
  "false",
  "false",
  "false",
  "false",
  "false",
  "false",
  "true"
].join(",")}\r\n${[
  CARD_CSV_VERSION,
  "サンプル魔法",
  "spell",
  "ドラゴンW",
  "",
  "",
  "",
  "",
  "",
  "カードテキストの入力例です。",
  "",
  "vertical",
  "false",
  "false",
  "false",
  "false",
  "false",
  "false",
  "false",
  "true"
].join(",")}\r\n`;

export const CARD_TYPE_ALIASES: Readonly<Record<string, CardType>> = {
  monster: "monster",
  spell: "spell",
  item: "item",
  impact: "impact",
  impact_monster: "impact_monster",
  flag_card: "flag_card",
  other: "other",
  モンスター: "monster",
  魔法: "spell",
  武器: "item",
  アイテム: "item",
  必殺技: "impact",
  必殺モンスター: "impact_monster",
  フラッグ: "flag_card",
  フラッグカード: "flag_card",
  その他: "other"
};

export const ORIENTATION_ALIASES: Readonly<Record<string, CardOrientation>> = {
  vertical: "vertical",
  horizontal: "horizontal",
  mixed: "mixed",
  縦: "vertical",
  横: "horizontal",
  複合: "mixed",
  混在: "mixed"
};

export const BOOLEAN_DEFAULTS = {
  is_dragon: false,
  is_hyakki: false,
  is_kakuoh: false,
  is_chaos: false,
  is_generic: false,
  is_heaven: false,
  is_hell: false,
  is_active: true
} as const;

export const CARD_CSV_BOOLEAN_DEFAULTS = BOOLEAN_DEFAULTS;
