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

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error(error);
    return null;
  }
  return data.user?.id ?? null;
}

function createRoomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `bf-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `bf-${Math.random().toString(36).slice(2, 10)}`;
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
    .in("status", ["waiting", "playing"])
    .order("updated_at", { ascending: false })
    .returns<BattleRoomRecord[]>();

  if (error) {
    console.error(error);
    return { data: [], error: error.message };
  }

  return { data: data ?? [], error: null };
}

export async function createBattleRoom(input: {
  deckId: string;
  name?: string;
}) {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { data: null, error: "ログインが必要です。" };
  }

  const roomId = createRoomId();
  const { data, error } = await supabase
    .from("battle_rooms")
    .insert({
      room_id: roomId,
      name: input.name?.trim() || `Battle Room ${roomId}`,
      status: "waiting",
      host_user_id: userId,
      host_deck_id: input.deckId
    })
    .select("*")
    .single<BattleRoomRecord>();

  if (error) {
    console.error(error);
    return { data: null, error: error.message };
  }

  return { data, error: null };
}

export async function joinBattleRoom(input: {
  room: BattleRoomRecord;
  deckId: string;
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

  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      status: "playing",
      guest_user_id: userId,
      guest_deck_id: input.deckId,
      disbanded_at: null,
      expires_at: null
    })
    .eq("room_id", input.room.room_id)
    .neq("status", "disbanded")
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
