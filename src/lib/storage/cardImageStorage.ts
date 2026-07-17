import { supabase } from "@/lib/supabase/client";
import type { CardImageRecord } from "@/types/baddiePhyto";

const BUCKET_NAME = "card-images";

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export async function loadCardImages(cardId?: string) {
  let query = supabase
    .from("card_images")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at");
  if (cardId) query = query.eq("card_id", cardId);
  return await query.returns<CardImageRecord[]>();
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

  return await supabase
    .from("card_images")
    .update({ is_default: true })
    .eq("id", input.imageId)
    .eq("card_id", input.cardId);
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
  return await supabase.from("card_images").delete().eq("id", input.imageId);
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
