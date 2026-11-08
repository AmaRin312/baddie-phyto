"use client";

import { memo } from "react";
import { BattleZone } from "@/components/battle/BattleZone";
import type { CSSProperties, MouseEvent } from "react";
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
  sleeveImageUrl?: string | null;
  playmatImageUrl?: string | null;
  activePersistentEffects?: string[];
  draggedCard: BattleCard | null;
  draggedInstanceCount: number;
  draggedSoulCard: BattleCard | null;
  draggedSoulInstanceCount: number;
  selectedInstanceIds: ReadonlySet<string>;
  onSelectCard: (
    card: BattleCard,
    input?: { shiftKey?: boolean; playerId?: "self" | "opponent"; anchor?: { right: number; bottom: number } }
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
  onContextMenuZone?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
  placementTargetZones?: ReadonlySet<BattleZoneId>;
  placementTargetPlayerId?: "self" | "opponent";
  onPlacementZoneClick?: (
    zoneId: BattleZoneId,
    event: MouseEvent<HTMLDivElement>,
    playerId: "self" | "opponent"
  ) => void;
  onChangeLife?: (amount: number) => void;
  onRollDice?: () => void;
  onClearDice?: () => void;
};

function BattlePlayerComponent({
  player,
  side,
  cardMap,
  imagesByCard,
  sleeveImageUrl = null,
  playmatImageUrl = null,
  activePersistentEffects = [],
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
  onContextMenuZone,
  placementTargetZones,
  placementTargetPlayerId,
  onPlacementZoneClick,
  onChangeLife,
  onRollDice,
  onClearDice
}: BattlePlayerProps) {
  const isOpponent = side === "opponent";
  const laevateinnActive =
    !isOpponent && activePersistentEffects.includes("レヴァンティン");
  const boardHalfStyle = playmatImageUrl
    ? ({
        "--bf-player-playmat-image": `url("${playmatImageUrl}")`
      } as CSSProperties)
    : undefined;

  return (
    <section
      className={`bf-board-half ${isOpponent ? "is-opponent" : "is-self"}${
        playmatImageUrl ? " has-playmat" : ""
      }`}
      style={boardHalfStyle}
    >
      <div className="bf-life-badge" aria-label={`${player.name}のライフ`}>
        <span>LIFE {player.life.value}</span>
        {!isOpponent && onChangeLife && (
          <span className="bf-life-controls" aria-label="ライフ操作">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeLife(-1);
              }}
            >
              -
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onChangeLife(1);
              }}
            >
              +
            </button>
          </span>
        )}
      </div>
      <div className="bf-dice-panel" aria-label={`${player.name}のサイコロ`}>
        {player.dice ? (
          <span className="bf-dice-value">{player.dice.value}</span>
        ) : (
          <span className="bf-dice-empty">-</span>
        )}
        {!isOpponent && (
          <span className="bf-dice-controls">
            {onRollDice && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRollDice();
                }}
              >
                振る
              </button>
            )}
            {player.dice && onClearDice && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onClearDice();
                }}
              >
                消す
              </button>
            )}
          </span>
        )}
      </div>
      <div className="bf-player-board-wrap">
        <div className={`bf-player-board${isOpponent ? " is-mirrored" : ""}`}>
          <BattleZone
            zoneId="gauge"
            label="ゲージ"
            cards={player.zones.gauge.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            sleeveImageUrl={sleeveImageUrl}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            rotateCard
            stack
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

          <BattleZone
            zoneId="left"
            label="レフト"
            cards={player.zones.left.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            showCount
            laevateinnActive={laevateinnActive}
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

          <BattleZone
            zoneId="flag"
            label="フラッグ"
            cards={player.zones.flag.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            sleeveImageUrl={sleeveImageUrl}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            activeEffects={activePersistentEffects}
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

          <BattleZone
            zoneId="item"
            label="アイテム"
            cards={player.zones.item.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            sleeveImageUrl={sleeveImageUrl}
            playerId={player.id}
            draggedCard={draggedCard}
            draggedInstanceCount={draggedInstanceCount}
            draggedSoulCard={draggedSoulCard}
            draggedSoulInstanceCount={draggedSoulInstanceCount}
            selectedInstanceIds={selectedInstanceIds}
            stack
            laevateinnActive={laevateinnActive}
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

          <BattleZone
            zoneId="buddy"
            label="バディ"
            cards={player.zones.buddy.cards}
            cardMap={cardMap}
            imagesByCard={imagesByCard}
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
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
            sleeveImageUrl={sleeveImageUrl}
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
            onDoubleClickZone={onDoubleClickZone}
            onContextMenuZone={onContextMenuZone}
            placementTargetZones={placementTargetZones}
            placementTargetPlayerId={placementTargetPlayerId}
            onPlacementZoneClick={onPlacementZoneClick}
          />
          {!isOpponent &&
            player.zones.resolution.cards.length === 0 &&
            (draggedCard != null || draggedSoulCard != null) && (
              <div className="bf-resolution-drag-indicator" aria-hidden="true">
                どこでもないゾーン
              </div>
            )}
        </div>
      </div>
    </section>
  );
}

export const BattlePlayer = memo(BattlePlayerComponent);

