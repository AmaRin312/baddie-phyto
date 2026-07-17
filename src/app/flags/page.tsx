"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadFlags, setFlagActive } from "@/lib/flags/flagActions";
import type { FlagWithCardRecord } from "@/types/baddiePhyto";

function getFlagDisplayName(flag: FlagWithCardRecord) {
  return flag.name || flag.card?.name || "名称未設定";
}

export default function FlagsPage() {
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
    } else {
      setFlags(data ?? []);
    }
    setLoading(false);
  }, []);

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
    <AppShell kicker="FLAGS" title="フラッグ管理">
      <div className="dm-page-actions">
        <Link href="/flags/new" className="dm-button primary">
          フラッグ新規登録
        </Link>
      </div>

      {message && <p className="dm-form-message">{message}</p>}

      <AppCard
        title="フラッグ一覧"
        description="flags はゲーム開始時に置くフラッグを管理します。"
      >
        {loading ? (
          <p className="dm-muted-text">フラッグを取得しています。</p>
        ) : flags.length === 0 ? (
          <p className="dm-muted-text">フラッグがありません。</p>
        ) : (
          <div className="dm-flag-admin-list">
            <div className="dm-flag-admin-row dm-flag-admin-head">
              <span>name</span>
              <span>card名</span>
              <span>usable_worlds</span>
              <span>手札</span>
              <span>ゲージ</span>
              <span>ライフ</span>
              <span>候補</span>
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
                <span>{flag.can_be_selected_as_flag ? "表示" : "非表示"}</span>
                <span>{flag.is_active ? "有効" : "無効"}</span>
                <span className="dm-card-admin-actions">
                  <Link href={`/flags/${flag.id}`} className="dm-button secondary">
                    編集
                  </Link>
                  {flag.is_active && (
                    <Button
                      size="sm"
                      variant="danger"
                      loading={deletingId === flag.id}
                      onClick={() => handleDeactivate(flag)}
                    >
                      無効化
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </AppShell>
  );
}
