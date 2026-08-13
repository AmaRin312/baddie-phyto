"use client";

import { useState } from "react";
import { BattlePopup } from "@/components/battle/BattlePopup";

type DeckCountPopupProps = {
  title: string;
  maxCount: number;
  x: number;
  y: number;
  onSubmit: (count: number) => void;
  onCancel: () => void;
};

export function DeckCountPopup({
  title,
  maxCount,
  x,
  y,
  onSubmit,
  onCancel
}: DeckCountPopupProps) {
  const [value, setValue] = useState("1");
  const parsedValue = Number.parseInt(value, 10);
  const isValid =
    Number.isInteger(parsedValue) && parsedValue >= 1 && parsedValue <= maxCount;

  return (
    <BattlePopup
      title={title}
      description={`1〜${maxCount} 枚を指定してください。`}
      size="small"
      onClose={onCancel}
      className="bf-deck-count-popup"
      style={{ left: x, top: y }}
      footer={
        <div className="bf-deck-count-popup-actions">
          <button type="button" disabled={!isValid} onClick={() => onSubmit(parsedValue)}>
            OK
          </button>
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      }
    >
        <input
          type="number"
          min={1}
          max={maxCount}
          value={value}
          autoFocus
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }

            if (event.key === "Enter" && isValid) {
              event.preventDefault();
              onSubmit(parsedValue);
            }
          }}
        />
    </BattlePopup>
  );
}
