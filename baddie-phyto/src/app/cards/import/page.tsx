"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  CARD_CSV_EXAMPLE_TEMPLATE,
  CARD_CSV_TEMPLATE,
  CARD_CSV_VERSION
} from "@/lib/cards/import/cardCsvConstants";
import {
  countImageLessImportedCards,
  dryRunCardCsvImport,
  executeCardCsvImport,
  getImportableRows,
  loadAvailableCsvAbilities,
  previewCardCsvImport
} from "@/lib/cards/import/importCardCsv";
import { parseCardSetFromFileName } from "@/lib/cards/import/parseCardCsv";
import type {
  CardCsvImportResult,
  CardCsvPreview,
  CardCsvPreviewStatus,
  CardCsvDryRunResult
} from "@/lib/cards/import/cardCsvTypes";
import type { CsvAbilityOption } from "@/lib/cards/import/importCardCsv";

const STATUS_LABELS: Record<CardCsvPreviewStatus, string> = {
  new_card: "新規カード",
  existing_add_printing: "既存カード・収録情報追加",
  duplicate_skip: "完全重複・スキップ",
  csv_duplicate: "CSV内重複",
  excluded: "除外済み",
  error: "エラー"
};

function downloadCsvText(input: { text: string; fileName: string }) {
  const blob = new Blob([`\uFEFF${input.text}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = input.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readFileText(file: File) {
  return await file.text();
}

export default function CardCsvImportPage() {
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [excludedRowNumbers, setExcludedRowNumbers] = useState<number[]>([]);
  const [preview, setPreview] = useState<CardCsvPreview | null>(null);
  const [dryRunResult, setDryRunResult] = useState<CardCsvDryRunResult | null>(null);
  const [result, setResult] = useState<CardCsvImportResult | null>(null);
  const [imageLessCount, setImageLessCount] = useState<number | null>(null);
  const [abilities, setAbilities] = useState<CsvAbilityOption[]>([]);
  const [copiedAbilityKey, setCopiedAbilityKey] = useState("");
  const [message, setMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [dryRunning, setDryRunning] = useState(false);
  const [importing, setImporting] = useState(false);
  const setInfo = fileName ? parseCardSetFromFileName(fileName) : null;

  async function refreshPreview(input: {
    nextFileName?: string;
    nextCsvText?: string;
    nextExcludedRowNumbers?: number[];
  }) {
    const targetFileName = input.nextFileName ?? fileName;
    const targetCsvText = input.nextCsvText ?? csvText;
    const targetExcludedRowNumbers =
      input.nextExcludedRowNumbers ?? excludedRowNumbers;

    if (!targetFileName || !targetCsvText) return;

    setLoading(true);
    setDryRunResult(null);
    setWarningMessage("");
    const { preview: nextPreview, error } = await previewCardCsvImport({
      fileName: targetFileName,
      csvText: targetCsvText,
      excludedRowNumbers: targetExcludedRowNumbers
    });
    setLoading(false);

    if (error) {
      setMessage(`CSVプレビューに失敗しました。${error}`);
      return;
    }

    setPreview(nextPreview);
  }

  async function handleFile(file: File | null) {
    setMessage("");
    setWarningMessage("");
    setPreview(null);
    setDryRunResult(null);
    setResult(null);
    setImageLessCount(null);
    setExcludedRowNumbers([]);

    if (!file || importing) return;

    if (!(await getOrCreateProfile())) {
      window.location.href = "/login";
      return;
    }

    setFileName(file.name);
    const nextCsvText = await readFileText(file);
    setCsvText(nextCsvText);
    await refreshPreview({
      nextFileName: file.name,
      nextCsvText,
      nextExcludedRowNumbers: []
    });
  }

  async function handleDryRun() {
    if (
      !preview ||
      preview.errors.length > 0 ||
      preview.duplicateGroups.length > 0 ||
      dryRunning ||
      importing
    ) {
      return;
    }

    setDryRunning(true);
    setMessage("");
    setWarningMessage("");
    const { result: nextDryRunResult, error } = await dryRunCardCsvImport({
      preview
    });
    setDryRunning(false);

    if (error) {
      setMessage(error);
      setDryRunResult(null);
      return;
    }

    setDryRunResult(nextDryRunResult);
  }

  async function handleImport() {
    if (
      !preview ||
      preview.errors.length > 0 ||
      preview.duplicateGroups.length > 0 ||
      importing
    ) {
      return;
    }

    if (!dryRunResult) {
      setMessage("本登録前にDB確認を実行してください。");
      return;
    }

    const activeRows = preview.rows.filter((row) => row.status !== "excluded");
    const newCardCount = activeRows.filter((row) => row.status === "new_card").length;
    const reusedCardCount = activeRows.filter(
      (row) => row.status === "existing_add_printing" || row.status === "duplicate_skip"
    ).length;
    const printingsCount = activeRows.filter(
      (row) => row.status === "new_card" || row.status === "existing_add_printing"
    ).length;
    const duplicateSkipCount = activeRows.filter(
      (row) => row.status === "duplicate_skip"
    ).length;
    const abilityCount = activeRows.filter((row) => row.normalized?.ability).length;
    const confirmed = window.confirm(
      [
        `パック：${preview.set.setCode}`,
        "",
        `総行数：${preview.totalRows}`,
        `除外済み重複行数：${preview.excludedRowNumbers.length}`,
        `新規カード：${newCardCount}件`,
        `既存カード再利用：${reusedCardCount}件`,
        `収録情報追加：${printingsCount}件`,
        `完全重複スキップ：${duplicateSkipCount}件`,
        `Ability紐付け予定：${abilityCount}件`,
        "",
        "この内容で登録しますか？"
      ].join("\n")
    );

    if (!confirmed) return;

    setImporting(true);
    setMessage("");
    setResult(null);
    const { result: nextResult, error } = await executeCardCsvImport({
      preview,
      dryRun: dryRunResult,
      fileName
    });
    setImporting(false);

    if (error && !nextResult) {
      setMessage(`CSV登録に失敗しました。${error}`);
      return;
    }

    if (error) {
      setWarningMessage(error);
    }

    const imageLessResult = await countImageLessImportedCards({
      rows: getImportableRows(preview)
    });
    if (imageLessResult.error) {
      setWarningMessage(
        "登録は完了しましたが、画像なしカード数の取得に失敗しました。"
      );
    } else {
      setImageLessCount(imageLessResult.count);
    }

    setResult(nextResult);
  }

  async function excludeRows(rowNumbers: number[]) {
    const nextExcludedRowNumbers = Array.from(
      new Set([...excludedRowNumbers, ...rowNumbers])
    ).sort((left, right) => left - right);
    setExcludedRowNumbers(nextExcludedRowNumbers);
    setDryRunResult(null);
    await refreshPreview({ nextExcludedRowNumbers });
  }

  async function resetExcludedRows() {
    setExcludedRowNumbers([]);
    setDryRunResult(null);
    await refreshPreview({ nextExcludedRowNumbers: [] });
  }

  async function copyAbilityKey(behaviorKey: string) {
    try {
      await navigator.clipboard.writeText(behaviorKey);
      setCopiedAbilityKey(behaviorKey);
      window.setTimeout(() => setCopiedAbilityKey(""), 1200);
    } catch {
      setWarningMessage("クリップボードへコピーできませんでした。");
    }
  }

  useEffect(() => {
    async function loadAbilities() {
      const { abilities: nextAbilities, error } = await loadAvailableCsvAbilities();
      setAbilities(nextAbilities);
      if (error) {
        setWarningMessage("Ability一覧の読み込みに失敗しました。CSV解析は続行できます。");
      }
    }
    void loadAbilities();
  }, []);

  return (
    <AppShell kicker="CSV IMPORT" title="カードCSVインポート">
      <div className="dm-page-actions">
        <Link href="/cards" className="dm-button secondary">
          カード一覧へ戻る
        </Link>
        <Link href="/cards/import/history" className="dm-button secondary">
          インポート履歴
        </Link>
        <Link href="/cards/export" className="dm-button secondary">
          CSVエクスポート
        </Link>
        <button
          type="button"
          className="dm-button secondary"
          onClick={() =>
            downloadCsvText({
              text: CARD_CSV_TEMPLATE,
              fileName: "baddie_phyto_cards_template_v1.csv"
            })
          }
        >
          空テンプレートDL
        </button>
        <button
          type="button"
          className="dm-button secondary"
          onClick={() =>
            downloadCsvText({
              text: CARD_CSV_EXAMPLE_TEMPLATE,
              fileName: "baddie_phyto_cards_template_example_v1.csv"
            })
          }
        >
          入力例付きDL
        </button>
      </div>

      <AppCard
        title="CSVファイル選択"
        description="ExcelのCSV UTF-8（コンマ区切り）を想定しています。ファイル名からset_codeを取得します。"
      >
        <div
          className="dm-import-drop-zone"
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files.item(0));
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={importing}
            onChange={(event) => void handleFile(event.target.files?.item(0) ?? null)}
          />
          <p>CSVを選択、またはここへドラッグ&ドロップしてください。</p>
        </div>

        {setInfo && (
          <div className="dm-import-set-info">
            <span>ファイル名: {fileName}</span>
            <span>set_code: {setInfo.setCode}</span>
            <span>パック名: {setInfo.setName}</span>
            <span>最新CSVバージョン: {CARD_CSV_VERSION}</span>
          </div>
        )}
      </AppCard>

      <AppCard
        title="CSV入力ルール"
        description="列構成はそのままです。入力補助としてBoolean空欄とワールド短縮名を正規化します。"
      >
        <div className="dm-import-help">
          <p>
            <b>Boolean:</b> is_dragon / is_hyakki / is_kakuoh / is_chaos /
            is_generic / is_heaven / is_hell は空欄で false、is_active だけは空欄で true です。
          </p>
          <p>
            <b>world:</b> 正式名称でも短縮名でも入力できます。複数ワールドは | 区切りです。
          </p>
          <p>
            例: ドラゴン|ダンジョン → ドラゴンワールド / ダンジョンワールド としてDBへ保存します。
          </p>
          <p>
            未知のワールド名は自動変換せず、行エラーにします。
          </p>
        </div>
      </AppCard>

      {message && <p className="dm-form-message">{message}</p>}
      {warningMessage && <p className="dm-muted-text">{warningMessage}</p>}

      <AppCard
        title="CSVで使えるAbility behavior_key"
        description="abilities.is_active=true の behavior_key だけを表示します。この画面ではAbilityを作成・編集しません。"
      >
        {abilities.length === 0 ? (
          <p className="dm-muted-text">表示できるAbilityがありません。</p>
        ) : (
          <div className="dm-import-ability-list">
            {abilities.map((ability) => (
              <button
                key={ability.id}
                type="button"
                className="dm-import-ability-row"
                onClick={() => void copyAbilityKey(ability.behavior_key)}
              >
                <b>{ability.behavior_key}</b>
                <span>{ability.name}</span>
                <small>{ability.description ?? "-"}</small>
                {copiedAbilityKey === ability.behavior_key && <em>コピーしました</em>}
              </button>
            ))}
          </div>
        )}
      </AppCard>

      {loading && <p className="dm-muted-text">CSVを解析しています。</p>}

      {preview && (
        <AppCard
          title="インポートプレビュー"
          description={`総行数：${preview.totalRows} / 正常：${preview.validRows} / エラー：${preview.errorRows} / set_code：${preview.set.setCode} / CSVバージョン：${preview.csvVersionLabel}`}
        >
          {preview.duplicateGroups.length > 0 && (
            <div className="dm-import-duplicates">
              <h3>CSV内重複</h3>
              {preview.duplicateGroups.map((group) => (
                <div key={group.key} className="dm-import-duplicate-row">
                  <p>{group.rowNumbers.join("行目 / ")}行目は同一内容です。</p>
                  <button
                    type="button"
                    className="dm-button secondary"
                    onClick={() => void excludeRows(group.rowNumbers.slice(1))}
                    disabled={importing}
                  >
                    {group.rowNumbers[0]}行目を残して他を除外
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="dm-button secondary"
                onClick={() =>
                  void excludeRows(
                    preview.duplicateGroups.flatMap((group) =>
                      group.rowNumbers.slice(1)
                    )
                  )
                }
                disabled={importing}
              >
                重複行をまとめて除外
              </button>
            </div>
          )}

          {preview.excludedRowNumbers.length > 0 && (
            <div className="dm-import-excluded-summary">
              <span>除外済み：{preview.excludedRowNumbers.join(", ")}行目</span>
              <button
                type="button"
                className="dm-button secondary"
                onClick={() => void resetExcludedRows()}
                disabled={importing}
              >
                除外を取り消す
              </button>
            </div>
          )}

          {preview.errors.length > 0 && (
            <div className="dm-import-errors">
              <h3>エラー</h3>
              {preview.errors.map((error, index) => (
                <p key={`${error.rowNumber}:${error.column}:${index}`}>
                  {error.rowNumber}行目 / {error.column}: {error.message}
                </p>
              ))}
            </div>
          )}

          <div className="dm-import-preview-table">
            <div className="dm-import-preview-row dm-import-preview-head">
              <span>行</span>
              <span>カード名</span>
              <span>タイプ</span>
              <span>ワールド</span>
              <span>種族</span>
              <span>Ability</span>
              <span>向き</span>
              <span>状態</span>
            </div>
            {preview.rows.map((row) => (
              <div
                key={row.rowNumber}
                className={`dm-import-preview-row is-${row.status}`}
              >
                <span>{row.rowNumber}</span>
                <span>{row.normalized?.name ?? "-"}</span>
                <span>{row.normalized?.card_type ?? "-"}</span>
                <span>{row.normalized?.worlds.join(", ") ?? "-"}</span>
                <span>{row.normalized?.races.join(", ") ?? "-"}</span>
                <span>{row.normalized?.ability ?? "-"}</span>
                <span>{row.normalized?.orientation ?? "-"}</span>
                <span>{STATUS_LABELS[row.status]}</span>
              </div>
            ))}
          </div>

          <div className="dm-page-actions">
            <Button
              variant="secondary"
              disabled={
                preview.errors.length > 0 ||
                preview.duplicateGroups.length > 0 ||
                dryRunning ||
                importing
              }
              loading={dryRunning}
              onClick={handleDryRun}
            >
              {dryRunning ? "DB確認中…" : "DB Dry Run確認"}
            </Button>
            <Button
              variant="primary"
              disabled={
                preview.errors.length > 0 ||
                preview.duplicateGroups.length > 0 ||
                !dryRunResult ||
                dryRunResult.errorCount > 0 ||
                importing
              }
              loading={importing}
              onClick={handleImport}
            >
              {importing ? "登録中…" : "登録実行"}
            </Button>
            {(preview.errors.length > 0 || preview.duplicateGroups.length > 0) && (
              <span className="dm-muted-text">
                エラーまたは未解決のCSV内重複がある場合は登録できません。
              </span>
            )}
            {!dryRunResult && preview.errors.length === 0 && preview.duplicateGroups.length === 0 && (
              <span className="dm-muted-text">
                本登録前にDB Dry Run確認が必要です。
              </span>
            )}
            {dryRunResult && dryRunResult.errorCount > 0 && (
              <span className="dm-muted-text">
                DB側エラーがあるため登録できません。
              </span>
            )}
          </div>
        </AppCard>
      )}

      {dryRunResult && (
        <AppCard
          title="DB Dry Run結果"
          description="DBへ登録せず、本登録RPCと同じ基準で判定した結果です。"
        >
          <div className="dm-import-result-grid">
            <span>新規カード予定数: {dryRunResult.newCards}</span>
            <span>既存カード再利用予定数: {dryRunResult.reusedCards}</span>
            <span>収録情報追加予定数: {dryRunResult.printingsAdded}</span>
            <span>完全重複スキップ予定数: {dryRunResult.duplicateSkipped}</span>
            <span>Ability紐付け予定数: {dryRunResult.abilityLinksAdded}</span>
            <span>DB側エラー数: {dryRunResult.errorCount}</span>
          </div>
          {dryRunResult.errors.length > 0 && (
            <div className="dm-import-errors">
              {dryRunResult.errors.map((error, index) => (
                <p key={`${error.rowNumber}:${error.column}:${index}`}>
                  {error.rowNumber}行目 / {error.column}: {error.message}
                </p>
              ))}
            </div>
          )}
        </AppCard>
      )}

      {result && (
        <AppCard title="登録結果">
          <div className="dm-import-result-grid">
            <span>新規カード登録数: {result.newCards}</span>
            <span>既存カード再利用数: {result.reusedCards}</span>
            <span>収録情報追加数: {result.printingsAdded}</span>
            <span>完全重複スキップ数: {result.duplicateSkipped}</span>
            <span>Ability紐付け数: {result.abilityLinksAdded}</span>
            <span>無効カード登録数: {getImportableRows(preview!).filter((row) => !row.is_active).length}</span>
            <span>画像なしカード数: {imageLessCount ?? "取得できませんでした"}</span>
            <span>完了日時: {new Date().toLocaleString("ja-JP")}</span>
            <span>エラー数: {result.errorCount}</span>
          </div>
          <div className="dm-page-actions">
            <Link href="/cards" className="dm-button secondary">
              カード一覧へ
            </Link>
            <Link href="/cards/import/history" className="dm-button secondary">
              インポート履歴を見る
            </Link>
            <button
              type="button"
              className="dm-button secondary"
              onClick={() => {
                setPreview(null);
                setDryRunResult(null);
                setResult(null);
                setImageLessCount(null);
                setFileName("");
                setCsvText("");
                setExcludedRowNumbers([]);
              }}
            >
              別のCSVをインポート
            </button>
          </div>
          {result.errors.length > 0 && (
            <div className="dm-import-errors">
              {result.errors.map((error, index) => (
                <p key={`${error.rowNumber}:${error.column}:${index}`}>
                  {error.rowNumber}行目 / {error.column}: {error.message}
                </p>
              ))}
            </div>
          )}
        </AppCard>
      )}
    </AppShell>
  );
}
