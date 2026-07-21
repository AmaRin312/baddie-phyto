"use client";

import { useEffect } from "react";
import { BoardCard } from "@/components/cards/BoardCard";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type AbilityCardTargetPopupProps = {
  title: string;
  description?: string;
  candidates: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  onSelect: (instanceId: string) => void;
  onCancel: () => void;
};

export function AbilityCardTargetPopup({
  title,
  description,
  candidates,
  cardMap,
  imagesByCard,
  onSelect,
  onCancel
}: AbilityCardTargetPopupProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div className="bf-deck-browser-backdrop" role="presentation" onClick={onCancel}>
      <section
        className="bf-deck-browser"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bf-ability-target-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="bf-deck-browser-header">
          <div>
            <h2 id="bf-ability-target-popup-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" onClick={onCancel}>
            ×
          </button>
        </header>
        <div className="bf-deck-browser-grid">
          {candidates.map((battleCard) => {
            const card = cardMap.get(battleCard.cardId);
            if (!card) return null;

            return (
              <button
                type="button"
                className="bf-deck-browser-card"
                key={battleCard.instanceId}
                onClick={() => onSelect(battleCard.instanceId)}
              >
                <BoardCard
                  card={card}
                  images={imagesByCard.get(card.id) ?? []}
                  selectedImageId={battleCard.selectedImageId}
                  isPublic={battleCard.visibility !== "face_down"}
                  variant="board"
                />
                <span>{card.name}</span>
              </button>
            );
          })}
          {candidates.length === 0 && (
            <p className="dm-muted-text">選択できるカードがありません。</p>
          )}
        </div>
      </section>
    </div>
  );
}
