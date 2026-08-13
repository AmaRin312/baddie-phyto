import type { CSSProperties } from "react";
import { getPublicCardImageUrl } from "@/lib/storage/cardImageStorage";
import type { CardType } from "@/types/baddiePhyto";

export type CardVisualData = {
  name: string;
  imagePath?: string | null;
  civilization?: string | null;
  cost?: number | null;
  size?: number | null;
  power?: number | null;
  defense?: number | null;
  critical?: number | null;
  cardText?: string | null;
  card_text?: string | null;
  cardType?: CardType | null;
  card_type?: CardType | null;
  worlds?: string[] | null;
  race?: string | null;
  races?: string[] | null;
};

type CardVisualProps = {
  card?: CardVisualData | null;
  mode?: "compact" | "viewer";
  faceDown?: boolean;
  label?: string;
  soulCount?: number;
};

const CIVILIZATION_COLORS: Readonly<Record<string, string>> = {
  火: "rgba(254, 202, 202, 0.9)",
  水: "rgba(125, 211, 252, 0.72)",
  光: "rgba(254, 249, 195, 0.94)",
  闇: "rgba(209, 213, 219, 0.9)",
  自然: "rgba(187, 247, 208, 0.9)",
  無色: "rgba(255, 255, 255, 0.96)"
};

const CARD_TYPE_LABELS: Readonly<Record<CardType, string>> = {
  monster: "モンスター",
  spell: "魔法",
  item: "アイテム",
  impact: "必殺技",
  impact_monster: "必殺モンスター",
  flag_card: "フラッグカード",
  other: "その他"
};

function splitCivilizations(civilization?: string | null) {
  if (!civilization?.trim()) return ["無色"];

  const values = civilization
    .split(/[\/・,、\s]+/u)
    .map((value) => value.trim())
    .filter(Boolean);

  return values.length > 0 ? values : ["無色"];
}

function getCivilizationBackground(civilizations: readonly string[]) {
  const colors = civilizations.map(
    (civilization) =>
      CIVILIZATION_COLORS[civilization] ?? "rgba(255, 255, 255, 0.96)"
  );

  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg, ${colors.join(", ")})`;
}

function getViewerTypeLabel(cardType?: CardType | null) {
  if (!cardType) return "-";
  return CARD_TYPE_LABELS[cardType] ?? cardType;
}

function getViewerSizeOrType(card?: CardVisualData | null) {
  const cardType = card?.cardType ?? card?.card_type;
  if (cardType === "monster") return card?.size ?? "-";
  return getViewerTypeLabel(cardType);
}

function getViewerRace(card?: CardVisualData | null) {
  const cardType = card?.cardType ?? card?.card_type;
  if (cardType !== "monster") return null;
  if (card?.races?.length) return card.races.join(" / ");
  return card?.race?.trim() || null;
}

export function CardVisual({
  card,
  mode = "compact",
  faceDown = false,
  label,
  soulCount
}: CardVisualProps) {
  if (faceDown) {
    return (
      <div className={`dm-card-visual ${mode} face-down`}>
        <span>裏向き</span>
      </div>
    );
  }

  const civilizations = splitCivilizations(card?.civilization);
  const imageUrl = getPublicCardImageUrl(card?.imagePath);
  const style = {
    "--dm-card-civilization-background": getCivilizationBackground(
      civilizations
    )
  } as CSSProperties;

  if (mode === "viewer") {
    const race = getViewerRace(card);

    return (
      <div className="bp-viewer-card-wrap">
        <article className="dm-card-visual viewer bp-viewer-card" style={style}>
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="dm-card-visual-image bp-viewer-card-image"
              src={imageUrl}
              alt={card?.name ?? label ?? "card"}
            />
          )}

          <div className="bp-viewer-size-or-type">
            {getViewerSizeOrType(card)}
          </div>

          <div className="bp-viewer-stat bp-viewer-defense">
            {card?.defense ?? "-"}
          </div>
          <div className="bp-viewer-stat bp-viewer-critical">
            {card?.critical ?? "-"}
          </div>
          <div className="bp-viewer-stat bp-viewer-power">
            {card?.power ?? "-"}
          </div>

          <div className="bp-viewer-text">
            {card?.cardText?.trim() || card?.card_text?.trim() || "カードテキストなし"}
          </div>

          {race && <div className="bp-viewer-race">{race}</div>}
          <div className="bp-viewer-name">
            {card?.name ?? label ?? "CARD"}
          </div>
        </article>
        {typeof soulCount === "number" && (
          <div className="bp-viewer-soul-count">ソウル：{soulCount}枚</div>
        )}
      </div>
    );
  }

  return (
    <div className={`dm-card-visual ${mode}`} style={style}>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="dm-card-visual-image"
          src={imageUrl}
          alt={card?.name ?? label ?? "card"}
        />
      )}

      <span
        className="dm-card-visual-cost"
        aria-label={`コスト ${card?.cost ?? "未設定"}`}
      >
        {card?.cost ?? "-"}
      </span>
      <span className="dm-card-visual-civilization">
        {civilizations.join(" / ")}
      </span>
      <strong className="dm-card-visual-name">
        {card?.name ?? label ?? "CARD"}
      </strong>
      <strong className="dm-card-visual-power">
        {card?.power ?? "-"}
      </strong>
    </div>
  );
}
