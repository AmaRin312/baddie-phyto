begin;

create table if not exists public.site_update_announcements (
  id boolean primary key default true check (id = true),
  announcement_id uuid,
  announced_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.site_update_announcements
  add column if not exists announcement_id uuid,
  add column if not exists announced_at timestamptz;

insert into public.site_update_announcements (id)
values (true)
on conflict (id) do nothing;

alter table public.site_update_announcements enable row level security;

drop policy if exists "anyone can read site update announcement"
on public.site_update_announcements;
create policy "anyone can read site update announcement"
on public.site_update_announcements for select
to anon, authenticated using (true);

drop policy if exists "admins can update site update announcement"
on public.site_update_announcements;
create policy "admins can update site update announcement"
on public.site_update_announcements for update
to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

grant select on public.site_update_announcements to anon, authenticated;
grant update on public.site_update_announcements to authenticated;

commit;
