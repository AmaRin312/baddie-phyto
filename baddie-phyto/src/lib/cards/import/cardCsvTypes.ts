import type { CardOrientation, CardRecord, CardType } from "@/types/baddiePhyto";

export type CardCsvColumn =
  | "csv_version"
  | "name"
  | "card_type"
  | "world"
  | "race"
  | "size"
  | "power"
  | "defense"
  | "critical"
  | "card_text"
  | "ability"
  | "orientation"
  | "is_dragon"
  | "is_hyakki"
  | "is_kakuoh"
  | "is_chaos"
  | "is_generic"
  | "is_heaven"
  | "is_hell"
  | "is_active";

export type CardCsvRawRow = {
  rowNumber: number;
  values: Partial<Record<CardCsvColumn, string>>;
};

export type CardCsvError = {
  rowNumber: number;
  column: CardCsvColumn | "file" | "header" | "import";
  message: string;
};

export type NormalizedCardCsvRow = {
  rowNumber: number;
  csv_version: string | null;
  name: string;
  card_type: CardType;
  worlds: string[];
  races: string[];
  size: number | null;
  power: number | null;
  defense: number | null;
  critical: number | null;
  card_text: string | null;
  ability: string | null;
  orientation: CardOrientation;
  is_dragon: boolean;
  is_hyakki: boolean;
  is_corner_king: boolean;
  is_chaos: boolean;
  is_generic: boolean;
  is_heaven: boolean;
  is_hell: boolean;
  is_active: boolean;
};

export type CardSetCsvInfo = {
  setCode: string;
  setName: string;
};

export type CardPrintingRecord = {
  id: string;
  card_id: string;
  set_id: string;
  card_number: string | null;
  rarity: string | null;
  created_at: string;
};

export type CardSetRecord = {
  id: string;
  set_code: string;
  name: string | null;
  created_at: string;
  updated_at: string;
};

export type CardCsvPreviewStatus =
  | "new_card"
  | "existing_add_printing"
  | "duplicate_skip"
  | "csv_duplicate"
  | "excluded"
  | "error";

export type CardCsvPreviewRow = {
  rowNumber: number;
  normalized: NormalizedCardCsvRow | null;
  status: CardCsvPreviewStatus;
  errors: CardCsvError[];
  matchedCard: CardRecord | null;
  duplicateOfRowNumber?: number;
  duplicateGroupKey?: string;
  excluded?: boolean;
};

export type CardCsvPreview = {
  set: CardSetCsvInfo;
  csvVersion: string | null;
  csvVersionLabel: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: CardCsvPreviewRow[];
  errors: CardCsvError[];
  duplicateGroups: Array<{
    key: string;
    rowNumbers: number[];
  }>;
  excludedRowNumbers: number[];
};

export type CardCsvImportResult = {
  newCards: number;
  reusedCards: number;
  printingsAdded: number;
  duplicateSkipped: number;
  abilityLinksAdded: number;
  errorCount: number;
  errors: CardCsvError[];
};

export type CardCsvDryRunRow = {
  rowNumber: number;
  status: "new_card" | "existing_add_printing" | "duplicate_skip";
  matchedCardId: string | null;
  willAddPrinting: boolean;
  willAddAbility: boolean;
};

export type CardCsvDryRunResult = CardCsvImportResult & {
  rows: CardCsvDryRunRow[];
  fingerprint: string;
};

export type CardImportLogRecord = {
  id: string;
  user_id: string;
  file_name: string;
  set_code: string;
  csv_version: string | null;
  total_row_count: number;
  excluded_duplicate_count: number;
  new_card_count: number;
  reused_card_count: number;
  printing_added_count: number;
  duplicate_skipped_count: number;
  ability_linked_count: number;
  status: "success" | "failed";
  error_message: string | null;
  created_at: string;
};
