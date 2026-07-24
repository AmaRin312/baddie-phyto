#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://fc-buddyfight.com";
const BUCKET_NAME = "card-images";
const MAX_IMAGES_PER_CARD = 8;
const MAX_CARDS_PER_PACK = 500;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const USER_AGENT = "BaddiePhytoCodexOfficialImporter/1.0 (+local user initiated import)";

const CARD_TYPE_VALUES = new Set([
  "monster",
  "spell",
  "item",
  "impact",
  "impact_monster",
  "flag_card",
  "other"
]);

function printHelp() {
  console.log(`Baddie Phyto official Buddyfight card importer

Usage:
  npm run import:official-bf -- --pack <official-pack-url>
  npm run import:official-bf -- --file <pack-url-list.txt>
  npm run import:official-bf -- --file <pack-url-list.txt> --apply

Options:
  --pack <url>        Official pack search URL. Can be repeated.
  --file <path>       Text file with one official pack URL per line.
  --apply             Write cards/images/printings to Supabase.
                      Without this option, the script only previews.
  --limit-cards <n>   Limit imported cards per run.
  --output <path>     Save JSON report.
  --help              Show this help.

Environment:
  Dry-run:
    Supabase environment is optional.

  Apply:
    NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY
    BADDIE_PHYTO_IMPORT_OWNER_ID

Notes:
  - Card No. and rarity are intentionally not registered.
  - Images are uploaded to card-images/<ownerId>/<cardId>/<hash>.<ext>.
  - Default mode is dry-run. Use --apply only after preview looks correct.
`);
}

function parseArgs(argv) {
  const args = {
    packUrls: [],
    files: [],
    apply: false,
    limitCards: null,
    output: null,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--pack" && next) {
      args.packUrls.push(next);
      index += 1;
    } else if (arg?.startsWith("--pack=")) {
      args.packUrls.push(arg.slice("--pack=".length));
    } else if (arg === "--file" && next) {
      args.files.push(next);
      index += 1;
    } else if (arg?.startsWith("--file=")) {
      args.files.push(arg.slice("--file=".length));
    } else if (arg === "--limit-cards" && next) {
      args.limitCards = Number.parseInt(next, 10);
      index += 1;
    } else if (arg?.startsWith("--limit-cards=")) {
      args.limitCards = Number.parseInt(arg.slice("--limit-cards=".length), 10);
    } else if (arg === "--output" && next) {
      args.output = next;
      index += 1;
    } else if (arg?.startsWith("--output=")) {
      args.output = arg.slice("--output=".length);
    } else if (arg) {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limitCards !== null && (!Number.isFinite(args.limitCards) || args.limitCards <= 0)) {
    throw new Error("--limit-cards must be a positive number.");
  }

  return args;
}

async function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await readFile(envPath, "utf8");
  } catch {
    return;
  }

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, decimal) => String.fromCodePoint(Number.parseInt(decimal, 10)));
}

function normalizeText(value) {
  return decodeHtml(String(value ?? ""))
    .normalize("NFC")
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function htmlToLines(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|table|section|article|dt|dd)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(Boolean);
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return await response.text();
}

function normalizePackUrl(input) {
  const trimmed = normalizeText(input);
  if (!trimmed) return null;

  const url = new URL(trimmed, BASE_URL);
  if (url.hostname !== "fc-buddyfight.com") return null;
  if (!url.pathname.startsWith("/cardlist/cardsearch/")) return null;

  const expansionId = url.searchParams.get("expansion");
  if (!expansionId) return null;

  url.searchParams.set("sort", "no");
  url.searchParams.set("view", "image");
  url.searchParams.set("cnt", "100");
  return url;
}

function inferEraKeyFromCode(value) {
  const upper = normalizeText(value).toUpperCase();
  if (upper.startsWith("H")) return "hundred";
  if (upper.startsWith("D")) return "ddd";
  if (upper.startsWith("X")) return "x";
  if (upper.startsWith("S")) return "god";
  return "first";
}

function extractPackName(html) {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (titleMatch?.[1]) {
    const title = normalizeText(titleMatch[1].replace(/<[^>]+>/g, ""))
      .replace(/\s*カードリスト\s*[｜|].*$/, "")
      .replace(/\s*[｜|]\s*フューチャーカード.*$/, "");
    if (title && title !== "カードリスト") return title;
  }

  const headingMatch = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(html);
  if (headingMatch?.[1]) {
    const heading = normalizeText(headingMatch[1].replace(/<[^>]+>/g, ""));
    if (heading && heading !== "カードリスト") return heading;
  }

  const lines = htmlToLines(html);
  return (
    lines.find(
      (line) =>
        line.includes("ブースター") ||
        line.includes("トライアル") ||
        line.includes("スペシャル") ||
        line.includes("カードセット") ||
        line.includes("PRカード")
    ) ?? "公式カードリスト"
  );
}

