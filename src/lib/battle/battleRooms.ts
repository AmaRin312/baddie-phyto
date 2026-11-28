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
  host_last_seen_at: string | null;
  host_last_activity_at: string | null;
  guest_user_id: string | null;
  guest_deck_id: string | null;
  guest_last_seen_at: string | null;
  guest_last_activity_at: string | null;
  created_at: string;
  updated_at: string;
  disbanded_at: string | null;
  expires_at: string | null;
};

export const PREALLOCATED_BATTLE_ROOMS = [
  { roomId: "bf-room-1", name: "対戦ルーム1" },
  { roomId: "bf-room-2", name: "対戦ルーム2" },
  { roomId: "bf-room-3", name: "対戦ルーム3" },
  { roomId: "bf-room-4", name: "対戦ルーム4" },
  { roomId: "bf-room-5", name: "対戦ルーム5" }
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

export async function leaveBattleRoom(
  roomId: string,
  seat: BattlePlayerSeat
) {
  const { data, error } = await supabase.rpc("leave_battle_room", {
    p_room_id: roomId,
    p_seat_key: seat
  });

  if (error) {
    console.error("Battle room leave request failed.", error);
    return { error: error.message };
  }
  if (data !== true) {
    return { error: "このルームの参加席を確認できませんでした。再読み込みしてからお試しください。" };
  }

  return { error: null };
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

export async function touchBattleRoom(roomId: string, seat: BattlePlayerSeat) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "ログインが必要です。" };

  const seatUserColumn = seat === "player1" ? "host_user_id" : "guest_user_id";
  const lastSeenColumn = seat === "player1" ? "host_last_seen_at" : "guest_last_seen_at";
  const { data, error } = await supabase
    .from("battle_rooms")
    .update({ [lastSeenColumn]: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq(seatUserColumn, userId)
    .neq("status", "disbanded")
    .select("room_id")
    .maybeSingle<{ room_id: string }>();

  if (error) {
    console.error(error);
    return { error: error.message };
  }
  return data ? { error: null } : { error: "このルームの参加席を確認できません。" };
}

export async function markBattleRoomActivity(roomId: string, seat: BattlePlayerSeat) {
  const userId = await getCurrentUserId();
  if (!userId) return { error: "ログインが必要です。" };

  const seatUserColumn = seat === "player1" ? "host_user_id" : "guest_user_id";
  const activityColumn = seat === "player1" ? "host_last_activity_at" : "guest_last_activity_at";
  const { data, error } = await supabase
    .from("battle_rooms")
    .update({ [activityColumn]: new Date().toISOString() })
    .eq("room_id", roomId)
    .eq(seatUserColumn, userId)
    .neq("status", "disbanded")
    .select("room_id")
    .maybeSingle<{ room_id: string }>();

  if (error) return { error: error.message };
  return data ? { error: null } : { error: "このルームの参加席を確認できません。" };
}

export async function leaveBattleRoomOnPageExit(
  roomId: string,
  seat: BattlePlayerSeat
) {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (error || !session || !supabaseUrl || !publishableKey) return;

  try {
    await fetch(`${supabaseUrl.replace(/\/$/u, "")}/rest/v1/rpc/leave_battle_room`, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ p_room_id: roomId, p_seat_key: seat }),
      keepalive: true
    });
  } catch (leaveError) {
    console.warn("Battle room page-exit request failed; heartbeat cleanup will release it.", leaveError);
  }
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

  // Room cards can be stale after another client joins or leaves. Read the
  // current row before deciding which seat to claim.
  const roomResult = await loadBattleRoom(input.room.room_id);
  if (roomResult.error || !roomResult.data) {
    return { data: null, error: roomResult.error ?? "ルームが見つかりません。" };
  }
  const room = roomResult.data;

  if (room.status === "disbanded") {
    return { data: null, error: "このルームは終了しました。ルーム一覧を再読み込みしてください。" };
  }

  if (room.host_user_id === userId) {
    return {
      data: {
        room,
        seat: "player1"
      },
      error: null
    };
  }

  if (room.guest_user_id === userId) {
    return { data: { room, seat: "player2" }, error: null };
  }

  if (room.host_user_id == null) {
    const { data, error } = await supabase
      .from("battle_rooms")
      .update({
        status: room.guest_user_id ? "playing" : "waiting",
        host_user_id: userId,
        host_deck_id: input.deckId ?? null,
        host_last_seen_at: new Date().toISOString(),
        host_last_activity_at: new Date().toISOString(),
        disbanded_at: null,
        expires_at: null
      })
      .eq("room_id", room.room_id)
      .in("status", ["waiting", "playing"])
      .is("host_user_id", null)
      .select("*")
      .single<BattleRoomRecord>();

    if (error) {
      console.error(error);
      return { data: null, error: "このルームは他の人が確保しました。別のルームを選んでください。" };
    }

    return { data: { room: data, seat: "player1" }, error: null };
  }

  if (room.guest_user_id != null || room.host_user_id == null) {
    return { data: null, error: "このルームは満員です。別のルームを選んでください。" };
  }

  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      status: "playing",
      guest_user_id: userId,
      guest_deck_id: input.deckId ?? null,
      guest_last_seen_at: new Date().toISOString(),
      guest_last_activity_at: new Date().toISOString(),
      disbanded_at: null,
      expires_at: null
    })
    .eq("room_id", room.room_id)
    .in("status", ["waiting", "playing"])
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
  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      status: "waiting",
      host_user_id: null,
      host_deck_id: null,
      host_last_seen_at: null,
      host_last_activity_at: null,
      guest_user_id: null,
      guest_deck_id: null,
      guest_last_seen_at: null,
      guest_last_activity_at: null,
      disbanded_at: null,
      expires_at: null
    })
    .eq("room_id", roomId)
    .select("room_id")
    .maybeSingle<{ room_id: string }>();

  if (error) {
    console.error(error);
    return { error: error.message };
  }
  if (!data) return { error: "解除対象の対戦部屋が見つかりませんでした。" };

  return { error: null };
}

export async function leaveBattleRoomBeforeDeckSelection(
  roomId: string,
  seat: BattlePlayerSeat
) {
  return leaveBattleRoom(roomId, seat);
}

export async function disbandBattleRoom(roomId: string) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 1);

  const { data, error } = await supabase
    .from("battle_rooms")
    .update({
      status: "disbanded",
      host_user_id: null,
      host_deck_id: null,
      host_last_seen_at: null,
      host_last_activity_at: null,
      guest_user_id: null,
      guest_deck_id: null,
      guest_last_seen_at: null,
      guest_last_activity_at: null,
      disbanded_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString()
    })
    .eq("room_id", roomId)
    .select("room_id")
    .maybeSingle<{ room_id: string }>();

  if (error) {
    console.error(error);
    return { error: error.message };
  }
  if (!data) return { error: "解散対象の対戦部屋が見つかりませんでした。" };

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
