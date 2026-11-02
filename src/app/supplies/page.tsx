"use client";

import { useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import {
  deleteBattleSupply,
  getPublicSupplyImageUrl,
  loadBattleSupplies,
  uploadBattleSupply
} from "@/lib/supplies/supplyActions";
import type {
  BattleSupplyRecord,
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

export default function SuppliesPage() {
  const [currentUserId, setCurrentUserId] = useState("");
  const [supplies, setSupplies] = useState<BattleSupplyRecord[]>([]);
  const [sleeveUpload, setSleeveUpload] = useState<SupplyUploadState>(
    createEmptyUploadState
  );
  const [playmatUpload, setPlaymatUpload] = useState<SupplyUploadState>(
    createEmptyUploadState
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function reload() {
    const supplyResult = await loadBattleSupplies();

    if (supplyResult.error) {
      console.warn("battle_supplies is not available yet.", supplyResult.error);
      setSupplies([]);
      setMessage("サプライ機能はまだ未設定です。必要なら SQL を適用してください。");
    } else {
      setSupplies(supplyResult.data ?? []);
    }

  }

  useEffect(() => {
    async function loadPage() {
      const profile = await getOrCreateProfile();
      if (!profile) {
        window.location.href = "/login";
        return;
      }

      setCurrentUserId(profile.id);
      await reload();
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
    await reload();
    setMessage(`${SUPPLY_TYPE_LABELS[type]}を登録しました。`);
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

    await reload();
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

  function renderRegisteredSupplies(type: BattleSupplyType) {
    const registeredSupplies = supplies.filter(
      (supply) => supply.owner_id === currentUserId && supply.supply_type === type
    );

    return (
      <AppCard title={`登録済み${SUPPLY_TYPE_LABELS[type]}`}>
        {registeredSupplies.length === 0 ? (
          <p className="dm-muted-text">登録済みの{SUPPLY_TYPE_LABELS[type]}はありません。</p>
        ) : (
          <div className="dm-supply-grid">
            {registeredSupplies.map((supply) => {
              const imageUrl = getPublicSupplyImageUrl(supply.image_path);
              return (
                <article className="dm-supply-card" key={supply.id}>
                  {imageUrl && (
                    <div className={`dm-registered-supply-image is-${type}`}>
                      <img src={imageUrl} alt={supply.name} />
                    </div>
                  )}
                  <strong>{supply.name}</strong>
                  <button
                    type="button"
                    className="dm-supply-delete"
                    disabled={saving}
                    onClick={() => void handleDeleteSupply(supply)}
                  >
                    削除
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </AppCard>
    );
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/register" />
      </div>
      {loading ? (
        <AppCard title="読み込み中" description="サプライ情報を取得しています。" />
      ) : (
        <>
          {message && <p className="dm-form-message">{message}</p>}

          <div className="dm-app-grid">
            {renderUploadCard("sleeve")}
            {renderUploadCard("playmat")}
            {renderRegisteredSupplies("sleeve")}
            {renderRegisteredSupplies("playmat")}
          </div>
        </>
      )}
    </AppShell>
  );
}
