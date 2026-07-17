"use client";

import { useEffect, useState } from "react";
import { FlagAdminForm } from "@/components/flags/FlagAdminForm";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { createFlag, type CreateFlagInput } from "@/lib/flags/flagActions";
import type { CardRecord } from "@/types/baddiePhyto";

export default function NewFlagPage() {
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        window.location.href = "/login";
        return;
      }

      const { data, error } = await loadCards({ activeOnly: true });
      if (error) {
        console.error(error);
        setMessage(`フラッグカード候補の読み込みに失敗しました。${error.message}`);
      } else {
        setCards(
          ((data ?? []) as CardRecord[]).filter(
            (card) => card.card_type === "flag_card" && card.is_active
          )
        );
      }
      setLoading(false);
    }
    void loadPage();
  }, []);

  async function handleSubmit(input: CreateFlagInput) {
    if (!input.cardId) {
      setMessage("フラッグカードを選択してください。");
      return;
    }

    setSaving(true);
    setMessage("");
    const { error } = await createFlag({
      ...input,
      cardId: input.cardId
    });
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`フラッグ登録に失敗しました。${error.message}`);
      return;
    }

    window.location.href = "/flags";
  }

  return (
    <AppShell kicker="NEW FLAG" title="フラッグ新規登録">
      <div className="dm-page-actions">
        <BackButton fallbackHref="/flags" />
      </div>
      {loading ? (
        <AppCard title="読み込み中" description="フラッグカード候補を取得しています。" />
      ) : (
        <AppCard
          title="フラッグ情報"
          description="cards.card_type = flag_card かつ有効なカードを、ゲーム開始フラッグとして flags に紐付けます。"
        >
          <FlagAdminForm
            cards={cards}
            submitLabel="フラッグを登録"
            loading={saving}
            requireCard
            onSubmit={(input) => handleSubmit(input as CreateFlagInput)}
          />
          {cards.length === 0 && (
            <p className="dm-form-message">
              有効なフラッグカードがありません。先にカード管理で card_type=flag_card のカードを登録してください。
            </p>
          )}
          {message && <p className="dm-form-message">{message}</p>}
        </AppCard>
      )}
    </AppShell>
  );
}