function extractDetailUrls(html, listUrl) {
  const detailUrls = [];
  const regex = /href=["'](\/cardlist\/(?:detail\/)?\d+\/?(?:\?[^"']*)?)["']/gi;
  let match = regex.exec(html);

  while (match) {
    const href = match[1];
    if (href) {
      const url = new URL(href, listUrl).toString();
      if (!detailUrls.includes(url)) detailUrls.push(url);
    }
    match = regex.exec(html);
  }

  return detailUrls;
}

function extractTotalPages(html) {
  const lines = htmlToLines(html).join(" ");
  const match = /(\d+)件中\s*(\d+)～(\d+)件を表示/.exec(lines);
  if (!match?.[1] || !match[3]) return 1;

  const total = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[3], 10);
  if (!Number.isFinite(total) || !Number.isFinite(end) || end <= 0) return 1;
  return Math.max(1, Math.ceil(total / end));
}

function parseCardType(value) {
  if (value.includes("必殺モンスター")) return "impact_monster";
  if (value.includes("モンスター")) return "monster";
  if (value.includes("魔法")) return "spell";
  if (value.includes("アイテム")) return "item";
  if (value.includes("必殺技")) return "impact";
  if (value.includes("フラッグ")) return "flag_card";
  return "other";
}

function splitList(value) {
  return normalizeText(value)
    .split(/[、,／/|｜]/)
    .map(normalizeText)
    .filter(Boolean)
    .filter((item) => item !== "-");
}

function parseNullableInteger(value) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === "-") return null;
  const match = /\d+/.exec(normalized);
  return match ? Number.parseInt(match[0], 10) : null;
}

function getNextValue(lines, label) {
  const index = lines.findIndex((line) => line === label || line.startsWith(`${label} `));
  if (index < 0) return "";
  const sameLineValue = lines[index]?.replace(label, "").trim();
  if (sameLineValue) return sameLineValue;
  return lines[index + 1] ?? "";
}

function extractCardName(lines) {
  const candidate =
    lines.find((line) => line.includes("カード情報")) ??
    lines.find((line) => line.includes("（") && !line.includes("カードリスト")) ??
    "";
  return normalizeText(
    candidate
      .replace("カード情報｜カードリスト ｜ フューチャーカード バディファイト公式サイト", "")
      .replace(/（[^）]*）.*$/, "")
      .replace(/Image:.+$/, "")
  );
}

