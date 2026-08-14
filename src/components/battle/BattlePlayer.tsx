"use client";

import type { MouseEvent } from "react";
import { BattleZone } from "@/components/battle/BattleZone";
import type {
  BattleCard,
  BattleDropInput,
  BattleZoneId,
  PlayerState,
} from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattlePlayerProps = {
  player: PlayerState;
  side: "self" | "opponent";
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" },
  ) => void;
  onDoubleClickCard: (
    card: BattleCard,
    input?: { playerId?: "self" | "opponent" },
  ) => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent",
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent",
  ) => void;
};

type ZoneConfig = {
  zoneId: BattleZoneId;
  label: string;
  rotateCard?: boolean;
  stack?: boolean;
  showCount?: boolean;
};

const ZONE_CONFIGS: readonly ZoneConfig[] = [
  { zoneId: "gauge", label: "ゲージ", rotateCard: true, stack: true, showCount: true },
  { zoneId: "left", label: "レフト" },
  { zoneId: "center", label: "センター" },
  { zoneId: "resolution", label: "どこでもないゾーン" },
  { zoneId: "right", label: "ライト" },
  { zoneId: "drop", label: "ドロップ", stack: true, showCount: true },
  { zoneId: "set", label: "設置", stack: true, showCount: true },
  { zoneId: "flag", label: "フラッグ", stack: true },
  { zoneId: "item", label: "アイテム", stack: true },
  { zoneId: "buddy", label: "バディ", stack: true },
  { zoneId: "deck", label: "デッキ", stack: true, showCount: true },
];

export function BattlePlayer({
  player,
  side,
  cardMap,
  imagesByCard,
  draggedCard,
  draggedInstanceCount,
  draggedSoulCard,
  draggedSoulInstanceCount,
  selectedInstanceIds,
  onSelectCard,
  onDoubleClickCard,
  onContextMenuCard,
  onDragStartCard,
  onDragEndCard,
  onDropCard,
  placementTargetZones,
  placementTargetPlayerId,
  onPlacementZoneClick,
}: BattlePlayerProps) {
  const isOpponent = side === "opponent";

  return (
    <section className={`bf-board-half ${isOpponent ? "is-opponent" : "is-self"}`}>
      <div className="bf-life-badge">LIFE {player.life.value}</div>

      <div className="bf-player-board-wrap">
        <div className={`bf-player-board${isOpponent ? " is-mirrored" : ""}`}>
          {ZONE_CONFIGS.map((zone) => (
            <BattleZone
              key={zone.zoneId}
              zoneId={zone.zoneId}
              label={zone.label}
              cards={player.zones[zone.zoneId].cards}
              cardMap={cardMap}
              imagesByCard={imagesByCard}
              rotateCard={zone.rotateCard}
              stack={zone.stack}
              showCount={zone.showCount}
              playerId={player.id}
              draggedCard={draggedCard}
              draggedInstanceCount={draggedInstanceCount}
              draggedSoulCard={draggedSoulCard}
              draggedSoulInstanceCount={draggedSoulInstanceCount}
              selectedInstanceIds={selectedInstanceIds}
              onSelectCard={onSelectCard}
              onDoubleClickCard={onDoubleClickCard}
              onContextMenuCard={onContextMenuCard}
              onDragStartCard={onDragStartCard}
              onDragEndCard={onDragEndCard}
              onDropCard={onDropCard}
              placementTargetZones={placementTargetZones}
              placementTargetPlayerId={placementTargetPlayerId}
              onPlacementZoneClick={onPlacementZoneClick}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
