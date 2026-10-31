begin;

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create table if not exists public.site_supply_settings (
  id boolean primary key default true check (id = true),
  sleeve_supply_id uuid references public.battle_supplies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.site_supply_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.site_supply_settings enable row level security;

drop policy if exists "authenticated users can read site supply settings"
on public.site_supply_settings;
create policy "authenticated users can read site supply settings"
on public.site_supply_settings
for select
to authenticated
using (true);

drop policy if exists "admins can insert site supply settings"
on public.site_supply_settings;
create policy "admins can insert site supply settings"
on public.site_supply_settings
for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

drop policy if exists "admins can update site supply settings"
on public.site_supply_settings;
create policy "admins can update site supply settings"
on public.site_supply_settings
for update
to authenticated
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.is_admin = true
  )
);

grant select, insert, update on public.site_supply_settings to authenticated;

drop trigger if exists set_site_supply_settings_updated_at
on public.site_supply_settings;
create trigger set_site_supply_settings_updated_at
before update on public.site_supply_settings
for each row
execute function public.set_updated_at();

commit;
