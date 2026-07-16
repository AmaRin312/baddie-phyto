"use client";

import { BattlePopup } from "@/components/battle/BattlePopup";
import { BoardCard } from "@/components/cards/BoardCard";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type BiriKinataTargetPopupProps = {
  dropCards: BattleCard[];
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  onSelect: (targetInstanceId: string) => void;
  onCancel: () => void;
};

export function BiriKinataTargetPopup({
  dropCards,
  cardMap,
  imagesByCard,
  onSelect,
  onCancel
}: BiriKinataTargetPopupProps) {
  return (
    <BattlePopup
      title="ビリ・キナータ 起動能力"
      description="相手ドロップから1枚選び、裏向きで相手センターへ置きます。"
      size="large"
      onClose={onCancel}
      className="bf-biri-popup"
      footer={
        <div className="bf-biri-popup-footer">
          <button type="button" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      }
    >
      <div className="bf-biri-popup-grid">
        {dropCards.map((battleCard) => {
          const card = cardMap.get(battleCard.cardId);
          if (!card) return null;

          return (
            <article className="bf-biri-popup-card" key={battleCard.instanceId}>
              <BoardCard
                card={card}
                images={imagesByCard.get(card.id) ?? []}
                selectedImageId={battleCard.selectedImageId}
                isPublic={battleCard.visibility !== "face_down"}
                variant="board"
              />
              <strong>{card.name}</strong>
              <div className="bf-biri-popup-card-actions">
                <button
                  type="button"
                  onClick={() => onSelect(battleCard.instanceId)}
                >
                  選択
                </button>
              </div>
            </article>
          );
        })}
        {dropCards.length === 0 && (
          <p className="bf-biri-popup-empty">相手ドロップにカードがありません。</p>
        )}
      </div>
    </BattlePopup>
  );
}
