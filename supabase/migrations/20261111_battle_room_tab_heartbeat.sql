begin;

alter table public.battle_rooms
  add column if not exists host_last_seen_at timestamptz,
  add column if not exists guest_last_seen_at timestamptz;

update public.battle_rooms
set host_last_seen_at = case when host_user_id is not null then now() else null end,
    guest_last_seen_at = case when guest_user_id is not null then now() else null end
where status in ('waiting', 'playing');

create or replace function public.cleanup_expired_battle_rooms()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  stale_room_ids text[];
  expired_room_ids text[];
  changed_count integer := 0;
begin
  with stale_rooms as (
    update public.battle_rooms
    set host_user_id = case
          when host_user_id is not null
            and coalesce(host_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else host_user_id end,
        host_deck_id = case
          when host_user_id is not null
            and coalesce(host_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else host_deck_id end,
        host_last_seen_at = case
          when host_user_id is not null
            and coalesce(host_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else host_last_seen_at end,
        guest_user_id = case
          when guest_user_id is not null
            and coalesce(guest_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else guest_user_id end,
        guest_deck_id = case
          when guest_user_id is not null
            and coalesce(guest_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else guest_deck_id end,
        guest_last_seen_at = case
          when guest_user_id is not null
            and coalesce(guest_last_seen_at, updated_at) < now() - interval '3 minutes'
          then null else guest_last_seen_at end,
        status = 'waiting'
    where status in ('waiting', 'playing')
      and (
        (host_user_id is not null
          and coalesce(host_last_seen_at, updated_at) < now() - interval '3 minutes')
        or
        (guest_user_id is not null
          and coalesce(guest_last_seen_at, updated_at) < now() - interval '3 minutes')
      )
    returning room_id
  )
  select coalesce(array_agg(distinct room_id), array[]::text[])
  into stale_room_ids
  from stale_rooms;

  if cardinality(stale_room_ids) > 0 then
    delete from public.battle_player_states state
    using public.battle_rooms room
    where state.room_id = room.room_id
      and room.room_id = any(stale_room_ids)
      and (
        (state.seat_key = 'player1' and room.host_user_id is null)
        or (state.seat_key = 'player2' and room.guest_user_id is null)
      );

    delete from public.battle_states
    where room_id = any(stale_room_ids);
    get diagnostics changed_count = row_count;
  end if;

  select coalesce(array_agg(room_id), array[]::text[])
  into expired_room_ids
  from public.battle_rooms
  where status = 'disbanded'
    and coalesce(expires_at, disbanded_at + interval '1 day') <= now();

  if cardinality(expired_room_ids) = 0 then
    return changed_count;
  end if;

  delete from public.battle_player_states
  where room_id = any(expired_room_ids);

  delete from public.battle_states
  where room_id = any(expired_room_ids);

  update public.battle_rooms
  set status = 'waiting',
      host_user_id = null,
      host_deck_id = null,
      host_last_seen_at = null,
      guest_user_id = null,
      guest_deck_id = null,
      guest_last_seen_at = null,
      disbanded_at = null,
      expires_at = null
  where room_id = any(expired_room_ids)
    and room_id in ('bf-room-1', 'bf-room-2');
  get diagnostics changed_count = row_count;

  delete from public.battle_rooms
  where room_id = any(expired_room_ids)
    and room_id not in ('bf-room-1', 'bf-room-2');
  get diagnostics changed_count = row_count;

  return changed_count;
end;
$$;

revoke all on function public.cleanup_expired_battle_rooms() from public;
grant execute on function public.cleanup_expired_battle_rooms() to authenticated;

commit;
