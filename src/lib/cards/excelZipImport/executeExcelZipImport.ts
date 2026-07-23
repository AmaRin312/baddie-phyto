import { supabase } from "@/lib/supabase/client";
import {
  isSameExcelZipCardRecord,
  normalizeImportText
} from "@/lib/cards/excelZipImport/excelZipImportNormalization";
import { getExcelZipImageStoragePath } from "@/lib/cards/excelZipImport/excelZipImageHash";
import type {
  ExcelZipCardGroup,
  ExcelZipImageEntry,
  ExcelZipImportPreview,
  ExcelZipImportResult,
  NormalizedExcelZipCardRow
} from "@/lib/cards/excelZipImport/excelZipImportTypes";
import type { AbilityRecord, CardImageRecord, CardRecord } from "@/types/baddiePhyto";

const BUCKET_NAME = "card-images";

function getFirstRow(group: ExcelZipCardGroup) {
  const firstRow = group.rows[0];
  if (!firstRow) throw new Error(`カード行がありません: ${group.name}`);
  return firstRow;
}

function getImageByName(preview: ExcelZipImportPreview) {
  return new Map(preview.images.map((image) => [image.fileName, image]));
}

function createCardInsertPayload(cardId: string, row: NormalizedExcelZipCardRow) {
  return {
    id: cardId,
    name: row.name,
    worlds: row.worlds,
    races: row.races,
    orientation: row.orientation,
    size: row.size,
    power: row.power,
    defense: row.defense,
    critical: row.critical,
    card_text: row.card_text,
    card_type: row.card_type,
    is_dragon: row.is_dragon,
    is_hyakki: row.is_hyakki,
    is_corner_king: row.is_corner_king,
    is_chaos: row.is_chaos,
    is_generic: row.is_generic,
    is_heaven: row.is_heaven,
    is_hell: row.is_hell,
    is_active: row.is_active
  };
}

async function loadAbilities() {
  const { data, error } = await supabase
    .from("abilities")
    .select("*")
    .eq("is_active", true)
    .returns<AbilityRecord[]>();
  if (error) throw new Error(error.message);
  return data ?? [];
}

function findAbility(abilities: AbilityRecord[], value: string | null) {
  if (!value) return null;
  const normalized = normalizeImportText(value).toLowerCase();
  return (
    abilities.find(
      (ability) =>
        normalizeImportText(ability.behavior_key).toLowerCase() === normalized ||
        normalizeImportText(ability.name).toLowerCase() === normalized
    ) ?? null
  );
}

function resolveAbilityAtExecutionTime(input: {
  abilities: AbilityRecord[];
  row: NormalizedExcelZipCardRow;
}) {
  if (!input.row.ability) return null;

  const ability = findAbility(input.abilities, input.row.ability);
  if (!ability) {
    throw new Error(
      `登録直前の確認で、Abilityが見つからないか無効になっています: ${input.row.ability}`
    );
  }

  return ability;
}

async function ensureAbilityLink(input: {
  cardId: string;
  ability: AbilityRecord | null;
}) {
  if (!input.ability) return false;

  const { data: existing, error: existingError } = await supabase
    .from("card_abilities")
    .select("id")
    .eq("card_id", input.cardId)
    .eq("ability_id", input.ability.id)
    .maybeSingle<{ id: string }>();
  if (existingError) throw new Error(existingError.message);
  if (existing) return false;

  const { error } = await supabase.from("card_abilities").insert({
    card_id: input.cardId,
    ability_id: input.ability.id,
    params: {},
    sort_order: 0
  });
  if (error) throw new Error(error.message);
  return true;
}

async function uploadImagesForCard(input: {
  userId: string;
  cardId: string;
  group: ExcelZipCardGroup;
  imagesByName: Map<string, ExcelZipImageEntry>;
  hasExistingImages: boolean;
}) {
  const uploadedPaths: string[] = [];
  let skippedImageCount = 0;
  const skippedImageFiles: string[] = [];
  const imageRows: Array<{
    card_id: string;
    owner_id: string;
    image_path: string;
    thumbnail_path: string;
    is_default: boolean;
  }> = [];

  for (const [index, imageFile] of input.group.imageFiles.entries()) {
    const image = input.imagesByName.get(imageFile);
    if (!image) throw new Error(`画像が見つかりません: ${imageFile}`);

    const path = await getExcelZipImageStoragePath({
      userId: input.userId,
      cardId: input.cardId,
      image
    });

    const { data: existingImageRow, error: existingImageError } = await supabase
      .from("card_images")
      .select("id")
      .eq("card_id", input.cardId)
      .eq("image_path", path)
      .maybeSingle<{ id: string }>();
    if (existingImageError) {
      throw new Error(
        `画像の既存確認に失敗しました: ${imageFile} / path=${path} / ${existingImageError.message}`
      );
    }
    if (existingImageRow) {
      skippedImageCount += 1;
      skippedImageFiles.push(imageFile);
      continue;
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, image.blob, { upsert: false, contentType: image.blob.type || undefined });

    if (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPaths);
      }
      throw new Error(
        `画像アップロードに失敗しました: ${imageFile} / path=${path} / ${error.message}`
      );
    }

    uploadedPaths.push(path);
    imageRows.push({
      card_id: input.cardId,
      owner_id: input.userId,
      image_path: path,
      thumbnail_path: path,
      is_default: !input.hasExistingImages && index === 0
    });
  }

  return { uploadedPaths, imageRows, skippedImageCount, skippedImageFiles };
}

