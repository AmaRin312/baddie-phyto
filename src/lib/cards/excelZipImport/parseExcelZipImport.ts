import JSZip from "jszip";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase/client";
import {
  getExcelZipImageContentHash,
  getExcelZipImageStoragePath
} from "@/lib/cards/excelZipImport/excelZipImageHash";
import {
  createExcelZipCardIdentity,
  findExcelZipCardRecordDiffColumns,
  findExcelZipRowDiffColumns,
  isSameExcelZipCardRecord,
  normalizeExcelZipRow,
  normalizeImportFileName,
  normalizeImportText
} from "@/lib/cards/excelZipImport/excelZipImportNormalization";
import {
  EXCEL_ZIP_IMPORT_COLUMNS,
  EXCEL_ZIP_IMPORT_LIMITS,
  type ExcelZipCardGroup,
  type ExcelZipImageEntry,
  type ExcelZipImportColumn,
  type ExcelZipImportIssue,
  type ExcelZipImportPreview,
  type NormalizedExcelZipCardRow
} from "@/lib/cards/excelZipImport/excelZipImportTypes";
import type { AbilityRecord, CardRecord } from "@/types/baddiePhyto";

const ALLOWED_IMAGE_EXTENSIONS = new Set<string>(
  EXCEL_ZIP_IMPORT_LIMITS.allowedImageExtensions
);

function issue(
  level: ExcelZipImportIssue["level"],
  column: ExcelZipImportIssue["column"],
  message: string,
  rowNumber: number | null = null
): ExcelZipImportIssue {
  return { level, column, message, rowNumber };
}

function isUnsafeZipPath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  return (
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").includes("..")
  );
}

function getImageExtension(fileName: string) {
  const match = /\.([^.]+)$/.exec(fileName);
  const extension = match?.[1]?.toLowerCase();
  return extension && ALLOWED_IMAGE_EXTENSIONS.has(extension)
    ? (extension as ExcelZipImageEntry["extension"])
    : null;
}

function isSupportedImageFileName(fileName: string) {
  return Boolean(getImageExtension(fileName));
}

async function imageMatchesExtension(image: Blob, extension: ExcelZipImageEntry["extension"]) {
  const bytes = new Uint8Array(await image.slice(0, 16).arrayBuffer());
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a;
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;

  if (extension === "jpg" || extension === "jpeg") return isJpeg;
  if (extension === "png") return isPng;
  if (extension === "webp") return isWebp;
  return false;
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return null;
}

function findDuplicateReferences<T>(
  values: T[],
  getKey: (value: T) => string
) {
  const references = new Map<string, T[]>();
  values.forEach((value) => {
    const key = getKey(value);
    references.set(key, [...(references.get(key) ?? []), value]);
  });

  return Array.from(references.entries()).filter(
    ([, referencedValues]) => referencedValues.length > 1
  );
}

function readWorkbookRows(workbookFile: ArrayBuffer) {
  const workbook = XLSX.read(workbookFile, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: false,
    defval: ""
  });
}

function buildRawRows(rows: unknown[][], issues: ExcelZipImportIssue[]) {
  const headerRow = rows[1] ?? [];
  const headers = headerRow.map((value) => normalizeImportText(value));
  const columnIndex = new Map<string, number>();

  headers.forEach((header, index) => {
    if (!header) return;
    if (columnIndex.has(header)) {
      issues.push(issue("error", "header", `システム列名が重複しています: ${header}`, 2));
      return;
    }
    columnIndex.set(header, index);
  });

  EXCEL_ZIP_IMPORT_COLUMNS.forEach((column) => {
    if (!columnIndex.has(column)) {
      issues.push(issue("error", "header", `必須列がありません: ${column}`, 2));
    }
  });

  headers.forEach((header) => {
    if (!header) return;
    if (!(EXCEL_ZIP_IMPORT_COLUMNS as readonly string[]).includes(header)) {
      issues.push(issue("warning", "header", `未対応列です。今回は無視します: ${header}`, 2));
    }
  });

  if (issues.some((item) => item.level === "error")) return [];

  return rows.slice(2).flatMap((row, rowIndex) => {
    const rowNumber = rowIndex + 3;
    const hasValue = row.some((value) => normalizeImportText(value));
    if (!hasValue) return [];

    const values = Object.fromEntries(
      EXCEL_ZIP_IMPORT_COLUMNS.map((column) => [
        column,
        normalizeImportText(row[columnIndex.get(column) ?? -1])
      ])
    ) as Partial<Record<ExcelZipImportColumn, string>>;

    return [{ rowNumber, values }];
  });
}

