import { supabase } from "@/lib/supabase/client";
import { parseCardCsv, parseCardSetFromFileName } from "@/lib/cards/import/parseCardCsv";
import {
  CARD_CSV_LEGACY_VERSION_LABEL,
  CARD_CSV_VERSION
} from "@/lib/cards/import/cardCsvConstants";
import {
  createCardIdentityKey,
  normalizeCardTextValue,
  normalizeListForComparison,
  normalizeTextValue
} from "@/lib/cards/import/cardCsvNormalization";
import { normalizeCardCsvRow } from "@/lib/cards/import/validateCardCsv";
import type {
  CardCsvError,
  CardCsvDryRunResult,
  CardCsvImportResult,
  CardCsvPreview,
  CardImportLogRecord,
  CardPrintingRecord,
  CardSetRecord,
  NormalizedCardCsvRow
} from "@/lib/cards/import/cardCsvTypes";
import type { AbilityRecord, CardRecord } from "@/types/baddiePhyto";

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function nullableText(value: string | null) {
  return value == null ? null : normalizeCardTextValue(value) || null;
}

export function isSameCard(card: CardRecord, row: NormalizedCardCsvRow) {
  return (
    normalizeTextValue(card.name) === row.name &&
    card.card_type === row.card_type &&
    arraysEqual(normalizeListForComparison(card.worlds ?? []), normalizeListForComparison(row.worlds)) &&
    arraysEqual(normalizeListForComparison(card.races ?? []), normalizeListForComparison(row.races)) &&
    card.size === row.size &&
    card.power === row.power &&
    card.defense === row.defense &&
    card.critical === row.critical &&
    nullableText(card.card_text) === row.card_text &&
    card.orientation === row.orientation &&
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

export function createCardCsvFingerprint(preview: CardCsvPreview) {
  const rows = preview.rows
    .filter(
      (row) =>
        row.status !== "error" &&
        row.status !== "excluded" &&
        row.status !== "csv_duplicate"
    )
    .map((row) => row.normalized)
    .filter((row): row is NormalizedCardCsvRow => row != null)
    .filter((row) => !preview.excludedRowNumbers.includes(row.rowNumber));

  return JSON.stringify({
    setCode: preview.set.setCode,
    setName: preview.set.setName,
    csvVersion: preview.csvVersion,
    excludedRowNumbers: preview.excludedRowNumbers,
    rows
  });
}

export function getImportableRows(preview: CardCsvPreview) {
  return preview.rows
    .filter(
      (row) =>
        row.status !== "error" &&
        row.status !== "excluded" &&
        row.status !== "csv_duplicate"
    )
    .map((row) => row.normalized)
    .filter((row): row is NormalizedCardCsvRow => row != null)
    .filter((row) => !preview.excludedRowNumbers.includes(row.rowNumber));
}

function normalizeImportResult(data: unknown): CardCsvImportResult {
  const result = data as Partial<CardCsvImportResult> | null;
  return {
    newCards: result?.newCards ?? 0,
    reusedCards: result?.reusedCards ?? 0,
    printingsAdded: result?.printingsAdded ?? 0,
    duplicateSkipped: result?.duplicateSkipped ?? 0,
    abilityLinksAdded: result?.abilityLinksAdded ?? 0,
    errorCount: result?.errorCount ?? 0,
    errors: result?.errors ?? []
  };
}

export async function previewCardCsvImport(input: {
  fileName: string;
  csvText: string;
  excludedRowNumbers?: number[];
}): Promise<{ preview: CardCsvPreview | null; error: string | null }> {
  const set = parseCardSetFromFileName(input.fileName);
  const excludedRowNumberSet = new Set(input.excludedRowNumbers ?? []);
  const parsed = parseCardCsv(input.csvText);
  const normalizedRows = parsed.rows.map((rawRow) => {
    const normalized = normalizeCardCsvRow(rawRow);
    return {
      rawRow,
      normalized: normalized.row,
      errors: normalized.errors
    };
  });
  const normalizedWithoutRowErrors = normalizedRows
    .map((row) => row.normalized)
    .filter((row): row is NormalizedCardCsvRow => row != null);
  const abilityKeys = Array.from(
    new Set(
      normalizedWithoutRowErrors
        .map((row) => row.ability)
        .filter((ability): ability is string => Boolean(ability))
    )
  );
  const versions = Array.from(
    new Set(
      normalizedWithoutRowErrors
        .map((row) => row.csv_version)
        .filter((version): version is string => Boolean(version))
    )
  );
  const csvVersion = versions[0] ?? null;

  const [cardsResult, abilitiesResult, setsResult] = await Promise.all([
    supabase.from("cards").select("*").returns<CardRecord[]>(),
    supabase
      .from("abilities")
      .select("*")
      .in("behavior_key", abilityKeys.length > 0 ? abilityKeys : ["__none__"])
      .eq("is_active", true)
      .returns<AbilityRecord[]>(),
    supabase
      .from("card_sets")
      .select("*")
      .eq("set_code", set.setCode)
      .maybeSingle<CardSetRecord>()
  ]);

  if (cardsResult.error) {
    return { preview: null, error: cardsResult.error.message };
  }

  if (abilitiesResult.error) {
    return { preview: null, error: abilitiesResult.error.message };
  }

  if (setsResult.error) {
    return { preview: null, error: setsResult.error.message };
  }

  const existingCards = cardsResult.data ?? [];
  const activeAbilityKeys = new Set(
    (abilitiesResult.data ?? []).map((ability) => ability.behavior_key)
  );
  const setId = setsResult.data?.id ?? null;
  const printingsResult = setId
    ? await supabase
        .from("card_printings")
        .select("*")
        .eq("set_id", setId)
        .returns<CardPrintingRecord[]>()
    : { data: [] as CardPrintingRecord[], error: null };

  if (printingsResult.error) {
    return { preview: null, error: printingsResult.error.message };
  }

  const existingPrintingCardIds = new Set(
    (printingsResult.data ?? []).map((printing) => printing.card_id)
  );
  const rowMetadata = normalizedRows.map((row) => {
    const rowErrors: CardCsvError[] = [...row.errors];
    const isExcluded = excludedRowNumberSet.has(row.rawRow.rowNumber);

    if (row.normalized?.ability && !activeAbilityKeys.has(row.normalized.ability)) {
      rowErrors.push({
        rowNumber: row.normalized.rowNumber,
        column: "ability",
        message: `behavior_key "${row.normalized.ability}" が見つかりません`
      });
    }

    if (isExcluded) {
      return {
        rowNumber: row.rawRow.rowNumber,
        normalized: row.normalized,
        status: "excluded" as const,
        errors: rowErrors,
        matchedCard: null,
        excluded: true
      };
    }

    if (!row.normalized || rowErrors.length > 0) {
      return {
        rowNumber: row.rawRow.rowNumber,
        normalized: row.normalized,
        status: "error" as const,
        errors: rowErrors,
        matchedCard: null
      };
    }

    const normalized = row.normalized;
    const matchedCard = existingCards.find((card) => isSameCard(card, normalized));
    if (!matchedCard) {
      return {
        rowNumber: row.rawRow.rowNumber,
        normalized,
        status: "new_card" as const,
        errors: [],
        matchedCard: null
      };
    }

    return {
      rowNumber: row.rawRow.rowNumber,
      normalized,
      status: existingPrintingCardIds.has(matchedCard.id)
        ? ("duplicate_skip" as const)
        : ("existing_add_printing" as const),
      errors: [],
      matchedCard
    };
  });
  const versionCheckedRows =
    versions.length > 1
      ? rowMetadata.map((row) => ({
          ...row,
          status: "error" as const,
          errors: [
            ...row.errors,
            {
              rowNumber: row.rowNumber,
              column: "csv_version" as const,
              message: "同一CSV内でcsv_versionが混在しています。"
            }
          ]
        }))
      : rowMetadata;
  const abilityConflictMap = new Map<string, Map<string, number[]>>();
  versionCheckedRows.forEach((row) => {
    if (!row.normalized || row.errors.length > 0 || row.excluded) return;
    const key = createCardIdentityKey(row.normalized, { includeAbility: false });
    const abilityKey = row.normalized.ability ?? "";
    const abilityRows = abilityConflictMap.get(key) ?? new Map<string, number[]>();
    abilityRows.set(abilityKey, [...(abilityRows.get(abilityKey) ?? []), row.rowNumber]);
    abilityConflictMap.set(key, abilityRows);
  });
  const abilityConflictRows = new Map<number, number[]>();
  abilityConflictMap.forEach((abilityRows) => {
    if (abilityRows.size <= 1) return;
    const rowNumbers = Array.from(abilityRows.values()).flat().sort((left, right) => left - right);
    rowNumbers.forEach((rowNumber) => abilityConflictRows.set(rowNumber, rowNumbers));
  });

  const conflictCheckedRows = rowMetadata.map((row) => {
    const conflictRows = abilityConflictRows.get(row.rowNumber);
    if (!conflictRows || !row.normalized || row.excluded) return row;

    return {
      ...row,
      status: "error" as const,
      errors: [
        ...row.errors,
        {
          rowNumber: row.rowNumber,
          column: "ability" as const,
          message: `${conflictRows.join("行目 / ")}行目は同一カード内容でAbilityだけが異なります。`
        }
      ]
    };
  });

  const duplicateMap = new Map<string, number[]>();
  conflictCheckedRows.forEach((row) => {
    if (!row.normalized || row.errors.length > 0 || row.excluded) return;
    const key = createCardIdentityKey(row.normalized, { includeAbility: true });
    duplicateMap.set(key, [...(duplicateMap.get(key) ?? []), row.rowNumber]);
  });
  const duplicateGroups = Array.from(duplicateMap.entries())
    .filter(([, rowNumbers]) => rowNumbers.length > 1)
    .map(([key, rowNumbers]) => ({ key, rowNumbers }));
  const duplicateFirstRows = new Map(
    duplicateGroups.flatMap((group) =>
      group.rowNumbers.slice(1).map((rowNumber) => [rowNumber, group] as const)
    )
  );
  const rows = conflictCheckedRows.map((row) => {
    const duplicateGroup = duplicateFirstRows.get(row.rowNumber);
    if (!duplicateGroup || row.status === "error" || row.status === "excluded") {
      return row;
    }

    return {
      ...row,
      status: "csv_duplicate" as const,
      duplicateOfRowNumber: duplicateGroup.rowNumbers[0],
      duplicateGroupKey: duplicateGroup.key
    };
  });
  const allErrors = [...parsed.errors, ...rows.flatMap((row) => row.errors)];

  return {
    preview: {
      set,
      csvVersion,
      csvVersionLabel: csvVersion ?? CARD_CSV_LEGACY_VERSION_LABEL,
      totalRows: normalizedRows.length,
      validRows: rows.filter(
        (row) => row.status !== "error" && row.status !== "excluded"
      ).length,
      errorRows: rows.filter((row) => row.status === "error").length,
      rows,
      errors: allErrors,
      duplicateGroups,
      excludedRowNumbers: Array.from(excludedRowNumberSet)
    },
    error: null
  };
}

export async function executeCardCsvImport(input: {
  preview: CardCsvPreview;
  dryRun: CardCsvDryRunResult;
  fileName: string;
}): Promise<{ result: CardCsvImportResult | null; error: string | null }> {
  if (input.preview.errors.length > 0) {
    return {
      result: null,
      error: "エラーが残っているため登録できません。"
    };
  }

  if (input.dryRun.fingerprint !== createCardCsvFingerprint(input.preview)) {
    return {
      result: null,
      error: "DB確認後にCSV内容が変更されています。もう一度DB確認を実行してください。"
    };
  }

  const rows = getImportableRows(input.preview);

  const { data, error } = await supabase.rpc("import_baddie_phyto_card_csv", {
    p_set_code: input.preview.set.setCode,
    p_set_name: input.preview.set.setName,
    p_rows: rows
  });

  if (error) {
    await saveCardImportLog({
      fileName: input.fileName,
      preview: input.preview,
      result: null,
      status: "failed",
      errorMessage: "CSV登録に失敗しました。入力内容を確認して再試行してください。"
    });
    return { result: null, error: error.message };
  }

  const result = normalizeImportResult(data);
  const logResult = await saveCardImportLog({
    fileName: input.fileName,
    preview: input.preview,
    result,
    status: "success",
    errorMessage: null
  });

  return {
    result,
    error: logResult.error
      ? "カード登録は成功しましたが、履歴保存に失敗しました。"
      : null
  };
}

export async function dryRunCardCsvImport(input: {
  preview: CardCsvPreview;
}): Promise<{ result: CardCsvDryRunResult | null; error: string | null }> {
  if (
    input.preview.errors.length > 0 ||
    input.preview.duplicateGroups.length > 0
  ) {
    return {
      result: null,
      error: "エラーまたは未解決のCSV内重複があるためDB確認できません。"
    };
  }

  const { data, error } = await supabase.rpc("preview_baddie_phyto_card_csv", {
    p_set_code: input.preview.set.setCode,
    p_set_name: input.preview.set.setName,
    p_rows: getImportableRows(input.preview)
  });

  if (error) {
    return {
      result: null,
      error: "DB確認に失敗しました。入力内容を確認して再試行してください。"
    };
  }

  const normalized = normalizeImportResult(data);
  const payload = data as { rows?: CardCsvDryRunResult["rows"] } | null;
  return {
    result: {
      ...normalized,
      rows: payload?.rows ?? [],
      fingerprint: createCardCsvFingerprint(input.preview)
    },
    error: null
  };
}

export async function saveCardImportLog(input: {
  fileName: string;
  preview: CardCsvPreview;
  result: CardCsvImportResult | null;
  status: "success" | "failed";
  errorMessage: string | null;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_card_import_log", {
    p_file_name: input.fileName,
    p_set_code: input.preview.set.setCode,
    p_csv_version: input.preview.csvVersion ?? CARD_CSV_VERSION,
    p_total_row_count: input.preview.totalRows,
    p_excluded_duplicate_count: input.preview.excludedRowNumbers.length,
    p_new_card_count: input.result?.newCards ?? 0,
    p_reused_card_count: input.result?.reusedCards ?? 0,
    p_printing_added_count: input.result?.printingsAdded ?? 0,
    p_duplicate_skipped_count: input.result?.duplicateSkipped ?? 0,
    p_ability_linked_count: input.result?.abilityLinksAdded ?? 0,
    p_status: input.status,
    p_error_message: input.errorMessage
  });

  if (error) {
    return { id: null, error: error.message };
  }

  return { id: data as string, error: null };
}

export async function loadCardImportLogs(input: {
  page: number;
  pageSize: number;
}): Promise<{
  logs: CardImportLogRecord[];
  count: number;
  error: string | null;
}> {
  const from = Math.max(input.page - 1, 0) * input.pageSize;
  const to = from + input.pageSize - 1;
  const { data, error, count } = await supabase
    .from("card_import_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<CardImportLogRecord[]>();

  if (error) {
    return { logs: [], count: 0, error: error.message };
  }

  return { logs: data ?? [], count: count ?? 0, error: null };
}

export type CsvAbilityOption = Pick<
  AbilityRecord,
  "id" | "name" | "behavior_key" | "description"
>;

export async function loadAvailableCsvAbilities(): Promise<{
  abilities: CsvAbilityOption[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("abilities")
    .select("id,name,behavior_key,description")
    .eq("is_active", true)
    .not("behavior_key", "is", null)
    .neq("behavior_key", "")
    .order("behavior_key")
    .returns<CsvAbilityOption[]>();

  if (error) {
    return { abilities: [], error: error.message };
  }

  return { abilities: data ?? [], error: null };
}

export async function countImageLessImportedCards(input: {
  rows: NormalizedCardCsvRow[];
}): Promise<{ count: number; error: string | null }> {
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("*")
    .returns<CardRecord[]>();

  if (cardsError) {
    return { count: 0, error: cardsError.message };
  }

  const cardIds = Array.from(
    new Set(
      input.rows
        .map((row) => (cards ?? []).find((card) => isSameCard(card, row))?.id)
        .filter((id): id is string => Boolean(id))
    )
  );

  if (cardIds.length === 0) {
    return { count: 0, error: null };
  }

  const { data: images, error: imagesError } = await supabase
    .from("card_images")
    .select("card_id")
    .in("card_id", cardIds)
    .returns<Array<{ card_id: string }>>();

  if (imagesError) {
    return { count: 0, error: imagesError.message };
  }

  const cardsWithImages = new Set((images ?? []).map((image) => image.card_id));
  return {
    count: cardIds.filter((cardId) => !cardsWithImages.has(cardId)).length,
    error: null
  };
}
