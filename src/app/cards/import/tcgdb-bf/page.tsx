"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import {
  ImportPageLinks,
  type ImportPageLinkItem,
} from "@/components/cards/import/ImportPageLinks";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { executeExcelZipCardImport } from "@/lib/cards/excelZipImport/executeExcelZipImport";
import type {
  ExcelZipCardGroupStatus,
  ExcelZipImportIssue,
  ExcelZipImportPreview,
  ExcelZipImportResult,
} from "@/lib/cards/excelZipImport/excelZipImportTypes";
import { createTcgDbBfImportPreview } from "@/lib/cards/tcgDbBfImport/createTcgDbBfPreview";
import type {
  TcgDbBfFetchedCard,
  TcgDbBfFetchResponse,
} from "@/lib/cards/tcgDbBfImport/tcgDbBfTypes";

const PAGE_LINKS: readonly ImportPageLinkItem[] = [
  { href: "/cards/import", label: "登録方法一覧へ戻る" },
  { href: "/cards", label: "カード一覧へ戻る" },
] as const;

const STATUS_LABELS: Record<ExcelZipCardGroupStatus, string> = {
  new_card: "新規カード",
  existing_card_add_images: "既存カードへ画像追加",
  error: "エラー",
};

function splitInputs(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatIssue(issue: ExcelZipImportIssue) {
  const rowPrefix = issue.rowNumber == null ? "" : `${issue.rowNumber}行 / `;
  return `${rowPrefix}${issue.column}: ${issue.message}`;
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${bytes}B`;
}

async function fetchTcgDbCards(inputs: string[]) {
  const response = await fetch("/api/cards/import/tcgdb-bf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inputs }),
  });

  if (!response.ok) {
    throw new Error(`TCG DB API の取得に失敗しました。HTTP ${response.status}`);
  }

  return (await response.json()) as TcgDbBfFetchResponse;
}

function getFetchedImageCount(cards: TcgDbBfFetchedCard[]) {
  return cards.reduce((total, card) => total + card.images.length, 0);
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
      "image_files",
    ],
    ...result.groupResults.map((group) => [
      group.cardId,
      group.cardName,
      group.cardCreated ? "created" : "reused",
      group.imageAddedCount,
      group.skippedImageCount,
      group.printingAddedCount,
      group.imageFiles.join(" / "),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "baddie_phyto_tcgdb_bf_import_result.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildConfirmText(preview: ExcelZipImportPreview) {
  return [
    "この内容で TCG DB BF のカードと画像をインポートしますか？",
    "",
    `カード数: ${preview.cardGroups.length}件`,
    `画像数: ${preview.images.length}件`,
    "",
    "画像は card-images bucket に保存されます。",
  ].join("\n");
}

export default function TcgDbBfImportPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [inputText, setInputText] = useState("");
  const [fetchedCards, setFetchedCards] = useState<TcgDbBfFetchedCard[]>([]);
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
  const canImport = Boolean(preview) && errors.length === 0 && !importing;

  async function handlePreview() {
    const inputs = splitInputs(inputText);
    if (inputs.length === 0) {
      setMessage("カード URL または card_key を 1 行ずつ入力してください。");
      return;
    }

    setLoading(true);
    setMessage("");
    setPreview(null);
    setResult(null);
    setFetchedCards([]);

    try {
      const response = await fetchTcgDbCards(inputs);
      setFetchedCards(response.cards);

      const { preview: nextPreview, error } = await createTcgDbBfImportPreview(response.cards);
      if (error) {
        setMessage(error);
      } else {
        setPreview(nextPreview);
      }

      if (response.issues.length > 0) {
        setMessage(response.issues.map((issue) => `${issue.input}: ${issue.message}`).join("\n"));
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "TCG DB BF の取得に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!preview || !canImport) return;
    if (!window.confirm(buildConfirmText(preview))) return;

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
    setMessage("TCG DB BF からのカード取込が完了しました。");
  }

  return (
    <AppShell>
      <div className="dm-stack">
        <ImportPageLinks items={PAGE_LINKS} />

        <AppCard
          title="TCG DB BF 取込"
          description="TCG DB BF のカード URL または card_key を入力して、画像付きで取り込みます。"
        >
          <div className="dm-stack">
            <textarea
              rows={8}
              value={inputText}
              disabled={!authenticated || loading || importing}
              placeholder={[
                "https://tcg-db.nikita.jp/cardlist/bf?card_key=X2-BT01%2F0004",
                "X2-BT01/0072",
              ].join("\n")}
              onChange={(event) => setInputText(event.target.value)}
            />

            <div className="dm-page-actions">
              <Button
                variant="primary"
                disabled={!authenticated || loading || importing}
                loading={loading}
                onClick={() => void handlePreview()}
              >
                {loading ? "取得中..." : "取得してプレビュー"}
              </Button>
            </div>

            <p className="dm-muted-text">1回あたりの取得対象は 30 件までです。</p>
          </div>
        </AppCard>

        <AppCard
          title="取込時の注意"
          description="プレビューで一致状況を確認してから登録します。"
        >
          <ul>
            <li>同じ既存カードがあれば、画像追加または再利用として扱います。</li>
            <li>一致しない場合は新規カードとして登録します。</li>
            <li>画像は card-images bucket に保存されます。</li>
          </ul>
        </AppCard>

        {message ? <p className="dm-form-message">{message}</p> : null}

        {fetchedCards.length > 0 ? (
          <AppCard
            title="取得結果"
            description={`カード ${fetchedCards.length}件 / 画像 ${getFetchedImageCount(fetchedCards)}件`}
          >
            <div className="dm-table-wrap">
              <table className="dm-table">
                <thead>
                  <tr>
                    <th>カード番号</th>
                    <th>カード名</th>
                    <th>タイプ</th>
                    <th>ワールド</th>
                    <th>種族</th>
                    <th>画像</th>
                    <th>収録</th>
                  </tr>
                </thead>
                <tbody>
                  {fetchedCards.map((card) => (
                    <tr key={card.cardKey}>
                      <td>{card.cardNumber ?? "-"}</td>
                      <td>{card.name}</td>
                      <td>{card.cardType}</td>
                      <td>{card.worlds.join(", ") || "-"}</td>
                      <td>{card.races.join(", ") || "-"}</td>
                      <td>
                        {card.images.length}件
                        {card.images[0] ? <span> / {formatBytes(card.images[0].size)}</span> : null}
                      </td>
                      <td>{card.setName ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AppCard>
        ) : null}

        {preview ? (
          <AppCard
            title="インポートプレビュー"
            description={`カード ${preview.cardGroups.length}件 / 画像 ${preview.images.length}件 / エラー ${errors.length}件`}
          >
            <div className="dm-stack">
              {errors.length > 0 ? (
                <div className="dm-form-error">
                  <b>エラー</b>
                  <ul>
                    {errors.map((issue, index) => (
                      <li key={`${issue.column}-${issue.rowNumber}-${index}`}>
                        {formatIssue(issue)}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="dm-table-wrap">
                <table className="dm-table">
                  <thead>
                    <tr>
                      <th>状態</th>
                      <th>カード名</th>
                      <th>画像</th>
                      <th>行</th>
                      <th>補足</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.cardGroups.map((group) => (
                      <tr key={group.groupKey}>
                        <td>{STATUS_LABELS[group.status]}</td>
                        <td>{group.name}</td>
                        <td>{group.imageFiles.join(", ") || "-"}</td>
                        <td>{group.rows.map((row) => row.rowNumber).join(", ")}</td>
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

              <Button
                variant="primary"
                disabled={!canImport}
                loading={importing}
                onClick={() => void handleImport()}
              >
                {importing ? "インポート中..." : "カードと画像をインポート"}
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
                <li>収録追加: {result.printingAddedCount}件</li>
              </ul>

              <button
                type="button"
                className="dm-button secondary"
                onClick={() => downloadResultCsv(result)}
              >
                結果 CSV を保存
              </button>
            </div>
          </AppCard>
        ) : null}
      </div>
    </AppShell>
  );
}
