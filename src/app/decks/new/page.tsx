"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createDraftDeck } from "@/lib/decks/deckActions";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadBattleSupplies } from "@/lib/supplies/supplyActions";
import type { BattleSupplyRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

export default function NewDeckPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [sleeveSupplies, setSleeveSupplies] = useState<BattleSupplyRecord[]>([]);
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [selectedFlagId, setSelectedFlagId] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    async function loadPage() {
      const [profile, supplyResult, flagResult] = await Promise.all([
        getOrCreateProfile(),
        loadBattleSupplies("sleeve"),
        loadFlags({ selectableOnly: true, activeOnly: true })
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
      if (flagResult.error) {
        setMessage("フラッグ一覧を読み込めませんでした。画面を更新して再度お試しください。");
      } else {
        setFlags(flagResult.data ?? []);
      }
      setLoadingOptions(false);
    }
    void loadPage();
  }, [router]);

  async function handleStartDeckCreation() {
    if (!selectedFlagId) {
      setMessage("フラッグを選択してください。");
      return;
    }
    setCreating(true);
    setMessage("");

    const { data, error } = await createDraftDeck({
      flagId: selectedFlagId,
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
        description="フラッグを選択して編集画面へ進みます。ワールド指定のないフラッグも選択できます。デッキ名とバディは編集画面で設定できます。"
      >
        <label className="dm-new-deck-supply-field">
          フラッグ
          <select
            value={selectedFlagId}
            onChange={(event) => setSelectedFlagId(event.target.value)}
            disabled={creating || loadingOptions}
          >
            <option value="">フラッグを選択</option>
            {flags.map((flag) => (
              <option key={flag.id} value={flag.id}>
                {flag.name ?? flag.card?.name ?? "名称未設定"}
                {flag.usable_worlds.length === 0 ? "（ワールド指定なし）" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="dm-new-deck-supply-field">
          スリーブ
          <select
            value={selectedSleeveSupplyId}
            onChange={(event) => setSelectedSleeveSupplyId(event.target.value)}
            disabled={creating || loadingOptions}
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
          disabled={loadingOptions || !selectedFlagId || flags.length === 0}
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
