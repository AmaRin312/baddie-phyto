import { CardViewer } from "@/components/cards/CardViewer";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BoardCardProps = {
  card: CardRecord;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
  isPublic?: boolean;
  variant?: "board";
  sleeveImageUrl?: string | null;
  preserveOrientation?: boolean;
};

export function BoardCard({
  card,
  images = [],
  selectedImageId,
  isPublic = true,
  sleeveImageUrl = null,
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
        preserveOrientation={preserveOrientation}
      />
    </div>
  );
}
