import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { BattlePlayerId, PlayerState } from "@/types/battle";

export type RealtimeStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

export type BattlePlayerSeat = "player1" | "player2";

export const BATTLE_PLAYER_SEATS: ReadonlyArray<BattlePlayerSeat> = [
  "player1",
  "player2"
];

export type SyncedPlayerBattleState = {
  roomId: string;
  seatKey: BattlePlayerSeat;
  ownerId: string | null;
  version: number;
  state: PlayerState;
  updatedBy: string | null;
  updatedAt: string;
};

type BattlePlayerStateRow = {
  room_id: string;
  seat_key: BattlePlayerSeat;
  owner_id: string | null;
  state: PlayerState;
  version: number;
  updated_by: string | null;
  updated_at: string;
};

export async function getCurrentBattleUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error(error);
    return null;
  }
  return data.user?.id ?? null;
}

export function normalizeBattlePlayerSeat(
  value: string | null | undefined
): BattlePlayerSeat | null {
  return value === "player1" || value === "player2" ? value : null;
}

export function getOpponentSeat(seat: BattlePlayerSeat): BattlePlayerSeat {
  return seat === "player1" ? "player2" : "player1";
}

export function getBattleStatePlayerKeyForSeat(input: {
  seatKey: BattlePlayerSeat;
  selfSeat: BattlePlayerSeat;
}): BattlePlayerId {
  return input.seatKey === input.selfSeat ? "self" : "opponent";
}

export function getSeatForBattleStatePlayerKey(input: {
  playerId: BattlePlayerId;
  selfSeat: BattlePlayerSeat;
}): BattlePlayerSeat {
  return input.playerId === "self"
    ? input.selfSeat
    : getOpponentSeat(input.selfSeat);
}

export function mapSyncedSeatStatesToPlayers(input: {
  seatStates: Partial<Record<BattlePlayerSeat, SyncedPlayerBattleState>>;
  selfSeat: BattlePlayerSeat;
}): Partial<Record<BattlePlayerId, PlayerState>> {
  return Object.fromEntries(
    BATTLE_PLAYER_SEATS.flatMap((seatKey) => {
      const syncedSeat = input.seatStates[seatKey];
      if (!syncedSeat) return [];

      return [
        [
          getBattleStatePlayerKeyForSeat({
            seatKey,
            selfSeat: input.selfSeat
          }),
          syncedSeat.state
        ]
      ];
    })
  ) as Partial<Record<BattlePlayerId, PlayerState>>;
}

function toSyncedPlayerState(row: BattlePlayerStateRow): SyncedPlayerBattleState {
  return {
    roomId: row.room_id,
    seatKey: row.seat_key,
    ownerId: row.owner_id,
    version: row.version,
    state: row.state,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at
  };
}

export async function loadSyncedPlayerBattleStates(roomId: string): Promise<{
  data: Partial<Record<BattlePlayerSeat, SyncedPlayerBattleState>>;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("battle_player_states")
    .select("*")
    .eq("room_id", roomId)
    .in("seat_key", BATTLE_PLAYER_SEATS)
    .returns<BattlePlayerStateRow[]>();

  if (error) {
    console.error(error);
    return { data: {}, error: error.message };
  }

  return {
    data: Object.fromEntries(
      (data ?? []).map((row) => [row.seat_key, toSyncedPlayerState(row)])
    ) as Partial<Record<BattlePlayerSeat, SyncedPlayerBattleState>>,
    error: null
  };
}

export async function saveSyncedPlayerBattleState(input: {
  roomId: string;
  seatKey: BattlePlayerSeat;
  state: PlayerState;
  expectedVersion: number;
}): Promise<{ data: SyncedPlayerBattleState | null; error: string | null }> {
  const { data, error } = await supabase.rpc("save_battle_player_state", {
    p_room_id: input.roomId,
    p_seat_key: input.seatKey,
    p_state: input.state,
    p_expected_version: input.expectedVersion
  });

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  const rows = data as BattlePlayerStateRow[] | null;
  const row = rows?.[0] ?? null;
  return {
    data: row ? toSyncedPlayerState(row) : null,
    error: null
  };
}

export function subscribeSyncedPlayerBattleStates(input: {
  roomId: string;
  onStatusChange: (status: RealtimeStatus) => void;
  onPlayerState: (state: SyncedPlayerBattleState) => void;
  onError: (message: string) => void;
}): RealtimeChannel {
  input.onStatusChange("connecting");

  const channel = supabase
    .channel(`battle-player-states:${input.roomId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "battle_player_states",
        filter: `room_id=eq.${input.roomId}`
      },
      (payload) => {
        const row = payload.new as BattlePlayerStateRow | null;
        if (!row || row.room_id !== input.roomId) return;
        if (!normalizeBattlePlayerSeat(row.seat_key)) return;
        input.onPlayerState(toSyncedPlayerState(row));
      }
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        input.onStatusChange("connected");
        return;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        input.onStatusChange("error");
        input.onError("Realtime購読でエラーが発生しました。");
        return;
      }
      if (status === "CLOSED") {
        input.onStatusChange("reconnecting");
      }
    });

  return channel;
}

export async function unsubscribeSyncedPlayerBattleStates(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
}

export async function deleteSyncedPlayerBattleStates(roomId: string) {
  const { error } = await supabase
    .from("battle_player_states")
    .delete()
    .eq("room_id", roomId);

  if (error) console.error(error);
  return { error };
}
