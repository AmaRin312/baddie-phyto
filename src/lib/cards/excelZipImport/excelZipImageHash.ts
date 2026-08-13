import type { ExcelZipImageEntry } from "@/lib/cards/excelZipImport/excelZipImportTypes";

export async function getExcelZipImageContentHash(image: ExcelZipImageEntry) {
  const digest = await crypto.subtle.digest("SHA-256", await image.blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getExcelZipImageStoragePath(input: {
  userId: string;
  cardId: string;
  image: ExcelZipImageEntry;
}) {
  const hash = await getExcelZipImageContentHash(input.image);
  return `${input.userId}/${input.cardId}/${hash}.${input.image.extension}`;
}

