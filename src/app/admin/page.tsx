"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  getPublicSupplyImageUrl,
  loadBattleSupplies,
  loadSiteSupplySettings,
  saveSiteDefaultSleeveSupply
} from "@/lib/supplies/supplyActions";
import type { BattleSupplyRecord } from "@/types/baddiePhyto";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [supplies, setSupplies] = useState<BattleSupplyRecord[]>([]);
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }

      if (!profile.is_admin) {
        setMessage("管理者権限が必要です。");
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      const [supplyResult, settingsResult] = await Promise.all([
        loadBattleSupplies("sleeve"),
        loadSiteSupplySettings()
      ]);

      if (supplyResult.error || settingsResult.error) {
        console.error(supplyResult.error ?? settingsResult.error);
        setMessage("管理者設定の読み込みに失敗しました。SQLの適用状況を確認してください。");
      } else {
        setSupplies(supplyResult.data ?? []);
        setSelectedSleeveSupplyId(settingsResult.data?.sleeve_supply_id ?? "");
      }
      setLoading(false);
    }

    void loadPage();
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const result = await saveSiteDefaultSleeveSupply(selectedSleeveSupplyId || null);
    setSaving(false);

    if (result.error) {
      console.error(result.error);
      setMessage(`デフォルトスリーブの保存に失敗しました。${result.error.message}`);
      return;
    }

    setMessage("サイト全体のデフォルトスリーブを保存しました。");
  }

  const selectedSupply = supplies.find((supply) => supply.id === selectedSleeveSupplyId);
  const selectedImageUrl = getPublicSupplyImageUrl(selectedSupply?.image_path);

  return (
    <AppShell>
      {loading ? (
        <AppCard title="読み込み中" description="管理者設定を取得しています。" />
      ) : !isAdmin ? (
        <AppCard title="管理者画面" description={message} />
      ) : (
        <>
          {message && <p className="dm-form-message">{message}</p>}
          <AppCard
            title="サイト共通設定"
            description="デッキに個別設定がない場合に使用するスリーブを設定します。"
          >
            <label className="dm-admin-supply-field">
              デフォルトスリーブ
              <select
                value={selectedSleeveSupplyId}
                disabled={saving}
                onChange={(event) => setSelectedSleeveSupplyId(event.target.value)}
              >
                <option value="">設定なし</option>
                {supplies.map((supply) => (
                  <option key={supply.id} value={supply.id}>
                    {supply.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedImageUrl && (
              <div className="dm-admin-supply-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImageUrl} alt={selectedSupply?.name ?? "デフォルトスリーブ"} />
              </div>
            )}
            <button
              type="button"
              className="dm-button primary"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "保存中..." : "設定を保存"}
            </button>
          </AppCard>
        </>
      )}
    </AppShell>
  );
}
