"use client";

import { BattlePlayer } from "@/components/battle/BattlePlayer";
import type { MouseEvent } from "react";
import type {
  BattleCard,
  BattleDropInput,
  BattleState,
  BattleZoneId
} from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BattleBoardProps = {
  battleState: BattleState;
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
  onDoubleClickZone?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLElement>,
    playerId: "self" | "opponent"
  ) => void;
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  sleeveImageUrls?: Partial<Record<"self" | "opponent", string | null>>;
  playmatImageUrls?: Partial<Record<"self" | "opponent", string | null>>;
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
};

export function BattleBoard({
  battleState,
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
  onDoubleClickZone,
  placementTargetZones,
  placementTargetPlayerId,
  sleeveImageUrls,
  playmatImageUrls,
  onPlacementZoneClick
}: BattleBoardProps) {
  const isPlacementMode = placementTargetZones != null;

  return (
    <section
      className="bf-board-stage"
      aria-label="盤面"
      onClick={(event) => {
        if (isPlacementMode) {
          event.stopPropagation();
        }
      }}
    >
      <BattlePlayer
        side="opponent"
        player={battleState.players.opponent}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        sleeveImageUrl={sleeveImageUrls?.opponent ?? null}
        playmatImageUrl={playmatImageUrls?.opponent ?? null}
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
        onDoubleClickZone={onDoubleClickZone}
        placementTargetZones={placementTargetZones}
        placementTargetPlayerId={placementTargetPlayerId}
        onPlacementZoneClick={onPlacementZoneClick}
      />
      <BattlePlayer
        side="self"
        player={battleState.players.self}
        cardMap={cardMap}
        imagesByCard={imagesByCard}
        sleeveImageUrl={sleeveImageUrls?.self ?? null}
        playmatImageUrl={playmatImageUrls?.self ?? null}
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
        onDoubleClickZone={onDoubleClickZone}
        placementTargetZones={placementTargetZones}
        placementTargetPlayerId={placementTargetPlayerId}
        onPlacementZoneClick={onPlacementZoneClick}
      />
    </section>
  );
}
