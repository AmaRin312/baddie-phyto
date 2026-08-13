import { supabase } from "@/lib/supabase/client";
import {
  getExcelZipImageContentHash
} from "@/lib/cards/excelZipImport/excelZipImageHash";
import {
  isSameExcelZipCardRecord,
  normalizeImportText
} from "@/lib/cards/excelZipImport/excelZipImportNormalization";
import type {
  ExcelZipCardGroup,
  ExcelZipImageEntry,
  ExcelZipImportIssue,
  ExcelZipImportPreview,
  NormalizedExcelZipCardRow
} from "@/lib/cards/excelZipImport/excelZipImportTypes";
import type { CardRecord } from "@/types/baddiePhyto";
import type {
  TcgDbBfFetchedCard,
  TcgDbBfFetchedImage
} from "@/lib/cards/tcgDbBfImport/tcgDbBfTypes";

function base64ToBlob(input: TcgDbBfFetchedImage) {
  const binary = atob(input.base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: input.contentType });
}

function getImageExtension(contentType: string, fileName: string) {
  const lower = fileName.toLowerCase();
  if (contentType.includes("png") || lower.endsWith(".png")) return "png";
  if (contentType.includes("webp") || lower.endsWith(".webp")) return "webp";
  if (lower.endsWith(".jpeg")) return "jpeg";
  return "jpg";
}

function createImageEntry(image: TcgDbBfFetchedImage): ExcelZipImageEntry {
  const extension = getImageExtension(image.contentType, image.fileName);
  return {
    fileName: image.fileName,
    zipPath: `tcg-db/${image.fileName}`,
    extension,
    size: image.size,
    blob: base64ToBlob(image)
  };
}

function createNormalizedRow(
  fetchedCard: TcgDbBfFetchedCard,
  rowNumber: number,
  imageFile: string
): NormalizedExcelZipCardRow {
  return {
    rowNumber,
    name: fetchedCard.name,
    worlds: fetchedCard.worlds,
    races: fetchedCard.races,
    orientation: fetchedCard.orientation,
    size: fetchedCard.size,
    power: fetchedCard.power,
    defense: fetchedCard.defense,
    critical: fetchedCard.critical,
    card_text: fetchedCard.cardText,
    ability: null,
    image_file: imageFile,
    set_code: fetchedCard.setCode,
    set_name: fetchedCard.setName,
    era_key: fetchedCard.eraKey,
    card_number: fetchedCard.cardNumber,
    rarity: fetchedCard.rarity,
    card_type: fetchedCard.cardType,
    is_dragon: fetchedCard.isDragon,
    is_hyakki: fetchedCard.isHyakki,
    is_corner_king: fetchedCard.isCornerKing,
    is_chaos: fetchedCard.isChaos,
    is_generic: fetchedCard.isGeneric,
    is_heaven: fetchedCard.isHeaven,
    is_hell: fetchedCard.isHell,
    is_original: false,
    is_active: true
  };
}