async function extractZipEntries(file: File, issues: ExcelZipImportIssue[]) {
  if (file.size > EXCEL_ZIP_IMPORT_LIMITS.maxZipSizeBytes) {
    issues.push(
      issue(
        "error",
        "zip",
        `ZIPサイズが大きすぎます。${Math.floor(EXCEL_ZIP_IMPORT_LIMITS.maxZipSizeBytes / 1024 / 1024)}MB以下にしてください。`
      )
    );
    return { workbook: null, images: [] as ExcelZipImageEntry[] };
  }

  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files);

  if (entries.length > EXCEL_ZIP_IMPORT_LIMITS.maxFileCount) {
    issues.push(issue("error", "zip", `ZIP内のファイル数が多すぎます。上限: ${EXCEL_ZIP_IMPORT_LIMITS.maxFileCount}`));
  }

  entries.forEach((entry) => {
    if (isUnsafeZipPath(entry.name)) {
      issues.push(issue("error", "zip", `不正なZIPパスです: ${entry.name}`));
    }
  });

  entries.forEach((entry) => {
    const normalizedPath = entry.name.replace(/\\/g, "/");
    const isExpectedWorkbook = !entry.dir && normalizedPath === "cards.xlsx";
    const isExpectedImagesDirectory = entry.dir && normalizedPath === "images/";
    const isExpectedImageFile = !entry.dir && normalizedPath.startsWith("images/");

    if (isExpectedWorkbook || isExpectedImagesDirectory || isExpectedImageFile) {
      return;
    }

    issues.push(
      issue(
        "warning",
        "zip",
        `ZIP内に想定外の${entry.dir ? "フォルダ" : "ファイル"}があります。今回は無視します: ${entry.name}`
      )
    );
  });

  const workbookEntries = entries.filter((entry) => !entry.dir && entry.name === "cards.xlsx");
  if (workbookEntries.length !== 1) {
    issues.push(issue("error", "zip", "ZIP直下に cards.xlsx を1つだけ置いてください。"));
  }

  const hasImagesDirectory = entries.some(
    (entry) => entry.dir && entry.name.replace(/\\/g, "/") === "images/"
  );
  if (!hasImagesDirectory) {
    issues.push(issue("error", "zip", "ZIP直下に images/ フォルダを置いてください。"));
  }

  const imageEntries = entries.filter((entry) => {
    const normalizedPath = entry.name.replace(/\\/g, "/");
    return !entry.dir && normalizedPath.startsWith("images/");
  });
  if (imageEntries.length === 0) {
    issues.push(issue("error", "image", "images/ 内に画像ファイルがありません。"));
  }

  const nestedImage = imageEntries.find((entry) => {
    const withoutRoot = entry.name.replace(/\\/g, "/").slice("images/".length);
    return withoutRoot.includes("/");
  });
  if (nestedImage) {
    issues.push(issue("error", "image", `images内のサブフォルダは使えません: ${nestedImage.name}`));
  }

  if (issues.some((item) => item.level === "error")) {
    return { workbook: null, images: [] as ExcelZipImageEntry[] };
  }

  const workbook = await workbookEntries[0].async("arraybuffer");
  const images: ExcelZipImageEntry[] = [];

  for (const entry of imageEntries) {
    const fileName = normalizeImportFileName(entry.name.replace(/\\/g, "/").slice("images/".length));
    const extension = getImageExtension(fileName);
    if (!extension) {
      issues.push(issue("error", "image", `未対応の画像拡張子です: ${fileName}`));
      continue;
    }

    const blob = await entry.async("blob");
    if (blob.size > EXCEL_ZIP_IMPORT_LIMITS.maxImageSizeBytes) {
      issues.push(issue("error", "image", `画像サイズが大きすぎます: ${fileName}`));
      continue;
    }
    if (!(await imageMatchesExtension(blob, extension))) {
      issues.push(issue("error", "image", `画像の中身と拡張子が一致しません: ${fileName}`));
      continue;
    }

    images.push({
      fileName,
      zipPath: entry.name,
      extension,
      size: blob.size,
      blob
    });
  }

  const duplicateImageName = findDuplicate(images.map((image) => image.fileName));
  if (duplicateImageName) {
    issues.push(issue("error", "image", `同名画像が複数あります: ${duplicateImageName}`));
  }

  return { workbook, images };
}

