"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCardImportLogs } from "@/lib/cards/import/importCardCsv";
import type { CardImportLogRecord } from "@/lib/cards/import/cardCsvTypes";

const PAGE_SIZE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function CardImportHistoryPage() {
  const [logs, setLogs] = useState<CardImportLogRecord[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const totalPages = useMemo(
    () => Math.max(Math.ceil(count / PAGE_SIZE), 1),
    [count]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const { logs: nextLogs, count: nextCount, error } = await loadCardImportLogs({
      page,
      pageSize: PAGE_SIZE
    });

    if (error) {
      setMessage(`インポート履歴の取得に失敗しました。${error}`);
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
        window.location.href = "/login";
        return;
      }
      await reload();
    }
    void loadPage();
  }, [reload]);

  return (
    <AppShell kicker="IMPORT HISTORY" title="CSVインポート履歴">
      <div className="dm-page-actions">
        <Link href="/cards/import" className="dm-button secondary">
          CSVインポートへ戻る
        </Link>
        <Link href="/cards" className="dm-button secondary">
          カード一覧へ
        </Link>
      </div>

      {message && <p className="dm-form-message">{message}</p>}

      <AppCard title="履歴一覧" description={`総件数：${count}件`}>
        {loading ? (
          <p className="dm-muted-text">履歴を取得しています。</p>
        ) : logs.length === 0 ? (
          <p className="dm-muted-text">インポート履歴はありません。</p>
        ) : (
          <div className="dm-import-history-table">
            <div className="dm-import-history-row dm-import-history-head">
              <span>実行日時</span>
              <span>ファイル名</span>
              <span>set_code</span>
              <span>ユーザー</span>
              <span>総行数</span>
              <span>新規</span>
              <span>再利用</span>
              <span>収録追加</span>
              <span>重複</span>
              <span>Ability</span>
              <span>状態</span>
            </div>
            {logs.map((log) => (
              <div key={log.id} className="dm-import-history-row">
                <span>{formatDate(log.created_at)}</span>
                <span>{log.file_name}</span>
                <span>{log.set_code}</span>
                <span>{log.user_id.slice(0, 8)}…</span>
                <span>{log.total_row_count}</span>
                <span>{log.new_card_count}</span>
                <span>{log.reused_card_count}</span>
                <span>{log.printing_added_count}</span>
                <span>{log.duplicate_skipped_count}</span>
                <span>{log.ability_linked_count}</span>
                <span>
                  {log.status === "success" ? "成功" : "失敗"}
                  {log.error_message ? ` / ${log.error_message}` : ""}
                </span>
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
    </AppShell>
  );
}
