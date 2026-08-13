"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImportPageLinks, type ImportPageLinkItem } from "@/components/cards/import/ImportPageLinks";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardImportLogs } from "@/lib/cards/import/importCardCsv";
import type { CardImportLogRecord } from "@/lib/cards/import/cardCsvTypes";

const PAGE_SIZE = 20;

const PAGE_LINKS: readonly ImportPageLinkItem[] = [
  { href: "/cards/import", label: "登録方法一覧へ戻る" },
  { href: "/cards", label: "カード一覧へ戻る" },
] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function isExcelZipImportLog(log: CardImportLogRecord) {
  return log.set_code === "excel_zip" || log.csv_version === "excel_zip_v1";
}

function getImportTypeLabel(log: CardImportLogRecord) {
  return isExcelZipImportLog(log) ? "Excel + 画像ZIP" : "CSV";
}

function getImportedItemLabel(log: CardImportLogRecord) {
  if (isExcelZipImportLog(log)) {
    return log.file_name || "Excel + 画像ZIP";
  }

  if (log.set_code && log.set_code !== "unknown") {
    return log.set_code;
  }

  return log.file_name || "未設定";
}

export default function CardImportHistoryPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<CardImportLogRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const totalPages = useMemo(() => Math.max(Math.ceil(count / PAGE_SIZE), 1), [count]);

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { logs: nextLogs, count: nextCount, error } = await loadCardImportLogs({
      page,
      pageSize: PAGE_SIZE,
    });

    if (error) {
      setMessage(`インポート履歴の読み込みに失敗しました。${error}`);
      setLogs([]);
      setCount(0);
    } else {
      setLogs(nextLogs);
      setCount(nextCount);
    }

    setLoading(false);
  }, [page]);

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
        return;
      }

      await reload();
    }

    void loadPage();
  }, [reload, router]);

  return (
    <AppShell>
      <div className="dm-stack">
        <ImportPageLinks items={PAGE_LINKS} />

        {message ? <p className="dm-form-message">{message}</p> : null}

        <AppCard title="インポート履歴" description={`履歴件数: ${count} 件`}>
          {loading ? (
            <p className="dm-muted-text">履歴を読み込み中です。</p>
          ) : logs.length === 0 ? (
            <p className="dm-muted-text">インポート履歴はまだありません。</p>
          ) : (
            <div className="dm-stack">
              {logs.map((log) => (
                <div key={log.id} className="dm-card-surface">
                  <div className="dm-row" style={{ justifyContent: "space-between", gap: 16 }}>
                    <div className="dm-stack" style={{ gap: 6 }}>
                      <strong>{getImportedItemLabel(log)}</strong>
                      <span className="dm-muted-text">{formatDate(log.created_at)}</span>
                    </div>
                    <div className="dm-stack" style={{ gap: 6, alignItems: "flex-end" }}>
                      <span className="dm-muted-text">{getImportTypeLabel(log)}</span>
                      <span className={log.status === "success" ? "dm-muted-text" : "dm-form-message"}>
                        {log.status === "success" ? "成功" : "失敗"}
                      </span>
                    </div>
                  </div>

                  {log.error_message ? (
                    <p className="dm-muted-text" style={{ marginTop: 8 }}>
                      {log.error_message}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <div className="dm-page-actions">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
            >
              前へ
            </Button>
            <span className="dm-muted-text">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              次へ
            </Button>
          </div>
        </AppCard>
      </div>
    </AppShell>
  );
}
