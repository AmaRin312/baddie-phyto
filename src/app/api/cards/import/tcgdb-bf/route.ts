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

const BASE_URL = "https://tcg-db.nikita.jp";
const MAX_INPUTS = 30;
const MAX_IMAGES_PER_CARD = 2;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type RequestBody = {
  inputs?: string[];
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
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h\d|table|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map(normalizeText)
    .filter(Boolean);
  return text;
}

function extractImageUrls(html: string, pageUrl: string) {
  const urls: string[] = [];
  const imageRegex = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(html))) {
    const rawSrc = decodeHtml(match[1] ?? "").trim();
    if (!rawSrc) continue;
    const absoluteUrl = new URL(rawSrc, pageUrl).toString();
    const lower = absoluteUrl.toLowerCase();
    if (
      lower.includes("icon") ||
      lower.includes("logo") ||
      lower.includes("banner") ||
      lower.endsWith(".svg")
    ) {
      continue;
    }
    if (!urls.includes(absoluteUrl)) urls.push(absoluteUrl);
  }

  return urls.slice(0, MAX_IMAGES_PER_CARD);
}

function normalizeInputToUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.hostname !== "tcg-db.nikita.jp") return null;
    if (!url.pathname.startsWith("/cardlist/bf")) return null;
    return url.toString();
  } catch {
    const cardKey = trimmed.replace(/^card_key=/i, "");
    const url = new URL("/cardlist/bf", BASE_URL);
    url.searchParams.set("card_key", cardKey);
    return url.toString();
  }
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
    .split(/[／/、,]/)
    .map((item) => normalizeText(item))
    .filter(Boolean);
}

function parseIntegerFromLine(line: string, label: string) {
  const match = new RegExp(`${label}：?\\s*(\\d+)`).exec(line);
  return match?.[1] ? Number.parseInt(match[1], 10) : null;
}

