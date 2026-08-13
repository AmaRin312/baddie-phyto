begin;

-- Baddie Phyto Realtime player-state storage.
-- DB keys must be fixed seats (player1/player2), not client-perspective keys
-- (self/opponent). If a previous experimental migration created player_key
-- rows, those rows cannot be safely converted without knowing the actual seat.

do $$
declare
  has_legacy_player_key boolean;
  legacy_row_count integer;
begin
  if to_regclass('public.battle_player_states') is null then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'battle_player_states'
      and column_name = 'player_key'
  )
  into has_legacy_player_key;

  if not has_legacy_player_key then
    return;
  end if;

  execute 'select count(*) from public.battle_player_states'
  into legacy_row_count;

  if legacy_row_count > 0 then
    raise exception
      'battle_player_states contains legacy player_key rows. Stop here and inspect rows before migrating because self/opponent cannot be converted to player1/player2 automatically.';
  end if;

  -- Safe only when the legacy table has no rows.
  drop table public.battle_player_states;
end;
$$;

create table if not exists public.battle_player_states (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  seat_key text not null,
  owner_id uuid references auth.users(id) on delete set null,
  state jsonb not null,
  version integer not null default 0,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.battle_player_states
  add column if not exists seat_key text,
  add column if not exists owner_id uuid references auth.users(id) on delete set null,
  add column if not exists state jsonb,
  add column if not exists version integer not null default 0,
  add column if not exists updated_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.battle_player_states
  alter column room_id set not null,
  alter column seat_key set not null,
  alter column state set not null,
  alter column version set default 0,
  alter column version set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.battle_player_states'::regclass
      and conname = 'battle_player_states_player_key_check'
  ) then
    alter table public.battle_player_states
      drop constraint battle_player_states_player_key_check;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.battle_player_states'::regclass
      and conname = 'battle_player_states_seat_key_check'
  ) then
    alter table public.battle_player_states
      add constraint battle_player_states_seat_key_check
      check (seat_key in ('player1', 'player2'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.battle_player_states'::regclass
      and conname = 'battle_player_states_version_non_negative_check'
  ) then
    alter table public.battle_player_states
      add constraint battle_player_states_version_non_negative_check
      check (version >= 0);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.battle_player_states'::regclass
      and conname = 'battle_player_states_room_player_unique'
  ) then
    alter table public.battle_player_states
      drop constraint battle_player_states_room_player_unique;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.battle_player_states'::regclass
      and conname = 'battle_player_states_room_seat_unique'
  ) then
    alter table public.battle_player_states
      add constraint battle_player_states_room_seat_unique
      unique (room_id, seat_key);
  end if;
end;
$$;

drop index if exists public.battle_player_states_room_player_version_idx;

create index if not exists battle_player_states_room_id_idx
on public.battle_player_states (room_id);

create index if not exists battle_player_states_room_seat_version_idx
on public.battle_player_states (room_id, seat_key, version);

alter table public.battle_player_states enable row level security;

drop policy if exists "authenticated users can read battle player states"
on public.battle_player_states;
create policy "authenticated users can read battle player states"
on public.battle_player_states
for select
to authenticated
using (true);

drop policy if exists "authenticated users can insert battle player states"
on public.battle_player_states;
create policy "authenticated users can insert battle player states"
on public.battle_player_states
for insert
to authenticated
with check (auth.uid() is not null and updated_by = auth.uid());

drop policy if exists "authenticated users can update own keyed battle player states"
on public.battle_player_states;
create policy "authenticated users can update own keyed battle player states"
on public.battle_player_states
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null and updated_by = auth.uid());

drop policy if exists "authenticated users can delete battle player states"
on public.battle_player_states;
create policy "authenticated users can delete battle player states"
on public.battle_player_states
for delete
to authenticated
using (auth.uid() is not null);

grant select, insert, update, delete on public.battle_player_states to authenticated;

comment on table public.battle_player_states is
  'Baddie Phyto fixed-seat PlayerState storage. Future migration should restrict access by battle_room_players/participants.';
comment on column public.battle_player_states.seat_key is
  'Fixed room seat: player1 or player2. Never stores client-perspective self/opponent.';

create or replace function public.set_battle_player_states_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_player_states_updated_at
on public.battle_player_states;
create trigger set_battle_player_states_updated_at
before update on public.battle_player_states
for each row
execute function public.set_battle_player_states_updated_at();

drop function if exists public.save_battle_player_state(text, text, jsonb, integer);

create function public.save_battle_player_state(
  p_room_id text,
  p_seat_key text,
  p_state jsonb,
  p_expected_version integer
)
returns table (
  room_id text,
  seat_key text,
  owner_id uuid,
  state jsonb,
  version integer,
  updated_by uuid,
  updated_at timestamptz
)
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
    returning
      public.battle_player_states.room_id,
      public.battle_player_states.seat_key,
      public.battle_player_states.owner_id,
      public.battle_player_states.state,
      public.battle_player_states.version,
      public.battle_player_states.updated_by,
      public.battle_player_states.updated_at
    into
      room_id,
      seat_key,
      owner_id,
      state,
      version,
      updated_by,
      updated_at;

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
  returning
    battle_player_state.room_id,
    battle_player_state.seat_key,
    battle_player_state.owner_id,
    battle_player_state.state,
    battle_player_state.version,
    battle_player_state.updated_by,
    battle_player_state.updated_at
  into
    room_id,
    seat_key,
    owner_id,
    state,
    version,
    updated_by,
    updated_at;

  return next;
end;
$$;

revoke all on function public.save_battle_player_state(text, text, jsonb, integer)
from public;
grant execute on function public.save_battle_player_state(text, text, jsonb, integer)
to authenticated;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  )
  and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'battle_player_states'
  ) then
    alter publication supabase_realtime add table public.battle_player_states;
  end if;
end;
$$;

commit;
