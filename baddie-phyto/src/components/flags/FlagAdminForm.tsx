"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/common/button";
import type { CreateFlagInput, UpdateFlagInput } from "@/lib/flags/flagActions";
import type { CardRecord, FlagWithCardRecord } from "@/types/baddiePhyto";

type FlagAdminFormInput = CreateFlagInput | UpdateFlagInput;

type FlagAdminFormProps = {
  cards: CardRecord[];
  initialFlag?: FlagWithCardRecord | null;
  submitLabel: string;
  loading?: boolean;
  requireCard?: boolean;
  onSubmit: (input: FlagAdminFormInput) => Promise<void>;
};

function arrayToInput(values?: string[] | null) {
  return values?.join(", ") ?? "";
}

function inputToArray(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function numberToInput(value: number | null | undefined, fallback: number) {
  return String(value ?? fallback);
}

function parseNonNegativeInteger(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function FlagAdminForm({
  cards,
  initialFlag,
  submitLabel,
  loading = false,
  requireCard = false,
  onSubmit
}: FlagAdminFormProps) {
  const [name, setName] = useState(
    initialFlag?.name ?? initialFlag?.card?.name ?? ""
  );
  const [cardId, setCardId] = useState(initialFlag?.card_id ?? "");
  const [usableWorldsText, setUsableWorldsText] = useState(
    arrayToInput(initialFlag?.usable_worlds)
  );
  const [initialHand, setInitialHand] = useState(
    numberToInput(initialFlag?.initial_hand, 6)
  );
  const [initialGauge, setInitialGauge] = useState(
    numberToInput(initialFlag?.initial_gauge, 2)
  );
  const [initialLife, setInitialLife] = useState(
    numberToInput(initialFlag?.initial_life, 10)
  );
  const [canBeSelectedAsFlag, setCanBeSelectedAsFlag] = useState(
    initialFlag?.can_be_selected_as_flag ?? true
  );
  const [isActive, setIsActive] = useState(initialFlag?.is_active ?? true);
  const [message, setMessage] = useState("");

  const usableWorlds = useMemo(
    () => inputToArray(usableWorldsText),
    [usableWorldsText]
  );

  const selectedCardExists = cards.some((card) => card.id === cardId);
  const shouldShowCurrentMissingCard =
    Boolean(cardId) && !selectedCardExists && initialFlag?.card;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requireCard && !cardId) {
      setMessage("フラッグカードを選択してください。");
      return;
    }

    if (usableWorlds.length === 0) {
      setMessage("使用可能ワールドを1つ以上入力してください。");
      return;
    }

    setMessage("");
    await onSubmit({
      name: name.trim() || null,
      cardId: cardId || null,
      usableWorlds,
      initialHand: parseNonNegativeInteger(initialHand, 0),
      initialGauge: parseNonNegativeInteger(initialGauge, 0),
      initialLife: parseNonNegativeInteger(initialLife, 0),
      canBeSelectedAsFlag,
      isActive
    });
  }

  return (
    <form className="dm-auth-form dm-card-form" onSubmit={handleSubmit}>
      <label>
        管理名
        <input
          value={name}
          placeholder="例: ドラゴンワールド"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label>
        紐付けるフラッグカード
        <select
          value={cardId}
          onChange={(event) => setCardId(event.target.value)}
          required={requireCard}
        >
          <option value="">未設定</option>
          {shouldShowCurrentMissingCard && initialFlag?.card && (
            <option value={initialFlag.card.id}>
              {initialFlag.card.name}（現在の紐付け・候補外）
            </option>
          )}
          {cards.map((card) => (
            <option key={card.id} value={card.id}>
              {card.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        使用可能ワールド
        <input
          value={usableWorldsText}
          placeholder="例: ドラゴンワールド, スタードラゴンワールド"
          onChange={(event) => setUsableWorldsText(event.target.value)}
        />
      </label>

      <div className="dm-form-grid-2">
        <label>
          初期手札
          <input
            type="number"
            min={0}
            value={initialHand}
            onChange={(event) => setInitialHand(event.target.value)}
            required
          />
        </label>
        <label>
          初期ゲージ
          <input
            type="number"
            min={0}
            value={initialGauge}
            onChange={(event) => setInitialGauge(event.target.value)}
            required
          />
        </label>
        <label>
          初期ライフ
          <input
            type="number"
            min={0}
            value={initialLife}
            onChange={(event) => setInitialLife(event.target.value)}
            required
          />
        </label>
      </div>

      <label className="dm-settings-check-row">
        <input
          type="checkbox"
          checked={canBeSelectedAsFlag}
          onChange={(event) => setCanBeSelectedAsFlag(event.target.checked)}
        />
        <span>フラッグ選択画面へ表示する</span>
      </label>

      <label className="dm-settings-check-row">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span>有効なゲーム開始フラッグとして扱う</span>
      </label>

      <div className="dm-card-form-preview">
        <p>使用可能ワールド：{usableWorlds.join("・") || "未入力"}</p>
        <p>
          初期値：手札{initialHand || "-"} / ゲージ{initialGauge || "-"} /
          ライフ{initialLife || "-"}
        </p>
      </div>

      <Button type="submit" variant="primary" loading={loading} fullWidth>
        {submitLabel}
      </Button>
      {message && <p className="dm-form-message">{message}</p>}
    </form>
  );
}
