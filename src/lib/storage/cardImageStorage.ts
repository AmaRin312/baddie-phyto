import { supabase } from "@/lib/supabase/client";
import type { CardImageRecord } from "@/types/baddiePhyto";

const BUCKET_NAME = "card-images";
const CARD_IMAGE_SELECT_COLUMNS = [
  "id",
  "card_id",
  "owner_id",
  "image_path",
  "thumbnail_path",
  "is_default",
  "created_at"
].join(",");
const CARD_IMAGE_CACHE_TTL_MS = 60_000;
type CachedCardImagesResponse = {
  data: CardImageRecord[] | null;
  error: { message: string } | null;
};
const cardImagesCache = new Map<
  string,
  { expiresAt: number; value: CachedCardImagesResponse }
>();
const cardImagesInFlight = new Map<string, Promise<CachedCardImagesResponse>>();

function clearCardImagesCache() {
  cardImagesCache.clear();
}

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function loadCardImages(cardId?: string) {
  const cacheKey = `card-images:${cardId ?? "all"}`;
  const cached = cardImagesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = cardImagesInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  let query = supabase
    .from("card_images")
    .select(CARD_IMAGE_SELECT_COLUMNS)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (cardId) query = query.eq("card_id", cardId);
  const request: Promise<CachedCardImagesResponse> = (async () => {
    try {
      const result = await query.returns<CardImageRecord[]>();
      if (!result.error) {
        cardImagesCache.set(cacheKey, {
          expiresAt: Date.now() + CARD_IMAGE_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    } finally {
      cardImagesInFlight.delete(cacheKey);
    }
  })();
  cardImagesInFlight.set(cacheKey, request);
  return request;
}

export async function loadCardImagesByCardIds(cardIds: readonly string[]) {
  const uniqueCardIds = [...new Set(cardIds.filter(Boolean))];

  if (uniqueCardIds.length === 0) {
    return {
      data: [] as CardImageRecord[],
      error: null
    };
  }

  const cacheKey = `card-images:ids:${uniqueCardIds.slice().sort().join(",")}`;
  const cached = cardImagesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = cardImagesInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  const request: Promise<CachedCardImagesResponse> = (async () => {
    try {
      const result = await supabase
        .from("card_images")
        .select(CARD_IMAGE_SELECT_COLUMNS)
        .in("card_id", uniqueCardIds)
        .order("is_default", { ascending: false })
        .order("created_at")
        .returns<CardImageRecord[]>();
      if (!result.error) {
        cardImagesCache.set(cacheKey, {
          expiresAt: Date.now() + CARD_IMAGE_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    } finally {
      cardImagesInFlight.delete(cacheKey);
    }
  })();

  cardImagesInFlight.set(cacheKey, request);
  return request;
}

export async function uploadCardImage(input: {
  ownerId: string;
  cardId: string;
  file: File;
}) {
  const imagePath = `${input.ownerId}/${input.cardId}/${crypto.randomUUID()}.${getExtension(input.file)}`;
  const existingImages = await loadCardImages(input.cardId);
  const shouldBeDefault = !existingImages.error && (existingImages.data ?? []).length === 0;
  const uploadResult = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imagePath, input.file, { upsert: false });

  if (uploadResult.error) return { data: null, error: uploadResult.error };

  const insertResult = await supabase
    .from("card_images")
    .insert({
      card_id: input.cardId,
      owner_id: input.ownerId,
      image_path: imagePath,
      thumbnail_path: imagePath,
      is_default: shouldBeDefault
    })
    .select("*")
    .single();

  if (insertResult.error) {
    await supabase.storage.from(BUCKET_NAME).remove([imagePath]);
  }

  if (!insertResult.error) {
    clearCardImagesCache();
  }
  return insertResult;
}

export async function setDefaultCardImage(input: {
  cardId: string;
  imageId: string;
}) {
  const resetResult = await supabase
    .from("card_images")
    .update({ is_default: false })
    .eq("card_id", input.cardId);

  if (resetResult.error) return resetResult;

  const result = await supabase
    .from("card_images")
    .update({ is_default: true })
    .eq("id", input.imageId)
    .eq("card_id", input.cardId);
  if (!result.error) {
    clearCardImagesCache();
  }
  return result;
}

export async function deleteCardImage(input: {
  imageId: string;
  imagePath: string;
  thumbnailPath?: string | null;
}) {
  const paths = [
    input.imagePath,
    ...(input.thumbnailPath && input.thumbnailPath !== input.imagePath
      ? [input.thumbnailPath]
      : [])
  ];
  const storageResult = await supabase.storage
    .from(BUCKET_NAME)
    .remove(paths);

  if (storageResult.error) return storageResult;
  const result = await supabase.from("card_images").delete().eq("id", input.imageId);
  if (!result.error) {
    clearCardImagesCache();
  }
  return result;
}

export function getPublicCardImageUrl(imagePath?: string | null) {
  if (!imagePath) return null;
  return supabase.storage.from(BUCKET_NAME).getPublicUrl(imagePath).data.publicUrl;
}

export function getCardBoardImagePath(image?: {
  image_path: string;
  thumbnail_path?: string | null;
} | null) {
  return image?.thumbnail_path || image?.image_path || null;
}
