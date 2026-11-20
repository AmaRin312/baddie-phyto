"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/common/button";
import { getOrCreateProfile } from "@/lib/auth/getOrCreateProfile";
import { isBattleAbilityId } from "@/lib/battle/abilities/abilityTypes";
import {
  addCardAbilityLink,
  createAbility,
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
  const [canCreateAbility, setCanCreateAbility] = useState(false);
  const [newAbilityName, setNewAbilityName] = useState("");
  const [newAbilityBehaviorKey, setNewAbilityBehaviorKey] = useState("");
  const [newAbilityDescription, setNewAbilityDescription] = useState("");

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
    setAbilities(abilitiesResult.data ?? []);
    setLinks(linksResult.data ?? []);

    if (abilitiesResult.error || linksResult.error) {
      console.error(abilitiesResult.error ?? linksResult.error);
      setMessage(
        abilitiesResult.error?.message ??
          linksResult.error?.message ??
          "Ability情報の読み込みに失敗しました。"
      );
      return;
    }

    setSelectedAbilityId("");
  }

  useEffect(() => {
    let isMounted = true;

    Promise.all([loadAvailableAbilities(), loadCardAbilityLinks(cardId)])
      .then(([abilitiesResult, linksResult]) => {
        if (!isMounted) return;
        setLoading(false);
        setAbilities(abilitiesResult.data ?? []);
        setLinks(linksResult.data ?? []);

        if (abilitiesResult.error || linksResult.error) {
          console.error(abilitiesResult.error ?? linksResult.error);
          setMessage(
            abilitiesResult.error?.message ??
              linksResult.error?.message ??
              "Ability情報の読み込みに失敗しました。"
          );
          return;
        }

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

  useEffect(() => {
    let isMounted = true;
    void getOrCreateProfile().then((profile) => {
      if (isMounted) setCanCreateAbility(Boolean(profile?.is_admin));
    });
    return () => {
      isMounted = false;
    };
  }, []);

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

  async function handleCreateAbility() {
    const name = newAbilityName.trim();
    if (!name) return;

    setSaving(true);
    setMessage("");
    const result = await createAbility({
      name,
      behaviorKey: newAbilityBehaviorKey,
      description: newAbilityDescription
    });
    if (result.error || !result.data) {
      console.error(result.error);
      setSaving(false);
      setMessage(`Ability登録に失敗しました。${result.error?.message ?? "登録結果を取得できませんでした。"}`);
      return;
    }

    const linkResult = await addCardAbilityLink({ cardId, abilityId: result.data.id });
    setSaving(false);
    if (linkResult.error) {
      console.error(linkResult.error);
      await reload();
      setMessage(`Abilityは登録されましたが、カードへの紐付けに失敗しました。${linkResult.error.message}`);
      return;
    }

    setNewAbilityName("");
    setNewAbilityBehaviorKey("");
    setNewAbilityDescription("");
    await reload();
    setMessage("Abilityを登録し、このカードに紐付けました。");
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

  function renderAbilitySupportBadge(behaviorKey: string | null | undefined) {
    const isSupported = behaviorKey ? isBattleAbilityId(behaviorKey) : false;
    return (
      <span
        className={
          isSupported
            ? "dm-ability-support-badge supported"
            : "dm-ability-support-badge unsupported"
        }
      >
        {isSupported ? "Battle対応" : "Battle未対応"}
      </span>
    );
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
                {ability.behavior_key && isBattleAbilityId(ability.behavior_key) ? "Battle対応" : "未対応"} /{" "}
                {ability.behavior_key ? `${ability.behavior_key} / ` : ""}{ability.name}
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

      {canCreateAbility && (
        <section className="dm-form-stack" aria-label="Ability新規登録">
          <strong>Abilityを新規登録</strong>
          <div className="dm-form-row">
            <label className="dm-form-field">
              <span>Ability名</span>
              <input
                value={newAbilityName}
                onChange={(event) => setNewAbilityName(event.target.value)}
                maxLength={120}
                placeholder="Ability名を入力"
              />
            </label>
            <label className="dm-form-field">
              <span>behavior_key（任意）</span>
              <input
                value={newAbilityBehaviorKey}
                onChange={(event) => setNewAbilityBehaviorKey(event.target.value)}
                maxLength={120}
                placeholder="ゲーム処理と連携する場合に入力"
              />
            </label>
          </div>
          <label className="dm-form-field">
            <span>説明（任意）</span>
            <textarea
              value={newAbilityDescription}
              onChange={(event) => setNewAbilityDescription(event.target.value)}
              rows={3}
              maxLength={2000}
            />
          </label>
          <div>
            <Button
              variant="secondary"
              loading={saving}
              disabled={!newAbilityName.trim()}
              onClick={handleCreateAbility}
            >
              登録してこのカードに紐付け
            </Button>
          </div>
        </section>
      )}

      <div className="dm-admin-list">
        {links.map((link) => (
          <article key={link.id} className="dm-admin-list-item">
            <div>
              <div className="dm-ability-title-row">
                <strong>{link.ability?.name ?? "Unknown Ability"}</strong>
                {renderAbilitySupportBadge(link.ability?.behavior_key)}
              </div>
              <p className="dm-muted-text">
                {link.ability?.behavior_key ?? "behavior_key未設定（説明用Ability）"}
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
          有効なAbilityがありません。Abilityを新規登録してください。
        </p>
      )}
      {message && <p className="dm-form-message">{message}</p>}
    </div>
  );
}
