"use client";

import { BattlePopup } from "@/components/battle/BattlePopup";
import type { BattleAbilityNotification } from "@/lib/battle/battleAbilityNotifications";
import type { BattleState } from "@/types/battle";
import type { CardRecord } from "@/types/baddiePhyto";

type AbilityNotificationListPanelProps = {
  notifications: readonly BattleAbilityNotification[];
  battleState: BattleState;
  cardMap: Map<string, CardRecord>;
  onSelect: (notificationId: string) => void;
  onClose: () => void;
};

function getNotificationLabel(notification: BattleAbilityNotification) {
  if (notification.abilityKey === "biri_kinata_face_down_use") {
    return "ビリ・キナータ";
  }

  return notification.abilityKey;
}

function getBattleCardName({
  battleState,
  cardMap,
  instanceId
}: {
  battleState: BattleState;
  cardMap: Map<string, CardRecord>;
  instanceId: string;
}) {
  const battleCard = Object.values(battleState.players)
    .flatMap((player) => Object.values(player.zones))
    .flatMap((zone) => zone.cards)
    .find((card) => card.instanceId === instanceId);
  if (!battleCard) return "カード未検出";

  return cardMap.get(battleCard.cardId)?.name ?? "カード情報未検出";
}

export function AbilityNotificationListPanel({
  notifications,
  battleState,
  cardMap,
  onSelect,
  onClose
}: AbilityNotificationListPanelProps) {
  return (
    <BattlePopup
      title="未確認Ability通知"
      description="確認するAbility通知を選択してください。"
      size="medium"
      onClose={onClose}
      className="bf-ability-notification-list-popup"
    >
      {notifications.length === 0 ? (
        <p className="bf-ability-notification-empty">
          未確認のAbility通知はありません。
        </p>
      ) : (
        <div className="bf-ability-notification-list">
          {notifications.map((notification) => {
            const sourceName = getBattleCardName({
              battleState,
              cardMap,
              instanceId: notification.sourceInstanceId
            });
            const targetName = getBattleCardName({
              battleState,
              cardMap,
              instanceId: notification.targetInstanceId
            });

            return (
              <button
                type="button"
                key={notification.id}
                className="bf-ability-notification-list-item"
                onClick={() => onSelect(notification.id)}
              >
                <span>{getNotificationLabel(notification)}</span>
                <strong>{sourceName}</strong>
                <small>対象: {targetName}</small>
              </button>
            );
          })}
        </div>
      )}
    </BattlePopup>
  );
}
