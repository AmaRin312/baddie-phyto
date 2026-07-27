begin;

insert into storage.buckets (id, name, public)
values ('battle-supplies', 'battle-supplies', true)
on conflict (id) do update
set public = excluded.public;

create table if not exists public.battle_supplies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  supply_type text not null,
  name text not null,
  image_path text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint battle_supplies_supply_type_check
    check (supply_type in ('sleeve', 'playmat'))
);

create table if not exists public.battle_supply_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sleeve_supply_id uuid references public.battle_supplies(id) on delete set null,
  playmat_supply_id uuid references public.battle_supplies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists battle_supplies_owner_type_index
on public.battle_supplies (owner_id, supply_type, is_active);

alter table public.battle_supplies enable row level security;
alter table public.battle_supply_settings enable row level security;

drop policy if exists "users can read own battle supplies"
on public.battle_supplies;
create policy "users can read own battle supplies"
on public.battle_supplies
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "users can insert own battle supplies"
on public.battle_supplies;
create policy "users can insert own battle supplies"
on public.battle_supplies
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "users can update own battle supplies"
on public.battle_supplies;
create policy "users can update own battle supplies"
on public.battle_supplies
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "users can delete own battle supplies"
on public.battle_supplies;
create policy "users can delete own battle supplies"
on public.battle_supplies
for delete
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "users can read own battle supply settings"
on public.battle_supply_settings;
create policy "users can read own battle supply settings"
on public.battle_supply_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "users can insert own battle supply settings"
on public.battle_supply_settings;
create policy "users can insert own battle supply settings"
on public.battle_supply_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update own battle supply settings"
on public.battle_supply_settings;
create policy "users can update own battle supply settings"
on public.battle_supply_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

grant select, insert, update, delete on public.battle_supplies to authenticated;
grant select, insert, update on public.battle_supply_settings to authenticated;

create or replace function public.validate_battle_supply_settings_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sleeve_supply_id is not null and not exists (
    select 1
    from public.battle_supplies
    where id = new.sleeve_supply_id
      and owner_id = new.user_id
      and supply_type = 'sleeve'
      and is_active = true
  ) then
    raise exception 'sleeve_supply_id is invalid.';
  end if;

  if new.playmat_supply_id is not null and not exists (
    select 1
    from public.battle_supplies
    where id = new.playmat_supply_id
      and owner_id = new.user_id
      and supply_type = 'playmat'
      and is_active = true
  ) then
    raise exception 'playmat_supply_id is invalid.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_battle_supply_settings_owner
on public.battle_supply_settings;
create trigger validate_battle_supply_settings_owner
before insert or update on public.battle_supply_settings
for each row
execute function public.validate_battle_supply_settings_owner();

drop policy if exists "public can read battle supply images"
on storage.objects;
create policy "public can read battle supply images"
on storage.objects
for select
to public
using (bucket_id = 'battle-supplies');

drop policy if exists "users can upload own battle supply images"
on storage.objects;
create policy "users can upload own battle supply images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'battle-supplies'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can update own battle supply images"
on storage.objects;
create policy "users can update own battle supply images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'battle-supplies'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'battle-supplies'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users can delete own battle supply images"
on storage.objects;
create policy "users can delete own battle supply images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'battle-supplies'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.set_battle_supplies_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_supplies_updated_at
on public.battle_supplies;
create trigger set_battle_supplies_updated_at
before update on public.battle_supplies
for each row
execute function public.set_battle_supplies_updated_at();

create or replace function public.set_battle_supply_settings_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_battle_supply_settings_updated_at
on public.battle_supply_settings;
create trigger set_battle_supply_settings_updated_at
before update on public.battle_supply_settings
for each row
execute function public.set_battle_supply_settings_updated_at();

commit;
