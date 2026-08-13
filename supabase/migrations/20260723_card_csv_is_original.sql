begin;

-- Baddie Phyto consolidated SQL for original-card support.
--
-- Use this file in Supabase SQL Editor when applying the current change.
-- It adds cards.is_original and updates CSV preview/import RPCs so CSV import
-- can preserve the original-card flag.
--
-- This file is safe to run even if 20260723_cards_is_original.sql was already
-- run, because the column and index use IF NOT EXISTS.

alter table public.cards
  add column if not exists is_original boolean not null default false;

create index if not exists cards_is_original_index
on public.cards (is_original);

create or replace function public.preview_baddie_phyto_card_csv(
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
  existing_set_id uuid;
  row_value jsonb;
  row_number integer;
  row_worlds text[];
  row_races text[];
  compare_worlds text[];
  compare_races text[];
  matched_card_id uuid;
  target_ability_id uuid;
  would_add_ability boolean;
  new_cards integer := 0;
  reused_cards integer := 0;
  printings_added integer := 0;
  duplicate_skipped integer := 0;
  ability_links_added integer := 0;
  row_results jsonb := '[]'::jsonb;
  db_errors jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_set_code), '') is null then
    raise exception 'set_code is required.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array.';
  end if;

  select id into existing_set_id
  from public.card_sets
  where set_code = trim(p_set_code)
  limit 1;

  for row_value in select * from jsonb_array_elements(p_rows)
  loop
    row_number := coalesce((row_value->>'rowNumber')::integer, 0);
    row_worlds := array(select jsonb_array_elements_text(coalesce(row_value->'worlds', '[]'::jsonb)));
    row_races := array(select jsonb_array_elements_text(coalesce(row_value->'races', '[]'::jsonb)));
    compare_worlds := array(
      select distinct value from unnest(row_worlds) as world_value(value) order by value
    );
    compare_races := array(
      select distinct value from unnest(row_races) as race_value(value) order by value
    );
    matched_card_id := null;
    target_ability_id := null;
    would_add_ability := false;

    if nullif(trim(coalesce(row_value->>'name', '')), '') is null then
      db_errors := db_errors || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number,
        'column', 'name',
        'message', 'name is required.'
      ));
      continue;
    end if;

    if (row_value->>'card_type') not in (
      'monster',
      'spell',
      'item',
      'impact',
      'impact_monster',
      'flag_card',
      'other'
    ) then
      db_errors := db_errors || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number,
        'column', 'card_type',
        'message', 'card_type is invalid.'
      ));
      continue;
    end if;

    if (row_value->>'orientation') not in ('vertical', 'horizontal', 'mixed') then
      db_errors := db_errors || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number,
        'column', 'orientation',
        'message', 'orientation is invalid.'
      ));
      continue;
    end if;

    if (row_value->>'card_type') in ('monster', 'impact_monster') then
      if nullif(row_value->>'size', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'size', 'message', 'size is required.'));
      end if;
      if nullif(row_value->>'power', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'power', 'message', 'power is required.'));
      end if;
      if nullif(row_value->>'defense', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'defense', 'message', 'defense is required.'));
      end if;
      if nullif(row_value->>'critical', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'critical', 'message', 'critical is required.'));
      end if;
    end if;

    if (row_value->>'card_type') = 'item' then
      if nullif(row_value->>'power', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'power', 'message', 'power is required.'));
      end if;
      if nullif(row_value->>'critical', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'critical', 'message', 'critical is required.'));
      end if;
    end if;

    if nullif(row_value->>'ability', '') is not null then
      select id into target_ability_id
      from public.abilities
      where behavior_key = row_value->>'ability'
        and is_active = true
      limit 1;

      if target_ability_id is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'column', 'ability',
          'message', format('behavior_key "%s" was not found.', row_value->>'ability')
        ));
        continue;
      end if;
    end if;

    select id into matched_card_id
    from public.cards as card
    where name = row_value->>'name'
      and card_type = row_value->>'card_type'
      and array(
        select distinct value from unnest(card.worlds) as world_value(value) order by value
      ) = compare_worlds
      and array(
        select distinct value from unnest(card.races) as race_value(value) order by value
      ) = compare_races
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
      and is_original = coalesce((row_value->>'is_original')::boolean, false)
      and is_active = (row_value->>'is_active')::boolean
    order by created_at
    limit 1;

    if matched_card_id is null then
      new_cards := new_cards + 1;
      if target_ability_id is not null then
        ability_links_added := ability_links_added + 1;
        would_add_ability := true;
      end if;

      row_results := row_results || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number,
        'status', 'new_card',
        'matchedCardId', null,
        'willAddPrinting', true,
        'willAddAbility', would_add_ability
      ));
      printings_added := printings_added + 1;
    else
      reused_cards := reused_cards + 1;

      if target_ability_id is not null and not exists (
        select 1
        from public.card_abilities
        where card_id = matched_card_id
          and ability_id = target_ability_id
      ) then
        ability_links_added := ability_links_added + 1;
        would_add_ability := true;
      end if;

      if existing_set_id is not null and exists (
        select 1
        from public.card_printings
        where card_id = matched_card_id
          and set_id = existing_set_id
          and card_number is null
      ) then
        duplicate_skipped := duplicate_skipped + 1;
        row_results := row_results || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'status', 'duplicate_skip',
          'matchedCardId', matched_card_id,
          'willAddPrinting', false,
          'willAddAbility', would_add_ability
        ));
      else
        printings_added := printings_added + 1;
        row_results := row_results || jsonb_build_array(jsonb_build_object(
          'rowNumber', row_number,
          'status', 'existing_add_printing',
          'matchedCardId', matched_card_id,
          'willAddPrinting', true,
          'willAddAbility', would_add_ability
        ));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'newCards', new_cards,
    'reusedCards', reused_cards,
    'printingsAdded', printings_added,
    'duplicateSkipped', duplicate_skipped,
    'abilityLinksAdded', ability_links_added,
    'errorCount', jsonb_array_length(db_errors),
    'errors', db_errors,
    'rows', row_results
  );
