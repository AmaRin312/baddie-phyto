"use client";

import { useEffect, useState } from "react";
import { FlagAdminForm } from "@/components/flags/FlagAdminForm";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createCard, loadCards } from "@/lib/cards/cardActions";
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
    setSaving(true);
    setMessage("");
    let cardId = input.cardId;

    if (!cardId) {
      const flagCardName = input.name?.trim() || input.usableWorlds[0]?.trim();
      if (!flagCardName) {
        setSaving(false);
        setMessage("既存カードを選ばない場合は、管理名または使用可能ワールドを入力してください。");
        return;
      }

      const cardResult = await createCard({
        name: flagCardName,
        worlds: input.usableWorlds,
        races: [],
        orientation: "vertical",
        size: null,
        power: null,
        defense: null,
        critical: null,
        cardText: null,
        cardType: "flag_card",
        isDragon: false,
        isCornerKing: false,
        isHyakki: false,
        isChaos: false,
        isGeneric: false,
        isActive: input.isActive ?? true,
        autoCreateFlag: false
      });

      if (cardResult.error || !cardResult.data) {
        setSaving(false);
        console.error(cardResult.error);
        setMessage(`フラッグカード作成に失敗しました。${cardResult.error?.message ?? ""}`);
        return;
      }

      cardId = cardResult.data.id;
    }

    const { error } = await createFlag({
      ...input,
      cardId
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
          description="既存のフラッグカードを選ぶか、未選択のまま管理名と使用可能ワールドから新しいフラッグカードを作成できます。"
        >
          <FlagAdminForm
            cards={cards}
            submitLabel="フラッグを登録"
            loading={saving}
            onSubmit={(input) => handleSubmit(input as CreateFlagInput)}
          />
          {cards.length === 0 && (
            <p className="dm-form-message">
              有効なフラッグカード候補はありません。未選択のまま登録すると、新しいフラッグカードも同時に作成します。
            </p>
          )}
          {message && <p className="dm-form-message">{message}</p>}
        </AppCard>
      )}
    </AppShell>
  );
}
