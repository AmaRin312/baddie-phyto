import { memo } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

const EMPTY_IMAGES: readonly CardImageRecord[] = [];

type BoardCardProps = {
  card: CardRecord | null;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
  isPublic?: boolean;
  variant?: "board";
  sleeveImageUrl?: string | null;
  forcePortraitZoomPercent?: number;
  preserveOrientation?: boolean;
};

export const BoardCard = memo(function BoardCard({
  card,
  images = EMPTY_IMAGES,
  selectedImageId,
  isPublic = true,
  sleeveImageUrl = null,
  forcePortraitZoomPercent,
  preserveOrientation = false
}: BoardCardProps) {
  if (!card) {
    return (
      <div className="bp-board-card" aria-label={isPublic ? "カードを読み込み中" : "裏向きカード"}>
        {!isPublic && sleeveImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sleeveImageUrl} alt="裏向きカード" draggable={false} />
        ) : (
          <div className={`bp-board-card-fallback${isPublic ? " is-loading" : ""}`}>
            {isPublic ? "読み込み中" : "BF"}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bp-board-card">
      <CardViewer
        card={card}
        images={images}
        selectedImageId={selectedImageId}
        variant="board"
        faceDown={!isPublic}
        faceDownImageUrl={sleeveImageUrl}
        forcePortraitZoomPercent={forcePortraitZoomPercent}
        preserveOrientation={preserveOrientation}
      />
    </div>
  );
});
