-- Allow catalog Ability records that are descriptive only and have no battle behavior.
alter table public.abilities
  alter column behavior_key drop not null;

-- Older deployments may have card_abilities without the columns expected by the editor.
alter table public.card_abilities
  add column if not exists params jsonb not null default '{}'::jsonb;

alter table public.card_abilities
  add column if not exists sort_order integer not null default 0;

create index if not exists card_abilities_sort_order_index
  on public.card_abilities (card_id, sort_order);

grant insert on public.abilities to authenticated;

drop policy if exists "admins can create abilities" on public.abilities;
create policy "admins can create abilities"
on public.abilities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.is_admin = true
  )
);
