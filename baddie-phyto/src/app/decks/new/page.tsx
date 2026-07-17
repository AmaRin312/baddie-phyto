"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { loadCards } from "@/lib/cards/cardActions";
import { createDeck } from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import type { CardRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

export default function NewDeckPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [cards, setCards] = useState<CardRecord[]>([]);
  const [flagId, setFlagId] = useState("");
  const [buddyCardId, setBuddyCardId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadPage() {
      if (!(await getOrCreateProfile())) {
        router.replace("/login");
        return;
      }
      const [flagResult, cardResult] = await Promise.all([
        loadFlags({ selectableOnly: true, activeOnly: true }),
        loadCards({ activeOnly: true })
      ]);
      if (flagResult.error || cardResult.error) {
        console.error(flagResult.error ?? cardResult.error);
        setMessage("選択肢の読み込みに失敗しました。");
      } else {
        setFlags(
          (flagResult.data ?? []).filter(
            (flag) =>
              Boolean(flag.card_id) &&
              flag.is_active &&
              flag.can_be_selected_as_flag &&
              flag.card?.card_type === "flag_card" &&
              flag.card?.is_active
          )
        );
        setCards(
          ((cardResult.data ?? []) as CardRecord[]).filter(
            (card) => card.is_active && card.card_type !== "flag_card"
          )
        );
      }
      setLoading(false);
    }
    void loadPage();
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!flagId || !buddyCardId) {
      setMessage("フラッグとバディを選択してください。");
      return;
    }
    setSaving(true);
    setMessage("");
    const { data, error } = await createDeck({
      name: name.trim(),
      flagId,
      buddyCardId
    });
    setSaving(false);
    if (error || !data) {
      console.error(error);
      setMessage("デッキ作成に失敗しました。");
      return;
    }
    router.replace(`/decks/${data}`);
  }

  return (
    <AppShell kicker="NEW DECK" title="デッキ作成">
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
      </div>
      {loading ? (
        <AppCard title="読み込み中" description="フラッグとカードを取得しています。" />
      ) : (
        <AppCard
          title="デッキ情報"
          description="フラッグ選択 → バディ選択 → 作成後にカード追加へ進みます。"
        >
          <form className="dm-auth-form" onSubmit={handleSubmit}>
            <label>
              デッキ名
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>

            <label>
              1. フラッグ
              <select
                value={flagId}
                onChange={(event) => {
                  setFlagId(event.target.value);
                  setBuddyCardId("");
                }}
                required
              >
                <option value="">選択してください</option>
                {flags.map((flag) => (
                  <option key={flag.id} value={flag.id}>
                    {flag.card?.name ?? "フラッグカード不明"}
                  </option>
                ))}
              </select>
            </label>

            {flags.length === 0 && (
              <p className="dm-form-message">
                フラッグ候補がありません。先にフラッグカードを cards に登録し、flags に紐づけてください。
              </p>
            )}

            {flagId && (
              <label>
                2. バディ
                <select
                  value={buddyCardId}
                  onChange={(event) => setBuddyCardId(event.target.value)}
                  required
                >
                  <option value="">選択してください</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!flagId || !buddyCardId}
              fullWidth
            >
              デッキを作成
            </Button>
            {message && <p className="dm-form-message">{message}</p>}
          </form>
        </AppCard>
      )}
    </AppShell>
  );
}
