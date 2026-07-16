import type { MouseEvent } from "react";
import type { BattleZoneId } from "@/types/battle";

export type BattleSelectionMode =
  | {
      type: "zone";
      title: string;
      description?: string;
      allowedZones: ReadonlyArray<BattleZoneId>;
      playerId: "self" | "opponent";
      onSelect: (
        zoneId: BattleZoneId,
        input?: { x?: number; y?: number; event?: MouseEvent<HTMLDivElement> }
      ) => void;
      onCancel: () => void;
    }
  | null;
