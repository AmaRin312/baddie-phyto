"use client";

import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  deleteBattleSupply,
  getPublicSupplyImageUrl,
  loadBattleSupplies,
  loadBattleSupplySettings,
  saveBattleSupplySettings,
  uploadBattleSupply
} from "@/lib/supplies/supplyActions";
import type {
  BattleSupplyRecord,
  BattleSupplySettingsRecord,
  BattleSupplyType
} from "@/types/baddiePhyto";

type SupplyUploadState = {
  name: string;
  file: File | null;
};

const SUPPLY_TYPE_LABELS: Record<BattleSupplyType, string> = {
  sleeve: "スリーブ",
  playmat: "プレイマット"
};

function createEmptyUploadState(): SupplyUploadState {
  return { name: "", file: null };
}

function isImageFile(file: File) {
  return ["image/png", "image/jpeg", "image/webp"].includes(file.type);
}

function SupplyPreview({ supply }: { supply: BattleSupplyRecord | null }) {
  const imageUrl = getPublicSupplyImageUrl(supply?.image_path);

  if (!supply || !imageUrl) {
    return <div className="dm-supply-empty-preview">未選択</div>;
  }

  return (
    <div className={`dm-supply-preview is-${supply.supply_type}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt={supply.name} />
    </div>
  );
}

export default function SuppliesPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [supplies, setSupplies] = useState<BattleSupplyRecord[]>([]);
  const [settings, setSettings] = useState<BattleSupplySettingsRecord | null>(null);
  const [sleeveUpload, setSleeveUpload] = useState<SupplyUploadState>(
    createEmptyUploadState
  );
  const [playmatUpload, setPlaymatUpload] = useState<SupplyUploadState>(
    createEmptyUploadState
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const sleeveSupplies = useMemo(
    () => supplies.filter((supply) => supply.supply_type === "sleeve"),
    [supplies]
  );
  const playmatSupplies = useMemo(
    () => supplies.filter((supply) => supply.supply_type === "playmat"),
    [supplies]
  );
  const selectedSleeve =
    sleeveSupplies.find((supply) => supply.id === settings?.sleeve_supply_id) ??
    null;
  const selectedPlaymat =
    playmatSupplies.find((supply) => supply.id === settings?.playmat_supply_id) ??
    null;

  async function reload(userId: string) {
    const [supplyResult, settingsResult] = await Promise.all([
      loadBattleSupplies(),
      loadBattleSupplySettings(userId)
    ]);

    if (supplyResult.error || settingsResult.error) {
      console.error(supplyResult.error ?? settingsResult.error);
      setMessage(
        "サプライ情報の読み込みに失敗しました。battle_supplies SQL が未適用の可能性があります。"
      );
      return;
    }

    setSupplies(supplyResult.data ?? []);
    setSettings(settingsResult.data ?? null);
  }

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(profile.id);
      await reload(profile.id);
      setLoading(false);
    }

    void loadPage();
  }, []);

  async function handleUpload(type: BattleSupplyType) {
    const uploadState = type === "sleeve" ? sleeveUpload : playmatUpload;
    if (!currentUserId || !uploadState.file) {
      setMessage(`${SUPPLY_TYPE_LABELS[type]}画像を選択してください。`);
      return;
    }

    setSaving(true);
    setMessage("");
    const result = await uploadBattleSupply({
      ownerId: currentUserId,
      type,
      name: uploadState.name,
      file: uploadState.file
    });
    setSaving(false);

    if (result.error) {
      console.error(result.error);
      setMessage(`${SUPPLY_TYPE_LABELS[type]}の登録に失敗しました。${result.error.message}`);
      return;
    }

    if (type === "sleeve") setSleeveUpload(createEmptyUploadState());
    if (type === "playmat") setPlaymatUpload(createEmptyUploadState());
    await reload(currentUserId);
    setMessage(`${SUPPLY_TYPE_LABELS[type]}を登録しました。`);
  }

  async function handleSaveSettings(next: {
    sleeveSupplyId?: string | null;
    playmatSupplyId?: string | null;
  }) {
    if (!currentUserId) return;

    setSaving(true);
    setMessage("");
    const result = await saveBattleSupplySettings({
      userId: currentUserId,
      sleeveSupplyId:
        next.sleeveSupplyId !== undefined
          ? next.sleeveSupplyId
          : settings?.sleeve_supply_id ?? null,
      playmatSupplyId:
        next.playmatSupplyId !== undefined
          ? next.playmatSupplyId
          : settings?.playmat_supply_id ?? null
    });
    setSaving(false);

    if (result.error) {
      console.error(result.error);
      setMessage(`サプライ設定の保存に失敗しました。${result.error.message}`);
      return;
    }

    setSettings(result.data);
    setMessage("サプライ設定を保存しました。");
  }

  async function handleDeleteSupply(supply: BattleSupplyRecord) {
    if (!window.confirm(`「${supply.name}」を削除しますか？`)) return;

    setSaving(true);
    setMessage("");
    const result = await deleteBattleSupply(supply);
    setSaving(false);

    if (result.error) {
      console.error(result.error);
      setMessage(`サプライ削除に失敗しました。${result.error.message}`);
      return;
    }

    await reload(currentUserId);
    setMessage("サプライを削除しました。");
  }

  function setUploadFile(type: BattleSupplyType, file: File | null) {
    if (file && !isImageFile(file)) {
      setMessage("PNG / JPEG / WebP の画像ファイルを選択してください。");
      return;
    }

    const setState = type === "sleeve" ? setSleeveUpload : setPlaymatUpload;
    setState((current) => ({ ...current, file }));
    if (file) setMessage(`${SUPPLY_TYPE_LABELS[type]}画像を選択しました。`);
  }

  function renderUploadCard(type: BattleSupplyType) {
    const state = type === "sleeve" ? sleeveUpload : playmatUpload;
    const setState = type === "sleeve" ? setSleeveUpload : setPlaymatUpload;

    return (
      <AppCard
        title={`${SUPPLY_TYPE_LABELS[type]}登録`}
        description={
          type === "sleeve"
            ? "裏向きカードに使用する画像を登録します。"
            : "対戦盤面の背景に使用する画像を登録します。"
        }
      >
        <label>
          名前
          <input
            value={state.name}
            onChange={(event) =>
              setState((current) => ({ ...current, name: event.target.value }))
            }
            placeholder={SUPPLY_TYPE_LABELS[type]}
          />
        </label>
        <label
          className={`dm-supply-drop${state.file ? " has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            setUploadFile(type, event.dataTransfer.files.item(0));
          }}
        >
          <span>画像を選択、またはここへドラッグ＆ドロップ</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) =>
              setUploadFile(type, event.target.files?.[0] ?? null)
            }
          />
          <b>{state.file?.name ?? "未選択"}</b>
        </label>
        <button
          type="button"
          className="dm-button primary"
          disabled={saving}
          onClick={() => void handleUpload(type)}
        >
          {SUPPLY_TYPE_LABELS[type]}を登録
        </button>
      </AppCard>
    );
  }

  function renderSupplySelector(type: BattleSupplyType, items: BattleSupplyRecord[]) {
    const selectedId =
      type === "sleeve" ? settings?.sleeve_supply_id : settings?.playmat_supply_id;
    const selectedLabel =
      type === "sleeve" ? "デフォルト使用中" : "使用中";
    const actionLabel =
      type === "sleeve" ? "デフォルトで使う" : "使う";

    return (
      <AppCard title={`${SUPPLY_TYPE_LABELS[type]}選択`}>
        <select
          value={selectedId ?? ""}
          disabled={saving}
          onChange={(event) =>
            void handleSaveSettings(
              type === "sleeve"
                ? { sleeveSupplyId: event.target.value || null }
                : { playmatSupplyId: event.target.value || null }
            )
          }
        >
          <option value="">未設定</option>
          {items.map((supply) => (
            <option key={supply.id} value={supply.id}>
              {supply.name}
            </option>
          ))}
        </select>
        <div className="dm-supply-grid">
          {items.map((supply) => (
            <div
              key={supply.id}
              className={`dm-supply-card${selectedId === supply.id ? " is-selected" : ""}`}
            >
              <button
                type="button"
                className="dm-supply-card-main"
                onClick={() =>
                  void handleSaveSettings(
                    type === "sleeve"
                      ? { sleeveSupplyId: supply.id }
                      : { playmatSupplyId: supply.id }
                  )
                }
              >
                <SupplyPreview supply={supply} />
                <span>{supply.name}</span>
                {selectedId === supply.id && (
                  <b className="dm-supply-selected-badge">{selectedLabel}</b>
                )}
              </button>
              {selectedId !== supply.id && (
                <button
                  type="button"
                  className="dm-supply-use"
                  disabled={saving}
                  onClick={() =>
                    void handleSaveSettings(
                      type === "sleeve"
                        ? { sleeveSupplyId: supply.id }
                        : { playmatSupplyId: supply.id }
                    )
                  }
                >
                  {actionLabel}
                </button>
              )}
              <button
                type="button"
                className="dm-supply-delete"
                disabled={saving}
                onClick={() => void handleDeleteSupply(supply)}
              >
                削除
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="dm-muted-text">登録済みサプライはありません。</p>
          )}
        </div>
      </AppCard>
    );
  }

  return (
    <AppShell>
      {loading ? (
        <AppCard title="読み込み中" description="サプライ情報を取得しています。" />
      ) : (
        <>
          {message && <p className="dm-form-message">{message}</p>}

          <div className="dm-app-grid">
            <AppCard title="現在の設定">
              <div className="dm-supply-current">
                <div>
                  <b>スリーブ</b>
                  <SupplyPreview supply={selectedSleeve} />
                </div>
                <div>
                  <b>プレイマット</b>
                  <SupplyPreview supply={selectedPlaymat} />
                </div>
              </div>
            </AppCard>
            {renderUploadCard("sleeve")}
            {renderUploadCard("playmat")}
            {renderSupplySelector("sleeve", sleeveSupplies)}
            {renderSupplySelector("playmat", playmatSupplies)}
          </div>
        </>
      )}
    </AppShell>
  );
}
