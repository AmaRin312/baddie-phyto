import type { BattleZoneId } from "@/types/battle";

export type BattleDestination =
  | "none"
  | "hand"
  | "gauge"
  | "drop"
  | "deck"
  | "center"
  | "left"
  | "right"
  | "item"
  | "set"
  | "resolution"
  | "soul"
  | "reveal";

export type BattleDestinationDefinition = {
  id: BattleDestination;
  label: string;
  kind: "zone" | "special";
  zoneId?: BattleZoneId;
  requiresVisibilityChoice?: boolean;
  faceUpOnMove?: boolean;
  allowsMultiple: boolean;
};
