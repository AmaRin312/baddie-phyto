begin;

alter table public.cards
  add column if not exists is_heaven boolean not null default false;

alter table public.cards
  add column if not exists is_hell boolean not null default false;

create index if not exists cards_is_heaven_index on public.cards (is_heaven);
create index if not exists cards_is_hell_index on public.cards (is_hell);

do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.cards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%card_type%'
  loop
    execute format('alter table public.cards drop constraint %I', constraint_record.conname);
  end loop;
end;
$$;

alter table public.cards
add constraint cards_card_type_check
check (card_type in (
  'monster',
  'spell',
  'item',
  'impact',
  'impact_monster',
  'flag_card',
  'other'
));

create table if not exists public.card_sets (
  id uuid primary key default gen_random_uuid(),
  set_code text not null unique,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_sets_set_code_not_blank check (char_length(trim(set_code)) > 0)
);

create table if not exists public.card_printings (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  set_id uuid not null references public.card_sets(id) on delete cascade,
  card_number text,
  rarity text,
  created_at timestamptz not null default now()
);

create unique index if not exists card_printings_card_set_no_number_unique
on public.card_printings (card_id, set_id)
where card_number is null;

create unique index if not exists card_printings_card_set_number_unique
on public.card_printings (card_id, set_id, card_number)
where card_number is not null;

create index if not exists card_printings_card_id_index on public.card_printings (card_id);
create index if not exists card_printings_set_id_index on public.card_printings (set_id);

drop trigger if exists card_sets_set_updated_at on public.card_sets;
create trigger card_sets_set_updated_at
before update on public.card_sets
for each row execute function public.set_updated_at();

alter table public.card_sets enable row level security;
alter table public.card_printings enable row level security;

drop policy if exists "authenticated users can read card sets" on public.card_sets;
create policy "authenticated users can read card sets"
on public.card_sets for select to authenticated using (true);

drop policy if exists "authenticated users can insert card sets" on public.card_sets;
create policy "authenticated users can insert card sets"
on public.card_sets for insert to authenticated with check (true);

drop policy if exists "authenticated users can update card sets" on public.card_sets;
create policy "authenticated users can update card sets"
on public.card_sets for update to authenticated using (true) with check (true);

drop policy if exists "authenticated users can delete card sets" on public.card_sets;
create policy "authenticated users can delete card sets"
on public.card_sets for delete to authenticated using (true);

drop policy if exists "authenticated users can read card printings" on public.card_printings;
create policy "authenticated users can read card printings"
on public.card_printings for select to authenticated using (true);

drop policy if exists "authenticated users can insert card printings" on public.card_printings;
create policy "authenticated users can insert card printings"
on public.card_printings for insert to authenticated with check (true);

drop policy if exists "authenticated users can update card printings" on public.card_printings;
create policy "authenticated users can update card printings"
on public.card_printings for update to authenticated using (true) with check (true);

drop policy if exists "authenticated users can delete card printings" on public.card_printings;
create policy "authenticated users can delete card printings"
on public.card_printings for delete to authenticated using (true);

grant select, insert, update, delete on public.card_sets to authenticated;
grant select, insert, update, delete on public.card_printings to authenticated;

