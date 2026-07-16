create table if not exists public.battle_states (
  id uuid primary key default gen_random_uuid(),
  room_id text not null unique,
  battle_state jsonb not null,
  version integer not null default 0,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.battle_states enable row level security;

drop policy if exists "authenticated users can read battle states"
on public.battle_states;
create policy "authenticated users can read battle states"
on public.battle_states
for select
to authenticated
using (true);

drop policy if exists "authenticated users can insert battle states"
on public.battle_states;
create policy "authenticated users can insert battle states"
on public.battle_states
for insert
to authenticated
with check (true);

drop policy if exists "authenticated users can update battle states"
on public.battle_states;
create policy "authenticated users can update battle states"
on public.battle_states
for update
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated users can delete battle states"
on public.battle_states;
create policy "authenticated users can delete battle states"
on public.battle_states
for delete
to authenticated
using (true);

create index if not exists battle_states_room_id_idx
on public.battle_states(room_id);

create or replace function public.set_battle_states_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_states_updated_at
on public.battle_states;
create trigger set_battle_states_updated_at
before update on public.battle_states
for each row
execute function public.set_battle_states_updated_at();
