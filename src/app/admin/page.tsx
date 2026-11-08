"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  DECK_CARD_ERA_OPTIONS,
  type DeckCardEraKey
} from "@/lib/decks/deckCardSearch";
import {
  loadManagedCardSets,
  setCardSetVisibility,
  type ManagedCardSet
} from "@/lib/decks/deckCardSearch";
import {
  getPublicSupplyImageUrl,
  loadBattleSupplies,
  loadSiteSupplySettings,
  saveSiteDefaultSleeveSupply
} from "@/lib/supplies/supplyActions";
import type { BattleSupplyRecord } from "@/types/baddiePhyto";
import {
  announceSiteUpdate,
  endSiteUpdateAnnouncement,
  loadSiteUpdateAnnouncement,
  SITE_UPDATE_NOTICE_DURATION_MS,
  type SiteUpdateAnnouncement
} from "@/lib/siteUpdates";

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [supplies, setSupplies] = useState<BattleSupplyRecord[]>([]);
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [cardSets, setCardSets] = useState<ManagedCardSet[]>([]);
  const [selectedProductEra, setSelectedProductEra] =
    useState<DeckCardEraKey>("first");
  const [updatingSetId, setUpdatingSetId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [updateAnnouncement, setUpdateAnnouncement] = useState<SiteUpdateAnnouncement | null>(null);
  const [savingUpdateAnnouncement, setSavingUpdateAnnouncement] = useState(false);

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
      const [supplyResult, settingsResult, cardSetsResult] = await Promise.all([
        loadBattleSupplies("sleeve"),
        loadSiteSupplySettings(),
        loadManagedCardSets()
      ]);

      if (supplyResult.error || settingsResult.error || cardSetsResult.error) {
        console.error(supplyResult.error ?? settingsResult.error ?? cardSetsResult.error);
        setMessage("管理者設定の読み込みに失敗しました。SQLの適用状況を確認してください。");
      } else {
        setSupplies(supplyResult.data ?? []);
        setSelectedSleeveSupplyId(settingsResult.data?.sleeve_supply_id ?? "");
        setCardSets(cardSetsResult.data ?? []);
      }
      setLoading(false);
    }

    void loadPage();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    async function refreshAnnouncement() {
      try {
        const { data, error } = await loadSiteUpdateAnnouncement();
        if (!active) return;
        if (error) {
          setMessage("更新通知の設定を読み込めませんでした。SQLの適用状況を確認してください。");
          return;
        }
        setUpdateAnnouncement(data);
      } catch {
        // Keep the last known announcement until the connection recovers.
      }
    }
    void refreshAnnouncement();
    const timer = window.setInterval(() => void refreshAnnouncement(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAdmin]);

  async function handleAnnouncement(end: boolean) {
    setSavingUpdateAnnouncement(true);
    const { data, error } = end
      ? await endSiteUpdateAnnouncement()
      : await announceSiteUpdate();
    setSavingUpdateAnnouncement(false);
    if (error || !data) {
      setMessage("更新通知の設定を保存できませんでした。SQLの適用状況を確認してください。");
      return;
    }
    setUpdateAnnouncement(data);
    setMessage(end ? "更新案内を終了しました。" : "更新案内を3時間表示します。");
  }

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

  async function handleSetVisibility(cardSet: ManagedCardSet) {
    setUpdatingSetId(cardSet.id);
    setMessage("");
    const result = await setCardSetVisibility(cardSet.id, !cardSet.is_visible);
    setUpdatingSetId(null);
    if (result.error || !result.data) {
      console.error(result.error);
      setMessage(`「${cardSet.name ?? cardSet.set_code}」の表示状態を更新できませんでした。SQLの適用状況を確認してください。`);
      return;
    }
    setCardSets((current) => current.map((item) =>
      item.id === cardSet.id ? { ...item, is_visible: !item.is_visible } : item
    ));
  }

  const selectedSupply = supplies.find((supply) => supply.id === selectedSleeveSupplyId);
  const selectedImageUrl = getPublicSupplyImageUrl(selectedSupply?.image_path);
  const selectedEraCardSets = cardSets.filter(
    (cardSet) => (cardSet.era_key ?? "first") === selectedProductEra
  );
  const announcementActive = Boolean(
    updateAnnouncement?.announcement_id &&
    updateAnnouncement.announced_at &&
    Date.parse(updateAnnouncement.announced_at) + SITE_UPDATE_NOTICE_DURATION_MS > Date.now()
  );

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
            title="サイト更新の通知"
            description="デプロイや商品表示の変更をまとめ、任意のタイミングで更新案内を配信できます。配信から3時間で自動終了します。"
          >
            <p className="dm-muted-text">
              {announcementActive ? "更新案内を配信中です。" : "現在、更新案内は配信していません。"}
            </p>
            <div className="dm-admin-update-actions">
              <button type="button" className="dm-button primary"
                disabled={savingUpdateAnnouncement}
                onClick={() => void handleAnnouncement(false)}>
                更新案内を出す
              </button>
              {announcementActive && (
                <button type="button" className="dm-button"
                  disabled={savingUpdateAnnouncement}
                  onClick={() => void handleAnnouncement(true)}>
                  通知を終了する
                </button>
              )}
            </div>
          </AppCard>
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
          <AppCard
            title="カード商品ごとの表示設定"
            description="シリーズを選び、そのシリーズに含まれる商品ごとに表示を切り替えます。新規登録した商品は初期状態で非表示となり、表示に切り替えるまでデッキ編集のカード検索と収録商品選択肢から除外されます。"
          >
            <label className="dm-admin-supply-field">
              シリーズ
              <select
                value={selectedProductEra}
                onChange={(event) =>
                  setSelectedProductEra(event.target.value as DeckCardEraKey)
                }
              >
                {DECK_CARD_ERA_OPTIONS.map((era) => (
                  <option key={era.value} value={era.value}>
                    {era.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedEraCardSets.length > 0 ? (
              <div className="dm-admin-product-list">
                {selectedEraCardSets.map((cardSet) => (
                  <label className="dm-admin-product-row" key={cardSet.id}>
                    <span>
                      <strong>{cardSet.name ?? cardSet.set_code}</strong>
                      <small>{cardSet.set_code}</small>
                    </span>
                    <span className="dm-admin-product-toggle">
                      <input
                        type="checkbox"
                        checked={cardSet.is_visible}
                        disabled={updatingSetId != null}
                        onChange={() => void handleSetVisibility(cardSet)}
                      />
                      {updatingSetId === cardSet.id
                        ? "更新中…"
                        : cardSet.is_visible ? "表示" : "非表示"}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="dm-muted-text">
                {DECK_CARD_ERA_OPTIONS.find((era) => era.value === selectedProductEra)?.label}
                シリーズに登録されている商品はありません。
              </p>
            )}
          </AppCard>
        </>
      )}
    </AppShell>
  );
}
