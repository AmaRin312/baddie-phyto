import { supabase } from "@/lib/supabase/client";
import type {
  BattleSupplyRecord,
  BattleSupplySettingsRecord,
  BattleSupplyType
} from "@/types/baddiePhyto";

const SUPPLY_BUCKET_NAME = "battle-supplies";
const SUPPLY_CACHE_TTL_MS = 300_000;
type CachedBattleSuppliesResponse = {
  data: BattleSupplyRecord[] | null;
  error: { message: string } | null;
};
const battleSuppliesCache = new Map<
  string,
  { expiresAt: number; value: CachedBattleSuppliesResponse }
>();
const battleSuppliesInFlight = new Map<
  string,
  Promise<CachedBattleSuppliesResponse>
>();

function getExtension(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function getPublicSupplyImageUrl(path?: string | null) {
  if (!path) return null;
  return supabase.storage.from(SUPPLY_BUCKET_NAME).getPublicUrl(path).data.publicUrl;
}

export async function loadBattleSupplies(type?: BattleSupplyType) {
  const cacheKey = `supplies:${type ?? "all"}`;
  const cached = battleSuppliesCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const inFlight = battleSuppliesInFlight.get(cacheKey);
  if (inFlight) return inFlight;

  let query = supabase
    .from("battle_supplies")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (type) query = query.eq("supply_type", type);

  const request: Promise<CachedBattleSuppliesResponse> = (async () => {
    try {
      const result = await query.returns<BattleSupplyRecord[]>();
      if (!result.error) {
        battleSuppliesCache.set(cacheKey, {
          expiresAt: Date.now() + SUPPLY_CACHE_TTL_MS,
          value: result
        });
      }
      return result;
    } finally {
      battleSuppliesInFlight.delete(cacheKey);
    }
  })();

  battleSuppliesInFlight.set(cacheKey, request);
  return request;
}

export async function uploadBattleSupply(input: {
  ownerId: string;
  type: BattleSupplyType;
  name: string;
  file: File;
}) {
  const imagePath = `${input.ownerId}/${input.type}/${crypto.randomUUID()}.${getExtension(
    input.file
  )}`;
  const uploadResult = await supabase.storage
    .from(SUPPLY_BUCKET_NAME)
    .upload(imagePath, input.file, { upsert: false });

  if (uploadResult.error) return { data: null, error: uploadResult.error };

  const insertResult = await supabase
    .from("battle_supplies")
    .insert({
      owner_id: input.ownerId,
      supply_type: input.type,
      name: input.name.trim() || (input.type === "sleeve" ? "スリーブ" : "プレイマット"),
      image_path: imagePath,
      is_active: true
    })
    .select("*")
    .single<BattleSupplyRecord>();

  if (insertResult.error) {
    await supabase.storage.from(SUPPLY_BUCKET_NAME).remove([imagePath]);
  }

  if (!insertResult.error) {
    battleSuppliesCache.clear();
  }

  return insertResult;
}

export async function deleteBattleSupply(supply: Pick<BattleSupplyRecord, "id" | "image_path">) {
  const updateResult = await supabase
    .from("battle_supplies")
    .update({ is_active: false })
    .eq("id", supply.id);

  if (updateResult.error) return updateResult;

  const result = await supabase.storage.from(SUPPLY_BUCKET_NAME).remove([supply.image_path]);
  if (!updateResult.error) {
    battleSuppliesCache.clear();
  }
  return result;
}

export async function loadBattleSupplySettings(userId: string) {
  return await supabase
    .from("battle_supply_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle<BattleSupplySettingsRecord>();
}

export async function saveBattleSupplySettings(input: {
  userId: string;
  sleeveSupplyId: string | null;
  playmatSupplyId: string | null;
}) {
  return await supabase
    .from("battle_supply_settings")
    .upsert({
      user_id: input.userId,
      sleeve_supply_id: input.sleeveSupplyId,
      playmat_supply_id: input.playmatSupplyId
    })
    .select("*")
    .single<BattleSupplySettingsRecord>();
}
