import { supabase } from "@/lib/supabase/client";
import type { BattleState } from "@/types/battle";

type BattleStateRow = {
  id: string;
  room_id: string;
  battle_state: BattleState;
  version: number;
  updated_at: string;
  updated_by: string | null;
  created_at: string;
};

function normalizeBattleState(state: BattleState): BattleState {
  return {
    ...state,
    version: state.version ?? 0
  };
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function loadBattleState(roomId: string) {
  const { data, error } = await supabase
    .from("battle_states")
    .select("*")
    .eq("room_id", roomId)
    .maybeSingle();

  if (error) {
    console.error(error);
    return {
      data: null,
      error
    };
  }

  const row = data as BattleStateRow | null;
  return {
    data: row?.battle_state
      ? normalizeBattleState({
          ...row.battle_state,
          version: row.version ?? row.battle_state.version
        })
      : null,
    error: null
  };
}

export async function saveBattleState(input: {
  roomId: string;
  battleState: BattleState;
}) {
  const updatedBy = await getCurrentUserId();
  const battleState = normalizeBattleState(input.battleState);
  const { error } = await supabase
    .from("battle_states")
    .upsert(
      {
        room_id: input.roomId,
        battle_state: battleState,
        version: battleState.version,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "room_id"
      }
    );

  if (error) console.error(error);
  return { error };
}

export async function createBattleState(input: {
  roomId: string;
  battleState: BattleState;
}) {
  return await saveBattleState(input);
}

export async function deleteBattleState(roomId: string) {
  const { error } = await supabase
    .from("battle_states")
    .delete()
    .eq("room_id", roomId);

  if (error) console.error(error);
  return { error };
}
