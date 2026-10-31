import { supabase } from "@/lib/supabase/client";
import type { BattlePlayerSeat } from "@/lib/battle/battlePlayerStateSync";

export type BattleRoomStatus = "waiting" | "playing" | "disbanded";

export type BattleRoomRecord = {
  id: string;
  room_id: string;
  name: string;
  status: BattleRoomStatus;
  host_user_id: string | null;
  host_deck_id: string | null;
  guest_user_id: string | null;
  guest_deck_id: string | null;
  created_at: string;
  updated_at: string;
  disbanded_at: string | null;
  expires_at: string | null;
};

export const PREALLOCATED_BATTLE_ROOMS = [
  { roomId: "bf-room-1", name: "対戦ルーム1" },
  { roomId: "bf-room-2", name: "対戦ルーム2" }
] as const;

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error(error);
    return null;
  }
  return data.user?.id ?? null;
}

export async function cleanupExpiredBattleRooms() {
  const { error } = await supabase.rpc("cleanup_expired_battle_rooms");
  if (error) {
    console.error(error);
  }
  return { error };
}

export async function loadActiveBattleRooms() {
  await cleanupExpiredBattleRooms();

  const { data, error } = await supabase
    .from("battle_rooms")
    .select("*")
    .in("room_id", PREALLOCATED_BATTLE_ROOMS.map((room) => room.roomId))
    .in("status", ["waiting", "playing"])
    .order("name", { ascending: true })
    .returns<BattleRoomRecord[]>();

  if (error) {
    console.error(error);
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function loadBattleRoom(roomId: string) {
  const { data, error } = await supabase
    .from("battle_rooms")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle<BattleRoomRecord>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function joinBattleRoom(input: {
  room: BattleRoomRecord;
  deckId?: string;
}): Promise<{
  data: { room: BattleRoomRecord; seat: BattlePlayerSeat } | null;
  error: string | null;
}> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: "ログインが必要です。" };
  }

  if (input.room.host_user_id === userId) {
    return {
      data: {
        room: input.room,
        seat: "player1"
      },
      error: null
    };
  }

  if (input.room.host_user_id == null && input.room.guest_user_id == null) {
    const { data, error } = await supabase
      .from("battle_rooms")
      .update({
        status: "waiting",
        host_user_id: userId,
        host_deck_id: input.deckId ?? null,
        guest_user_id: null,
        guest_deck_id: null,
        disbanded_at: null,
        expires_at: null
      })
      .eq("room_id", input.room.room_id)
      .eq("status", "waiting")
      .is("host_user_id", null)
      .is("guest_user_id", null)
      .select("*")
      .single<BattleRoomRecord>();

    if (error) {
      console.error(error);
      return { data: null, error: "このルームは他の人が確保しました。別のルームを選んでください。" };
    }

    return { data: { room: data, seat: "player1" }, error: null };
  }

  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      status: "playing",
      guest_user_id: userId,
      guest_deck_id: input.deckId ?? null,
      disbanded_at: null,
      expires_at: null
    })
    .eq("room_id", input.room.room_id)
    .eq("status", "waiting")
    .is("guest_user_id", null)
    .select("*")
    .single<BattleRoomRecord>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return {
    data: {
      room: data,
      seat: "player2"
    },
    error: null
  };
}

export async function releaseBattleRoom(roomId: string) {
  const { error } = await supabase
    .from("battle_rooms")
    .update({
      status: "waiting",
      host_user_id: null,
      host_deck_id: null,
      guest_user_id: null,
      guest_deck_id: null,
      disbanded_at: null,
      expires_at: null
    })
    .eq("room_id", roomId);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return { error: null };
}

export async function leaveBattleRoomBeforeDeckSelection(
  roomId: string,
  seat: BattlePlayerSeat
) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "ログインが必要です。" };

  if (seat === "player2") {
    const { error } = await supabase
      .from("battle_rooms")
      .update({
        status: "waiting",
        guest_user_id: null,
        guest_deck_id: null
      })
      .eq("room_id", roomId)
      .eq("guest_user_id", userId)
      .eq("status", "playing");

    if (error) {
      console.error(error);
      return { error: error.message };
    }
    return { error: null };
  }

  const { data: room, error: loadError } = await supabase
    .from("battle_rooms")
    .select("guest_user_id")
    .eq("room_id", roomId)
    .eq("host_user_id", userId)
    .maybeSingle<{ guest_user_id: string | null }>();
  if (loadError || !room) {
    return { error: loadError?.message ?? "ルームの席を確認できませんでした。" };
  }

  if (room.guest_user_id) {
    return disbandBattleRoom(roomId);
  }
  return releaseBattleRoom(roomId);
}

export async function disbandBattleRoom(roomId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  const { error } = await supabase
    .from("battle_rooms")
    .update({
      status: "disbanded",
      disbanded_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .eq("room_id", roomId);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return { error: null };
}

export async function deleteBattleRoom(roomId: string) {
  const { error } = await supabase
    .from("battle_rooms")
    .delete()
    .eq("room_id", roomId);

  if (error) {
    console.error(error);
    return { error: error.message };
  }

  return { error: null };
}

export async function updateBattleRoomDeck(input: {
  roomId: string;
  seat: BattlePlayerSeat;
  deckId: string;
}) {
  const updatePayload =
    input.seat === "player1"
      ? { host_deck_id: input.deckId }
      : { guest_deck_id: input.deckId };

  const { data, error } = await supabase
    .from("battle_rooms")
    .update(updatePayload)
    .eq("room_id", input.roomId)
    .neq("status", "disbanded")
    .select("*")
    .single<BattleRoomRecord>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}