function extractCardCodeFromDetail(lines) {
  const cardCodeLine = lines.find((line) => /^[A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+/.test(line));
  return cardCodeLine?.match(/^([A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+)/)?.[1] ?? null;
}

function extractStats(lines) {
  const headerIndex = lines.findIndex(
    (line) => line.includes("攻撃力") && line.includes("打撃力") && line.includes("防御力")
  );
  const valueLine = headerIndex >= 0 ? lines[headerIndex + 1] ?? "" : "";
  const values = valueLine.split(/\s*\|\s*|\s+/).filter(Boolean);

  return {
    power: parseNullableInteger(values[0] ?? ""),
    critical: parseNullableInteger(values[1] ?? ""),
    defense: parseNullableInteger(values[2] ?? "")
  };
}

function extractCardText(lines) {
  const statsIndex = lines.findIndex(
    (line) => line.includes("攻撃力") && line.includes("打撃力") && line.includes("防御力")
  );
  const startIndex = statsIndex >= 0 ? statsIndex + 2 : 0;
  const stopIndex = lines.findIndex(
    (line, index) =>
      index > startIndex &&
      (line.includes("前のカード") ||
        line.includes("次のカード") ||
        line.includes("収録カード商品") ||
        line.includes("Q&A"))
  );
  const textLines = lines
    .slice(startIndex, stopIndex >= 0 ? stopIndex : undefined)
    .filter(
      (line) =>
        !line.startsWith("イラストレーター") &&
        !line.includes("ワールド") &&
        !line.includes("カード種別") &&
        !line.includes("サイズ") &&
        !line.includes("属性")
    );

  return textLines.length > 0 ? textLines.join("\n") : null;
}

function extractImageUrls(html, detailUrl, cardName) {
  const urls = [];
  const regex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match = regex.exec(html);

  while (match) {
    const tag = match[0] ?? "";
    const rawSrc = decodeHtml(match[1] ?? "").trim();
    if (!rawSrc) {
      match = regex.exec(html);
      continue;
    }

    const normalizedTag = normalizeText(tag.replace(/<[^>]+>/g, " "));
    const absoluteUrl = new URL(rawSrc, detailUrl).toString();
    const lower = absoluteUrl.toLowerCase();

    if (
      lower.endsWith(".svg") ||
      lower.includes("logo") ||
      lower.includes("bnr") ||
      lower.includes("banner") ||
      lower.includes("icon")
    ) {
      match = regex.exec(html);
      continue;
    }

    if (!normalizedTag.includes(cardName) && !lower.includes("card") && !lower.includes("buddyfight")) {
      match = regex.exec(html);
      continue;
    }

    if (!urls.includes(absoluteUrl)) urls.push(absoluteUrl);
    match = regex.exec(html);
  }

  return urls.slice(0, MAX_IMAGES_PER_CARD);
}

function sanitizeFilePart(value) {
  return normalizeText(value)
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function getExtensionFromContentType(contentType) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function fetchImage(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`Unsupported image type: ${contentType || "unknown"}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    bytes,
    contentType,
    extension: getExtensionFromContentType(contentType),
    size: bytes.byteLength
  };
}

async function fetchPackInfo(packUrl) {
  const html = await fetchHtml(packUrl.toString());
  const expansionId = packUrl.searchParams.get("expansion") ?? "unknown";
  const setName = extractPackName(html);
  return {
    url: packUrl.toString(),
    expansionId,
    setCode: `official-expansion-${expansionId}`,
    setName
  };
}

async function collectDetailUrls(packUrl) {
  const firstHtml = await fetchHtml(packUrl.toString());
  const totalPages = Math.min(extractTotalPages(firstHtml), 100);
  const urls = new Set(extractDetailUrls(firstHtml, packUrl.toString()));

  for (let page = 2; page <= totalPages && urls.size < MAX_CARDS_PER_PACK; page += 1) {
    const nextUrl = new URL(packUrl);
    nextUrl.searchParams.set("page", String(page));
    const html = await fetchHtml(nextUrl.toString());
    for (const detailUrl of extractDetailUrls(html, nextUrl.toString())) {
      urls.add(detailUrl);
      if (urls.size >= MAX_CARDS_PER_PACK) break;
    }
  }

  return Array.from(urls).slice(0, MAX_CARDS_PER_PACK);
}

async function fetchOfficialCard(detailUrl, pack) {
  const html = await fetchHtml(detailUrl);
  const lines = htmlToLines(html);
  const name = extractCardName(lines);
  if (!name) throw new Error("カード名を解析できませんでした。");

  const cardCodeForEra = extractCardCodeFromDetail(lines);
  const worlds = splitList(getNextValue(lines, "ワールド"));
  const cardTypeText = getNextValue(lines, "カード種別");
  const races = splitList(getNextValue(lines, "属性"));
  const stats = extractStats(lines);
  const cardType = parseCardType(cardTypeText);

  return {
    sourceUrl: detailUrl,
    cardKey: detailUrl,
    cardNumber: null,
    name,
    card_type: CARD_TYPE_VALUES.has(cardType) ? cardType : "other",
    orientation: "vertical",
    worlds,
    races,
    size: parseNullableInteger(getNextValue(lines, "サイズ")),
    power: stats.power,
    defense: stats.defense,
    critical: stats.critical,
    card_text: extractCardText(lines),
    set_code: pack.setCode,
    set_name: pack.setName,
    era_key: inferEraKeyFromCode(cardCodeForEra),
    rarity: null,
    is_dragon: races.some((race) => race.includes("ドラゴン")),
    is_hyakki: races.some((race) => race.includes("百鬼")),
    is_corner_king: races.some((race) => race.includes("角王")),
    is_chaos: races.some((race) => race.includes("カオス")) || name.includes("the Chaos"),
    is_generic: worlds.some((world) => world.includes("ジェネリック")),
    is_heaven: races.some((race) => race.includes("天国")) || name.includes("楽園天国"),
    is_hell: races.some((race) => race.includes("地獄")) || name.includes("灼熱地獄"),
    is_original: false,
    is_active: true,
    imageUrls: extractImageUrls(html, detailUrl, name)
  };
}

function sortUnique(values) {
  return Array.from(new Set((values ?? []).map(normalizeText).filter(Boolean))).sort();
}

function sameNullableNumber(left, right) {
  return (left ?? null) === (right ?? null);
}

function isSameCardRecord(card, row) {
  return (
    card.name === row.name &&
    card.card_type === row.card_type &&
    JSON.stringify(sortUnique(card.worlds)) === JSON.stringify(sortUnique(row.worlds)) &&
    JSON.stringify(sortUnique(card.races)) === JSON.stringify(sortUnique(row.races)) &&
    card.orientation === row.orientation &&
    sameNullableNumber(card.size, row.size) &&
    sameNullableNumber(card.power, row.power) &&
    sameNullableNumber(card.defense, row.defense) &&
    sameNullableNumber(card.critical, row.critical) &&
    (card.card_text ?? null) === (row.card_text ?? null) &&
    Boolean(card.is_dragon) === row.is_dragon &&
    Boolean(card.is_hyakki) === row.is_hyakki &&
    Boolean(card.is_corner_king) === row.is_corner_king &&
    Boolean(card.is_chaos) === row.is_chaos &&
    Boolean(card.is_generic) === row.is_generic &&
    Boolean(card.is_heaven) === row.is_heaven &&
    Boolean(card.is_hell) === row.is_hell &&
    Boolean(card.is_original) === row.is_original &&
    Boolean(card.is_active) === row.is_active
  );
}

function createCardPayload(id, row) {
  return {
    id,
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
    is_original: row.is_original,
    is_active: row.is_active
  };
}

async function findOrCreateCard(supabase, row, dryRun) {
  if (!supabase) {
    const cardId = randomUUID();
    return { card: { ...createCardPayload(cardId, row), id: cardId }, created: false, wouldCreate: true };
  }

  const { data, error } = await supabase.from("cards").select("*").eq("name", row.name);
  if (error) throw new Error(error.message);

  const sameNameCards = data ?? [];
  const exactMatches = sameNameCards.filter((card) => isSameCardRecord(card, row));
  if (exactMatches.length === 1) {
    return { card: exactMatches[0], created: false, wouldCreate: false };
  }
  if (exactMatches.length > 1) {
    throw new Error(`同じ内容の既存カードが複数見つかりました: ${row.name}`);
  }
  if (sameNameCards.length > 0) {
    throw new Error(`同名カードがありますが内容が一致しません。確認してください: ${row.name}`);
  }

  const cardId = randomUUID();
  if (dryRun) {
    return { card: { ...createCardPayload(cardId, row), id: cardId }, created: false, wouldCreate: true };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("cards")
    .insert(createCardPayload(cardId, row))
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);
  return { card: inserted, created: true, wouldCreate: false };
}

async function ensureCardSet(supabase, row, dryRun) {
  const { data: existingSet, error: existingError } = await supabase
    .from("card_sets")
    .select("id,set_code,name,era_key")
    .eq("set_code", row.set_code)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);

  if (dryRun) {
    return {
      set: existingSet ?? {
        id: `dry-run-set-${row.set_code}`,
        set_code: row.set_code,
        name: row.set_name,
        era_key: row.era_key
      },
      created: !existingSet
    };
  }

  if (existingSet) {
    const updates = {};
    if (!existingSet.name && row.set_name) updates.name = row.set_name;
    if (row.era_key && existingSet.era_key !== row.era_key) updates.era_key = row.era_key;
    if (Object.keys(updates).length === 0) return { set: existingSet, created: false };

    const { data: updatedSet, error: updateError } = await supabase
      .from("card_sets")
      .update(updates)
      .eq("id", existingSet.id)
      .select("id,set_code,name,era_key")
      .single();
    if (updateError) throw new Error(updateError.message);
    return { set: updatedSet, created: false };
  }

  const { data: insertedSet, error: insertError } = await supabase
    .from("card_sets")
    .insert({ set_code: row.set_code, name: row.set_name ?? row.set_code })
    .select("id,set_code,name,era_key")
    .single();
  if (insertError) throw new Error(insertError.message);

  if (!row.era_key || insertedSet.era_key === row.era_key) {
    return { set: insertedSet, created: true };
  }

  const { data: updatedSet, error: updateError } = await supabase
    .from("card_sets")
    .update({ era_key: row.era_key })
    .eq("id", insertedSet.id)
    .select("id,set_code,name,era_key")
    .single();
  if (updateError) throw new Error(updateError.message);
  return { set: updatedSet, created: true };
}

async function ensurePrinting(supabase, row, cardId, dryRun) {
  if (!supabase) {
    return { added: true, setCreated: true };
  }

  const { set, created: setCreated } = await ensureCardSet(supabase, row, dryRun);
  if (dryRun && String(set.id).startsWith("dry-run-set-")) {
    return { added: true, setCreated };
  }

  const { data: existingPrinting, error: existingError } = await supabase
    .from("card_printings")
    .select("id")
    .eq("card_id", cardId)
    .eq("set_id", set.id)
    .is("card_number", null)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existingPrinting) return { added: false, setCreated };

  if (dryRun) return { added: true, setCreated };

  const { error: insertError } = await supabase.from("card_printings").insert({
    card_id: cardId,
    set_id: set.id,
    card_number: null,
    rarity: null
  });
  if (insertError) throw new Error(insertError.message);

  return { added: true, setCreated };
}

async function countExistingImages(supabase, cardId) {
  const { data, error } = await supabase.from("card_images").select("id").eq("card_id", cardId);
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}

async function imagePathExists(supabase, cardId, imagePath) {
  const { data, error } = await supabase
    .from("card_images")
    .select("id")
    .eq("card_id", cardId)
    .eq("image_path", imagePath)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

async function uploadImagesForCard(supabase, row, cardId, ownerId, dryRun) {
  let added = 0;
  let skipped = 0;
  const issues = [];
  let hasExistingImages = dryRun || !supabase ? false : (await countExistingImages(supabase, cardId)) > 0;

  for (const [index, imageUrl] of row.imageUrls.entries()) {
    try {
      const image = await fetchImage(imageUrl);
      const hash = createHash("sha256").update(image.bytes).digest("hex");
      const fileName = `${sanitizeFilePart(row.name)}_${index + 1}_${hash.slice(0, 16)}.${image.extension}`;
      const storagePath = `${ownerId}/${cardId}/${fileName}`;

      if (!dryRun && supabase && (await imagePathExists(supabase, cardId, storagePath))) {
        skipped += 1;
        continue;
      }

      if (dryRun) {
        added += 1;
        hasExistingImages = true;
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, image.bytes, {
          upsert: false,
          contentType: image.contentType
        });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from("card_images").insert({
        card_id: cardId,
        owner_id: ownerId,
        image_path: storagePath,
        thumbnail_path: storagePath,
        is_default: !hasExistingImages && index === 0
      });
      if (insertError) {
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw new Error(insertError.message);
      }

      added += 1;
      hasExistingImages = true;
    } catch (error) {
      issues.push({
        cardName: row.name,
        imageUrl,
        message: error instanceof Error ? error.message : "画像登録に失敗しました。"
      });
    }
  }

  return { added, skipped, issues };
}

async function readPackUrls(args) {
  const urls = [...args.packUrls];
  for (const file of args.files) {
    const content = await readFile(path.resolve(file), "utf8");
    urls.push(
      ...content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
    );
  }
  return Array.from(new Set(urls));
}

function createSupabaseClient(input) {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ownerId = process.env.BADDIE_PHYTO_IMPORT_OWNER_ID;

  if (!supabaseUrl || !serviceKey || !ownerId) {
    if (!input.apply) {
      console.log("Supabase設定が未設定のため、DB比較なしのdry-runとして実行します。");
      return { ownerId: "dry-run-owner", supabase: null };
    }

    if (!supabaseUrl) throw new Error("SUPABASE_URL または NEXT_PUBLIC_SUPABASE_URL が必要です。");
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY が必要です。");
    throw new Error("BADDIE_PHYTO_IMPORT_OWNER_ID が必要です。");
  }

  return {
    ownerId,
    supabase: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  };
}

async function fetchCardsFromPacks(packUrls, limitCards) {
  const cards = [];
  const issues = [];
  const normalizedPackUrls = [];

  for (const rawUrl of packUrls) {
    const packUrl = normalizePackUrl(rawUrl);
    if (!packUrl) {
      issues.push({ input: rawUrl, message: "公式カードリストのパックURLではありません。" });
      continue;
    }
    normalizedPackUrls.push(packUrl);
  }

  for (const packUrl of normalizedPackUrls) {
    if (limitCards && cards.length >= limitCards) break;
    try {
      const pack = await fetchPackInfo(packUrl);
      console.log(`Pack: ${pack.setName} (${pack.setCode})`);
      const detailUrls = await collectDetailUrls(packUrl);
      console.log(`  Detail URLs: ${detailUrls.length}`);

      for (const detailUrl of detailUrls) {
        if (limitCards && cards.length >= limitCards) break;
        try {
          const card = await fetchOfficialCard(detailUrl, pack);
          cards.push(card);
          console.log(`  - ${card.name} / images:${card.imageUrls.length}`);
        } catch (error) {
          issues.push({
            input: detailUrl,
            message: error instanceof Error ? error.message : "カード解析に失敗しました。"
          });
        }
      }
    } catch (error) {
      issues.push({
        input: packUrl.toString(),
        message: error instanceof Error ? error.message : "パック解析に失敗しました。"
      });
    }
  }

  return { cards, issues };
}

async function importCards(input) {
  const report = {
    mode: input.dryRun ? "dry-run" : "apply",
    fetchedCardCount: input.cards.length,
    newCardCount: 0,
    reusedCardCount: 0,
    cardSetAddedCount: 0,
    printingAddedCount: 0,
    imageAddedCount: 0,
    imageSkippedCount: 0,
    issueCount: input.initialIssues.length,
    issues: [...input.initialIssues],
    cards: []
  };

  for (const row of input.cards) {
    try {
      const cardResult = await findOrCreateCard(input.supabase, row, input.dryRun);
      const printingResult = await ensurePrinting(input.supabase, row, cardResult.card.id, input.dryRun);
      const imageResult = await uploadImagesForCard(
        input.supabase,
        row,
        cardResult.card.id,
        input.ownerId,
        input.dryRun
      );

      if (cardResult.created || cardResult.wouldCreate) report.newCardCount += 1;
      else report.reusedCardCount += 1;
      if (printingResult.setCreated) report.cardSetAddedCount += 1;
      if (printingResult.added) report.printingAddedCount += 1;
      report.imageAddedCount += imageResult.added;
      report.imageSkippedCount += imageResult.skipped;

      for (const issue of imageResult.issues) {
        report.issues.push(issue);
      }

      report.cards.push({
        name: row.name,
        sourceUrl: row.sourceUrl,
        cardId: cardResult.card.id,
        cardCreated: cardResult.created,
        wouldCreateCard: cardResult.wouldCreate,
        printingAdded: printingResult.added,
        imageAddedCount: imageResult.added,
        imageSkippedCount: imageResult.skipped
      });
    } catch (error) {
      report.issues.push({
        cardName: row.name,
        sourceUrl: row.sourceUrl,
        message: error instanceof Error ? error.message : "登録処理に失敗しました。"
      });
    }
  }

  report.issueCount = report.issues.length;
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  await loadDotEnvLocal();
  const packUrls = await readPackUrls(args);
  if (packUrls.length === 0) {
    throw new Error("--pack または --file で公式パックURLを指定してください。");
  }

  const { supabase, ownerId } = createSupabaseClient({ apply: args.apply });
  const dryRun = !args.apply;
  console.log(dryRun ? "Mode: dry-run (Supabaseへ書き込みません)" : "Mode: apply (Supabaseへ登録します)");

  const fetched = await fetchCardsFromPacks(packUrls, args.limitCards);
  const report = await importCards({
    supabase,
    ownerId,
    dryRun,
    cards: fetched.cards,
    initialIssues: fetched.issues
  });

  console.log("");
  console.log("Summary");
  console.log(`  fetched cards: ${report.fetchedCardCount}`);
  console.log(`  new cards: ${report.newCardCount}`);
  console.log(`  reused cards: ${report.reusedCardCount}`);
  console.log(`  card sets added: ${report.cardSetAddedCount}`);
  console.log(`  printings added: ${report.printingAddedCount}`);
  console.log(`  images added: ${report.imageAddedCount}`);
  console.log(`  images skipped: ${report.imageSkippedCount}`);
  console.log(`  issues: ${report.issueCount}`);

  if (args.output) {
    await writeFile(path.resolve(args.output), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`Report saved: ${args.output}`);
  }

  if (report.issueCount > 0) {
    console.log("");
    console.log("Issues");
    for (const issue of report.issues.slice(0, 20)) {
      console.log(`  - ${issue.cardName ?? issue.input ?? issue.sourceUrl ?? "unknown"}: ${issue.message}`);
    }
    if (report.issues.length > 20) {
      console.log(`  ... and ${report.issues.length - 20} more`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
