"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import {
  ImportPageLinks,
  type ImportPageLinkItem,
} from "@/components/cards/import/ImportPageLinks";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { executeExcelZipCardImport } from "@/lib/cards/excelZipImport/executeExcelZipImport";
import { previewExcelZipCardImport } from "@/lib/cards/excelZipImport/parseExcelZipImport";
import {
  EXCEL_ZIP_IMPORT_COLUMNS,
  EXCEL_ZIP_IMPORT_LIMITS,
  type ExcelZipCardGroupStatus,
  type ExcelZipImportIssue,
  type ExcelZipImportPreview,
  type ExcelZipImportResult,
} from "@/lib/cards/excelZipImport/excelZipImportTypes";

const PAGE_LINKS: readonly ImportPageLinkItem[] = [
  { href: "/cards/import", label: "登録方法一覧へ戻る" },
  { href: "/cards", label: "カード一覧へ戻る" },
] as const;

const STATUS_LABELS: Record<ExcelZipCardGroupStatus, string> = {
  new_card: "新規カード",
  existing_card_add_images: "既存カードへ画像追加",
  error: "エラー",
};

function formatIssue(issue: ExcelZipImportIssue) {
  const rowPrefix = issue.rowNumber == null ? "" : `${issue.rowNumber}行 / `;
  return `${rowPrefix}${issue.column}: ${issue.message}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function createTemplateWorkbook() {
  const sampleRow: Partial<
    Record<(typeof EXCEL_ZIP_IMPORT_COLUMNS)[number], string>
  > = {
    name: "Sample Card",
    world1: "Dragon W",
    orientation: "vertical",
    is_dragon: "dragon",
    image_file: "sample-card.png",
    set_code: "BT01",
    set_name: "Sample Booster",
    era_key: "first",
    card_number: "001",
    rarity: "R",
    race1: "Dragon",
    card_type: "monster",
    size: "1",
    power: "5000",
    defense: "3000",
    critical: "2",
    card_text: "Enter card text here.",
    is_original: "false",
    is_active: "true",
  };

  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      "1行目は説明です。2行目のシステム列名は変更せず、3行目以降にカード情報を入力してください。image_file には images/ 直下のファイル名を指定します。",
    ],
    [...EXCEL_ZIP_IMPORT_COLUMNS],
    EXCEL_ZIP_IMPORT_COLUMNS.map((column) => sampleRow[column] ?? ""),
  ]);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "cards");
  return workbook;
}

function downloadBlobFile(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadTextFile(fileName: string, text: string, type: string) {
  const blob = new Blob([`\uFEFF${text}`], { type });
  downloadBlobFile(fileName, blob);
}

function downloadTemplate() {
  const workbook = createTemplateWorkbook();
  XLSX.writeFile(workbook, "baddie_phyto_cards_import_template.xlsx");
}

async function downloadSampleZip() {
  const workbook = createTemplateWorkbook();
  const workbookArray = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  }) as ArrayBuffer;

  const samplePngBytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    ),
    (character) => character.charCodeAt(0),
  );

  const zip = new JSZip();
  zip.file("cards.xlsx", workbookArray);
  zip.folder("images")?.file("sample-card.png", samplePngBytes);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlobFile("baddie_phyto_excel_zip_import_sample.zip", blob);
}

function csvEscape(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function formatGroupPrintings(
  rows: ExcelZipImportPreview["cardGroups"][number]["rows"],
) {
  const printings = rows
    .filter((row) => row.set_code)
    .map((row) =>
      [
        row.set_code,
        row.set_name ? `name=${row.set_name}` : "",
        row.era_key ? `era=${row.era_key}` : "",
        row.card_number ? `no=${row.card_number}` : "",
        row.rarity ? `rarity=${row.rarity}` : "",
      ]
        .filter(Boolean)
        .join(" / "),
    );

  return Array.from(new Set(printings)).join(" | ");
}

function downloadPreviewCsv(preview: ExcelZipImportPreview) {
  const rows = [
    [
      "status",
      "row_numbers",
      "card_name",
      "image_files",
      "printings",
      "image_hashes",
      "skipped_existing_image_files",
      "ability",
      "issues",
    ],
    ...preview.cardGroups.map((group) => [
      STATUS_LABELS[group.status],
      group.rows.map((row) => row.rowNumber).join(" / "),
      group.name,
      group.imageFiles.join(" / "),
      formatGroupPrintings(group.rows),
      group.imageFiles
        .map(
          (imageFile) =>
            preview.imageHashesByFileName[imageFile]?.slice(0, 12) ?? "",
        )
        .join(" / "),
      group.skippedExistingImageFiles.join(" / "),
      group.abilityBehaviorKey ?? group.rows[0]?.ability ?? "",
      group.issues.map(formatIssue).join(" / "),
    ]),
  ];

  downloadTextFile(
    "baddie_phyto_excel_zip_import_preview.csv",
    rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}

function downloadResultCsv(result: ExcelZipImportResult) {
  const rows = [
    [
      "card_id",
      "card_name",
      "card_status",
      "image_added_count",
      "skipped_image_count",
      "printing_added_count",
      "ability_linked",
      "image_files",
      "skipped_image_files",
    ],
    ...result.groupResults.map((group) => [
      group.cardId,
      group.cardName,
      group.cardCreated ? "created" : "reused",
      group.imageAddedCount,
      group.skippedImageCount,
      group.printingAddedCount,
      group.abilityLinked ? "true" : "false",
      group.imageFiles.join(" / "),
      group.skippedImageFiles.join(" / "),
    ]),
  ];

  downloadTextFile(
    "baddie_phyto_excel_zip_import_result.csv",
    rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}

function buildImportConfirmText(
  preview: ExcelZipImportPreview,
  skippedExistingImageCount: number,
) {
  return [
    "この内容でカードと画像をインポートしますか？",
    "",
    `カードグループ: ${preview.cardGroups.length}件`,
    `新規カード: ${
      preview.cardGroups.filter((group) => group.status === "new_card").length
    }件`,
    `既存カードへ画像追加: ${
      preview.cardGroups.filter(
        (group) => group.status === "existing_card_add_images",
      ).length
    }件`,
    `画像数: ${preview.cardGroups.reduce(
      (total, group) => total + group.imageFiles.length,
      0,
    )}件`,
    `既存画像スキップ: ${skippedExistingImageCount}件`,
    "",
    "確認後にカード登録と Storage への画像登録を実行します。",
  ].join("\n");
}

export default function ExcelZipCardImportPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelZipImportPreview | null>(null);
  const [result, setResult] = useState<ExcelZipImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
        return;
      }
      setAuthenticated(true);
    }

    void loadPage();
  }, [router]);

  const errors = useMemo(
    () => preview?.issues.filter((issue) => issue.level === "error") ?? [],
    [preview],
  );
  const warnings = useMemo(
    () => preview?.issues.filter((issue) => issue.level === "warning") ?? [],
    [preview],
  );
  const canImport = Boolean(preview) && errors.length === 0 && !importing;

  const skippedExistingImageCount =
    preview?.cardGroups.reduce(
      (total, group) => total + group.skippedExistingImageFiles.length,
      0,
    ) ?? 0;

  async function handleFile(file: File | null) {
    setZipFile(file);
    setPreview(null);
    setResult(null);
    setMessage("");

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setMessage("ZIP ファイルを選択してください。");
      return;
    }

    setLoading(true);
    const { preview: nextPreview, error } = await previewExcelZipCardImport(file);
    setLoading(false);

    if (error) {
      setMessage(error);
      return;
    }

    setPreview(nextPreview);
  }

  async function handleImport() {
    if (!preview || !canImport) return;
    if (!window.confirm(buildImportConfirmText(preview, skippedExistingImageCount))) {
      return;
    }

    setImporting(true);
    setMessage("");
    setResult(null);

    const { result: nextResult, error } = await executeExcelZipCardImport(preview);
    setImporting(false);

    if (error) {
      setMessage(error);
      return;
    }

    setResult(nextResult);
    setMessage("Excel + 画像 ZIP のインポートが完了しました。");
  }

  return (
    <AppShell>
      <div className="dm-stack">
        <ImportPageLinks items={PAGE_LINKS} />

        <div className="dm-page-actions">
          <button type="button" className="dm-button secondary" onClick={downloadTemplate}>
            Excel テンプレート
          </button>
          <button
            type="button"
            className="dm-button secondary"
            onClick={() => void downloadSampleZip()}
          >
            サンプル ZIP
          </button>
        </div>

        <AppCard
          title="ZIP をドロップして取り込む"
          description="cards.xlsx と images/ を含む ZIP を読み込み、そのままプレビューできます。"
        >
          <div
            className="dm-import-drop-zone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files.item(0));
            }}
          >
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={!authenticated || loading || importing}
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
            <p>ZIP を選ぶか、ここへドラッグ&ドロップしてください。</p>
          </div>

          {zipFile ? (
            <div className="dm-import-set-info">
              <span>選択中: {zipFile.name}</span>
              <span>サイズ: {formatBytes(zipFile.size)}</span>
            </div>
          ) : null}

          {loading ? <p className="dm-muted-text">ZIP と Excel を解析中です...</p> : null}
          {message ? <p className="dm-form-message">{message}</p> : null}
        </AppCard>

        <AppCard
          title="受け入れ上限"
          description="大きすぎる ZIP や不正な構成はプレビューで止めます。"
        >
          <ul>
            <li>ZIP サイズ: {formatBytes(EXCEL_ZIP_IMPORT_LIMITS.maxZipSizeBytes)} まで</li>
            <li>ZIP 内ファイル数: {EXCEL_ZIP_IMPORT_LIMITS.maxFileCount} 件まで</li>
            <li>Excel データ行: {EXCEL_ZIP_IMPORT_LIMITS.maxRowCount} 行まで</li>
            <li>画像 1 枚: {formatBytes(EXCEL_ZIP_IMPORT_LIMITS.maxImageSizeBytes)} まで</li>
            <li>対応画像形式: {EXCEL_ZIP_IMPORT_LIMITS.allowedImageExtensions.join(" / ")}</li>
          </ul>
        </AppCard>

        <AppCard title="ZIP の中身" description="ZIP の構成と取り込みルールです。">
          <ul>
            <li>1 行につき 1 カード情報グループとして扱います。</li>
            <li>同じカード情報の既存カードがあれば、そのカードへ画像追加します。</li>
            <li>画像は card-images bucket に保存されます。</li>
            <li>既存カードに画像がない場合は default 画像として設定されます。</li>
          </ul>
        </AppCard>

        {preview ? (
          <AppCard title="事前確認">
            <div className="dm-stack">
              <div className="dm-grid dm-grid-4">
                <div>
                  <b>Excel 行数</b>
                  <p>{preview.totalRows}</p>
                </div>
                <div>
                  <b>有効行数</b>
                  <p>{preview.validRows}</p>
                </div>
                <div>
                  <b>カードグループ</b>
                  <p>{preview.cardGroups.length}</p>
                </div>
                <div>
                  <b>画像</b>
                  <p>{preview.images.length}</p>
                </div>
              </div>

              <div className="dm-grid dm-grid-4">
                <div>
                  <b>新規</b>
                  <p>
                    {
                      preview.cardGroups.filter((group) => group.status === "new_card")
                        .length
                    }
                  </p>
                </div>
                <div>
                  <b>既存へ画像追加</b>
                  <p>
                    {
                      preview.cardGroups.filter(
                        (group) => group.status === "existing_card_add_images",
                      ).length
                    }
                  </p>
                </div>
                <div>
                  <b>エラー</b>
                  <p>{errors.length}</p>
                </div>
                <div>
                  <b>既存画像スキップ</b>
                  <p>{skippedExistingImageCount}</p>
                </div>
              </div>

              <div className="dm-page-actions">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={() => downloadPreviewCsv(preview)}
                >
                  preview CSV を保存
                </button>
              </div>

              {errors.length > 0 ? (
                <div className="dm-form-error">
                  <b>エラー</b>
                  <ul>
                    {errors.slice(0, 30).map((item, index) => (
                      <li key={`${item.column}-${item.rowNumber}-${index}`}>
                        {formatIssue(item)}
                      </li>
                    ))}
                  </ul>
                  {errors.length > 30 ? <p>残り {errors.length - 30} 件あります。</p> : null}
                </div>
              ) : null}

              {warnings.length > 0 ? (
                <div className="dm-form-warning">
                  <b>警告</b>
                  <ul>
                    {warnings.slice(0, 30).map((item, index) => (
                      <li key={`${item.column}-${item.rowNumber}-${index}`}>
                        {formatIssue(item)}
                      </li>
                    ))}
                  </ul>
                  {warnings.length > 30 ? (
                    <p>残り {warnings.length - 30} 件あります。</p>
                  ) : null}
                </div>
              ) : null}

              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>状態</th>
                      <th>カード名</th>
                      <th>行</th>
                      <th>画像</th>
                      <th>既存画像スキップ</th>
                      <th>Ability</th>
                      <th>備考</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cardGroups.map((group) => (
                      <tr key={group.groupKey}>
                        <td>{STATUS_LABELS[group.status]}</td>
                        <td>{group.name}</td>
                        <td>{group.rows.map((row) => row.rowNumber).join(", ")}</td>
                        <td>{group.imageFiles.join(", ")}</td>
                        <td>
                          {group.skippedExistingImageFiles.length > 0
                            ? group.skippedExistingImageFiles.join(", ")
                            : "-"}
                        </td>
                        <td>{group.abilityBehaviorKey ?? group.rows[0]?.ability ?? "-"}</td>
                        <td>
                          {group.issues.length > 0
                            ? group.issues.map(formatIssue).join(" / ")
                            : formatGroupPrintings(group.rows) || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button disabled={!canImport} onClick={() => void handleImport()}>
                {importing ? "インポート中..." : "ZIP をインポート"}
              </Button>
            </div>
          </AppCard>
        ) : null}

        {result ? (
          <AppCard title="インポート結果">
            <div className="dm-stack">
              <ul>
                <li>新規カード: {result.newCardCount}件</li>
                <li>既存カード再利用: {result.reusedCardCount}件</li>
                <li>画像追加: {result.imageAddedCount}件</li>
                <li>既存画像スキップ: {result.skippedImageCount}件</li>
                <li>Ability 連携: {result.abilityLinkedCount}件</li>
                <li>Storage 登録: {result.uploadedPaths.length}件</li>
                <li>追加印刷情報: {result.printingAddedCount}件</li>
              </ul>

              <div className="dm-page-actions">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={() => downloadResultCsv(result)}
                >
                  結果 CSV を保存
                </button>
              </div>
            </div>
          </AppCard>
        ) : null}
      </div>
    </AppShell>
  );
}
