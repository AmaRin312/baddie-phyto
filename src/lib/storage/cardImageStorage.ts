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
const cardImagesByCardCache = new Map<
  string,
  { expiresAt: number; images: CardImageRecord[] }
>();
const cardImagesByCardInFlight = new Map<string, Promise<CachedCardImagesResponse>>();
let cardImageCacheGeneration = 0;

function clearCardImagesCache() {
  cardImageCacheGeneration += 1;
  cardImagesCache.clear();
  cardImagesByCardCache.clear();
  cardImagesInFlight.clear();
  cardImagesByCardInFlight.clear();
}

function cacheImagesByCardIds(cardIds: readonly string[], images: readonly CardImageRecord[]) {
  const imagesByCard = new Map<string, CardImageRecord[]>();
  images.forEach((image) => {
    const cardImages = imagesByCard.get(image.card_id);
    if (cardImages) cardImages.push(image);
    else imagesByCard.set(image.card_id, [image]);
  });
  const expiresAt = Date.now() + CARD_IMAGE_CACHE_TTL_MS;
  cardIds.forEach((cardId) => {
    cardImagesByCardCache.set(cardId, {
      expiresAt,
      images: imagesByCard.get(cardId) ?? []
    });
  });
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
  if (cardId) {
    const perCard = cardImagesByCardCache.get(cardId);
    if (perCard && perCard.expiresAt > Date.now()) {
      const value: CachedCardImagesResponse = { data: perCard.images, error: null };
      cardImagesCache.set(cacheKey, { expiresAt: perCard.expiresAt, value });
      return value;
    }
    if (perCard) cardImagesByCardCache.delete(cardId);
    const perCardInFlight = cardImagesByCardInFlight.get(cardId);
    if (perCardInFlight) {
      return perCardInFlight.then((result) => result.error
        ? result
        : { ...result, data: (result.data ?? []).filter((image) => image.card_id === cardId) });
    }
  }
  const inFlight = cardImagesInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  let query = supabase
    .from("card_images")
    .select(CARD_IMAGE_SELECT_COLUMNS)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (cardId) query = query.eq("card_id", cardId);
  const cacheGeneration = cardImageCacheGeneration;
  const request: Promise<CachedCardImagesResponse> = (async () => {
    try {
      const result = await query.returns<CardImageRecord[]>();
      if (!result.error && cacheGeneration === cardImageCacheGeneration) {
        cardImagesCache.set(cacheKey, {
          expiresAt: Date.now() + CARD_IMAGE_CACHE_TTL_MS,
          value: result
        });
        if (cardId) cacheImagesByCardIds([cardId], result.data ?? []);
      }
      return result;
    } finally {
      if (cacheGeneration === cardImageCacheGeneration) {
        cardImagesInFlight.delete(cacheKey);
      }
      if (cardId && cacheGeneration === cardImageCacheGeneration) {
        cardImagesByCardInFlight.delete(cardId);
      }
    }
  })();
  cardImagesInFlight.set(cacheKey, request);
  if (cardId) cardImagesByCardInFlight.set(cardId, request);
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
  const missingCardIds = uniqueCardIds.filter((cardId) => {
    const entry = cardImagesByCardCache.get(cardId);
    if (!entry) return true;
    if (entry.expiresAt <= Date.now()) {
      cardImagesByCardCache.delete(cardId);
      return true;
    }
    return false;
  });

  const requestedFlights = new Set<Promise<CachedCardImagesResponse>>();
  const newCardIds = missingCardIds.filter((cardId) => {
    const inFlight = cardImagesByCardInFlight.get(cardId);
    if (inFlight) requestedFlights.add(inFlight);
    return !inFlight;
  });

  if (newCardIds.length > 0) {
    const cacheGeneration = cardImageCacheGeneration;
    let request: Promise<CachedCardImagesResponse>;
    request = (async () => {
      try {
        const result = await supabase
          .from("card_images")
          .select(CARD_IMAGE_SELECT_COLUMNS)
          .in("card_id", newCardIds)
          .order("is_default", { ascending: false })
          .order("created_at")
          .returns<CardImageRecord[]>();
        if (!result.error && cacheGeneration === cardImageCacheGeneration) {
          cacheImagesByCardIds(newCardIds, result.data ?? []);
        }
        return result;
      } finally {
        newCardIds.forEach((cardId) => {
          if (cardImagesByCardInFlight.get(cardId) === request) {
            cardImagesByCardInFlight.delete(cardId);
          }
        });
      }
    })();
    newCardIds.forEach((cardId) => cardImagesByCardInFlight.set(cardId, request));
    requestedFlights.add(request);
  }

  const flightResults = await Promise.all(requestedFlights);
  const failedResult = flightResults.find((result) => result.error);
  if (failedResult?.error) return failedResult;

  const images = uniqueCardIds.flatMap((cardId) =>
    cardImagesByCardCache.get(cardId)?.images ?? []
  );
  const result: CachedCardImagesResponse = { data: images, error: null };
  cardImagesCache.set(cacheKey, {
    expiresAt: Date.now() + CARD_IMAGE_CACHE_TTL_MS,
    value: result
  });
  return result;
}

export async function uploadCardImage(input: {
  ownerId: string;
  cardId: string;
  file: File;
}) {
  const imagePath = `${input.ownerId}/${input.cardId}/${crypto.randomUUID()}.${getExtension(input.file)}`;
  const imageId = crypto.randomUUID();
  const thumbnailPath = `${input.ownerId}/${input.cardId}/thumbnails/${imageId}.webp`;
  const existingImages = await loadCardImages(input.cardId);
  const shouldBeDefault = !existingImages.error && (existingImages.data ?? []).length === 0;
  const uploadResult = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imagePath, input.file, { upsert: false });

  if (uploadResult.error) return { data: null, error: uploadResult.error };

  let storedThumbnailPath = imagePath;
  try {
    const thumbnail = await createCardThumbnail(input.file);
    if (thumbnail) {
      const thumbnailUpload = await supabase.storage.from(BUCKET_NAME).upload(thumbnailPath, thumbnail, {
        upsert: false,
        contentType: "image/webp"
      });
      if (!thumbnailUpload.error) storedThumbnailPath = thumbnailPath;
    }
  } catch (error) {
    console.warn("カードのサムネイル生成に失敗しました。元画像を使用します。", error);
  }

  const insertResult = await supabase
    .from("card_images")
    .insert({
      card_id: input.cardId,
      owner_id: input.ownerId,
      image_path: imagePath,
      thumbnail_path: storedThumbnailPath,
      is_default: shouldBeDefault
    })
    .select("*")
    .single();

  if (insertResult.error) {
    await supabase.storage.from(BUCKET_NAME).remove([imagePath, ...(storedThumbnailPath !== imagePath ? [storedThumbnailPath] : [])]);
  }

  if (!insertResult.error) {
    clearCardImagesCache();
  }
  return insertResult;
}

export async function createCardThumbnail(source: Blob) {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(source);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * 0.75));
    canvas.height = Math.max(1, Math.round(bitmap.height * 0.75));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const thumbnail = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, "image/webp", 0.82)
    );
    return thumbnail?.type === "image/webp" ? thumbnail : null;
  } finally {
    bitmap.close();
  }
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