function buildAbilityLookup(abilities: AbilityRecord[]) {
  const lookup = new Map<string, AbilityRecord>();
  abilities.forEach((ability) => {
    lookup.set(normalizeImportText(ability.behavior_key).toLowerCase(), ability);
    lookup.set(normalizeImportText(ability.name).toLowerCase(), ability);
  });
  return lookup;
}

function groupRows(
  rows: NormalizedExcelZipCardRow[],
  existingCards: CardRecord[],
  abilities: AbilityRecord[],
  issues: ExcelZipImportIssue[]
) {
  const byName = new Map<string, NormalizedExcelZipCardRow[]>();
  const abilityLookup = buildAbilityLookup(abilities);

  rows.forEach((row) => {
    const key = normalizeImportText(row.name);
    byName.set(key, [...(byName.get(key) ?? []), row]);
  });

  const groups: ExcelZipCardGroup[] = [];
  byName.forEach((groupRowsForName, name) => {
    const groupIssues: ExcelZipImportIssue[] = [];
    const identities = new Map<string, number[]>();
    const firstRow = groupRowsForName[0];

    groupRowsForName.forEach((row) => {
      const identity = createExcelZipCardIdentity(row);
      identities.set(identity, [...(identities.get(identity) ?? []), row.rowNumber]);
    });

    if (identities.size > 1) {
      const diffMessages = groupRowsForName
        .slice(1)
        .map((row) => {
          const diffColumns = findExcelZipRowDiffColumns(firstRow, row);
          return `${firstRow.rowNumber}行目と${row.rowNumber}行目: ${diffColumns.join(", ")}`;
        })
        .filter((message) => !message.endsWith(": "));
      groupIssues.push(
        issue(
          "error",
          "group",
          `同じカード名ですが、カード基本情報が一致しません: ${Array.from(
            identities.values()
          )
            .map((rowNumbers) => rowNumbers.join("/"))
            .join(", ")}行目${
            diffMessages.length > 0 ? ` / 差分: ${diffMessages.join(" / ")}` : ""
          }`,
          groupRowsForName[0].rowNumber
        )
      );
    }

    const abilityBehaviorKey = firstRow.ability
      ? abilityLookup.get(firstRow.ability.toLowerCase())?.behavior_key ?? null
      : null;
    if (firstRow.ability && !abilityBehaviorKey) {
      groupIssues.push(
        issue(
          "error",
          "ability",
          `Abilityが見つかりません: ${firstRow.ability}`,
          firstRow.rowNumber
        )
      );
    }

    const matchedCards = existingCards.filter(
      (card) => normalizeImportText(card.name) === name
    );
    const exactMatches = matchedCards.filter((card) =>
      isSameExcelZipCardRecord(card, firstRow)
    );
    let matchedCard: CardRecord | null = null;
    if (exactMatches.length === 1) {
      matchedCard = exactMatches[0];
    } else if (exactMatches.length > 1) {
      groupIssues.push(
        issue("error", "db", `同じ内容の既存カードが複数あります: ${name}`, firstRow.rowNumber)
      );
    } else if (matchedCards.length > 0) {
      const diffColumns = findExcelZipCardRecordDiffColumns(matchedCards[0], firstRow);
      groupIssues.push(
        issue(
          "error",
          "db",
          `同名の既存カードがありますが、カード基本情報が一致しません: ${name}${
            diffColumns.length > 0 ? ` / 差分: ${diffColumns.join(", ")}` : ""
          }`,
          firstRow.rowNumber
        )
      );
    }

    const imageFiles = groupRowsForName.map((row) => row.image_file);
    const duplicateImage = findDuplicate(imageFiles);
    if (duplicateImage) {
      groupIssues.push(
        issue("error", "image_file", `同一カード内で画像指定が重複しています: ${duplicateImage}`, firstRow.rowNumber)
      );
    }

    groups.push({
      groupKey: name,
      name,
      rows: groupRowsForName,
      status:
        groupIssues.length > 0
          ? "error"
          : matchedCard
            ? "existing_card_add_images"
            : "new_card",
      matchedCard,
      imageFiles,
      skippedExistingImageFiles: [],
      abilityBehaviorKey,
      issues: groupIssues
    });
    issues.push(...groupIssues);
  });

  return groups;
}

