create or replace function public.save_battle_player_state_compact(
  p_room_id text,
  p_seat_key text,
  p_state jsonb,
  p_expected_version integer
)
returns table (version integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_user_id uuid;
  current_row public.battle_player_states%rowtype;
begin
  current_user_id := auth.uid();
  if current_user_id is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_room_id), '') is null then
    raise exception 'room_id is required.';
  end if;

  if p_seat_key not in ('player1', 'player2') then
    raise exception 'seat_key is invalid.';
  end if;

  if p_state is null then
    raise exception 'state is required.';
  end if;

  select *
  into current_row
  from public.battle_player_states as battle_player_state
  where battle_player_state.room_id = trim(p_room_id)
    and battle_player_state.seat_key = p_seat_key
  for update;

  if not found then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'Battle player state version conflict. expected %, current %',
        p_expected_version,
        0
        using errcode = '40001';
    end if;

    insert into public.battle_player_states (
      room_id,
      seat_key,
      owner_id,
      state,
      version,
      updated_by
    )
    values (
      trim(p_room_id),
      p_seat_key,
      current_user_id,
      p_state,
      1,
      current_user_id
    )
    returning public.battle_player_states.version into version;

    return next;
    return;
  end if;

  if current_row.version <> coalesce(p_expected_version, 0) then
    raise exception 'Battle player state version conflict. expected %, current %',
      p_expected_version,
      current_row.version
      using errcode = '40001';
  end if;

  update public.battle_player_states as battle_player_state
  set
    state = p_state,
    version = current_row.version + 1,
    owner_id = coalesce(battle_player_state.owner_id, current_user_id),
    updated_by = current_user_id,
    updated_at = now()
  where battle_player_state.id = current_row.id
  returning battle_player_state.version into version;

  return next;
end;
$$;

revoke all on function public.save_battle_player_state_compact(text, text, jsonb, integer)
from public;
grant execute on function public.save_battle_player_state_compact(text, text, jsonb, integer)
to authenticated;
