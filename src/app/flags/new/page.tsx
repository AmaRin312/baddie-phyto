"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { FlagAdminForm } from "@/components/flags/FlagAdminForm";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { createFlag, type CreateFlagInput } from "@/lib/flags/flagActions";
import type { CardRecord } from "@/types/baddiePhyto";

export default function NewFlagPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
        return;
      }

      const { data, error } = await loadCards({ activeOnly: true });
      if (error) {
        console.error(error);
        setMessage(`フラッグ候補の読み込みに失敗しました。${error.message}`);
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
  }, [router]);

  async function handleSubmit(input: CreateFlagInput) {
    if (!input.cardId) {
      setMessage("フラッグにするカードを選んでください。");
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
      setMessage(`フラッグの登録に失敗しました。${error.message}`);
      return;
    }

    router.push("/flags");
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/flags" />
      </div>

      {loading ? (
        <AppCard title="読み込み中" description="フラッグ候補を読み込んでいます。">
          <p className="dm-muted-text">少し待ってください。</p>
        </AppCard>
      ) : (
        <AppCard
          title="フラッグ新規登録"
          description="cards.card_type = flag_card のカードを、ゲーム開始フラッグとして登録します。"
        >
          <FlagAdminForm
            cards={cards}
            submitLabel="フラッグを登録"
            loading={saving}
            requireCard
            onSubmit={(input) => handleSubmit(input as CreateFlagInput)}
          />
          {cards.length === 0 ? (
            <p className="dm-form-message">
              利用可能なフラッグカードがありません。先に card_type = flag_card のカードを登録してください。
            </p>
          ) : null}
          {message ? <p className="dm-form-message">{message}</p> : null}
        </AppCard>
      )}
    </AppShell>
  );
}
