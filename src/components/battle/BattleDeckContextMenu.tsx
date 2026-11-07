"use client";

type BattleDeckContextMenuProps = {
  x: number;
  y: number;
  onSelect: (action: "look" | "reveal" | "view") => void;
  onClose: () => void;
};

export function BattleDeckContextMenu({
  x,
  y,
  onSelect,
  onClose
}: BattleDeckContextMenuProps) {
  return (
    <div
      className="bf-deck-context-backdrop"
      role="presentation"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="bf-deck-context-menu"
        role="menu"
        aria-label="山札の操作"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => onSelect("look")}>
          x枚見る
        </button>
        <button type="button" role="menuitem" onClick={() => onSelect("reveal")}>
          x枚公開する
        </button>
        <button type="button" role="menuitem" onClick={() => onSelect("view")}>
          デッキを見る
        </button>
      </div>
    </div>
  );
}
