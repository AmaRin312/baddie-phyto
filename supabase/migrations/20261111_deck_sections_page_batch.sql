begin;

create or replace function public.list_deck_sections_page(
  p_era_key text default null,
  p_flag_id uuid default null,
  p_own_page integer default 0,
  p_public_page integer default 0,
  p_default_page integer default 0,
  p_page_size integer default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with limits as (
    select
      least(greatest(coalesce(p_page_size, 30), 1), 100) as page_size,
      least(greatest(coalesce(p_own_page, 0), 0), 1000000) as own_page,
      least(greatest(coalesce(p_public_page, 0), 0), 1000000) as public_page,
      least(greatest(coalesce(p_default_page, 0), 0), 1000000) as default_page
  ),
  unavailable as materialized (
    select unavailable.deck_id
    from public.list_decks_with_unavailable_cards() as unavailable
  ),
  sectioned as (
    select 'own'::text as section, deck.*, limits.own_page as page_number
    from public.decks as deck
    cross join limits
    where deck.owner_id = (select auth.uid())
      and deck.deck_visibility not in ('default', 'public')
      and (p_era_key is null or deck.era_key = p_era_key)
      and (p_flag_id is null or deck.flag_id = p_flag_id)
      and not exists (select 1 from unavailable where unavailable.deck_id = deck.id)

    union all

    select 'public'::text as section, deck.*, limits.public_page as page_number
    from public.decks as deck
    cross join limits
    where deck.deck_visibility = 'public'
      and (p_era_key is null or deck.era_key = p_era_key)
      and (p_flag_id is null or deck.flag_id = p_flag_id)
      and not exists (select 1 from unavailable where unavailable.deck_id = deck.id)

    union all

    select 'default'::text as section, deck.*, limits.default_page as page_number
    from public.decks as deck
    cross join limits
    where deck.deck_visibility = 'default'
      and (p_era_key is null or deck.era_key = p_era_key)
      and (p_flag_id is null or deck.flag_id = p_flag_id)
      and not exists (select 1 from unavailable where unavailable.deck_id = deck.id)
  ),
  numbered as (
    select
      sectioned.*,
      row_number() over (
        partition by sectioned.section
        order by sectioned.updated_at desc, sectioned.id desc
      ) as row_number,
      count(*) over (partition by sectioned.section) as total_count
    from sectioned
  ),
  page_rows as (
    select numbered.*, limits.page_size
    from numbered
    cross join limits
    where numbered.row_number > numbered.page_number::bigint * limits.page_size
      and numbered.row_number <= (numbered.page_number::bigint + 1) * limits.page_size
  )
  select jsonb_build_object(
    'own', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          to_jsonb(page_rows) - 'section' - 'page_number' - 'row_number' - 'total_count' - 'page_size'
          order by page_rows.row_number
        )
        from page_rows where page_rows.section = 'own'
      ), '[]'::jsonb),
      'totalCount', coalesce((select max(total_count) from numbered where section = 'own'), 0)
    ),
    'public', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          to_jsonb(page_rows) - 'section' - 'page_number' - 'row_number' - 'total_count' - 'page_size'
          order by page_rows.row_number
        )
        from page_rows where page_rows.section = 'public'
      ), '[]'::jsonb),
      'totalCount', coalesce((select max(total_count) from numbered where section = 'public'), 0)
    ),
    'default', jsonb_build_object(
      'items', coalesce((
        select jsonb_agg(
          to_jsonb(page_rows) - 'section' - 'page_number' - 'row_number' - 'total_count' - 'page_size'
          order by page_rows.row_number
        )
        from page_rows where page_rows.section = 'default'
      ), '[]'::jsonb),
      'totalCount', coalesce((select max(total_count) from numbered where section = 'default'), 0)
    )
  );
$$;

revoke all on function public.list_deck_sections_page(text, uuid, integer, integer, integer, integer) from public;
grant execute on function public.list_deck_sections_page(text, uuid, integer, integer, integer, integer) to authenticated;

commit;
