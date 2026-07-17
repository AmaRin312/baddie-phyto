"use client";

import { BattleZone } from "@/components/battle/BattleZone";
import type { MouseEvent } from "react";
import type {
  BattleCard,
  BattleDropInput,
  BattleZoneId,
  PlayerState
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
  onPlacementZoneClick
}: BattlePlayerProps) {
  const isOpponent = side === "opponent";

  return (
    <section className={`bf-board-half ${isOpponent ? "is-opponent" : "is-self"}`}>
      <div className="bf-life-badge">
        LIFE {player.life.value}
      </div>
      <div className="bf-player-board-wrap">
        <div className={`bf-player-board${isOpponent ? " is-mirrored" : ""}`}>
          <BattleZone
            zoneId="gauge"
            label="ゲージ"
            cards={player.zones.gauge.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            rotateCard
            stack
            showCount
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

          <BattleZone
            zoneId="left"
            label="レフト"
            cards={player.zones.left.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
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
          <BattleZone
            zoneId="center"
            label="センター"
            cards={player.zones.center.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
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
          <BattleZone
            zoneId="resolution"
            label="どこでもないゾーン"
            cards={player.zones.resolution.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
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
          <BattleZone
            zoneId="right"
            label="ライト"
            cards={player.zones.right.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
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

          <BattleZone
            zoneId="drop"
            label="ドロップ"
            cards={player.zones.drop.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            showCount
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

          <BattleZone
            zoneId="set"
            label="設置"
            cards={player.zones.set.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            showCount
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

          <BattleZone
            zoneId="flag"
            label="フラッグ"
            cards={player.zones.flag.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
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

          <BattleZone
            zoneId="item"
            label="アイテム"
            cards={player.zones.item.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
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

          <BattleZone
            zoneId="buddy"
            label="バディ"
            cards={player.zones.buddy.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
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

          <BattleZone
            zoneId="deck"
            label="デッキ"
            cards={player.zones.deck.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            showCount
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
        </div>
      </div>
    </section>
  );
}
