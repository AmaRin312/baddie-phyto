"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  loadCardCsvExportSets,
  loadExportableCards
} from "@/lib/cards/export/loadCardCsvExportData";
import {
  createCardCsvFileName,
  downloadCardCsv
} from "@/lib/cards/export/downloadCardCsv";
import { serializeCardsToCsv } from "@/lib/cards/export/serializeCardCsv";
import type {
  CardCsvExportData,
  CardCsvExportScope,
  CardCsvExportSet
} from "@/lib/cards/export/cardCsvExportTypes";

export default function CardCsvExportPage() {
  const [sets, setSets] = useState<CardCsvExportSet[]>([]);
  const [scope, setScope] = useState<CardCsvExportScope>("all");
  const [selectedSetId, setSelectedSetId] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [exportData, setExportData] = useState<CardCsvExportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const selectedSet = useMemo(
    () => sets.find((set) => set.id === selectedSetId) ?? null,
    [selectedSetId, sets]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage("");

    if (scope === "set" && !selectedSetId) {
      setExportData({ cards: [], warnings: [] });
      setLoading(false);
      return;
    }

    const { data, error } = await loadExportableCards({
      scope,
      setId: scope === "set" ? selectedSetId : null,
      includeInactive
    });

    if (error) {
      setMessage(`エクスポート対象の取得に失敗しました。${error}`);
      setExportData(null);
    } else {
      setExportData(data);
    }
    setLoading(false);
  }, [includeInactive, scope, selectedSetId]);

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        window.location.href = "/login";
        return;
      }

      const setResult = await loadCardCsvExportSets();
      if (setResult.error) {
        setMessage(`パック一覧の取得に失敗しました。${setResult.error}`);
      }
      setSets(setResult.sets);
      setSelectedSetId(setResult.sets[0]?.id ?? "");
    }
    void loadPage();
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [reload]);

  function handleDownload() {
    if (!exportData || exportData.cards.length === 0 || exporting) return;
    setExporting(true);
    try {
      const csvText = serializeCardsToCsv(exportData.cards);
      const fileName = createCardCsvFileName({
        scope,
        setCode: selectedSet?.set_code,
        includeInactive
      });
      downloadCardCsv({ csvText, fileName, withBom: true });
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell kicker="CSV EXPORT" title="カードCSVエクスポート">
      <div className="dm-page-actions">
        <Link href="/cards" className="dm-button secondary">
          カード一覧へ戻る
        </Link>
        <Link href="/cards/import" className="dm-button secondary">
          CSVインポートへ
        </Link>
      </div>

      <AppCard
        title="エクスポート条件"
        description="パック単位CSVはそのまま再インポートしやすい形式です。全カードCSVはバックアップ・編集用です。"
      >
        <div className="dm-card-search-form">
          <label>
            対象
            <select
              value={scope}
              onChange={(event) => setScope(event.target.value as CardCsvExportScope)}
            >
              <option value="all">全カード</option>
              <option value="set">収録パック単位</option>
            </select>
          </label>

          {scope === "set" && (
            <label>
              パック
              <select
                value={selectedSetId}
                onChange={(event) => setSelectedSetId(event.target.value)}
              >
                {sets.map((set) => (
                  <option key={set.id} value={set.id}>
                    {set.set_code}
                    {set.name ? ` / ${set.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="dm-settings-check-row">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(event) => setIncludeInactive(event.target.checked)}
            />
            <span>無効カードを含む</span>
          </label>
        </div>
      </AppCard>

      {message && <p className="dm-form-message">{message}</p>}

      <AppCard title="エクスポート内容">
        {loading ? (
          <p className="dm-muted-text">対象件数を確認しています。</p>
        ) : (
          <>
            <div className="dm-import-result-grid">
              <span>対象件数: {exportData?.cards.length ?? 0}件</span>
              <span>
                複数Abilityカード:{" "}
                {exportData?.cards.filter((card) => card.abilityKeys.length > 1).length ?? 0}
                件
              </span>
            </div>

            {scope === "all" && (
              <p className="dm-muted-text">
                全カードCSVは複数パックのカードが混在するため、通常のパックインポートではなくバックアップ・編集用として扱ってください。
              </p>
            )}

            {exportData?.warnings.map((warning) => (
              <p key={warning} className="dm-form-message">
                {warning}
              </p>
            ))}

            {(exportData?.cards.some((card) => card.abilityKeys.length > 1) ?? false) && (
              <p className="dm-muted-text">
                複数Abilityは ability 列へ | 区切りで出力します。現在のインポートは1Ability前提のため、そのまま再インポートすると該当行でエラーになります。
              </p>
            )}

            <div className="dm-page-actions">
              <Button
                variant="primary"
                disabled={!exportData || exportData.cards.length === 0 || exporting}
                loading={exporting}
                onClick={handleDownload}
              >
                CSVエクスポート
              </Button>
              {exportData?.cards.length === 0 && (
                <span className="dm-muted-text">0件の場合はダウンロードできません。</span>
              )}
            </div>
          </>
        )}
      </AppCard>
    </AppShell>
  );
}
