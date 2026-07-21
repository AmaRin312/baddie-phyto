import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { BattlePlayerSeat } from "@/lib/battle/battlePlayerStateSync";

export type BattleAbilityNotificationStatus =
  | "pending"
  | "resolved"
  | "cancelled";

export type BattleAbilityNotificationType = "biri_kinata_face_down_use";

export type BattleAbilityNotification = {
  id: string;
  roomId: string;
  abilityKey: BattleAbilityNotificationType;
  sourceSeatKey: BattlePlayerSeat;
  targetSeatKey: BattlePlayerSeat;
  sourceInstanceId: string;
  targetInstanceId: string;
  status: BattleAbilityNotificationStatus;
  payload: Record<string, unknown>;
  createdBy: string | null;
  resolvedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type BattleAbilityNotificationRow = {
  id: string;
  room_id: string;
  ability_key: BattleAbilityNotificationType;
  source_seat_key: BattlePlayerSeat;
  target_seat_key: BattlePlayerSeat;
  source_instance_id: string;
  target_instance_id: string;
  status: BattleAbilityNotificationStatus;
  payload: Record<string, unknown>;
  created_by: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

function toNotification(
  row: BattleAbilityNotificationRow
): BattleAbilityNotification {
  return {
    id: row.id,
    roomId: row.room_id,
    abilityKey: row.ability_key,
    sourceSeatKey: row.source_seat_key,
    targetSeatKey: row.target_seat_key,
    sourceInstanceId: row.source_instance_id,
    targetInstanceId: row.target_instance_id,
    status: row.status,
    payload: row.payload ?? {},
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function createBattleAbilityNotification(input: {
  roomId: string;
  abilityKey: BattleAbilityNotificationType;
  sourceSeatKey: BattlePlayerSeat;
  targetSeatKey: BattlePlayerSeat;
  sourceInstanceId: string;
  targetInstanceId: string;
  payload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("battle_ability_notifications")
    .insert({
      room_id: input.roomId,
      ability_key: input.abilityKey,
      source_seat_key: input.sourceSeatKey,
      target_seat_key: input.targetSeatKey,
      source_instance_id: input.sourceInstanceId,
      target_instance_id: input.targetInstanceId,
      payload: input.payload ?? {}
    })
    .select("*")
    .single<BattleAbilityNotificationRow>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return {
    data: data ? toNotification(data) : null,
    error: null
  };
}

export async function updateBattleAbilityNotificationStatus(input: {
  id: string;
  status: BattleAbilityNotificationStatus;
}) {
  const { data, error } = await supabase
    .from("battle_ability_notifications")
    .update({
      status: input.status,
      resolved_by:
        input.status === "resolved" || input.status === "cancelled"
          ? (await supabase.auth.getUser()).data.user?.id ?? null
          : null
    })
    .eq("id", input.id)
    .select("*")
    .single<BattleAbilityNotificationRow>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return {
    data: data ? toNotification(data) : null,
    error: null
  };
}

export async function loadPendingBattleAbilityNotifications(input: {
  roomId: string;
  targetSeatKey: BattlePlayerSeat;
}) {
  const { data, error } = await supabase
    .from("battle_ability_notifications")
    .select("*")
    .eq("room_id", input.roomId)
    .eq("target_seat_key", input.targetSeatKey)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .returns<BattleAbilityNotificationRow[]>();

  if (error) {
    console.error(error);
    return { data: [], error: error.message };
  }

  return {
    data: (data ?? []).map(toNotification),
    error: null
  };
}

export function subscribeBattleAbilityNotifications(input: {
  roomId: string;
  targetSeatKey: BattlePlayerSeat;
  onNotification: (notification: BattleAbilityNotification) => void;
  onError: (message: string) => void;
}): RealtimeChannel {
  const channel = supabase
    .channel(`battle-ability-notifications:${input.roomId}:${input.targetSeatKey}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "battle_ability_notifications",
        filter: `room_id=eq.${input.roomId}`
      },
      (payload) => {
        const row = payload.new as BattleAbilityNotificationRow | null;
        if (!row || row.room_id !== input.roomId) return;
        if (row.target_seat_key !== input.targetSeatKey) return;
        input.onNotification(toNotification(row));
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        input.onError("Ability通知のRealtime購読に失敗しました。");
      }
    });

  return channel;
}

export async function unsubscribeBattleAbilityNotifications(
  channel: RealtimeChannel
) {
  await supabase.removeChannel(channel);
}
