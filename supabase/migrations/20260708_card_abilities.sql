create table if not exists public.card_abilities (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  ability_id uuid not null references public.abilities(id) on delete cascade,
  params jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, ability_id)
);

create index if not exists abilities_active_index on public.abilities (is_active);
create index if not exists card_abilities_card_id_index on public.card_abilities (card_id);
create index if not exists card_abilities_ability_id_index on public.card_abilities (ability_id);
create index if not exists card_abilities_sort_order_index on public.card_abilities (card_id, sort_order);

drop trigger if exists card_abilities_set_updated_at on public.card_abilities;
create trigger card_abilities_set_updated_at
before update on public.card_abilities
for each row execute function public.set_updated_at();

alter table public.card_abilities enable row level security;

drop policy if exists "authenticated users can read card abilities" on public.card_abilities;
create policy "authenticated users can read card abilities"
on public.card_abilities for select to authenticated using (true);

drop policy if exists "authenticated users can insert card abilities" on public.card_abilities;
create policy "authenticated users can insert card abilities"
on public.card_abilities for insert to authenticated with check (true);

drop policy if exists "authenticated users can update card abilities" on public.card_abilities;
create policy "authenticated users can update card abilities"
on public.card_abilities for update to authenticated using (true) with check (true);

drop policy if exists "authenticated users can delete card abilities" on public.card_abilities;
create policy "authenticated users can delete card abilities"
on public.card_abilities for delete to authenticated using (true);

grant select, insert, update, delete on public.card_abilities to authenticated;
