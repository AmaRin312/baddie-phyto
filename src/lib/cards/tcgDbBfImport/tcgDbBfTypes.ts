import type { CardOrientation, CardType } from "@/types/baddiePhyto";
import type { ExcelZipEraKey } from "@/lib/cards/excelZipImport/excelZipImportTypes";

export type TcgDbBfFetchedImage = {
  fileName: string;
  sourceUrl: string;
  contentType: string;
  base64: string;
  size: number;
};

export type TcgDbBfFetchedCard = {
  sourceUrl: string;
  cardKey: string;
  cardNumber: string | null;
  name: string;
  cardType: CardType;
  orientation: CardOrientation;
  worlds: string[];
  races: string[];
  size: number | null;
  power: number | null;
  defense: number | null;
  critical: number | null;
  cardText: string | null;
  setCode: string | null;
  setName: string | null;
  eraKey: ExcelZipEraKey | null;
  rarity: string | null;
  isDragon: boolean;
  isHyakki: boolean;
  isCornerKing: boolean;
  isChaos: boolean;
  isGeneric: boolean;
  isHeaven: boolean;
  isHell: boolean;
  images: TcgDbBfFetchedImage[];
};

export type TcgDbBfFetchIssue = {
  input: string;
  message: string;
};

export type TcgDbBfFetchResponse = {
  cards: TcgDbBfFetchedCard[];
  issues: TcgDbBfFetchIssue[];
};
