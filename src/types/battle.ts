import type { CardOrientation } from "@/types/baddiePhyto";

export type BattlePlayerId = "self" | "opponent";

export type BattleCardVisibility = "public" | "private" | "face_down";

export type BattleAreaSlot = 0 | 1;

export type BattleZoneId =
  | "deck"
  | "hand"
  | "gauge"
  | "drop"
  | "flag"
  | "buddy"
  | "center"
  | "left"
  | "right"
  | "item"
  | "set"
  | "resolution";

export type BattleCard = {
  instanceId: string;
  cardId: string;
  ownerId: BattlePlayerId;
  zoneId: BattleZoneId;
  selectedImageId: string | null;
  visibility: BattleCardVisibility;
  orientation: CardOrientation;
  soul: BattleCard[];
  counters: Record<string, number>;
  meta: Record<string, unknown>;
};

export type BattleZone = {
  id: BattleZoneId;
  label: string;
  cards: BattleCard[];
};

export type LifeState = {
  value: number;
};

export type PlayerState = {
  id: BattlePlayerId;
  name: string;
  life: LifeState;
  zones: Record<BattleZoneId, BattleZone>;
};

export type BattleRuleState = {
  itemLimit: number | null;
  appliedRuleEffectIds: string[];
};

export type BattleState = {
  id: string;
  version: number;
  startedAt: string;
  players: Record<BattlePlayerId, PlayerState>;
  activeViewerCardInstanceId: string | null;
  ruleState: BattleRuleState;
  deckLook: {
    playerId: BattlePlayerId;
    instanceIds: string[];
  } | null;
  meta: Record<string, unknown>;
};

export type BattleDropInput = {
  targetInstanceId?: string;
  placeAsNewStack?: boolean;
  clientX?: number;
  clientY?: number;
};

export const BATTLE_ZONE_LABELS: Readonly<Record<BattleZoneId, string>> = {
  deck: "デッキ",
  hand: "手札",
  gauge: "ゲージ",
  drop: "ドロップ",
  flag: "フラッグ",
  buddy: "バディ",
  center: "センター",
  left: "レフト",
  right: "ライト",
  item: "アイテム",
  set: "設置",
  resolution: "どこでもないゾーン"
};