export async function previewExcelZipCardImport(file: File): Promise<{
  preview: ExcelZipImportPreview | null;
  error: string | null;
}> {
  const issues: ExcelZipImportIssue[] = [];

  try {
    const { workbook, images } = await extractZipEntries(file, issues);
    if (!workbook) {
      return {
        preview: {
          fileName: file.name,
          totalRows: 0,
          validRows: 0,
          cardGroups: [],
          images,
          imageHashesByFileName: {},
          issues
        },
        error: null
      };
    }

    const workbookRows = readWorkbookRows(workbook);
    if (workbookRows.length < 2) {
      issues.push(issue("error", "excel", "cards.xlsx は1行目説明、2行目システム列名、3行目以降データの形式にしてください。"));
    }
    if (workbookRows.length - 2 > EXCEL_ZIP_IMPORT_LIMITS.maxRowCount) {
      issues.push(issue("error", "excel", `Excelのデータ行が多すぎます。上限: ${EXCEL_ZIP_IMPORT_LIMITS.maxRowCount}`));
    }

    const rawRows = buildRawRows(workbookRows, issues);
    if (rawRows.length === 0) {
      issues.push(issue("error", "excel", "カードデータ行がありません。3行目以降にデータを入力してください。"));
    }
    const normalizedRows = rawRows.map((rawRow) => normalizeExcelZipRow(rawRow));
    const rows = normalizedRows
      .map((row) => row.row)
      .filter((row): row is NormalizedExcelZipCardRow => row != null);
    normalizedRows.forEach((row) => issues.push(...row.issues));

    const imagesByName = new Map(images.map((image) => [image.fileName, image]));
    const referencedImages = new Set(rows.map((row) => row.image_file));
    const imageHashByName = new Map<string, string>();
    for (const image of images) {
      imageHashByName.set(image.fileName, await getExcelZipImageContentHash(image));
    }
    findDuplicateReferences(rows, (row) => row.image_file).forEach(
      ([imageFile, referencedRows]) => {
        issues.push(
          issue(
            "error",
            "image_file",
            `同じ image_file が複数行から参照されています: ${imageFile} (${referencedRows
              .map((row) => `${row.rowNumber}行目`)
              .join(" / ")})`,
            referencedRows[0]?.rowNumber ?? null
          )
        );
      }
    );
    const rowImageHashKeys = rows
      .filter((row) => imagesByName.has(row.image_file))
      .map((row) => ({
        row,
        key: `${normalizeImportText(row.name)}::${imageHashByName.get(row.image_file) ?? ""}`
      }));
    findDuplicateReferences(rowImageHashKeys, (entry) => entry.key).forEach(
      ([, duplicatedEntries]) => {
        const rowNumbers = duplicatedEntries
          .map((entry) => `${entry.row.rowNumber}行目`)
          .join(" / ");
        const imageFiles = duplicatedEntries
          .map((entry) => entry.row.image_file)
          .join(" / ");
        issues.push(
          issue(
            "error",
            "image_file",
            `同じカードに同一内容の画像が複数指定されています: ${imageFiles} (${rowNumbers})`,
            duplicatedEntries[0]?.row.rowNumber ?? null
          )
        );
      }
    );

    rows.forEach((row) => {
      if (!isSupportedImageFileName(row.image_file)) {
        issues.push(
          issue(
            "error",
            "image_file",
            `image_file の拡張子が未対応です: ${row.image_file}`,
            row.rowNumber
          )
        );
        return;
      }
      if (!imagesByName.has(row.image_file)) {
        issues.push(issue("error", "image_file", `images内に画像が見つかりません: ${row.image_file}`, row.rowNumber));
      }
    });

    images.forEach((image) => {
      if (!referencedImages.has(image.fileName)) {
        issues.push(issue("warning", "image", `Excelから参照されていない画像です: ${image.fileName}`));
      }
    });

    const [cardsResult, abilitiesResult] = await Promise.all([
      supabase.from("cards").select("*").returns<CardRecord[]>(),
      supabase.from("abilities").select("*").eq("is_active", true).returns<AbilityRecord[]>()
    ]);

    if (cardsResult.error) return { preview: null, error: cardsResult.error.message };
    if (abilitiesResult.error) return { preview: null, error: abilitiesResult.error.message };

    const groups = buildRowsSafeGroups(
      rows,
      cardsResult.data ?? [],
      abilitiesResult.data ?? [],
      issues
    );
    const groupsWithExistingImageSkips = await markExistingImageSkips({
      groups,
      images,
      issues
    });

    return {
      preview: {
        fileName: file.name,
        totalRows: rawRows.length,
        validRows: rows.length,
        cardGroups: groupsWithExistingImageSkips,
        images,
        imageHashesByFileName: Object.fromEntries(imageHashByName.entries()),
        issues
      },
      error: null
    };
  } catch (error) {
    return {
      preview: null,
      error: error instanceof Error ? error.message : "ZIP/Excelの解析に失敗しました。"
    };
  }
}

