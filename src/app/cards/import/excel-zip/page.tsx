"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { executeExcelZipCardImport } from "@/lib/cards/excelZipImport/executeExcelZipImport";
import { previewExcelZipCardImport } from "@/lib/cards/excelZipImport/parseExcelZipImport";
import { EXCEL_ZIP_IMPORT_COLUMNS } from "@/lib/cards/excelZipImport/excelZipImportTypes";
import type {
  ExcelZipCardGroupStatus,
  ExcelZipImportIssue,
  ExcelZipImportPreview,
  ExcelZipImportResult
} from "@/lib/cards/excelZipImport/excelZipImportTypes";

const STATUS_LABELS: Record<ExcelZipCardGroupStatus, string> = {
  new_card: "新規カード",
  existing_card_add_images: "既存カードへ画像追加",
  error: "エラー"
};

function formatIssue(issue: ExcelZipImportIssue) {
  const row = issue.rowNumber == null ? "" : `${issue.rowNumber}行目 / `;
  return `${row}${issue.column}: ${issue.message}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

function createTemplateWorkbook() {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [
      "1行目は説明行です。2行目のシステム列名を変更せず、3行目以降にカードデータを入力してください。image_fileにはimagesフォルダ直下の画像ファイル名を入れます。"
    ],
    [...EXCEL_ZIP_IMPORT_COLUMNS],
    [
      "サンプルカード",
      "ドラゴンW",
      "",
      "",
      "vertical",
      "dragon",
      "",
      "",
      "",
      "",
      "",
      "",
      "サンプルカード.png",
      "ドラゴン",
      "",
      "",
      "",
      "",
      "monster",
      "1",
      "5000",
      "3000",
      "2",
      "カードテキストを入力します。",
      "",
      "true"
    ]
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "cards");
  return workbook;
}

function downloadExcelTemplate() {
  const workbook = createTemplateWorkbook();
  XLSX.writeFile(workbook, "baddie_phyto_cards_import_template.xlsx");
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadTextFile(input: {
  fileName: string;
  text: string;
  type: string;
}) {
  const blob = new Blob([`\uFEFF${input.text}`], { type: input.type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadBlobFile(input: {
  fileName: string;
  blob: Blob;
}) {
  const url = URL.createObjectURL(input.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadSampleZip() {
  const workbook = createTemplateWorkbook();
  const workbookArray = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array"
  }) as ArrayBuffer;
  const samplePngBytes = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    ),
    (character) => character.charCodeAt(0)
  );
  const zip = new JSZip();
  zip.file("cards.xlsx", workbookArray);
  zip.folder("images")?.file("サンプルカード.png", samplePngBytes);

  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlobFile({
    fileName: "baddie_phyto_excel_zip_import_sample.zip",
    blob
  });
}

function downloadPreviewCsv(preview: ExcelZipImportPreview) {
  const rows = [
    [
      "status",
      "row_numbers",
      "card_name",
      "image_files",
      "image_hashes",
      "skipped_existing_image_files",
      "ability",
      "issues"
    ],
    ...preview.cardGroups.map((group) => [
      STATUS_LABELS[group.status],
      group.rows.map((row) => row.rowNumber).join(" / "),
      group.name,
      group.imageFiles.join(" / "),
      group.imageFiles
        .map((imageFile) => preview.imageHashesByFileName[imageFile]?.slice(0, 12) ?? "")
        .join(" / "),
      group.skippedExistingImageFiles.join(" / "),
      group.abilityBehaviorKey ?? group.rows[0]?.ability ?? "",
      group.issues.map(formatIssue).join(" / ")
    ]),
    ...preview.issues
      .filter((issue) => issue.rowNumber == null)
      .map((issue) => [
        issue.level,
        "",
        "",
        "",
        "",
        "",
        "",
        formatIssue(issue)
      ])
  ];

  downloadTextFile({
    fileName: "baddie_phyto_excel_zip_import_preview.csv",
    text: rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"),
    type: "text/csv;charset=utf-8"
  });
}

function downloadResultCsv(result: ExcelZipImportResult) {
  const rows = [
    [
      "card_id",
      "card_name",
      "card_status",
      "image_added_count",
      "skipped_image_count",
      "ability_linked",
      "image_files",
      "skipped_image_files"
    ],
    ...result.groupResults.map((group) => [
      group.cardId,
      group.cardName,
      group.cardCreated ? "created" : "reused",
      group.imageAddedCount,
      group.skippedImageCount,
      group.abilityLinked ? "true" : "false",
      group.imageFiles.join(" / "),
      group.skippedImageFiles.join(" / ")
    ])
  ];

  downloadTextFile({
    fileName: "baddie_phyto_excel_zip_import_result.csv",
    text: rows.map((row) => row.map(csvEscape).join(",")).join("\r\n"),
    type: "text/csv;charset=utf-8"
  });
}

export default function ExcelZipCardImportPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ExcelZipImportPreview | null>(null);
  const [result, setResult] = useState<ExcelZipImportResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    async function checkProfile() {
      if (!(await getOrCreateProfile())) {
        window.location.href = "/login";
        return;
      }
      setAuthenticated(true);
    }

    void checkProfile();
  }, []);

  const errors = useMemo(
    () => preview?.issues.filter((issue) => issue.level === "error") ?? [],
    [preview]
  );
  const warnings = useMemo(
    () => preview?.issues.filter((issue) => issue.level === "warning") ?? [],
    [preview]
  );
  const canImport = Boolean(preview) && errors.length === 0 && !importing;
  const skippedExistingImageCount =
    preview?.cardGroups.reduce(
      (total, group) => total + group.skippedExistingImageFiles.length,
      0
    ) ?? 0;

  async function handleFile(file: File | null) {
    setZipFile(file);
    setPreview(null);
    setResult(null);
    setMessage("");
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".zip")) {
      setMessage("ZIPファイルを選択してください。");
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

    const confirmed = window.confirm(
      [
        "この内容でカードと画像を登録します。",
        "",
        `カードグループ: ${preview.cardGroups.length}件`,
        `新規カード: ${preview.cardGroups.filter((group) => group.status === "new_card").length}件`,
        `既存カードへ画像追加: ${preview.cardGroups.filter((group) => group.status === "existing_card_add_images").length}件`,
        `画像: ${preview.cardGroups.reduce((total, group) => total + group.imageFiles.length, 0)}件`,
        `同一画像スキップ予定: ${skippedExistingImageCount}件`,
        "",
        "途中失敗時は、今回アップロードしたStorage画像を可能な範囲で削除します。"
      ].join("\n")
    );

    if (!confirmed) return;

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
    setMessage("Excel＋画像ZIPのインポートが完了しました。");
  }

  return (
    <AppShell kicker="Cards" title="Excel＋画像ZIP 一括インポート">
      <div className="dm-stack">
        <div className="dm-row">
          <Link href="/cards/import">CSVインポートへ戻る</Link>
          <Link href="/cards">カード一覧へ</Link>
          <button
            type="button"
            className="dm-button secondary"
            onClick={downloadExcelTemplate}
          >
            ExcelテンプレートDL
          </button>
          <button
            type="button"
            className="dm-button secondary"
            onClick={() => void downloadSampleZip()}
          >
            サンプルZIP DL
          </button>
        </div>

        <AppCard
          title="ZIPファイル"
          description="ZIP直下に cards.xlsx と images/ を置いてください。cards.xlsx は1行目説明、2行目システム列名、3行目以降データとして読み込みます。"
        >
          <div className="dm-stack">
            <input
              type="file"
              accept=".zip,application/zip"
              disabled={!authenticated || loading || importing}
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
            {zipFile && (
              <p>
                選択中: {zipFile.name} / {formatBytes(zipFile.size)}
              </p>
            )}
            {loading && <p>ZIPとExcelを確認しています...</p>}
            {message && <p className="dm-form-error">{message}</p>}
          </div>
        </AppCard>

        <AppCard
          title="読み込み仕様"
          description="この画面ではExcel列 is_kakuoh を受け取り、既存DB互換のため保存時は cards.is_corner_king に反映します。is_active の空欄は false として扱います。"
        >
          <ul>
            <li>同じカード名の複数行は1枚のカード＋複数画像としてまとめます。</li>
            <li>同じカード名でカード基本情報が違う場合はエラーにします。</li>
            <li>画像は Storage の card-images bucket にアップロードします。</li>
            <li>最初の画像は、既存画像がない場合だけDefault画像にします。</li>
          </ul>
        </AppCard>

        <AppCard
          title="手動テスト手順"
          description="まずサンプルZIPで、ZIP構成・Excel列・日本語ファイル名の読み込みを確認できます。"
        >
          <ol>
            <li>「サンプルZIP DL」を押して、テスト用ZIPをダウンロードします。</li>
            <li>この画面のファイル選択で、そのZIPを選択します。</li>
            <li>事前確認でエラーが0件になり、カード1件・画像1件として表示されることを確認します。</li>
            <li>実際に登録する場合だけ「登録する」を押します。</li>
            <li>登録後は「登録結果CSVをDL」で、追加カード・追加画像・スキップ画像を保存できます。</li>
          </ol>
          <p className="dm-muted-text">
            サンプルZIPは cards.xlsx と images/サンプルカード.png を含みます。実運用ZIPも同じ構成にしてください。
          </p>
        </AppCard>

        {preview && (
          <AppCard title="事前確認">
            <div className="dm-stack">
              <div className="dm-grid dm-grid-4">
                <div>
                  <b>Excel行数</b>
                  <p>{preview.totalRows}</p>
                </div>
                <div>
                  <b>有効行</b>
                  <p>{preview.validRows}</p>
                </div>
                <div>
                  <b>カード数</b>
                  <p>{preview.cardGroups.length}</p>
                </div>
                <div>
                  <b>画像数</b>
                  <p>{preview.images.length}</p>
                </div>
              </div>

              <div className="dm-grid dm-grid-3">
                <div>
                  <b>新規</b>
                  <p>{preview.cardGroups.filter((group) => group.status === "new_card").length}</p>
                </div>
                <div>
                  <b>既存へ画像追加</b>
                  <p>
                    {
                      preview.cardGroups.filter(
                        (group) => group.status === "existing_card_add_images"
                      ).length
                    }
                  </p>
                </div>
                <div>
                  <b>エラー</b>
                  <p>{errors.length}</p>
                </div>
                <div>
                  <b>同一画像スキップ予定</b>
                  <p>{skippedExistingImageCount}</p>
                </div>
              </div>

              <div className="dm-row">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={() => downloadPreviewCsv(preview)}
                >
                  preview結果CSVをDL
                </button>
              </div>

              {errors.length > 0 && (
                <div className="dm-form-error">
                  <b>エラー</b>
                  <ul>
                    {errors.slice(0, 30).map((item, index) => (
                      <li key={`${item.column}-${item.rowNumber}-${index}`}>
                        {formatIssue(item)}
                      </li>
                    ))}
                  </ul>
                  {errors.length > 30 && <p>他 {errors.length - 30} 件あります。</p>}
                </div>
              )}

              {warnings.length > 0 && (
                <div className="dm-form-warning">
                  <b>警告</b>
                  <ul>
                    {warnings.slice(0, 30).map((item, index) => (
                      <li key={`${item.column}-${item.rowNumber}-${index}`}>
                        {formatIssue(item)}
                      </li>
                    ))}
                  </ul>
                  {warnings.length > 30 && <p>他 {warnings.length - 30} 件あります。</p>}
                </div>
              )}

              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>状態</th>
                      <th>カード名</th>
                      <th>行</th>
                      <th>画像</th>
                      <th>スキップ予定</th>
                      <th>Ability</th>
                      <th>問題</th>
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
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button disabled={!canImport} onClick={() => void handleImport()}>
                {importing ? "登録中..." : "登録する"}
              </Button>
            </div>
          </AppCard>
        )}

        {result && (
          <AppCard title="登録結果">
            <div className="dm-stack">
              <ul>
                <li>新規カード: {result.newCardCount}件</li>
                <li>既存カード利用: {result.reusedCardCount}件</li>
                <li>画像追加: {result.imageAddedCount}件</li>
                <li>同一画像スキップ: {result.skippedImageCount}件</li>
                <li>Ability紐付け: {result.abilityLinkedCount}件</li>
                <li>Storageアップロード: {result.uploadedPaths.length}件</li>
              </ul>

              <div className="dm-row">
                <button
                  type="button"
                  className="dm-button secondary"
                  onClick={() => downloadResultCsv(result)}
                >
                  登録結果CSVをDL
                </button>
              </div>

              {result.groupResults.length > 0 && (
                <div className="dm-table-wrap">
                  <table className="dm-table">
                    <thead>
                      <tr>
                        <th>カード名</th>
                        <th>カード</th>
                        <th>画像追加</th>
                        <th>スキップ</th>
                        <th>Ability</th>
                        <th>画像</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.groupResults.map((group) => (
                        <tr key={group.cardId}>
                          <td>{group.cardName}</td>
                          <td>{group.cardCreated ? "新規作成" : "既存利用"}</td>
                          <td>{group.imageAddedCount}</td>
                          <td>{group.skippedImageCount}</td>
                          <td>{group.abilityLinked ? "紐付け追加" : "-"}</td>
                          <td>{group.imageFiles.join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </AppCard>
        )}
      </div>
    </AppShell>
  );
}
