"use client";

import { memo } from "react";
import type { MouseEvent } from "react";
import { BattlePlayer } from "@/components/battle/BattlePlayer";
import type {
  BattleCard,
  BattleDropInput,
  BattleZoneId,
  PlayerState
} from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleBoardProps = {
  selfPlayer: PlayerState;
  opponentPlayer: PlayerState;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent" }
  ) => void;
  onDoubleClickCard: (
    card: BattleCard,
    input?: { playerId?: "self" | "opponent" }
  ) => void;
  onContextMenuCard: (
    card: BattleCard,
    event: MouseEvent<HTMLButtonElement>,
    playerId: "self" | "opponent"
  ) => void;
  onDragStartCard: (card: BattleCard, playerId: "self" | "opponent") => void;
  onDragEndCard: () => void;
  onDropCard: (zoneId: BattleZoneId, input?: BattleDropInput) => void;
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
};

function BattleBoardComponent({
  selfPlayer,
  opponentPlayer,
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
  onPlacementZoneClick
}: BattleBoardProps) {
  const isPlacementMode = placementTargetZones != null;

  return (
    <section
      className="bf-board-stage"
      aria-label="対戦盤面"
      onClick={(event) => {
        if (isPlacementMode) {
          event.stopPropagation();
        }
      }}
    >
      <BattlePlayer
        side="opponent"
        player={opponentPlayer}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
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
      <BattlePlayer
        side="self"
        player={selfPlayer}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
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
    </section>
  );
}

export const BattleBoard = memo(BattleBoardComponent);
