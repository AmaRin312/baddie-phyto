"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppCard } from "@/components/common/card/AppCard";
import { Button } from "@/components/common/button";
import { AppShell } from "@/components/common/layout/AppShell";
import { BackButton } from "@/components/common/navigation/BackButton";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { createDraftDeck } from "@/lib/decks/deckActions";
import { deckSearchWorldLabel, loadDeckCardSearchOptions, resolveDeckSearchWorlds } from "@/lib/decks/deckCardSearch";
import { loadFlags } from "@/lib/flags/flagActions";
import { loadBattleSupplies } from "@/lib/supplies/supplyActions";
import type { BattleSupplyRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

function findDefaultFlag(flags: FlagWithCardRecord[], world: string) {
  const matchesWorld = (value: string) =>
    resolveDeckSearchWorlds([world], [value]).length > 0;
  const selectable = flags.filter((flag) =>
    flag.card?.card_type === "flag_card" && flag.card.is_active
  );
  const namedFlag = selectable.find((flag) =>
    matchesWorld(flag.card?.name ?? "") || matchesWorld(flag.name ?? "")
  );
  if (namedFlag) return namedFlag;

  const singleWorldFlags = selectable.filter((flag) =>
    flag.usable_worlds.length === 1 && matchesWorld(flag.usable_worlds[0])
  );
  return singleWorldFlags.length === 1 ? singleWorldFlags[0] : null;
}

export default function NewDeckPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const [sleeveSupplies, setSleeveSupplies] = useState<BattleSupplyRecord[]>([]);
  const [selectedSleeveSupplyId, setSelectedSleeveSupplyId] = useState("");
  const [worlds, setWorlds] = useState<string[]>([]);
  const [flags, setFlags] = useState<FlagWithCardRecord[]>([]);
  const [selectedWorld, setSelectedWorld] = useState("");
  const [loadingOptions, setLoadingOptions] = useState(true);

  useEffect(() => {
    async function loadPage() {
      const [profile, supplyResult, searchOptions, flagResult] = await Promise.all([
        getOrCreateProfile(),
        loadBattleSupplies("sleeve"),
        loadDeckCardSearchOptions(),
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
      if (searchOptions.error) {
        setMessage("ワールド一覧を読み込めませんでした。画面を更新して再度お試しください。");
      }
      if (flagResult.error) {
        setMessage("フラッグ一覧を読み込めませんでした。画面を更新して再度お試しください。");
      } else {
        const selectableFlags = flagResult.data ?? [];
        setFlags(selectableFlags);
        if (!searchOptions.error) {
          setWorlds(searchOptions.worlds.filter((world) =>
            findDefaultFlag(selectableFlags, world) != null
          ));
        }
      }
      setLoadingOptions(false);
    }
    void loadPage();
  }, [router]);

  async function handleStartDeckCreation() {
    if (!selectedWorld) {
      setMessage("ワールドを選択してください。");
      return;
    }
    const defaultFlag = findDefaultFlag(flags, selectedWorld);
    if (!defaultFlag) {
      setMessage("選択したワールドに対応するフラッグがありません。別のワールドを選択してください。");
      return;
    }
    setCreating(true);
    setMessage("");

    const { data, error } = await createDraftDeck({
      flagId: defaultFlag.id,
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

    router.replace(`/decks/${data.id}?world=${encodeURIComponent(selectedWorld)}`);
  }

  return (
    <AppShell>
      <div className="dm-page-actions">
        <BackButton fallbackHref="/decks" />
      </div>

      <AppCard
        title="デッキ作成を開始"
        description="ワールドを選択すると、対応するフラッグを設定して編集画面へ進みます。デッキ名とバディは編集画面で設定できます。"
      >
        <label className="dm-new-deck-supply-field">
          ワールド
          <select
            value={selectedWorld}
            onChange={(event) => setSelectedWorld(event.target.value)}
            disabled={creating || loadingOptions}
          >
            <option value="">ワールドを選択</option>
            {worlds.map((world) => (
              <option key={world} value={world}>{deckSearchWorldLabel(world)}</option>
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
          disabled={loadingOptions || !selectedWorld || flags.length === 0}
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
