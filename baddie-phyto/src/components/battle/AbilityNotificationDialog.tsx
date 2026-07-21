"use client";

import { BattlePopup } from "@/components/battle/BattlePopup";
import { BoardCard } from "@/components/cards/BoardCard";
import type { BattleAbilityNotification } from "@/lib/battle/battleAbilityNotifications";
import type { BattleCard } from "@/types/battle";
import type { CardImageRecord, CardRecord } from "@/types/baddiePhyto";

type AbilityNotificationDialogProps = {
  notification: BattleAbilityNotification;
  sourceCard: BattleCard | null;
  targetCard: BattleCard | null;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
  onConfirm: () => void;
  onCancel: () => void;
};

function NotificationCardPreview({
  title,
  battleCard,
  cardMap,
  imagesByCard
}: {
  title: string;
  battleCard: BattleCard | null;
  cardMap: Map<string, CardRecord>;
  imagesByCard: Map<string, CardImageRecord[]>;
}) {
  const card = battleCard ? cardMap.get(battleCard.cardId) ?? null : null;

  return (
    <article className="bf-ability-notification-card">
      <h3>{title}</h3>
      {battleCard && card ? (
        <>
          <BoardCard
            card={card}
            images={imagesByCard.get(card.id) ?? []}
            selectedImageId={battleCard.selectedImageId}
            isPublic={battleCard.visibility !== "face_down"}
            variant="board"
          />
          <strong>{card.name}</strong>
        </>
      ) : (
        <p>カードが見つかりません。</p>
      )}
    </article>
  );
}

export function AbilityNotificationDialog({
  sourceCard,
  targetCard,
  cardMap,
  imagesByCard,
  onConfirm,
  onCancel
}: AbilityNotificationDialogProps) {
  return (
    <BattlePopup
      title="Ability通知"
      description="相手のAbility処理を確認してください。確認後、対象カードを裏向きで自分のCenterへ置きます。"
      size="large"
      closeOnBackdrop={false}
      onClose={onCancel}
      className="bf-ability-notification-popup"
      footer={
        <div className="bf-ability-notification-actions">
          <button type="button" onClick={onConfirm}>
            確認して解決
          </button>
          <button type="button" onClick={onCancel}>
            後で確認
          </button>
        </div>
      }
    >
      <div className="bf-ability-notification-grid">
        <NotificationCardPreview
          title="使用カード"
          battleCard={sourceCard}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
        />
        <NotificationCardPreview
          title="対象カード"
          battleCard={targetCard}
          cardMap={cardMap}
          imagesByCard={imagesByCard}
        />
      </div>
    </BattlePopup>
  );
}
