begin;

create table if not exists public.battle_ability_notifications (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  ability_key text not null,
  source_seat_key text not null,
  target_seat_key text not null,
  source_instance_id text not null,
  target_instance_id text not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint battle_ability_notifications_ability_key_check
    check (ability_key in ('biri_kinata_face_down_use')),
  constraint battle_ability_notifications_source_seat_key_check
    check (source_seat_key in ('player1', 'player2')),
  constraint battle_ability_notifications_target_seat_key_check
    check (target_seat_key in ('player1', 'player2')),
  constraint battle_ability_notifications_status_check
    check (status in ('pending', 'resolved', 'cancelled')),
  constraint battle_ability_notifications_different_seats_check
    check (source_seat_key <> target_seat_key)
);

create index if not exists battle_ability_notifications_room_target_status_idx
on public.battle_ability_notifications (room_id, target_seat_key, status, created_at);

create index if not exists battle_ability_notifications_room_status_idx
on public.battle_ability_notifications (room_id, status, created_at);

alter table public.battle_ability_notifications enable row level security;

drop policy if exists "authenticated users can read battle ability notifications"
on public.battle_ability_notifications;
create policy "authenticated users can read battle ability notifications"
on public.battle_ability_notifications
for select
to authenticated
using (true);

drop policy if exists "authenticated users can create battle ability notifications"
on public.battle_ability_notifications;
create policy "authenticated users can create battle ability notifications"
on public.battle_ability_notifications
for insert
to authenticated
with check (auth.uid() is not null and created_by = auth.uid());

drop policy if exists "authenticated users can update battle ability notifications"
on public.battle_ability_notifications;
create policy "authenticated users can update battle ability notifications"
on public.battle_ability_notifications
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

grant select, insert, update on public.battle_ability_notifications to authenticated;

create or replace function public.set_battle_ability_notifications_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_ability_notifications_updated_at
on public.battle_ability_notifications;
create trigger set_battle_ability_notifications_updated_at
before update on public.battle_ability_notifications
for each row
execute function public.set_battle_ability_notifications_updated_at();

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
      and tablename = 'battle_ability_notifications'
  ) then
    alter publication supabase_realtime add table public.battle_ability_notifications;
  end if;
end;
$$;

commit;
