"use client";

import { useEffect, useMemo, useState } from "react";

export type BattleActionPopupAction =
  | "stack"
  | "place"
  | "soulFaceUp"
  | "soulFaceDown";

type BattleActionPopupOption = {
  action: BattleActionPopupAction;
  keyLabel: "W" | "A" | "S" | "D";
  label: string;
  className: string;
};

type BattleActionPopupProps = {
  x: number;
  y: number;
  onSelect: (action: BattleActionPopupAction) => void;
  onCancel: () => void;
};

const OPTIONS: BattleActionPopupOption[] = [
  {
    action: "stack",
    keyLabel: "W",
    label: "上に重ねる",
    className: "is-top"
  },
  {
    action: "soulFaceUp",
    keyLabel: "A",
    label: "表向きソウル",
    className: "is-left"
  },
  {
    action: "place",
    keyLabel: "S",
    label: "新たなカード",
    className: "is-bottom"
  },
  {
    action: "soulFaceDown",
    keyLabel: "D",
    label: "裏向きソウル",
    className: "is-right"
  }
];

export function BattleActionPopup({
  x,
  y,
  onSelect,
  onCancel
}: BattleActionPopupProps) {
  const [selectedAction, setSelectedAction] =
    useState<BattleActionPopupAction>("stack");
  const optionByKey = useMemo(
    () =>
      new Map(
        OPTIONS.map((option) => [option.keyLabel.toLowerCase(), option.action])
      ),
    []
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      const action = optionByKey.get(key);

      if (action) {
        event.preventDefault();
        setSelectedAction(action);
        onSelect(action);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onSelect(selectedAction);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, onSelect, optionByKey, selectedAction]);

  return (
    <div
      className="bf-action-popup-backdrop"
      role="presentation"
      onClick={onCancel}
    >
      <div
        className="bf-action-popup"
        role="menu"
        style={{ left: x, top: y }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="bf-action-popup-core">●</div>
        {OPTIONS.map((option) => (
          <button
            type="button"
            className={`bf-action-popup-option ${option.className}${selectedAction === option.action ? " is-selected" : ""}`}
            key={option.action}
            onMouseEnter={() => setSelectedAction(option.action)}
            onClick={() => onSelect(option.action)}
          >
            <kbd>{option.keyLabel}</kbd>
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
