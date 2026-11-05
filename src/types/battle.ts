import type { CardOrientation } from "@/types/baddiePhyto";

export type BattlePlayerId = "self" | "opponent";

export type BattleCardVisibility = "public" | "private" | "face_down";

export type BattleAreaSlot = number;

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

export type DiceState = {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  rolledAt: string;
};

export type BattleActivityLogEntry = {
  id: string;
  createdAt: string;
  actorName: string;
  message: string;
};

export type PlayerState = {
  id: BattlePlayerId;
  name: string;
  life: LifeState;
  dice: DiceState | null;
  zones: Record<BattleZoneId, BattleZone>;
  activeEffectIds?: string[];
  activityLogs?: BattleActivityLogEntry[];
};

export type BattleRuleState = {
  itemLimit: number | null;
  appliedRuleEffectIds: string[];
  itemLimitBeforeLaevateinn?: number | null;
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
