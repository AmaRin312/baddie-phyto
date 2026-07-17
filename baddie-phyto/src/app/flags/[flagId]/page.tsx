"use client";

import { useEffect, useState } from "react";
import { FlagAdminForm } from "@/components/flags/FlagAdminForm";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import {
  loadFlag,
  setFlagActive,
  updateFlag,
  type UpdateFlagInput
} from "@/lib/flags/flagActions";
import type { CardRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

type FlagEditPageProps = { params: Promise<{ flagId: string }> };

function getFlagDisplayName(flag: FlagWithCardRecord) {
  return flag.name || flag.card?.name || "名称未設定";
}

export default function FlagEditPage({ params }: FlagEditPageProps) {
  const [flagId, setFlagId] = useState("");
  const [flag, setFlag] = useState<FlagWithCardRecord | null>(null);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  async function reload(nextFlagId: string) {
    const [flagResult, cardResult] = await Promise.all([
      loadFlag(nextFlagId),
      loadCards({ activeOnly: true })
    ]);

    if (flagResult.error || !flagResult.data) {
      console.error(flagResult.error);
      setMessage(flagResult.error?.message ?? "フラッグが見つかりません。");
      setFlag(null);
      return;
    }

    if (cardResult.error) {
      console.error(cardResult.error);
      setMessage(`フラッグカード候補の読み込みに失敗しました。${cardResult.error.message}`);
      setCards([]);
    } else {
      setCards(
        ((cardResult.data ?? []) as CardRecord[]).filter(
          (card) => card.card_type === "flag_card" && card.is_active
        )
      );
    }

    setFlag(flagResult.data as FlagWithCardRecord);
  }

  useEffect(() => {
    async function loadPage() {
      const [{ flagId: resolvedFlagId }, profile] = await Promise.all([
        params,
        getOrCreateProfile()
      ]);

      if (!profile) {
        window.location.href = "/login";
        return;
      }

      setFlagId(resolvedFlagId);
      await reload(resolvedFlagId);
      setLoading(false);
    }
    void loadPage();
  }, [params]);

  async function handleSubmit(input: UpdateFlagInput) {
    if (!flagId) return;
    setSaving(true);
    setMessage("");
    const { error } = await updateFlag(flagId, {
      ...input,
      cardId: input.cardId || undefined
    });
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグ更新に失敗しました。${error.message}`);
      return;
    }

    await reload(flagId);
    setMessage("フラッグを更新しました。");
  }

  async function handleDeactivate() {
    if (!flag || !window.confirm(`「${getFlagDisplayName(flag)}」を無効化しますか？`)) {
      return;
    }

    setDeleting(true);
    setMessage("");
    const { error } = await setFlagActive(flag.id, false);
    setDeleting(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグの無効化に失敗しました。${error.message}`);
      return;
    }

    await reload(flag.id);
    setMessage("フラッグを無効化しました。");
  }

  return (
    <AppShell kicker="EDIT FLAG" title={flag ? getFlagDisplayName(flag) : "フラッグ編集"}>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/flags" />
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="フラッグ情報を取得しています。" />
      ) : flag ? (
        <div className="dm-app-grid">
          <AppCard
            title="フラッグ編集"
            description="ゲーム開始フラッグの初期値と選択候補表示を編集します。"
          >
            <FlagAdminForm
              key={flag.id}
              cards={cards}
              initialFlag={flag}
              submitLabel="フラッグを更新"
              loading={saving}
              onSubmit={(input) => handleSubmit(input as UpdateFlagInput)}
            />
          </AppCard>

          <AppCard
            title="現在の設定"
            description={flag.card_id ? "cards と紐付いています。" : "card_id が未設定の既存フラッグです。"}
          >
            <div className="dm-card-text-preview">
              <b>{getFlagDisplayName(flag)}</b>
              <span>card名：{flag.card?.name ?? "未設定"}</span>
              <span>使用可能ワールド：{flag.usable_worlds.join(", ") || "-"}</span>
              <span>
                初期値：手札{flag.initial_hand} / ゲージ{flag.initial_gauge} /
                ライフ{flag.initial_life}
              </span>
              <span>
                フラッグ選択候補：
                {flag.can_be_selected_as_flag ? "表示" : "非表示"}
              </span>
              <span>状態：{flag.is_active ? "有効" : "無効"}</span>
            </div>
            {flag.is_active ? (
              <Button
                variant="danger"
                loading={deleting}
                onClick={handleDeactivate}
              >
                論理削除する
              </Button>
            ) : (
              <p className="dm-muted-text">
                このフラッグは is_active=false の無効フラッグです。
              </p>
            )}
          </AppCard>
        </div>
      ) : (
        <AppCard
          title="エラー"
          description={message || "フラッグが見つかりません。"}
        />
      )}

      {message && flag && <p className="dm-form-message">{message}</p>}
    </AppShell>
  );
}