async function insertImageRows(imageRows: Array<{
  card_id: string;
  owner_id: string;
  image_path: string;
  thumbnail_path: string;
  is_default: boolean;
}>) {
  if (imageRows.length === 0) return [];
  const { data, error } = await supabase
    .from("card_images")
    .insert(imageRows)
    .select("*")
    .returns<CardImageRecord[]>();
  if (error) {
    throw new Error(
      `画像レコード登録に失敗しました: ${imageRows.length}件 / ${error.message}`
    );
  }
  return data ?? [];
}

async function removeImageRows(imageIds: string[]) {
  if (imageIds.length === 0) return;
  await supabase.from("card_images").delete().in("id", imageIds);
}

async function deactivateNewCard(cardId: string) {
  await supabase.from("cards").update({ is_active: false }).eq("id", cardId);
}

async function countExistingImages(cardId: string) {
  const { data, error } = await supabase
    .from("card_images")
    .select("id")
    .eq("card_id", cardId)
    .returns<Array<{ id: string }>>();
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

async function resolveCardAtExecutionTime(input: {
  group: ExcelZipCardGroup;
  firstRow: NormalizedExcelZipCardRow;
}) {
  if (input.group.matchedCard) {
    return input.group.matchedCard;
  }

  const { data, error } = await supabase
    .from("cards")
    .select("*")
    .eq("name", input.group.name)
    .returns<CardRecord[]>();
  if (error) throw new Error(error.message);

  const sameNameCards = data ?? [];
  if (sameNameCards.length === 0) return null;

  const exactMatches = sameNameCards.filter((card) =>
    isSameExcelZipCardRecord(card, input.firstRow)
  );
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    throw new Error(
      `登録直前の確認で、同じ内容の既存カードが複数見つかりました: ${input.group.name}`
    );
  }

  throw new Error(
    `登録直前の確認で、同名の既存カードが見つかりましたが内容が一致しません: ${input.group.name}`
  );
}

export async function executeExcelZipCardImport(
  preview: ExcelZipImportPreview
): Promise<{ result: ExcelZipImportResult | null; error: string | null }> {
  const errors = preview.issues.filter((item) => item.level === "error");
  if (errors.length > 0) {
    return {
      result: null,
      error: "エラーが残っているため登録できません。preview内容を確認してください。"
    };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { result: null, error: "ログインが必要です。" };
  }

  const result: ExcelZipImportResult = {
    newCardCount: 0,
    reusedCardCount: 0,
    imageAddedCount: 0,
    abilityLinkedCount: 0,
    skippedImageCount: 0,
    uploadedPaths: [],
    groupResults: []
  };

  const imagesByName = getImageByName(preview);
  const abilities = await loadAbilities();
  const groups = preview.cardGroups.filter((group) => group.status !== "error");

  for (const group of groups) {
    const firstRow = getFirstRow(group);
    let uploadedPathsForGroup: string[] = [];
    let insertedImagesForGroup: CardImageRecord[] = [];
    let createdNewCard = false;
    let cardIdForCleanup: string | null = null;

    try {
      let card: CardRecord | null = await resolveCardAtExecutionTime({ group, firstRow });
      const ability = resolveAbilityAtExecutionTime({ abilities, row: firstRow });
      const cardId = card?.id ?? crypto.randomUUID();
      cardIdForCleanup = cardId;
      const existingImageCount = card ? await countExistingImages(cardId) : 0;
      const uploadResult = await uploadImagesForCard({
        userId: userData.user.id,
        cardId,
        group,
        imagesByName,
        hasExistingImages: existingImageCount > 0
      });
      uploadedPathsForGroup = uploadResult.uploadedPaths;

      if (!card) {
        const { data, error } = await supabase
          .from("cards")
          .insert(createCardInsertPayload(cardId, firstRow))
          .select("*")
          .single<CardRecord>();
        if (error) throw new Error(error.message);
        card = data;
        createdNewCard = true;
        result.newCardCount += 1;
      } else {
        result.reusedCardCount += 1;
      }

      const insertedImages = await insertImageRows(uploadResult.imageRows);
      insertedImagesForGroup = insertedImages;
      result.imageAddedCount += insertedImages.length;
      result.uploadedPaths.push(...uploadResult.uploadedPaths);
      result.skippedImageCount += uploadResult.skippedImageCount;

      const abilityLinked = await ensureAbilityLink({ cardId: card.id, ability });
      if (abilityLinked) {
        result.abilityLinkedCount += 1;
      }

      result.groupResults.push({
        cardId: card.id,
        cardName: group.name,
        cardCreated: createdNewCard,
        reusedExistingCard: !createdNewCard,
        imageAddedCount: insertedImages.length,
        skippedImageCount: uploadResult.skippedImageCount,
        abilityLinked,
        imageFiles: group.imageFiles,
        skippedImageFiles: uploadResult.skippedImageFiles
      });
    } catch (error) {
      await removeImageRows(insertedImagesForGroup.map((image) => image.id));
      if (uploadedPathsForGroup.length > 0) {
        await supabase.storage.from(BUCKET_NAME).remove(uploadedPathsForGroup);
      }
      if (createdNewCard && cardIdForCleanup) {
        await deactivateNewCard(cardIdForCleanup);
      }
      return {
        result: null,
        error:
          error instanceof Error
            ? `${group.name} の登録中に失敗しました。${error.message}`
            : "登録処理中に不明なエラーが発生しました。"
      };
    }
  }

  return { result, error: null };
}