end;
$$;

revoke all on function public.preview_baddie_phyto_card_csv(text, text, jsonb) from public;
grant execute on function public.preview_baddie_phyto_card_csv(text, text, jsonb) to authenticated;

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
  compare_worlds text[];
  compare_races text[];
  matched_card_id uuid;
  imported_card_id uuid;
  ability_id uuid;
  inserted_card_ability_id uuid;
  new_cards integer := 0;
  reused_cards integer := 0;
  printings_added integer := 0;
  duplicate_skipped integer := 0;
  ability_links_added integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if nullif(trim(p_set_code), '') is null then
    raise exception 'set_code is required.';
  end if;

  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'rows must be an array.';
  end if;

  for row_value in select * from jsonb_array_elements(p_rows)
  loop
    row_number := coalesce((row_value->>'rowNumber')::integer, 0);

    if nullif(trim(coalesce(row_value->>'name', '')), '') is null then
      raise exception '%. name is required.', row_number;
    end if;

    if (row_value->>'card_type') not in (
      'monster',
      'spell',
      'item',
      'impact',
      'impact_monster',
      'flag_card',
      'other'
    ) then
      raise exception '%. card_type is invalid.', row_number;
    end if;

    if (row_value->>'orientation') not in ('vertical', 'horizontal', 'mixed') then
      raise exception '%. orientation is invalid.', row_number;
    end if;

    if nullif(row_value->>'ability', '') is not null and not exists (
      select 1
      from public.abilities
      where behavior_key = row_value->>'ability'
        and is_active = true
    ) then
      raise exception '%. ability behavior_key was not found: %', row_number, row_value->>'ability';
    end if;
  end loop;

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
    compare_worlds := array(
      select distinct value from unnest(row_worlds) as world_value(value) order by value
    );
    compare_races := array(
      select distinct value from unnest(row_races) as race_value(value) order by value
    );
    matched_card_id := null;
    imported_card_id := null;
    ability_id := null;
    inserted_card_ability_id := null;

    if nullif(row_value->>'ability', '') is not null then
      select id into ability_id
      from public.abilities
      where behavior_key = row_value->>'ability'
        and is_active = true
      limit 1;
    end if;

    select id into matched_card_id
    from public.cards as card
    where name = row_value->>'name'
      and card_type = row_value->>'card_type'
      and array(
        select distinct value from unnest(card.worlds) as world_value(value) order by value
      ) = compare_worlds
      and array(
        select distinct value from unnest(card.races) as race_value(value) order by value
      ) = compare_races
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
      and is_original = coalesce((row_value->>'is_original')::boolean, false)
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
        is_original,
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
        coalesce((row_value->>'is_original')::boolean, false),
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
      on conflict (card_id, ability_id) do nothing
      returning id into inserted_card_ability_id;

      if inserted_card_ability_id is not null then
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
    'errorCount', 0,
    'errors', '[]'::jsonb
  );
end;
$$;

revoke all on function public.import_baddie_phyto_card_csv(text, text, jsonb) from public;
grant execute on function public.import_baddie_phyto_card_csv(text, text, jsonb) to authenticated;

commit;
