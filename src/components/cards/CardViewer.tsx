import { getDisplayCard } from "@/lib/cards/cardPresentation";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";
import styles from "./CardViewer.module.css";

type CardViewerProps = {
  card: CardRecord;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
  className?: string;
  variant?: "viewer" | "compact" | "board";
  faceDown?: boolean;
  forcePortrait?: boolean;
  forcePortraitZoomPercent?: number;
  faceDownImageUrl?: string | null;
  preserveOrientation?: boolean;
};

function formatValue(value: number | null) {
  return value == null ? "-" : value.toLocaleString();
}

export function CardViewer({
  card,
  images = [],
  selectedImageId,
  className = "",
  variant = "viewer",
  faceDown = false,
  forcePortrait = false,
  forcePortraitZoomPercent,
  faceDownImageUrl = null,
  preserveOrientation = false
}: CardViewerProps) {
  const displayCard = getDisplayCard({ card, images, selectedImageId });
  const rootClassName = [
    styles.viewer,
    variant === "compact" ? styles.compact : "",
    variant === "board" ? styles.board : "",
    variant === "viewer" && card.orientation === "horizontal" ? styles.horizontalViewer : "",
    className
  ]
    .filter(Boolean)
    .join(" ");

  if (faceDown) {
    return (
      <article className={rootClassName} aria-label="??????">
        {faceDownImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.image}
            src={faceDownImageUrl}
            alt="??????"
            draggable={false}
          />
        ) : (
          <div className={styles.faceDown}>BF</div>
        )}
      </article>
    );
  }

  const imageSrc = variant === "board" ? displayCard.thumbnailUrl : displayCard.imageUrl;
  const shouldForcePortraitImage =
    card.orientation === "horizontal" &&
    !preserveOrientation &&
    (forcePortrait || variant !== "viewer");
  const imageClassName = [
    styles.image,
    shouldForcePortraitImage ? styles.forcePortraitImage : ""
  ]
    .filter(Boolean)
    .join(" ");
  const imageStyle =
    shouldForcePortraitImage && forcePortraitZoomPercent != null
      ? { width: `${forcePortraitZoomPercent}%` }
      : undefined;

  if (!displayCard.useHtmlCard && imageSrc) {
    return (
      <article className={rootClassName} aria-label={displayCard.name}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={imageClassName}
          src={imageSrc}
          alt={displayCard.name}
          style={imageStyle}
          draggable={false}
        />
      </article>
    );
  }

  const sizeOrType =
    displayCard.size == null ? displayCard.cardType : String(displayCard.size);

  return (
    <article className={rootClassName} aria-label={displayCard.name}>
      <div className={styles.htmlCard}>
        <div className={styles.topLine}>
          <span className={styles.sizeOrType}>{sizeOrType}</span>
          <span className={styles.cardType}>{displayCard.cardType}</span>
        </div>

        <strong className={styles.name}>{displayCard.name}</strong>

        <div className={styles.races}>
          {displayCard.races.length > 0 ? displayCard.races.join(" / ") : "????"}
        </div>

        <div className={styles.text}>
          {displayCard.cardText?.trim() || "?????????"}
        </div>

        <div className={styles.stats}>
          <span className={styles.stat}>? {formatValue(displayCard.power)}</span>
          <span className={styles.stat}>? {formatValue(displayCard.defense)}</span>
          <span className={styles.stat}>? {formatValue(displayCard.critical)}</span>
        </div>
      </div>
    </article>
  );
}
