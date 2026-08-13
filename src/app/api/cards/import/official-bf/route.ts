import { NextResponse } from "next/server";
import type { CardType } from "@/types/baddiePhyto";
import type { ExcelZipEraKey } from "@/lib/cards/excelZipImport/excelZipImportTypes";
import type {
  TcgDbBfFetchedCard,
  TcgDbBfFetchedImage,
  TcgDbBfFetchIssue,
  TcgDbBfFetchResponse
} from "@/lib/cards/tcgDbBfImport/tcgDbBfTypes";

export const runtime = "nodejs";

const BASE_URL = "https://fc-buddyfight.com";
const MAX_PACKS = 5;
const MAX_CARDS_PER_PACK = 250;
const MAX_IMAGES_PER_CARD = 6;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type RequestBody = {
  packUrls?: string[];
};

type OfficialPackInfo = {
  url: string;
  expansionId: string;
  setCode: string;
  setName: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    );
}

function normalizeText(value: string) {
  return decodeHtml(value)
    .normalize("NFC")
    .replace(/\u3000/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function htmlToLines(html: string) {
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

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BaddiePhytoOfficialImporter/1.0 (+local user initiated import)"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`公式カードリスト取得に失敗しました。HTTP ${response.status}`);
  }
  return await response.text();
}

function normalizePackUrl(input: string) {
  const trimmed = input.trim();
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

function inferEraKeyFromCode(value: string | null): ExcelZipEraKey {
  const upper = normalizeText(value ?? "").toUpperCase();
  if (upper.startsWith("H")) return "hundred";
  if (upper.startsWith("D")) return "ddd";
  if (upper.startsWith("X")) return "x";
  if (upper.startsWith("S")) return "god";
  return "first";
}

function extractPackName(html: string) {
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

function extractDetailUrls(html: string, listUrl: string) {
  const detailUrls: string[] = [];
  const regex = /href=["'](\/cardlist\/(?:detail\/)?\d+\/?)["']/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const href = match[1];
    if (!href) continue;
    const url = new URL(href, listUrl).toString();
    if (!detailUrls.includes(url)) detailUrls.push(url);
  }

  return detailUrls;
}

function extractTotalPages(html: string) {
  const lines = htmlToLines(html).join(" ");
  const match = /(\d+)件中\s*(\d+)～(\d+)件を表示/.exec(lines);
  if (!match?.[1] || !match[3]) return 1;

  const total = Number.parseInt(match[1], 10);
  const end = Number.parseInt(match[3], 10);
  if (!Number.isFinite(total) || !Number.isFinite(end) || end <= 0) return 1;
  return Math.max(1, Math.ceil(total / end));
}

function parseCardType(value: string): CardType {
  if (value.includes("必殺モンスター")) return "impact_monster";
  if (value.includes("モンスター")) return "monster";
  if (value.includes("魔法")) return "spell";
  if (value.includes("アイテム")) return "item";
  if (value.includes("必殺技")) return "impact";
  if (value.includes("フラッグ")) return "flag_card";
  return "other";
}

function splitList(value: string) {
  return value
    .split(/[、,／/|｜]/)
    .map(normalizeText)
    .filter(Boolean)
    .filter((item) => item !== "-");
}

function parseNullableInteger(value: string) {
  const normalized = normalizeText(value);
  if (!normalized || normalized === "-") return null;
  const match = /\d+/.exec(normalized);
  return match ? Number.parseInt(match[0], 10) : null;
}

function getNextValue(lines: string[], label: string) {
  const index = lines.findIndex((line) => line === label || line.startsWith(`${label} `));
  if (index < 0) return "";
  const sameLineValue = lines[index]?.replace(label, "").trim();
  if (sameLineValue) return sameLineValue;
  return lines[index + 1] ?? "";
}

function extractCardName(lines: string[]) {
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

function extractCardCodeFromDetail(lines: string[]) {
  const cardCodeLine = lines.find((line) =>
    /^[A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+/.test(line)
  );
  return cardCodeLine?.match(/^([A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+)/)?.[1] ?? null;
}

function extractStats(lines: string[]) {
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

function extractCardText(lines: string[]) {
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

function extractImageUrls(html: string, detailUrl: string, cardName: string) {
  const urls: string[] = [];
  const regex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    const tag = match[0] ?? "";
    const rawSrc = decodeHtml(match[1] ?? "").trim();
    if (!rawSrc) continue;
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
      continue;
    }

    if (
      !normalizedTag.includes(cardName) &&
      !lower.includes("card") &&
      !lower.includes("buddyfight")
    ) {
      continue;
    }

    if (!urls.includes(absoluteUrl)) urls.push(absoluteUrl);
  }

  return urls.slice(0, MAX_IMAGES_PER_CARD);
}

function sanitizeFilePart(value: string) {
  return value
    .normalize("NFC")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function getExtensionFromContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  return "jpg";
}

async function fetchImage(input: {
  url: string;
  cardName: string;
  index: number;
}): Promise<TcgDbBfFetchedImage> {
  const response = await fetch(input.url, {
    headers: {
      "user-agent": "BaddiePhytoOfficialImporter/1.0 (+local user initiated import)"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`画像取得に失敗しました。HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error(`対応していない画像形式です: ${contentType || "unknown"}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const extension = getExtensionFromContentType(contentType);
  return {
    fileName: `${sanitizeFilePart(`${input.cardName}_${input.index + 1}`)}.${extension}`,
    sourceUrl: input.url,
    contentType,
    base64: bytes.toString("base64"),
    size: bytes.byteLength
  };
}

async function fetchPackInfo(packUrl: URL): Promise<OfficialPackInfo> {
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

async function collectDetailUrls(packUrl: URL) {
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

async function fetchOfficialCard(detailUrl: string, pack: OfficialPackInfo): Promise<TcgDbBfFetchedCard> {
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
  const imageUrls = extractImageUrls(html, detailUrl, name);
  const images: TcgDbBfFetchedImage[] = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      images.push(await fetchImage({ url: imageUrl, cardName: name, index }));
    } catch {
      // Other candidates may still work. Preview reports zero-image cards.
    }
  }

  return {
    sourceUrl: detailUrl,
    cardKey: detailUrl,
    cardNumber: null,
    name,
    cardType,
    orientation: "vertical",
    worlds,
    races,
    size: parseNullableInteger(getNextValue(lines, "サイズ")),
    power: stats.power,
    defense: stats.defense,
    critical: stats.critical,
    cardText: extractCardText(lines),
    setCode: pack.setCode,
    setName: pack.setName,
    eraKey: inferEraKeyFromCode(cardCodeForEra),
    rarity: null,
    isDragon: races.some((race) => race.includes("ドラゴン")),
    isHyakki: races.some((race) => race.includes("百鬼")),
    isCornerKing: races.some((race) => race.includes("角王")),
    isChaos: races.some((race) => race.includes("カオス")) || name.includes("the Chaos"),
    isGeneric: worlds.some((world) => world.includes("ジェネリック")),
    isHeaven: races.some((race) => race.includes("天国")) || name.includes("楽園天国"),
    isHell: races.some((race) => race.includes("地獄")) || name.includes("灼熱地獄"),
    images
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const rawUrls = Array.from(
    new Set((body.packUrls ?? []).map((input) => input.trim()).filter(Boolean))
  );
  const packUrls = rawUrls
    .slice(0, MAX_PACKS)
    .map(normalizePackUrl)
    .filter((url): url is URL => Boolean(url));
  const issues: TcgDbBfFetchIssue[] = [];
  const cards: TcgDbBfFetchedCard[] = [];

  if (rawUrls.length > MAX_PACKS) {
    issues.push({
      input: "packUrls",
      message: `一度に取り込めるパックURLは${MAX_PACKS}件までです。超過分は無視しました。`
    });
  }

  for (const rawUrl of rawUrls.slice(0, MAX_PACKS)) {
    if (!normalizePackUrl(rawUrl)) {
      issues.push({
        input: rawUrl,
        message: "公式カードリストのパックURL（expansion付き）を入力してください。"
      });
    }
  }

  for (const packUrl of packUrls) {
    try {
      const pack = await fetchPackInfo(packUrl);
      const detailUrls = await collectDetailUrls(packUrl);
      if (detailUrls.length === 0) {
        issues.push({
          input: pack.url,
          message: "収録カードの詳細URLを取得できませんでした。"
        });
        continue;
      }

      for (const detailUrl of detailUrls) {
        try {
          cards.push(await fetchOfficialCard(detailUrl, pack));
        } catch (error) {
          issues.push({
            input: detailUrl,
            message:
              error instanceof Error
                ? error.message
                : "カード詳細の解析に失敗しました。"
          });
        }
      }
    } catch (error) {
      issues.push({
        input: packUrl.toString(),
        message:
          error instanceof Error
            ? error.message
            : "パックURLの解析に失敗しました。"
      });
    }
  }

  return NextResponse.json({ cards, issues } satisfies TcgDbBfFetchResponse);
}
