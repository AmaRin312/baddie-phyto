begin;

create table if not exists public.battle_rooms (
  id uuid primary key default gen_random_uuid(),
  room_id text not null unique,
  name text not null,
  status text not null default 'waiting',
  host_user_id uuid references auth.users(id) on delete set null,
  host_deck_id uuid references public.decks(id) on delete set null,
  guest_user_id uuid references auth.users(id) on delete set null,
  guest_deck_id uuid references public.decks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disbanded_at timestamptz,
  expires_at timestamptz,
  constraint battle_rooms_status_check
    check (status in ('waiting', 'playing', 'disbanded'))
);

create index if not exists battle_rooms_status_updated_at_idx
on public.battle_rooms (status, updated_at desc);

create index if not exists battle_rooms_expires_at_idx
on public.battle_rooms (expires_at)
where expires_at is not null;

alter table public.battle_rooms enable row level security;

drop policy if exists "authenticated users can read battle rooms"
on public.battle_rooms;
create policy "authenticated users can read battle rooms"
on public.battle_rooms
for select
to authenticated
using (true);

drop policy if exists "authenticated users can insert own battle rooms"
on public.battle_rooms;
create policy "authenticated users can insert own battle rooms"
on public.battle_rooms
for insert
to authenticated
with check (auth.uid() is not null and host_user_id = auth.uid());

drop policy if exists "authenticated users can update battle rooms"
on public.battle_rooms;
create policy "authenticated users can update battle rooms"
on public.battle_rooms
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists "authenticated users can delete battle rooms"
on public.battle_rooms;
create policy "authenticated users can delete battle rooms"
on public.battle_rooms
for delete
to authenticated
using (auth.uid() is not null);

grant select, insert, update, delete on public.battle_rooms to authenticated;

create or replace function public.set_battle_rooms_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_rooms_updated_at
on public.battle_rooms;
create trigger set_battle_rooms_updated_at
before update on public.battle_rooms
for each row
execute function public.set_battle_rooms_updated_at();

create or replace function public.cleanup_expired_battle_rooms()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  deleted_count integer := 0;
  expired_room_ids text[];
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

  delete from public.battle_rooms
  where room_id = any(expired_room_ids);

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_expired_battle_rooms() from public;
grant execute on function public.cleanup_expired_battle_rooms() to authenticated;

commit;
