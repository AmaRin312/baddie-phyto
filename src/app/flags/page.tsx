"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/common/button";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadFlags, setFlagActive } from "@/lib/flags/flagActions";
import type { FlagWithCardRecord } from "@/types/baddiePhyto";

function getFlagDisplayName(flag: FlagWithCardRecord) {
  return flag.name || flag.card?.name || "未設定のフラッグ";
}

export default function FlagsPage() {
  const router = useRouter();
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data, error } = await loadFlags();

    if (error) {
      console.error(error);
      setMessage(`フラッグ一覧の読み込みに失敗しました。${error.message}`);
      setFlags([]);
      setLoading(false);
      return;
    }

    setFlags(data ?? []);
    setLoading(false);
  }, []);

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

  async function handleDeactivate(flag: FlagWithCardRecord) {
    if (!window.confirm(`「${getFlagDisplayName(flag)}」を無効化しますか？`)) {
      return;
    }

    setDeletingId(flag.id);
    setMessage("");
    const { error } = await setFlagActive(flag.id, false);
    setDeletingId("");

    if (error) {
      console.error(error);
      setMessage(`フラッグの無効化に失敗しました。${error.message}`);
      return;
    }

    await reload();
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <Link href="/flags/new" className="dm-button primary">
          フラッグ新規登録
        </Link>
      </div>

      {message ? <p className="dm-form-message">{message}</p> : null}

      <AppCard title="フラッグ一覧" description="ゲーム開始に使うフラッグを確認します。">
        {loading ? (
          <p className="dm-muted-text">フラッグを読み込み中です。</p>
        ) : flags.length === 0 ? (
          <p className="dm-muted-text">フラッグがありません。</p>
        ) : (
          <div className="dm-flag-admin-list">
            <div className="dm-flag-admin-row dm-flag-admin-head">
              <span>フラッグ名</span>
              <span>カード</span>
              <span>使用可能ワールド</span>
              <span>手札</span>
              <span>ゲージ</span>
              <span>ライフ</span>
              <span>選択可能</span>
              <span>状態</span>
              <span>操作</span>
            </div>
            {flags.map((flag) => (
              <div key={flag.id} className="dm-flag-admin-row">
                <span>
                  <b>{getFlagDisplayName(flag)}</b>
                </span>
                <span>{flag.card?.name ?? "未設定"}</span>
                <span>{flag.usable_worlds.join(", ") || "-"}</span>
                <span>{flag.initial_hand}</span>
                <span>{flag.initial_gauge}</span>
                <span>{flag.initial_life}</span>
                <span>{flag.can_be_selected_as_flag ? "はい" : "いいえ"}</span>
                <span>{flag.is_active ? "有効" : "無効"}</span>
                <span className="dm-card-admin-actions">
                  <Link href={`/flags/${flag.id}`} className="dm-button secondary">
                    編集
                  </Link>
                  {flag.is_active ? (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deletingId === flag.id}
                      onClick={() => handleDeactivate(flag)}
                    >
                      無効化
                    </Button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