function inferEraKey(setCode: string | null): ExcelZipEraKey | null {
  if (!setCode) return "first";
  const upper = setCode.toUpperCase();
  if (upper.startsWith("H")) return "hundred";
  if (upper.startsWith("D")) return "ddd";
  if (upper.startsWith("X")) return "x";
  if (upper.startsWith("S")) return "god";
  return "first";
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

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "BaddiePhytoImporter/1.0 (+local user initiated import)"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`ページ取得に失敗しました。HTTP ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  return new TextDecoder("utf-8").decode(bytes);
}

async function fetchImage(input: {
  url: string;
  cardName: string;
  cardNumber: string | null;
  index: number;
}): Promise<TcgDbBfFetchedImage> {
  const response = await fetch(input.url, {
    headers: {
      "user-agent": "BaddiePhytoImporter/1.0 (+local user initiated import)"
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
  const baseName = sanitizeFilePart(
    [input.cardNumber ?? "no-number", input.cardName, input.index + 1].join("_")
  );

  return {
    fileName: `${baseName}.${extension}`,
    sourceUrl: input.url,
    contentType,
    base64: bytes.toString("base64"),
    size: bytes.byteLength
  };
}

function parseCardFromHtml(input: {
  html: string;
  pageUrl: string;
  cardKey: string;
}): Omit<TcgDbBfFetchedCard, "images"> {
  const lines = htmlToLines(input.html);
  const mainLineIndex = lines.findIndex((line) =>
    /^[A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+\s+/.test(line)
  );
  if (mainLineIndex < 0) {
    throw new Error("カード番号とカード名を解析できませんでした。");
  }

  const mainLine = lines[mainLineIndex] ?? "";
  const mainMatch = /^([A-Z0-9][A-Z0-9-]*\/[A-Z0-9-]+)\s+(.+)$/.exec(mainLine);
  if (!mainMatch) throw new Error("カード番号とカード名を解析できませんでした。");

  const cardNumber = mainMatch[1] ?? null;
  const name = normalizeText(mainMatch[2] ?? "");
  const setCode = cardNumber?.split("/")[0] ?? null;
  const typeLine = lines[mainLineIndex + 1] ?? "";
  const worldLine = lines.find((line) => line.includes("ワールド：")) ?? "";
  const statLine = lines.find((line) => line.includes("攻撃力：") || line.includes("サイズ：")) ?? "";
  const worldMatch = /ワールド：(.+?)(?:\s+属性：|$)/.exec(worldLine);
  const racesMatch = /属性：(.+)$/.exec(worldLine);
  const typeParts = typeLine.split(/\s+/).filter(Boolean);
  const cardTypeText = typeParts[0] ?? "";
  const rarity = typeParts.at(-1) && typeParts.length >= 3 ? typeParts.at(-1) ?? null : null;
  const setName =
    typeParts.length >= 3
      ? typeParts.slice(1, -1).join(" ") || null
      : typeParts.slice(1).join(" ") || null;
  const cardType = parseCardType(cardTypeText);
  const races = racesMatch ? splitList(racesMatch[1] ?? "") : [];
  const worlds = worldMatch ? splitList(worldMatch[1] ?? "") : [];
  const textStartIndex = statLine
    ? lines.findIndex((line) => line === statLine) + 1
    : mainLineIndex + 2;
  const textLines = lines
    .slice(textStartIndex)
    .filter(
      (line) =>
        !line.startsWith("イラスト:") &&
        !line.includes("画像モード") &&
        !line.includes("テキストモード")
    );
  const illustratorIndex = textLines.findIndex((line) => line.startsWith("イラスト:"));
  const effectiveTextLines =
    illustratorIndex >= 0 ? textLines.slice(0, illustratorIndex) : textLines;
  const cardText = effectiveTextLines.length > 0 ? effectiveTextLines.join("\n") : null;

  return {
    sourceUrl: input.pageUrl,
    cardKey: input.cardKey,
    cardNumber,
    name,
    cardType,
    orientation: "vertical",
    worlds,
    races,
    size: parseIntegerFromLine(statLine, "サイズ"),
    power: parseIntegerFromLine(statLine, "攻撃力"),
    defense: parseIntegerFromLine(statLine, "防御力"),
    critical: parseIntegerFromLine(statLine, "打撃力"),
    cardText,
    setCode,
    setName,
    eraKey: inferEraKey(setCode),
    rarity,
    isDragon: races.some((race) => race.includes("ドラゴン")),
    isHyakki: races.some((race) => race.includes("百鬼")),
    isCornerKing: races.some((race) => race.includes("角王")),
    isChaos: races.some((race) => race.includes("カオス")) || name.includes("the Chaos"),
    isGeneric: worlds.some((world) => world.includes("ジェネリック")),
    isHeaven: races.some((race) => race.includes("天国")) || name.includes("楽園天国"),
    isHell: races.some((race) => race.includes("地獄")) || name.includes("灼熱地獄")
  };
}

async function fetchCard(input: string): Promise<TcgDbBfFetchedCard> {
  const pageUrl = normalizeInputToUrl(input);
  if (!pageUrl) {
    throw new Error("tcg-db.nikita.jp/cardlist/bf のURL、または card_key を入力してください。");
  }

  const url = new URL(pageUrl);
  const cardKey = url.searchParams.get("card_key") ?? input.trim();
  const html = await fetchText(pageUrl);
  const parsedCard = parseCardFromHtml({ html, pageUrl, cardKey });
  const imageUrls = extractImageUrls(html, pageUrl);
  const images: TcgDbBfFetchedImage[] = [];

  for (const [index, imageUrl] of imageUrls.entries()) {
    try {
      images.push(
        await fetchImage({
          url: imageUrl,
          cardName: parsedCard.name,
          cardNumber: parsedCard.cardNumber,
          index
        })
      );
    } catch {
      // Continue with other image candidates. If none can be fetched,
      // the preview layer reports it as an import error.
    }
  }

  return { ...parsedCard, images };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RequestBody;
  const rawInputs = Array.from(new Set((body.inputs ?? []).map((input) => input.trim()).filter(Boolean)));
  const limitedInputs = rawInputs.slice(0, MAX_INPUTS);
  const issues: TcgDbBfFetchIssue[] = [];
  const cards: TcgDbBfFetchedCard[] = [];

  for (const input of limitedInputs) {
    try {
      cards.push(await fetchCard(input));
    } catch (error) {
      issues.push({
        input,
        message:
          error instanceof Error
            ? error.message
            : "カード取得中に不明なエラーが発生しました。"
      });
    }
  }

  if (rawInputs.length > MAX_INPUTS) {
    issues.push({
      input: "input",
      message: `一度に取得できるのは${MAX_INPUTS}件までです。超過分は無視しました。`
    });
  }

  return NextResponse.json({ cards, issues } satisfies TcgDbBfFetchResponse);
}
