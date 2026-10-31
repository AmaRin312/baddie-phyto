"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createDraftDeck } from "@/lib/decks/deckActions";
import { loadBattleSupplies } from "@/lib/supplies/supplyActions";
import type { BattleSupplyRecord } from "@/types/baddiePhyto";

export default function NewDeckPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [sleeveSupplies, setSleeveSupplies] = useState<BattleSupplyRecord[]>([]);
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [loadingSupplies, setLoadingSupplies] = useState(true);

  useEffect(() => {
    async function loadPage() {
      const [profile, supplyResult] = await Promise.all([
        getOrCreateProfile(),
        loadBattleSupplies("sleeve")
      ]);

      if (!profile) {
        router.replace("/login");
        return;
      }

      if (supplyResult.error) {
        console.error(supplyResult.error);
        setMessage("スリーブ一覧の読み込みに失敗しました。スリーブなしで作成できます。");
      } else {
        setSleeveSupplies(supplyResult.data ?? []);
      }
      setLoadingSupplies(false);
    }
    void loadPage();
  }, [router]);

  async function handleStartDeckCreation() {
    setCreating(true);
    setMessage("");

    const { data, error } = await createDraftDeck({
      sleeveSupplyId: selectedSleeveSupplyId || null
    });
    if (error || !data) {
      console.error(error);
      setMessage(
        "デッキ作成を開始できませんでした。ログイン状態、またはdecks.flag_id / buddy_card_idのNULL許可SQLを確認してください。"
      );
      setCreating(false);
      return;
    }

    router.replace(`/decks/${data.id}`);
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
      </div>

      <AppCard
        title="デッキ作成を開始"
        description="デッキ名・フラッグ・バディが未定でも、先に編集画面へ進めます。設定は編集画面で保存してください。"
      >
        <label className="dm-new-deck-supply-field">
          スリーブ
          <select
            value={selectedSleeveSupplyId}
            onChange={(event) => setSelectedSleeveSupplyId(event.target.value)}
            disabled={creating || loadingSupplies}
          >
            <option value="">サイト共通のデフォルトを使う</option>
            {sleeveSupplies.map((supply) => (
              <option key={supply.id} value={supply.id}>
                {supply.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="primary"
          loading={creating}
          onClick={handleStartDeckCreation}
          fullWidth
        >
          デッキ作成画面へ進む
        </Button>
        {message && <p className="dm-form-message">{message}</p>}
      </AppCard>
    </AppShell>
  );
}