function buildRowsSafeGroups(
  rows: NormalizedExcelZipCardRow[],
  existingCards: CardRecord[],
  abilities: AbilityRecord[],
  issues: ExcelZipImportIssue[]
) {
  if (issues.some((item) => item.level === "error")) {
    return buildGroupsWithoutDb(rows, issues);
  }

  return groupRows(rows, existingCards, abilities, issues);
}

function buildGroupsWithoutDb(
  rows: NormalizedExcelZipCardRow[],
  issues: ExcelZipImportIssue[]
) {
  const byName = new Map<string, NormalizedExcelZipCardRow[]>();
  rows.forEach((row) => {
    const name = normalizeImportText(row.name);
    byName.set(name, [...(byName.get(name) ?? []), row]);
  });

  return Array.from(byName.entries()).map<ExcelZipCardGroup>(([name, groupRowsForName]) => ({
    groupKey: name,
    name,
    rows: groupRowsForName,
    status: "error",
    matchedCard: null,
    imageFiles: groupRowsForName.map((row) => row.image_file),
    skippedExistingImageFiles: [],
    abilityBehaviorKey: groupRowsForName[0]?.ability ?? null,
    issues: issues.filter((item) =>
      item.rowNumber == null
        ? true
        : groupRowsForName.some((row) => row.rowNumber === item.rowNumber)
    )
  }));
}

async function markExistingImageSkips(input: {
  groups: ExcelZipCardGroup[];
  images: ExcelZipImageEntry[];
  issues: ExcelZipImportIssue[];
}) {
  if (input.issues.some((item) => item.level === "error")) return input.groups;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return input.groups;

  const imagesByName = new Map(input.images.map((image) => [image.fileName, image]));
  const pathEntries: Array<{
    groupKey: string;
    imageFile: string;
    path: string;
  }> = [];

  for (const group of input.groups) {
    if (!group.matchedCard) continue;
    for (const imageFile of group.imageFiles) {
      const image = imagesByName.get(imageFile);
      if (!image) continue;
      pathEntries.push({
        groupKey: group.groupKey,
        imageFile,
        path: await getExcelZipImageStoragePath({
          userId,
          cardId: group.matchedCard.id,
          image
        })
      });
    }
  }

  if (pathEntries.length === 0) return input.groups;

  const { data, error } = await supabase
    .from("card_images")
    .select("image_path")
    .in(
      "image_path",
      pathEntries.map((entry) => entry.path)
    )
    .returns<Array<{ image_path: string }>>();

  if (error) {
    input.issues.push(issue("warning", "db", `既存画像の重複確認に失敗しました: ${error.message}`));
    return input.groups;
  }

  const existingPaths = new Set((data ?? []).map((row) => row.image_path));
  const skippedByGroup = new Map<string, string[]>();
  pathEntries.forEach((entry) => {
    if (!existingPaths.has(entry.path)) return;
    skippedByGroup.set(entry.groupKey, [
      ...(skippedByGroup.get(entry.groupKey) ?? []),
      entry.imageFile
    ]);
  });

  return input.groups.map((group) => ({
    ...group,
    skippedExistingImageFiles: skippedByGroup.get(group.groupKey) ?? []
  }));
}
