begin;

insert into public.battle_rooms (room_id, name, status)
values
  ('bf-room-1', '対戦ルーム1', 'waiting'),
  ('bf-room-2', '対戦ルーム2', 'waiting')
on conflict (room_id) do nothing;

drop policy if exists "authenticated users can insert own battle rooms"
on public.battle_rooms;
revoke insert on public.battle_rooms from authenticated;

create or replace function public.cleanup_expired_battle_rooms()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expired_room_ids text[];
  released_count integer := 0;
  deleted_count integer := 0;
begin
  select coalesce(array_agg(room_id), array[]::text[])
  into expired_room_ids
  from public.battle_rooms
  where status = 'disbanded'
    and coalesce(expires_at, disbanded_at + interval '1 day') <= now();

  if array_length(expired_room_ids, 1) is null then
    return 0;
  end if;

  delete from public.battle_player_states
  where room_id = any(expired_room_ids);

  delete from public.battle_states
  where room_id = any(expired_room_ids);

  update public.battle_rooms
  set status = 'waiting',
      host_user_id = null,
      host_deck_id = null,
      guest_user_id = null,
      guest_deck_id = null,
      disbanded_at = null,
      expires_at = null
  where room_id = any(expired_room_ids)
    and room_id in ('bf-room-1', 'bf-room-2');
  get diagnostics released_count = row_count;

  delete from public.battle_rooms
  where room_id = any(expired_room_ids)
    and room_id not in ('bf-room-1', 'bf-room-2');
  get diagnostics deleted_count = row_count;

  return released_count + deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_battle_rooms() from public;
grant execute on function public.cleanup_expired_battle_rooms() to authenticated;

commit;