async function loadExistingCardsByName(names: string[]) {
  const uniqueNames = Array.from(new Set(names.map(normalizeImportText).filter(Boolean)));
  if (uniqueNames.length === 0) return [];

  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .in("name", uniqueNames)
    .returns<CardRecord[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function loadExistingImagePaths(cardIds: string[]) {
  if (cardIds.length === 0) return new Map<string, Set<string>>();

  const { data, error } = await supabase
    .from("card_images")
    .select("card_id,image_path")
    .in("card_id", Array.from(new Set(cardIds)))
    .returns<Array<{ card_id: string; image_path: string }>>();
  if (error) throw new Error(error.message);

  const map = new Map<string, Set<string>>();
  for (const row of data ?? []) {
    const paths = map.get(row.card_id) ?? new Set<string>();
    paths.add(row.image_path);
    map.set(row.card_id, paths);
  }
  return map;
}

function createGroup(input: {
  fetchedCard: TcgDbBfFetchedCard;
  rows: NormalizedExcelZipCardRow[];
  matchedCard: CardRecord | null;
  issues: ExcelZipImportIssue[];
  skippedExistingImageFiles: string[];
}): ExcelZipCardGroup {
  return {
    groupKey: `tcg-db:${input.fetchedCard.cardKey}`,
    name: input.fetchedCard.name,
    rows: input.rows,
    status:
      input.issues.length > 0
        ? "error"
        : input.matchedCard
          ? "existing_card_add_images"
          : "new_card",
    matchedCard: input.matchedCard,
    imageFiles: input.rows.map((row) => row.image_file),
    skippedExistingImageFiles: input.skippedExistingImageFiles,
    abilityBehaviorKey: null,
    issues: input.issues
  };
}

export async function createTcgDbBfImportPreview(
  fetchedCards: TcgDbBfFetchedCard[]
): Promise<{ preview: ExcelZipImportPreview | null; error: string | null }> {
  try {
    const issues: ExcelZipImportIssue[] = [];
    const images: ExcelZipImageEntry[] = [];
    const imageHashesByFileName: Record<string, string> = {};
    const existingCards = await loadExistingCardsByName(
      fetchedCards.map((card) => card.name)
    );
    const exactMatchedCards: CardRecord[] = [];
    const groupsSeed: Array<{
      fetchedCard: TcgDbBfFetchedCard;
      rows: NormalizedExcelZipCardRow[];
      matchedCard: CardRecord | null;
      issues: ExcelZipImportIssue[];
    }> = [];

    let rowNumber = 3;
    for (const fetchedCard of fetchedCards) {
      const groupIssues: ExcelZipImportIssue[] = [];
      const sameNameCards = existingCards.filter(
        (card) => normalizeImportText(card.name) === normalizeImportText(fetchedCard.name)
      );
      const cardImages = fetchedCard.images.map(createImageEntry);
      const rows = cardImages.map((image) =>
        createNormalizedRow(fetchedCard, rowNumber++, image.fileName)
      );
      const exactMatches = sameNameCards.filter((card) =>
        rows[0] ? isSameExcelZipCardRecord(card, rows[0]) : false
      );
      const matchedCard = exactMatches[0] ?? null;

      if (cardImages.length === 0) {
        groupIssues.push({
          level: "error",
          rowNumber: null,
          column: "image",
          message: `${fetchedCard.name}: 画像が取得できませんでした。`
        });
      }

      if (sameNameCards.length > 0 && exactMatches.length === 0 && rows[0]) {
        groupIssues.push({
          level: "error",
          rowNumber: rows[0].rowNumber,
          column: "group",
          message:
            "同名カードが既に存在しますが、取得したカード情報と一致しません。手動確認してください。"
        });
      }

      if (exactMatches.length > 1 && rows[0]) {
        groupIssues.push({
          level: "error",
          rowNumber: rows[0].rowNumber,
          column: "group",
          message:
            "同じ内容の既存カードが複数見つかりました。重複整理後に再実行してください。"
        });
      }

      images.push(...cardImages);
      if (matchedCard) exactMatchedCards.push(matchedCard);
      groupsSeed.push({
        fetchedCard,
        rows,
        matchedCard,
        issues: groupIssues
      });
    }

    const existingImagePathsByCard = await loadExistingImagePaths(
      exactMatchedCards.map((card) => card.id)
    );
    const cardGroups: ExcelZipCardGroup[] = [];

    for (const image of images) {
      imageHashesByFileName[image.fileName] = await getExcelZipImageContentHash(image);
    }

    for (const seed of groupsSeed) {
      const existingPaths = seed.matchedCard
        ? existingImagePathsByCard.get(seed.matchedCard.id) ?? new Set<string>()
        : new Set<string>();
      const skippedExistingImageFiles: string[] = [];

      for (const row of seed.rows) {
        const hash = imageHashesByFileName[row.image_file];
        const extension = row.image_file.split(".").pop() ?? "jpg";
        const expectedPathSuffix = seed.matchedCard
          ? `/${seed.matchedCard.id}/${hash}.${extension}`
          : null;
        if (
          expectedPathSuffix &&
          Array.from(existingPaths).some((path) => path.endsWith(expectedPathSuffix))
        ) {
          skippedExistingImageFiles.push(row.image_file);
        }
      }

      issues.push(...seed.issues);
      cardGroups.push(
        createGroup({
          ...seed,
          skippedExistingImageFiles
        })
      );
    }

    return {
      preview: {
        fileName: "tcg-db-bf-import",
        totalRows: fetchedCards.length,
        validRows: cardGroups.filter((group) => group.status !== "error").length,
        cardGroups,
        images,
        imageHashesByFileName,
        issues
      },
      error: null
    };
  } catch (error) {
    return {
      preview: null,
      error:
        error instanceof Error
          ? error.message
          : "TCG DB取込プレビューの作成に失敗しました。"
    };
  }
}
