begin;

alter table public.battle_rooms
  add column if not exists host_last_activity_at timestamptz,
  add column if not exists guest_last_activity_at timestamptz;

update public.battle_rooms
set host_last_activity_at = coalesce(host_last_activity_at, host_last_seen_at, now()),
    guest_last_activity_at = coalesce(guest_last_activity_at, guest_last_seen_at, now())
where status in ('waiting', 'playing');

insert into public.battle_rooms (room_id, name, status)
values
  ('bf-room-3', '対戦ルーム3', 'waiting'),
  ('bf-room-4', '対戦ルーム4', 'waiting'),
  ('bf-room-5', '対戦ルーム5', 'waiting')
on conflict (room_id) do nothing;

create or replace function public.leave_battle_room(
  p_room_id text,
  p_seat_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  released_room_id text;
begin
  if current_user_id is null or p_seat_key not in ('player1', 'player2') then
    return false;
  end if;

  if p_seat_key = 'player1' then
    update public.battle_rooms
    set status = 'waiting',
        host_user_id = null,
        host_deck_id = null,
        host_last_seen_at = null,
        host_last_activity_at = null
    where room_id = p_room_id
      and host_user_id = current_user_id
      and status <> 'disbanded'
    returning room_id into released_room_id;
  else
    update public.battle_rooms
    set status = 'waiting',
        guest_user_id = null,
        guest_deck_id = null,
        guest_last_seen_at = null,
        guest_last_activity_at = null
    where room_id = p_room_id
      and guest_user_id = current_user_id
      and status <> 'disbanded'
    returning room_id into released_room_id;
  end if;

  if released_room_id is null then
    return false;
  end if;

  delete from public.battle_player_states
  where room_id = p_room_id and seat_key = p_seat_key;

  if not exists (
    select 1 from public.battle_rooms
    where room_id = p_room_id
      and (host_user_id is not null or guest_user_id is not null)
  ) then
    delete from public.battle_player_states where room_id = p_room_id;
    delete from public.battle_states where room_id = p_room_id;
  end if;

  return true;
end;
$$;

revoke all on function public.leave_battle_room(text, text) from public;
grant execute on function public.leave_battle_room(text, text) to authenticated;

create or replace function public.cleanup_expired_battle_rooms()
returns integer
language plpgsql
security definer
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
          when host_user_id is not null and (
            coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else host_user_id end,
        host_deck_id = case
          when host_user_id is not null and (
            coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else host_deck_id end,
        host_last_seen_at = case
          when host_user_id is not null and (
            coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else host_last_seen_at end,
        host_last_activity_at = case
          when host_user_id is not null and (
            coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else host_last_activity_at end,
        guest_user_id = case
          when guest_user_id is not null and (
            coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else guest_user_id end,
        guest_deck_id = case
          when guest_user_id is not null and (
            coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else guest_deck_id end,
        guest_last_seen_at = case
          when guest_user_id is not null and (
            coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else guest_last_seen_at end,
        guest_last_activity_at = case
          when guest_user_id is not null and (
            coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
            or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
          ) then null else guest_last_activity_at end,
        status = case
          when (host_user_id is not null and (
                 coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
                 or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
               ))
            or (guest_user_id is not null and (
                 coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
                 or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
               ))
          then 'waiting' else status end
    where status in ('waiting', 'playing')
      and (
        (host_user_id is not null and (
          coalesce(host_last_seen_at, updated_at) < now() - interval '2 minutes'
          or coalesce(host_last_activity_at, host_last_seen_at, updated_at) < now() - interval '1 hour'
        ))
        or (guest_user_id is not null and (
          coalesce(guest_last_seen_at, updated_at) < now() - interval '2 minutes'
          or coalesce(guest_last_activity_at, guest_last_seen_at, updated_at) < now() - interval '1 hour'
        ))
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

    delete from public.battle_states state
    using public.battle_rooms room
    where state.room_id = room.room_id
      and room.room_id = any(stale_room_ids)
      and room.host_user_id is null
      and room.guest_user_id is null;
  end if;

  select coalesce(array_agg(room_id), array[]::text[])
  into expired_room_ids
  from public.battle_rooms
  where status = 'disbanded'
    and coalesce(expires_at, disbanded_at + interval '1 day') <= now();

  if cardinality(expired_room_ids) = 0 then
    return coalesce(cardinality(stale_room_ids), 0);
  end if;

  delete from public.battle_player_states where room_id = any(expired_room_ids);
  delete from public.battle_states where room_id = any(expired_room_ids);

  update public.battle_rooms
  set status = 'waiting',
      host_user_id = null,
      host_deck_id = null,
      host_last_seen_at = null,
      host_last_activity_at = null,
      guest_user_id = null,
      guest_deck_id = null,
      guest_last_seen_at = null,
      guest_last_activity_at = null,
      disbanded_at = null,
      expires_at = null
  where room_id = any(expired_room_ids)
    and room_id in ('bf-room-1', 'bf-room-2', 'bf-room-3', 'bf-room-4', 'bf-room-5');
  get diagnostics changed_count = row_count;

  delete from public.battle_rooms
  where room_id = any(expired_room_ids)
    and room_id not in ('bf-room-1', 'bf-room-2', 'bf-room-3', 'bf-room-4', 'bf-room-5');

  return coalesce(cardinality(stale_room_ids), 0) + changed_count;
end;
$$;

revoke all on function public.cleanup_expired_battle_rooms() from public;
grant execute on function public.cleanup_expired_battle_rooms() to authenticated;

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule(
  'cleanup-expired-battle-rooms',
  '* * * * *',
  'select public.cleanup_expired_battle_rooms();'
);

commit;
