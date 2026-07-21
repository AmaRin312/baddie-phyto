"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/common/button";
import {
  addCardAbilityLink,
  loadAvailableAbilities,
  loadCardAbilityLinks,
  removeCardAbilityLink,
  type CardAbilityWithAbilityRecord
} from "@/lib/cards/cardAbilityActions";
import type { AbilityRecord } from "@/types/baddiePhyto";

type CardAbilityEditorProps = {
  cardId: string;
};

export function CardAbilityEditor({ cardId }: CardAbilityEditorProps) {
  const [abilities, setAbilities] = useState<AbilityRecord[]>([]);
  const [links, setLinks] = useState<CardAbilityWithAbilityRecord[]>([]);
  const [selectedAbilityId, setSelectedAbilityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const linkedAbilityIds = useMemo(
    () => new Set(links.map((link) => link.ability_id)),
    [links]
  );

  const selectableAbilities = useMemo(
    () => abilities.filter((ability) => !linkedAbilityIds.has(ability.id)),
    [abilities, linkedAbilityIds]
  );

  async function reload() {
    const [abilitiesResult, linksResult] = await Promise.all([
      loadAvailableAbilities(),
      loadCardAbilityLinks(cardId)
    ]);
    setLoading(false);

    if (abilitiesResult.error || linksResult.error) {
      console.error(abilitiesResult.error ?? linksResult.error);
      setMessage(
        abilitiesResult.error?.message ??
          linksResult.error?.message ??
          "Ability情報の読み込みに失敗しました。"
      );
      return;
    }

    setAbilities(abilitiesResult.data ?? []);
    setLinks(linksResult.data ?? []);
    setSelectedAbilityId("");
  }

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadAvailableAbilities(), loadCardAbilityLinks(cardId)])
      .then(([abilitiesResult, linksResult]) => {
        if (!isMounted) return;
        setLoading(false);

        if (abilitiesResult.error || linksResult.error) {
          console.error(abilitiesResult.error ?? linksResult.error);
          setMessage(
            abilitiesResult.error?.message ??
              linksResult.error?.message ??
              "Ability情報の読み込みに失敗しました。"
          );
          return;
        }

        setAbilities(abilitiesResult.data ?? []);
        setLinks(linksResult.data ?? []);
        setSelectedAbilityId("");
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        console.error(error);
        setLoading(false);
        setMessage("Ability情報の読み込みに失敗しました。");
      });

    return () => {
      isMounted = false;
    };
  }, [cardId]);

  async function handleAddAbility() {
    if (!selectedAbilityId) return;

    setSaving(true);
    setMessage("");
    const { error } = await addCardAbilityLink({
      cardId,
      abilityId: selectedAbilityId
    });
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`Ability追加に失敗しました。${error.message}`);
      return;
    }

    await reload();
    setMessage("Abilityを追加しました。");
  }

  async function handleRemoveAbility(link: CardAbilityWithAbilityRecord) {
    const abilityName = link.ability?.name ?? link.ability_id;
    if (!window.confirm(`「${abilityName}」の紐付けを解除しますか？`)) return;

    setSaving(true);
    setMessage("");
    const { error } = await removeCardAbilityLink(link.id);
    setSaving(false);

    if (error) {
      console.error(error);
      setMessage(`Ability解除に失敗しました。${error.message}`);
      return;
    }

    await reload();
    setMessage("Abilityの紐付けを解除しました。");
  }

  if (loading) {
    return <p className="dm-muted-text">Ability情報を読み込んでいます。</p>;
  }

  return (
    <div className="dm-form-stack">
      <div className="dm-form-row">
        <label className="dm-form-field">
          <span>追加するAbility</span>
          <select
            value={selectedAbilityId}
            onChange={(event) => setSelectedAbilityId(event.target.value)}
          >
            <option value="">選択してください</option>
            {selectableAbilities.map((ability) => (
              <option key={ability.id} value={ability.id}>
                {ability.behavior_key} / {ability.name}
              </option>
            ))}
          </select>
        </label>
        <div className="dm-form-field dm-form-field-compact">
          <span>操作</span>
          <Button
            variant="primary"
            loading={saving}
            disabled={!selectedAbilityId}
            onClick={handleAddAbility}
          >
            Abilityを追加
          </Button>
        </div>
      </div>

      <div className="dm-admin-list">
        {links.map((link) => (
          <article key={link.id} className="dm-admin-list-item">
            <div>
              <strong>{link.ability?.name ?? "Unknown Ability"}</strong>
              <p className="dm-muted-text">
                {link.ability?.behavior_key ?? link.ability_id}
              </p>
              {link.ability?.description && (
                <p className="dm-muted-text">{link.ability.description}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="danger"
              loading={saving}
              onClick={() => void handleRemoveAbility(link)}
            >
              解除
            </Button>
          </article>
        ))}
        {links.length === 0 && (
          <p className="dm-muted-text">
            このカードにはAbilityが紐付いていません。
          </p>
        )}
      </div>

      {selectableAbilities.length === 0 && abilities.length > 0 && (
        <p className="dm-muted-text">
          登録済みの有効Abilityはすべて紐付け済みです。
        </p>
      )}
      {abilities.length === 0 && (
        <p className="dm-muted-text">
          有効なAbilityがありません。先に abilities テーブルへ
          behavior_keyを登録してください。
        </p>
      )}
      {message && <p className="dm-form-message">{message}</p>}
    </div>
  );
}
