import { CardViewer } from "@/components/cards/CardViewer";
import type {
  CardImageRecord,
  CardOrientation,
  CardRecord,
} from "@/types/baddiePhyto";

type BoardCardProps = {
  card: CardRecord;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
  isPublic?: boolean;
  variant?: "board";
  displayOrientation?: CardOrientation;
};

export function BoardCard({
  card,
  images = [],
  selectedImageId,
  isPublic = true,
  displayOrientation = "vertical",
}: BoardCardProps) {
  return (
    <div className="bp-board-card">
      <CardViewer
        card={card}
        images={images}
        selectedImageId={selectedImageId}
        variant="board"
        faceDown={!isPublic}
        displayOrientation={displayOrientation}
      />
    </div>
  );
}
