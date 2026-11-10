import { memo } from "react";
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
  horizontalRotation?: "clockwise" | "counterclockwise";
  faceDownImageUrl?: string | null;
  preserveOrientation?: boolean;
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
  horizontalRotation = "clockwise",
  forcePortraitZoomPercent,
  faceDownImageUrl = null,
  preserveOrientation = false
}: CardViewerProps) {
  const displayCard = getDisplayCard({ card, images, selectedImageId });
  const rootClassName = [
    styles.viewer,
    variant === "compact" ? styles.compact : "",
    variant === "board" ? styles.board : "",
    variant === "viewer" && card.orientation === "horizontal" && preserveOrientation
      ? styles.horizontalViewer
      : "",
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
            loading={variant === "viewer" ? "eager" : "lazy"}
            decoding="async"
            draggable={false}
          />
        ) : (
          <div className={styles.faceDown}>BF</div>
        )}
      </article>
    );
  }

  const imageSrc =
    variant === "board" || variant === "compact"
      ? displayCard.thumbnailUrl
      : displayCard.imageUrl;
  const shouldForcePortraitImage =
    card.orientation === "horizontal" &&
    !preserveOrientation;
  const imageClassName = [
    styles.image,
    shouldForcePortraitImage
      ? horizontalRotation === "counterclockwise"
        ? styles.forcePortraitImageCounterClockwise
        : styles.forcePortraitImage
      : ""
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
          loading={variant === "viewer" ? "eager" : "lazy"}
          decoding="async"
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

function areImagesEqual(
  left: readonly CardImageRecord[] | undefined,
  right: readonly CardImageRecord[] | undefined
) {
  const leftImages = left ?? [];
  const rightImages = right ?? [];
  if (leftImages === rightImages) return true;
  if (leftImages.length !== rightImages.length) return false;

  for (let index = 0; index < leftImages.length; index += 1) {
    if (
      leftImages[index]?.id !== rightImages[index]?.id ||
      leftImages[index]?.image_path !== rightImages[index]?.image_path ||
      leftImages[index]?.thumbnail_path !== rightImages[index]?.thumbnail_path ||
      leftImages[index]?.is_default !== rightImages[index]?.is_default ||
      leftImages[index]?.created_at !== rightImages[index]?.created_at
    ) {
      return false;
    }
  }

  return true;
}

export const CardViewer = memo(CardViewerComponent, (prevProps, nextProps) => {
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.updated_at === nextProps.card.updated_at &&
    prevProps.selectedImageId === nextProps.selectedImageId &&
    prevProps.className === nextProps.className &&
    prevProps.variant === nextProps.variant &&
    prevProps.faceDown === nextProps.faceDown &&
    prevProps.forcePortrait === nextProps.forcePortrait &&
    prevProps.forcePortraitZoomPercent === nextProps.forcePortraitZoomPercent &&
    prevProps.horizontalRotation === nextProps.horizontalRotation &&
    prevProps.faceDownImageUrl === nextProps.faceDownImageUrl &&
    prevProps.preserveOrientation === nextProps.preserveOrientation &&
    areImagesEqual(prevProps.images, nextProps.images)
  );
});
