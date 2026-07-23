import type { CardOrientation, CardRecord, CardType } from "@/types/baddiePhyto";

export const EXCEL_ZIP_IMPORT_COLUMNS = [
  "name",
  "world1",
  "world2",
  "world3",
  "orientation",
  "is_dragon",
  "is_hyakki",
  "is_kakuoh",
  "is_chaos",
  "is_generic",
  "is_heaven",
  "is_hell",
  "image_file",
  "race1",
  "race2",
  "race3",
  "race4",
  "race5",
  "card_type",
  "size",
  "power",
  "defense",
  "critical",
  "card_text",
  "ability",
  "is_active"
] as const;

export const EXCEL_ZIP_IMPORT_LIMITS = {
  maxZipSizeBytes: 100 * 1024 * 1024,
  maxFileCount: 600,
  maxRowCount: 3000,
  maxImageSizeBytes: 15 * 1024 * 1024,
  allowedImageExtensions: ["jpg", "jpeg", "png", "webp"]
} as const;

export type ExcelZipImportColumn = (typeof EXCEL_ZIP_IMPORT_COLUMNS)[number];

export type ExcelZipImportIssueLevel = "error" | "warning";

export type ExcelZipImportIssue = {
  level: ExcelZipImportIssueLevel;
  rowNumber: number | null;
  column: ExcelZipImportColumn | "zip" | "excel" | "header" | "image" | "group" | "db";
  message: string;
};

export type NormalizedExcelZipCardRow = {
  rowNumber: number;
  name: string;
  worlds: string[];
  races: string[];
  orientation: CardOrientation;
  size: number | null;
  power: number | null;
  defense: number | null;
  critical: number | null;
  card_text: string | null;
  ability: string | null;
  image_file: string;
  card_type: CardType;
  is_dragon: boolean;
  is_hyakki: boolean;
  is_corner_king: boolean;
  is_chaos: boolean;
  is_generic: boolean;
  is_heaven: boolean;
  is_hell: boolean;
  is_active: boolean;
};

export type ExcelZipImageEntry = {
  fileName: string;
  zipPath: string;
  extension: "jpg" | "jpeg" | "png" | "webp";
  size: number;
  blob: Blob;
};

export type ExcelZipCardGroupStatus =
  | "new_card"
  | "existing_card_add_images"
  | "error";

export type ExcelZipCardGroup = {
  groupKey: string;
  name: string;
  rows: NormalizedExcelZipCardRow[];
  status: ExcelZipCardGroupStatus;
  matchedCard: CardRecord | null;
  imageFiles: string[];
  skippedExistingImageFiles: string[];
  abilityBehaviorKey: string | null;
  issues: ExcelZipImportIssue[];
};

export type ExcelZipImportPreview = {
  fileName: string;
  totalRows: number;
  validRows: number;
  cardGroups: ExcelZipCardGroup[];
  images: ExcelZipImageEntry[];
  imageHashesByFileName: Record<string, string>;
  issues: ExcelZipImportIssue[];
};

export type ExcelZipImportResult = {
  newCardCount: number;
  reusedCardCount: number;
  imageAddedCount: number;
  abilityLinkedCount: number;
  skippedImageCount: number;
  uploadedPaths: string[];
  groupResults: Array<{
    cardId: string;
    cardName: string;
    cardCreated: boolean;
    reusedExistingCard: boolean;
    imageAddedCount: number;
    skippedImageCount: number;
    abilityLinked: boolean;
    imageFiles: string[];
    skippedImageFiles: string[];
  }>;
};
