begin;

create or replace function public.list_deck_section_page(
  p_section text,
  p_era_key text default null,
  p_flag_id uuid default null,
  p_page integer default 0,
  p_page_size integer default 30
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with visible_decks as (
    select deck.*
    from public.decks as deck
    where
      (
        (p_section = 'own'
          and deck.owner_id = (select auth.uid())
          and deck.deck_visibility not in ('default', 'public'))
        or (p_section = 'public' and deck.deck_visibility = 'public')
        or (p_section = 'default' and deck.deck_visibility = 'default')
      )
      and (p_era_key is null or deck.era_key = p_era_key)
      and (p_flag_id is null or deck.flag_id = p_flag_id)
      and not exists (
        select 1
        from public.list_decks_with_unavailable_cards() as unavailable
        where unavailable.deck_id = deck.id
      )
  ),
  page_rows as (
    select visible_decks.*
    from visible_decks
    order by visible_decks.updated_at desc, visible_decks.id desc
    limit least(greatest(coalesce(p_page_size, 30), 1), 100)
    offset least(greatest(coalesce(p_page, 0), 0), 1000000)
      * least(greatest(coalesce(p_page_size, 30), 1), 100)
  )
  select jsonb_build_object(
    'items', coalesce(
      (select jsonb_agg(to_jsonb(page_rows) order by page_rows.updated_at desc, page_rows.id desc) from page_rows),
      '[]'::jsonb
    ),
    'totalCount', (select count(*) from visible_decks)
  );
$$;

revoke all on function public.list_deck_section_page(text, text, uuid, integer, integer) from public;
grant execute on function public.list_deck_section_page(text, text, uuid, integer, integer) to authenticated;

commit;
