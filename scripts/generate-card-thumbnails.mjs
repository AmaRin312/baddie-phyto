#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "card-images";
const SCALE = 0.75;
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const all = args.has("--all") || args.has("--count-only");
const countOnly = args.has("--count-only");
const argValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};
const limit = all ? Number.POSITIVE_INFINITY : Number(argValue("--limit", "10"));

async function loadEnvFile(filePath) {
  if (!filePath) return;
  const content = await readFile(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  await loadEnvFile(argValue("--env", ".env.local"));
  if (!all && (!Number.isInteger(limit) || limit < 1)) throw new Error("--limit は1以上の整数にしてください。");
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase URLとSUPABASE_SERVICE_ROLE_KEYが必要です。");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const targets = [];
  for (let offset = 0; targets.length < limit; offset += 1000) {
    const { data: rows, error } = await supabase
      .from("card_images")
      .select("id,owner_id,card_id,image_path,thumbnail_path")
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error(`画像一覧を取得できません: ${error.message}`);
    const candidates = (rows ?? []).filter(row => !row.thumbnail_path || row.thumbnail_path === row.image_path);
    targets.push(...candidates.slice(0, limit - targets.length));
    if (!rows || rows.length < 1000) break;
  }

  if (countOnly) {
    console.log(JSON.stringify({ mode: "count-only", candidates: targets.length }, null, 2));
    return;
  }

  let sourceBytes = 0;
  let thumbnailBytes = 0;
  let completed = 0;
  for (const row of targets) {
    const { data: source, error: downloadError } = await supabase.storage.from(BUCKET).download(row.image_path);
    if (downloadError || !source) throw new Error(`画像取得失敗 ${row.id}: ${downloadError?.message ?? "empty response"}`);
    const input = Buffer.from(await source.arrayBuffer());
    const metadata = await sharp(input, { limitInputPixels: 100_000_000 }).metadata();
    if (!metadata.width || !metadata.height) throw new Error(`画像サイズを読み取れません: ${row.id}`);
    const output = await sharp(input, { limitInputPixels: 100_000_000 })
      .resize({ width: Math.max(1, Math.round(metadata.width * SCALE)), height: Math.max(1, Math.round(metadata.height * SCALE)), fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    sourceBytes += input.byteLength;
    thumbnailBytes += output.byteLength;

    const thumbnailPath = `${row.owner_id}/${row.card_id}/thumbnails/${row.id}.webp`;
    if (apply) {
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(thumbnailPath, output, {
        contentType: "image/webp",
        upsert: true
      });
      if (uploadError) throw new Error(`サムネイル保存失敗 ${row.id}: ${uploadError.message}`);
      const { error: updateError } = await supabase.from("card_images").update({ thumbnail_path: thumbnailPath }).eq("id", row.id);
      if (updateError) {
        await supabase.storage.from(BUCKET).remove([thumbnailPath]);
        throw new Error(`サムネイル情報更新失敗 ${row.id}: ${updateError.message}`);
      }
    }
    completed += 1;
    console.log(`${apply ? "保存" : "試算"}: ${row.id} ${metadata.width}x${metadata.height} -> ${Math.round(metadata.width * SCALE)}x${Math.round(metadata.height * SCALE)} (${input.byteLength} -> ${output.byteLength} bytes)`);
  }
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", candidates: targets.length, processed: completed, sourceBytes, thumbnailBytes, estimatedAddedBytes: apply ? thumbnailBytes : 0, estimatedTransferReductionBytes: sourceBytes - thumbnailBytes }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
