create table if not exists public.baddie_phyto_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  shortcut_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.baddie_phyto_user_settings enable row level security;

drop policy if exists "baddie_phyto_user_settings_select_own"
on public.baddie_phyto_user_settings;
create policy "baddie_phyto_user_settings_select_own"
on public.baddie_phyto_user_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "baddie_phyto_user_settings_insert_own"
on public.baddie_phyto_user_settings;
create policy "baddie_phyto_user_settings_insert_own"
on public.baddie_phyto_user_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "baddie_phyto_user_settings_update_own"
on public.baddie_phyto_user_settings;
create policy "baddie_phyto_user_settings_update_own"
on public.baddie_phyto_user_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.set_baddie_phyto_user_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_baddie_phyto_user_settings_updated_at
on public.baddie_phyto_user_settings;
create trigger set_baddie_phyto_user_settings_updated_at
before update on public.baddie_phyto_user_settings
for each row
execute function public.set_baddie_phyto_user_settings_updated_at();
