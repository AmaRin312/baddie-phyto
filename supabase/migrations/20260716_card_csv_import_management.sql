begin;

create table if not exists public.card_import_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  set_code text not null,
  csv_version text,
  total_row_count integer not null,
  excluded_duplicate_count integer not null default 0,
  new_card_count integer not null default 0,
  reused_card_count integer not null default 0,
  printing_added_count integer not null default 0,
  duplicate_skipped_count integer not null default 0,
  ability_linked_count integer not null default 0,
  status text not null,
  error_message text,
  created_at timestamptz not null default now(),
  constraint card_import_logs_status_check check (status in ('success', 'failed')),
  constraint card_import_logs_non_negative_counts check (
    total_row_count >= 0
    and excluded_duplicate_count >= 0
    and new_card_count >= 0
    and reused_card_count >= 0
    and printing_added_count >= 0
    and duplicate_skipped_count >= 0
    and ability_linked_count >= 0
  )
);

create index if not exists card_import_logs_created_at_index
on public.card_import_logs (created_at desc);

create index if not exists card_import_logs_set_code_index
on public.card_import_logs (set_code);

alter table public.card_import_logs enable row level security;

drop policy if exists "authenticated users can read card import logs"
on public.card_import_logs;
create policy "authenticated users can read card import logs"
on public.card_import_logs
for select
to authenticated
using (true);

drop policy if exists "authenticated users can insert own card import logs"
on public.card_import_logs;
create policy "authenticated users can insert own card import logs"
on public.card_import_logs
for insert
to authenticated
with check (auth.uid() = user_id);

grant select, insert on public.card_import_logs to authenticated;

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
        'message', '値が空です'
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
        'message', '許可されていない値です'
      ));
      continue;
    end if;

    if (row_value->>'orientation') not in ('vertical', 'horizontal', 'mixed') then
      db_errors := db_errors || jsonb_build_array(jsonb_build_object(
        'rowNumber', row_number,
        'column', 'orientation',
        'message', '許可されていない値です'
      ));
      continue;
    end if;

    if (row_value->>'card_type') in ('monster', 'impact_monster') then
      if nullif(row_value->>'size', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'size', 'message', 'sizeが必須です。'));
      end if;
      if nullif(row_value->>'power', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'power', 'message', 'powerが必須です。'));
      end if;
      if nullif(row_value->>'defense', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'defense', 'message', 'defenseが必須です。'));
      end if;
      if nullif(row_value->>'critical', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'critical', 'message', 'criticalが必須です。'));
      end if;
    end if;

    if (row_value->>'card_type') = 'item' then
      if nullif(row_value->>'power', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'power', 'message', 'powerが必須です。'));
      end if;
      if nullif(row_value->>'critical', '') is null then
        db_errors := db_errors || jsonb_build_array(jsonb_build_object('rowNumber', row_number, 'column', 'critical', 'message', 'criticalが必須です。'));
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
          'message', format('behavior_key "%s" が見つかりません', row_value->>'ability')
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

create or replace function public.create_card_import_log(
  p_file_name text,
  p_set_code text,
  p_csv_version text,
  p_total_row_count integer,
  p_excluded_duplicate_count integer,
  p_new_card_count integer,
  p_reused_card_count integer,
  p_printing_added_count integer,
  p_duplicate_skipped_count integer,
  p_ability_linked_count integer,
  p_status text,
  p_error_message text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  insert into public.card_import_logs (
    user_id,
    file_name,
    set_code,
    csv_version,
    total_row_count,
    excluded_duplicate_count,
    new_card_count,
    reused_card_count,
    printing_added_count,
    duplicate_skipped_count,
    ability_linked_count,
    status,
    error_message
  )
  values (
    auth.uid(),
    coalesce(nullif(trim(p_file_name), ''), 'unknown.csv'),
    coalesce(nullif(trim(p_set_code), ''), 'unknown'),
    nullif(trim(coalesce(p_csv_version, '')), ''),
    greatest(coalesce(p_total_row_count, 0), 0),
    greatest(coalesce(p_excluded_duplicate_count, 0), 0),
    greatest(coalesce(p_new_card_count, 0), 0),
    greatest(coalesce(p_reused_card_count, 0), 0),
    greatest(coalesce(p_printing_added_count, 0), 0),
    greatest(coalesce(p_duplicate_skipped_count, 0), 0),
    greatest(coalesce(p_ability_linked_count, 0), 0),
    p_status,
    case
      when p_error_message is null then null
      else left(p_error_message, 500)
    end
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

revoke all on function public.create_card_import_log(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
) from public;
grant execute on function public.create_card_import_log(
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  integer,
  text,
  text
) to authenticated;

commit;
