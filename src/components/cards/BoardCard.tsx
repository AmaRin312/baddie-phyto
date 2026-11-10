import { memo } from "react";
import { CardViewer } from "@/components/cards/CardViewer";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

const EMPTY_IMAGES: readonly CardImageRecord[] = [];

type BoardCardProps = {
  card: CardRecord;
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
