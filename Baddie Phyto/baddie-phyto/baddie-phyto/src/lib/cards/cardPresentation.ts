import { getCardTypeLabel, type CardImageRecord, type CardRecord } from "@/types/baddiePhyto";
import { getPublicCardImageUrl } from "@/lib/storage/cardImageStorage";

export type DisplayCard = {
  name: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  useHtmlCard: boolean;
  cardType: string;
  size: number | null;
  races: string[];
  power: number | null;
  defense: number | null;
  critical: number | null;
  cardText: string | null;
};

function selectDisplayImage(
  images: readonly CardImageRecord[],
  selectedImageId?: string | null
) {
  if (selectedImageId) {
    return images.find((image) => image.id === selectedImageId) ?? null;
  }

  return images.find((image) => image.is_default) ?? null;
}

export function getDisplayCard(input: {
  card: CardRecord;
  images?: readonly CardImageRecord[];
  selectedImageId?: string | null;
}): DisplayCard {
  const image = selectDisplayImage(input.images ?? [], input.selectedImageId);
  const imageUrl = getPublicCardImageUrl(image?.image_path);
  const thumbnailUrl = getPublicCardImageUrl(image?.thumbnail_path ?? image?.image_path);

  return {
    name: input.card.name,
    imageUrl,
    thumbnailUrl,
    useHtmlCard: !imageUrl,
    cardType: getCardTypeLabel(input.card.card_type),
    size: input.card.size,
    races: input.card.races,
    power: input.card.power,
    defense: input.card.defense,
    critical: input.card.critical,
    cardText: input.card.card_text
  };
}
