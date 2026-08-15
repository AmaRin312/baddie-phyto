import { memo, useMemo } from "react";
import { getDisplayCard } from "@/lib/cards/cardPresentation";
import type {
  CardImageRecord,
  CardOrientation,
  CardRecord
} from "@/types/baddiePhyto";
import styles from "./CardViewer.module.css";

type CardViewerProps = {
  card: CardRecord;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
  className?: string;
  variant?: "viewer" | "compact" | "board";
  faceDown?: boolean;
  displayOrientation?: CardOrientation;
};

function formatValue(value: number | null) {
  return value == null ? "-" : value.toLocaleString();
}

function CardViewerComponent({
  card,
  images = [],
  selectedImageId,
  className = "",
  variant = "viewer",
  faceDown = false,
  displayOrientation = "vertical"
}: CardViewerProps) {
  const displayCard = useMemo(
    () => getDisplayCard({ card, images, selectedImageId }),
    [card, images, selectedImageId]
  );

  const rootClassName = useMemo(
    () =>
      [
        "dm-card-viewer",
        `dm-card-viewer--${variant}`,
        `dm-card-viewer--${displayOrientation}`,
        styles.viewer,
        variant === "compact" ? styles.compact : "",
        variant === "board" ? styles.board : "",
        displayOrientation === "horizontal" ? styles.horizontal : "",
        className
      ]
        .filter(Boolean)
        .join(" "),
    [className, displayOrientation, variant]
  );

  if (faceDown) {
    return (
      <article
        className={rootClassName}
        data-card-viewer=""
        data-variant={variant}
        data-display-orientation={displayOrientation}
        aria-label="裏向きカード"
      >
        <div className={styles.faceDown}>BF</div>
      </article>
    );
  }

  const imageSrc =
    variant === "viewer"
      ? displayCard.imageUrl
      : displayCard.thumbnailUrl ?? displayCard.imageUrl;

  if (!displayCard.useHtmlCard && imageSrc) {
    return (
      <article
        className={rootClassName}
        data-card-viewer=""
        data-variant={variant}
        data-display-orientation={displayOrientation}
        aria-label={displayCard.name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={styles.image}
          src={imageSrc}
          alt={displayCard.name}
          loading="lazy"
          decoding="async"
        />
      </article>
    );
  }

  const sizeOrType = displayCard.size == null ? displayCard.cardType : String(displayCard.size);

  return (
    <article
      className={rootClassName}
      data-card-viewer=""
      data-variant={variant}
      data-display-orientation={displayOrientation}
      aria-label={displayCard.name}
    >
      <div className={styles.htmlCard}>
        <div className={styles.topLine}>
          <span className={styles.sizeOrType}>{sizeOrType}</span>
          <span className={styles.cardType}>{displayCard.cardType}</span>
        </div>

        <strong className={styles.name}>{displayCard.name}</strong>

        <div className={styles.races}>
          {displayCard.races.length > 0 ? displayCard.races.join(" / ") : "種族なし"}
        </div>

        <div className={styles.text}>
          {displayCard.cardText?.trim() || "カードテキストなし"}
        </div>

        <div className={styles.stats}>
          <span className={styles.stat}>攻 {formatValue(displayCard.power)}</span>
          <span className={styles.stat}>防 {formatValue(displayCard.defense)}</span>
          <span className={styles.stat}>打 {formatValue(displayCard.critical)}</span>
        </div>
      </div>
    </article>
  );
}

export const CardViewer = memo(CardViewerComponent);