create or replace function public.import_baddie_phyto_card_csv(
  p_set_code text,
  p_set_name text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_set_id uuid;
  row_value jsonb;
  row_number integer;
  row_worlds text[];
  row_races text[];
  matched_card_id uuid;
  imported_card_id uuid;
  ability_id uuid;
  new_cards integer := 0;
  reused_cards integer := 0;
  printings_added integer := 0;
  duplicate_skipped integer := 0;
  ability_links_added integer := 0;
  errors jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_set_code), '') is null then
    raise exception 'set_code is required.';
  end if;

  insert into public.card_sets (set_code, name)
  values (trim(p_set_code), nullif(trim(coalesce(p_set_name, p_set_code)), ''))
  on conflict (set_code) do update set
    name = coalesce(public.card_sets.name, excluded.name)
  returning id into target_set_id;

  for row_value in select * from jsonb_array_elements(p_rows)
  loop
    row_number := coalesce((row_value->>'rowNumber')::integer, 0);
    row_worlds := array(select jsonb_array_elements_text(coalesce(row_value->'worlds', '[]'::jsonb)));
    row_races := array(select jsonb_array_elements_text(coalesce(row_value->'races', '[]'::jsonb)));
    matched_card_id := null;
    imported_card_id := null;
    ability_id := null;

    if nullif(row_value->>'ability', '') is not null then
      select id into ability_id
      from public.abilities
      where behavior_key = row_value->>'ability'
        and is_active = true
      limit 1;

      if ability_id is null then
        errors := errors || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'column', 'ability',
          'message', format('behavior_key "%s" が見つかりません', row_value->>'ability')
        ));
        continue;
      end if;
    end if;

    select id into matched_card_id
    from public.cards
    where name = row_value->>'name'
      and card_type = row_value->>'card_type'
      and worlds = row_worlds
      and races = row_races
      and size is not distinct from nullif(row_value->>'size', '')::integer
      and power is not distinct from nullif(row_value->>'power', '')::integer
      and defense is not distinct from nullif(row_value->>'defense', '')::integer
      and critical is not distinct from nullif(row_value->>'critical', '')::integer
      and card_text is not distinct from nullif(row_value->>'card_text', '')
      and orientation = row_value->>'orientation'
      and is_dragon = (row_value->>'is_dragon')::boolean
      and is_hyakki = (row_value->>'is_hyakki')::boolean
      and is_corner_king = (row_value->>'is_corner_king')::boolean
      and is_chaos = (row_value->>'is_chaos')::boolean
      and is_generic = (row_value->>'is_generic')::boolean
      and is_heaven = (row_value->>'is_heaven')::boolean
      and is_hell = (row_value->>'is_hell')::boolean
      and is_active = (row_value->>'is_active')::boolean
    order by created_at
    limit 1;

    if matched_card_id is null then
      insert into public.cards (
        name,
        worlds,
        races,
        orientation,
        size,
        power,
        defense,
        critical,
        card_text,
        card_type,
        is_dragon,
        is_hyakki,
        is_corner_king,
        is_chaos,
        is_generic,
        is_heaven,
        is_hell,
        is_active
      )
      values (
        row_value->>'name',
        row_worlds,
        row_races,
        row_value->>'orientation',
        nullif(row_value->>'size', '')::integer,
        nullif(row_value->>'power', '')::integer,
        nullif(row_value->>'defense', '')::integer,
        nullif(row_value->>'critical', '')::integer,
        nullif(row_value->>'card_text', ''),
        row_value->>'card_type',
        (row_value->>'is_dragon')::boolean,
        (row_value->>'is_hyakki')::boolean,
        (row_value->>'is_corner_king')::boolean,
        (row_value->>'is_chaos')::boolean,
        (row_value->>'is_generic')::boolean,
        (row_value->>'is_heaven')::boolean,
        (row_value->>'is_hell')::boolean,
        (row_value->>'is_active')::boolean
      )
      returning id into imported_card_id;
      new_cards := new_cards + 1;
    else
      imported_card_id := matched_card_id;
      reused_cards := reused_cards + 1;
    end if;

    if ability_id is not null then
      insert into public.card_abilities (card_id, ability_id, params, sort_order)
      values (imported_card_id, ability_id, '{}'::jsonb, 0)
      on conflict (card_id, ability_id) do nothing;

      if found then
        ability_links_added := ability_links_added + 1;
      end if;
    end if;

    if exists (
      select 1
      from public.card_printings
      where card_id = imported_card_id
        and set_id = target_set_id
        and card_number is null
    ) then
      duplicate_skipped := duplicate_skipped + 1;
    else
      insert into public.card_printings (card_id, set_id, card_number, rarity)
      values (imported_card_id, target_set_id, null, null);
      printings_added := printings_added + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'newCards', new_cards,
    'reusedCards', reused_cards,
    'printingsAdded', printings_added,
    'duplicateSkipped', duplicate_skipped,
    'abilityLinksAdded', ability_links_added,
    'errorCount', jsonb_array_length(errors),
    'errors', errors
  );
end;
$$;

revoke all on function public.import_baddie_phyto_card_csv(text, text, jsonb) from public;
grant execute on function public.import_baddie_phyto_card_csv(text, text, jsonb) to authenticated;

commit;
