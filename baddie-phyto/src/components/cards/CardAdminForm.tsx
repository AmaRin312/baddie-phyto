"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/common/button";
import type { CreateCardInput } from "@/lib/cards/cardActions";
import {
  CARD_TYPE_OPTIONS,
  ORIENTATION_OPTIONS,
  type CardOrientation,
  type CardRecord,
  type CardType
} from "@/types/baddiePhyto";

type CardAdminFormProps = {
  initialCard?: CardRecord | null;
  submitLabel: string;
  loading?: boolean;
  onSubmit: (input: CreateCardInput) => Promise<void>;
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

function optionalNumberToInput(value?: number | null) {
  return value == null ? "" : String(value);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function CardAdminForm({
  initialCard,
  submitLabel,
  loading = false,
  onSubmit
}: CardAdminFormProps) {
  const [name, setName] = useState(initialCard?.name ?? "");
  const [worldsText, setWorldsText] = useState(arrayToInput(initialCard?.worlds));
  const [racesText, setRacesText] = useState(arrayToInput(initialCard?.races));
  const [cardType, setCardType] = useState<CardType>(
    initialCard?.card_type ?? "monster"
  );
  const [orientation, setOrientation] = useState<CardOrientation>(
    initialCard?.orientation ?? "vertical"
  );
  const [size, setSize] = useState(optionalNumberToInput(initialCard?.size));
  const [power, setPower] = useState(optionalNumberToInput(initialCard?.power));
  const [defense, setDefense] = useState(
    optionalNumberToInput(initialCard?.defense)
  );
  const [critical, setCritical] = useState(
    optionalNumberToInput(initialCard?.critical)
  );
  const [cardText, setCardText] = useState(initialCard?.card_text ?? "");
  const [isDragon, setIsDragon] = useState(initialCard?.is_dragon ?? false);
  const [isCornerKing, setIsCornerKing] = useState(
    initialCard?.is_corner_king ?? false
  );
  const [isHyakki, setIsHyakki] = useState(initialCard?.is_hyakki ?? false);
  const [isChaos, setIsChaos] = useState(initialCard?.is_chaos ?? false);
  const [isGeneric, setIsGeneric] = useState(initialCard?.is_generic ?? false);
  const [isHeaven, setIsHeaven] = useState(initialCard?.is_heaven ?? false);
  const [isHell, setIsHell] = useState(initialCard?.is_hell ?? false);
  const [isActive, setIsActive] = useState(initialCard?.is_active ?? true);
  const [message, setMessage] = useState("");

  const worlds = useMemo(() => inputToArray(worldsText), [worldsText]);
  const races = useMemo(() => inputToArray(racesText), [racesText]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("カード名を入力してください。");
      return;
    }

    setMessage("");
    await onSubmit({
      name: name.trim(),
      worlds,
      races,
      cardType,
      orientation,
      size: parseOptionalNumber(size),
      power: parseOptionalNumber(power),
      defense: parseOptionalNumber(defense),
      critical: parseOptionalNumber(critical),
      cardText: cardText.trim() || null,
      isDragon,
      isCornerKing,
      isHyakki,
      isChaos,
      isGeneric,
      isHeaven,
      isHell,
      isActive
    });
  }

  return (
    <form className="dm-auth-form dm-card-form" onSubmit={handleSubmit}>
      <label>
        カード名
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>

      <div className="dm-form-grid-2">
        <label>
          カードタイプ
          <select
            value={cardType}
            onChange={(event) => setCardType(event.target.value as CardType)}
          >
            {CARD_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          向き
          <select
            value={orientation}
            onChange={(event) =>
              setOrientation(event.target.value as CardOrientation)
            }
          >
            {ORIENTATION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        ワールド
        <input
          value={worldsText}
          placeholder="例: ドラゴンワールド, スタードラゴンワールド"
          onChange={(event) => setWorldsText(event.target.value)}
        />
      </label>

      <label>
        種族
        <input
          value={racesText}
          placeholder="例: ドラゴン, 雷帝軍"
          onChange={(event) => setRacesText(event.target.value)}
        />
      </label>

      <div className="dm-form-grid-2">
        <label>
          サイズ
          <input
            type="number"
            min={0}
            value={size}
            onChange={(event) => setSize(event.target.value)}
          />
        </label>

        <label>
          打撃力
          <input
            type="number"
            min={0}
            value={critical}
            onChange={(event) => setCritical(event.target.value)}
          />
        </label>

        <label>
          攻撃力
          <input
            type="number"
            min={0}
            value={power}
            onChange={(event) => setPower(event.target.value)}
          />
        </label>

        <label>
          防御力
          <input
            type="number"
            min={0}
            value={defense}
            onChange={(event) => setDefense(event.target.value)}
          />
        </label>
      </div>

      <label>
        カードテキスト
        <textarea
          rows={8}
          value={cardText}
          onChange={(event) => setCardText(event.target.value)}
        />
      </label>

      <fieldset className="dm-form-fieldset">
        <legend>分類タグ</legend>
        <div className="dm-checkbox-grid">
          <label>
            <input
              type="checkbox"
              checked={isDragon}
              onChange={(event) => setIsDragon(event.target.checked)}
            />
            ドラゴン
          </label>
          <label>
            <input
              type="checkbox"
              checked={isCornerKing}
              onChange={(event) => setIsCornerKing(event.target.checked)}
            />
            角王
          </label>
          <label>
            <input
              type="checkbox"
              checked={isHyakki}
              onChange={(event) => setIsHyakki(event.target.checked)}
            />
            百鬼
          </label>
          <label>
            <input
              type="checkbox"
              checked={isChaos}
              onChange={(event) => setIsChaos(event.target.checked)}
            />
            カオス
          </label>
          <label>
            <input
              type="checkbox"
              checked={isGeneric}
              onChange={(event) => setIsGeneric(event.target.checked)}
            />
            ジェネリック
          </label>
          <label>
            <input
              type="checkbox"
              checked={isHeaven}
              onChange={(event) => setIsHeaven(event.target.checked)}
            />
            楽園天国
          </label>
          <label>
            <input
              type="checkbox"
              checked={isHell}
              onChange={(event) => setIsHell(event.target.checked)}
            />
            灼熱地獄
          </label>
        </div>
      </fieldset>

      <label className="dm-settings-check-row">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        <span>有効カードとして扱う</span>
      </label>

      <div className="dm-card-form-preview">
        <p>ワールド：{worlds.join("・") || "未入力"}</p>
        <p>種族：{races.join("・") || "未入力"}</p>
      </div>

      <Button type="submit" variant="primary" loading={loading} fullWidth>
        {submitLabel}
      </Button>
      {message && <p className="dm-form-message">{message}</p>}
    </form>
  );
}
