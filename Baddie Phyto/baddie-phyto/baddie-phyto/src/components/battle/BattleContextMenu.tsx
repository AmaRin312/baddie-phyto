"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BattleMenuItem,
  BattlePlacementSource
} from "@/lib/battle/menus/battleContextMenu";
import type { BattleCommand } from "@/lib/battle/commands/battleCommandTypes";

type BattleContextMenuProps = {
  x: number;
  y: number;
  title?: string;
  items: BattleMenuItem[];
  onCommand: (command: BattleCommand) => void;
  onPlacement: (source: BattlePlacementSource) => void;
  onUiAction: (item: BattleMenuItem) => void;
  onCancel: () => void;
};

const POSITION_CLASS: Record<BattleMenuItem["direction"], string> = {
  W: "is-top",
  A: "is-left",
  S: "is-bottom",
  D: "is-right"
};

function getActionKey(item: BattleMenuItem) {
  return item.direction.toLowerCase();
}

export function BattleContextMenu({
  x,
  y,
  title = "Action",
  items,
  onCommand,
  onPlacement,
  onUiAction,
  onCancel
}: BattleContextMenuProps) {
  const [stack, setStack] = useState<BattleMenuItem[][]>(() => [items]);
  const currentItems = useMemo(
    () => stack[stack.length - 1] ?? [],
    [stack]
  );
  const selectableDirections = useMemo(
    () => new Set(currentItems.map((item) => getActionKey(item))),
    [currentItems]
  );
  const [selectedDirection, setSelectedDirection] = useState(
    items[0]?.direction ?? "W"
  );

  const runItem = useCallback((item: BattleMenuItem) => {
    if (item.children && item.children.length > 0) {
      setStack((current) => [...current, item.children ?? []]);
      setSelectedDirection(item.children[0]?.direction ?? "W");
      return;
    }

    if (item.command) {
      onCommand(item.command);
      return;
    }

    if (item.placementSource) {
      onPlacement(item.placementSource);
      return;
    }

    if (item.uiAction) {
      onUiAction(item);
    }
  }, [onCommand, onPlacement, onUiAction]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (key === "escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (key === "backspace" && stack.length > 1) {
        event.preventDefault();
        setStack((current) => {
          const nextStack = current.slice(0, -1);
          const nextItems = nextStack[nextStack.length - 1] ?? [];
          setSelectedDirection(nextItems[0]?.direction ?? "W");
          return nextStack;
        });
        return;
      }

      if (key === "enter") {
        event.preventDefault();
        const selectedItem = currentItems.find(
          (item) => item.direction === selectedDirection
        );
        if (selectedItem) runItem(selectedItem);
        return;
      }

      if (!selectableDirections.has(key)) return;

      event.preventDefault();
      const selectedItem = currentItems.find((item) => getActionKey(item) === key);
      if (!selectedItem) return;
      setSelectedDirection(selectedItem.direction);
      runItem(selectedItem);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentItems,
    onCancel,
    runItem,
    selectableDirections,
    selectedDirection,
    stack.length
  ]);

  return (
    <div className="bf-action-popup-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="bf-action-popup bf-context-menu"
        role="menu"
        aria-label={title}
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bf-action-popup-core">
          <span>{title}</span>
          {stack.length > 1 && <small>Backspace</small>}
        </div>
        {currentItems.map((item) => (
          <button
            type="button"
            role="menuitem"
            className={`bf-action-popup-option ${POSITION_CLASS[item.direction]}${selectedDirection === item.direction ? " is-selected" : ""}`}
            key={`${item.direction}:${item.label}`}
            onMouseEnter={() => setSelectedDirection(item.direction)}
            onClick={() => runItem(item)}
          >
            <kbd>{item.direction}</kbd>
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
