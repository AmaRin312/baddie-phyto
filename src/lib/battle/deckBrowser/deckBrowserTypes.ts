import type { BattleDestination } from "@/lib/battle/destinations/battleDestinationTypes";

export type DeckBrowserMode = "browse" | "look" | "move" | "ability";

export type DeckBrowserRequest = {
  cardInstanceId: string;
  destination: BattleDestination;
  soulTargetInstanceId?: string;
  visibility?: "public" | "face_down";
};
